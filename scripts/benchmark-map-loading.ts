import { chromium } from '@playwright/test';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';

// Run against a standalone Vite server: no API or saved world is needed.
// npx tsx scripts/benchmark-map-loading.ts --url=http://127.0.0.1:5187
// Repeat the same command with --after after the implementation changes.
const argument = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const url = new URL(
  argument('url', process.env.AFTERMARKET_MAP_BENCH_URL ?? 'http://127.0.0.1:5186'),
);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw new Error('Use um servidor Vite local isolado para esta medição.');
const count = Number(argument('count', '4000'));
if (!Number.isInteger(count) || count < 100 || count > 10000)
  throw new Error('Use --count=100 até 10000.');
const phase = process.argv.includes('--after') ? 'after' : 'before';
const output = resolve('test-results/map-loading', `${phase}.json`);
const sourceDirectory = resolve('apps/web/src/lib');
const sourceFiles = readdirSync(sourceDirectory)
  .filter((name) =>
    /^(pixel-buildings|pixel-building-shaders|pixel-basemap|map-performance)/.test(name),
  )
  .sort();
const sourceHashes = Object.fromEntries(
  sourceFiles.map((name) => [
    name,
    createHash('sha256')
      .update(readFileSync(resolve(sourceDirectory, name)))
      .digest('hex'),
  ]),
);

