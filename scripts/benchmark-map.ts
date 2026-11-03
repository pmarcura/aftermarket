import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  buildBuildingMesh,
  type BuildingFeature,
} from '../apps/web/src/lib/pixel-buildings-geometry';

// Reproducible CPU-only hot-content workload. This never opens a world or database.
const features: BuildingFeature[] = Array.from({ length: 500 }, (_, i) => {
  const x = -47.07 + (i % 25) * 0.0004,
    y = -22.91 + Math.floor(i / 25) * 0.0004;
  const outer = [
    [x, y],
    [x + 0.00025, y],
    [x + 0.00025, y + 0.00018],
    [x, y + 0.00018],
    [x, y],
  ];
  const hole = [
    [x + 0.00008, y + 0.00006],
    [x + 0.00016, y + 0.00006],
    [x + 0.00016, y + 0.00012],
    [x + 0.00008, y + 0.00012],
    [x + 0.00008, y + 0.00006],
  ];
  return {
    id: i,
    properties: { render_height: 3 + (i % 12) * 3 },
    geometry: { type: 'Polygon', coordinates: i % 7 === 0 ? [outer, hole] : [outer] },
  };
});
const after = process.argv.includes('--after');
const cache = after
  ? new (await import('../apps/web/src/lib/pixel-building-cache')).BuildingMeshCache()
  : undefined;
const get = () => (cache ? cache.get(features).mesh : buildBuildingMesh(features));
for (let i = 0; i < 5; i++) get();
const times: number[] = [];
let last = get();
for (let i = 0; i < 60; i++) {
  const start = performance.now();
  last = get();
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
const report = {
  mode: after ? 'content-cache' : 'previous-rebuild-before-compare',
  scope:
    '60 repeated same-content geometry requests, 500 synthetic geographic footprints, 72 courtyards; CPU only, not GPU FPS',
  samples: times.length,
  footprints: features.length,
  totalMs: times.reduce((a, b) => a + b, 0),
  medianMs: times[30],
  p95Ms: times[57],
  vertices: last.vertices.length / 10,
  bytes: last.vertices.byteLength,
  key: last.key,
  ...(cache ? { cache: cache.stats } : {}),
};
await mkdir('test-results/map-refinement', { recursive: true });
await writeFile(
  `test-results/map-refinement/${after ? 'after' : 'before'}-cpu.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