// Center the synthetic field inside one canonical z14 tile, avoiding split-edge
// duplicates. Rectangles are a workload fixture, never geographic observations.
const n = 2 ** 14;
const tileX = Math.floor(((-47.064757 + 180) / 360) * n);
const latitude = (-22.904734 * Math.PI) / 180;
const tileY = Math.floor(((1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2) * n);
const center: [number, number] = [
  ((tileX + 0.5) / n) * 360 - 180,
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 0.5)) / n))) * 180) / Math.PI,
];
const metresPerDegree = 111320;
const longitudeScale = metresPerDegree * Math.cos((center[1] * Math.PI) / 180);
const columns = 80;
const rows = Math.ceil(count / columns);
const point = (x: number, y: number): [number, number] => [
  center[0] + x / longitudeScale,
  center[1] + y / metresPerDegree,
];
const scene = {
  type: 'FeatureCollection' as const,
  features: Array.from({ length: count }, (_, index) => {
    const x = ((index % columns) - columns / 2) * 12;
    const y = (Math.floor(index / columns) - rows / 2) * 12;
    return {
      type: 'Feature' as const,
      id: index + 1,
      properties: { render_height: index % 3 ? 6 + (index % 5) * 2 : 18 + (index % 7) * 4 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [point(x, y), point(x + 8, y), point(x + 8, y + 7), point(x, y + 7), point(x, y)],
        ],
      },
    };
  }),
};
type BenchmarkState = {
  started: number;
  gaps: number[];
  longTasks: { startTime: number; duration: number }[];
  longTasksSupported: boolean;
  previous: number;
  timer: ReturnType<typeof setInterval>;
  observer: PerformanceObserver | null;
  previousProfile: Record<string, number>;
};
type BenchmarkWindow = Window & {
  aftermarketMap: LibreMap;
  aftermarketBasemap: LibreMap;
  mapLoadingBenchmark: BenchmarkState;
};
const world = createWorld(Date.UTC(2026, 9, 30, 12));
const errors: string[] = [];
const unexpectedApi: string[] = [];
const blockedExternal: string[] = [];
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
  headless: true,
});
let measurement: unknown = null;
let failure: string | null = null;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const request = new URL(route.request().url());
    if (request.pathname === '/api/world') return route.fulfill({ json: world });
    if (request.pathname.startsWith('/api/')) {
      unexpectedApi.push(`${route.request().method()} ${request.pathname}`);
      return route.fulfill({
        status: 503,
        json: { error: 'API bloqueada nesta medição isolada.' },
      });
    }
    if (request.pathname === '/__map-loading/empty.pbf')
      return route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
    if (request.hostname === 'tiles.openfreemap.org')
      return route.fulfill({
        json: {
          tilejson: '3.0.0',
          tiles: [`${url.origin}/__map-loading/empty.pbf?z={z}&x={x}&y={y}`],
          minzoom: 0,
          maxzoom: 14,
          vector_layers: [
            'landuse',
            'landcover',
            'water',
            'waterway',
            'boundary',
            'transportation',
            'building',
          ].map((id) => ({ id, fields: {} })),
        },
      });
    if (request.origin !== url.origin && request.protocol.startsWith('http')) {
      blockedExternal.push(request.origin);
      return route.fulfill({ status: 200, body: '' });
    }
    return route.continue();
  });
  // tsx keeps function names with this helper when serializing page.evaluate.
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  await page.addInitScript((seasonId) => {
    localStorage.clear();
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem('aftermarket.firstSteps', 'closed');
    localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
  }, world.season.id);
  await page.goto(new URL('/jogar', url).href);
  await page.locator('.main-map .world-map[data-map-ready="true"]').waitFor({ timeout: 45000 });
  await page.evaluate(
    ({ scene, center }) => {
      const target = window as unknown as BenchmarkWindow;
      const { aftermarketMap: main, aftermarketBasemap: base } = target;
      const started = performance.now();
      const state: BenchmarkState = {
        started,
        previous: started,
        gaps: [],
        longTasks: [],
        observer: null,
        longTasksSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
        previousProfile: JSON.parse(base.getCanvas().dataset.buildingProfile ?? '{}'),
        timer: 0 as unknown as ReturnType<typeof setInterval>,
      };
      if (state.longTasksSupported) {
        state.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.startTime >= state.started)
              state.longTasks.push({
                startTime: entry.startTime - state.started,
                duration: entry.duration,
              });
        });
        state.observer.observe({ type: 'longtask' });
      }
      state.timer = setInterval(() => {
        const now = performance.now();
        state.gaps.push(now - state.previous);
        state.previous = now;
      }, 20);
      target.mapLoadingBenchmark = state;
      for (const layer of base.getStyle().layers)
        if ('source' in layer && layer.source === 'openmaptiles') base.removeLayer(layer.id);
      base.removeSource('openmaptiles');
      base.addSource('openmaptiles', { type: 'geojson', data: scene, maxzoom: 14, buffer: 0 });
      base.addLayer({
        id: 'loading-benchmark-source',
        type: 'fill',
        source: 'openmaptiles',
        paint: { 'fill-opacity': 0 },
      });
      main.jumpTo({
        center,
        zoom: 16,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    },
    { scene, center },
  );
  await page.waitForFunction(
    (count) => {
      const base = (window as unknown as BenchmarkWindow).aftermarketBasemap;
      const profile = JSON.parse(base.getCanvas().dataset.buildingProfile ?? '{}');
      return (
        Number(base.getCanvas().dataset.detailedBuildings ?? 0) >= count && profile.uploadCount > 0
      );
    },
    count,
    { timeout: 60000, polling: 25 },
  );
  // Let the observer deliver its final long task; timing below excludes this pause.
  const readyAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(120);
  measurement = await page.evaluate((readyAt) => {
    const target = window as unknown as BenchmarkWindow;
    const base = target.aftermarketBasemap;
    const state = target.mapLoadingBenchmark;
    clearInterval(state.timer);
    state.observer?.disconnect();
    const gaps = state.gaps.slice().sort((a, b) => a - b);
    const percentile = (p: number) =>
      gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] ?? null;
    const currentProfile = JSON.parse(base.getCanvas().dataset.buildingProfile ?? '{}') as Record<
      string,
      number
    >;
    const work = Object.fromEntries(
      Object.entries(currentProfile).map(([key, value]) => [
        key,
        value - (state.previousProfile[key] ?? 0),
      ]),
    );
    return {
      elapsedMs: readyAt - state.started,
      buildingCount: Number(base.getCanvas().dataset.detailedBuildings ?? 0),
      vertices: Number(base.getCanvas().dataset.buildingVertices ?? 0),
      sourceFeatureCount:
        (base.getSource('openmaptiles') as GeoJSONSource).type === 'geojson'
          ? base.querySourceFeatures('openmaptiles').length
          : null,
      work,
      heartbeat: {
        targetIntervalMs: 20,
        samples: gaps.length,
        medianMs: percentile(0.5),
        p95Ms: percentile(0.95),
        maxMs: gaps.at(-1) ?? null,
        gapsOver50Ms: gaps.filter((gap) => gap > 50).length,
      },
      longTasksSupported: state.longTasksSupported,
      longTasks: state.longTasks,
      totalBlockingMs: state.longTasks.reduce(
        (sum, task) => sum + Math.max(0, task.duration - 50),
        0,
      ),
    };
  }, readyAt);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  const browserVersion = browser.version();
  await browser.close();
  mkdirSync(resolve('test-results/map-loading'), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    phase,
    url: url.origin,
    runtime: process.version,
    browserVersion,
    fixture: {
      synthetic: true,
      count,
      columns,
      rows,
      canonicalTile: { z: 14, x: tileX, y: tileY },
      center,
      spacingMetres: 12,
      footprintMetres: [8, 7],
      zoom: 16,
      viewport: [1440, 1000],
      dpr: 1,
    },
    sourceHashes,
    measurement,
    errors,
    unexpectedApi,
    blockedExternal: [...new Set(blockedExternal)],
    failure,
    limits:
      'One isolated cold GeoJSON-to-production-layer loading run. Includes GeoJSON tiling, source query, mesh creation and upload; excludes API/database/network tile latency. Heartbeat/Long Tasks measure main-thread responsiveness, not GPU FPS. No timing pass/fail threshold.',
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, measurement, errors, unexpectedApi, failure }));
  if (failure || errors.length || unexpectedApi.length) process.exitCode = 1;
}
