import { test, expect, type Page } from '@playwright/test';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import { createWorld } from '../../packages/simulation/src/seed';

type MapWindow = Window & {
  aftermarketMap: LibreMap;
  aftermarketBasemap: LibreMap;
};

test.use({ deviceScaleFactor: 2 });

async function fixture(page: Page, failCartography = false) {
  const world = createWorld(Date.UTC(2026, 9, 30, 12));
  const baseUrl = test.info().project.use.baseURL;
  const errors: string[] = [];
  const unexpectedApi: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(world.updatedAt);
  // Only the presentation reads this world. Every unexpected API operation is rejected.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/world') return route.fulfill({ json: world });
    if (url.pathname === '/api/market-history')
      return route.fulfill({ json: { samples: [], trades: [] } });
    if (url.pathname.startsWith('/api/')) {
      unexpectedApi.push(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({ status: 503, json: { error: 'API não prevista na fixture.' } });
    }
    if (url.pathname === '/__pixel-map/empty.pbf')
      return route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
    if (url.hostname === 'tiles.openfreemap.org') {
      if (failCartography) return route.abort('failed');
      return route.fulfill({
        json: {
          tilejson: '3.0.0',
          tiles: [`${baseUrl}/__pixel-map/empty.pbf?z={z}&x={x}&y={y}`],
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
    }
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1')
      return route.fulfill({ status: 200, body: '' });
    return route.continue();
  });
  await page.addInitScript((seasonId) => {
    localStorage.clear();
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem('aftermarket.firstSteps', 'closed');
    localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  return { world, errors, unexpectedApi };
}

async function expectSynchronized(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
        const camera = (map: LibreMap) => {
          const center = map.getCenter(),
            padding = map.getPadding();
          return [
            center.lng,
            center.lat,
            map.getZoom(),
            map.getBearing(),
            map.getPitch(),
            map.getRoll(),
            padding.top ?? 0,
            padding.right ?? 0,
            padding.bottom ?? 0,
            padding.left ?? 0,
          ];
        };
        const reference = camera(main);
        return Math.max(...camera(base).map((value, index) => Math.abs(value - reference[index])));
      }),
    )
    .toBeLessThan(1e-8);
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`mapa pixel ${viewport.name}: base e interação conservam resolução, câmera e seleção`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { world, errors, unexpectedApi } = await fixture(page);
    const map = page.locator('.main-map .world-map');
    await expect(map).toHaveAttribute('data-map-ready', 'true');

    await test.step('pixelar somente a geografia e manter as fontes separadas', async () => {
      const rendering = await page.evaluate(() => {
        const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
        const dimensions = (map: LibreMap) => {
          const canvas = map.getCanvas();
          return {
            width: canvas.width,
            height: canvas.height,
            cssWidth: canvas.clientWidth,
            cssHeight: canvas.clientHeight,
            pixelRatio: map.getPixelRatio(),
            sampling: getComputedStyle(canvas).imageRendering,
          };
        };
        return {
          main: dimensions(main),
          base: dimensions(base),
          dpr: devicePixelRatio,
          mainSources: Object.keys(main.getStyle().sources),
          baseSources: Object.keys(base.getStyle().sources),
          buildings: base
            .getStyle()
            .layers.filter(
              (layer) => 'source-layer' in layer && layer['source-layer'] === 'building',
            )
            .map((layer) => ({
              minzoom: layer.minzoom,
              source: 'source' in layer ? layer.source : undefined,
            })),
        };
      });
      expect(rendering.main.pixelRatio).toBe(rendering.dpr);
      expect(rendering.base.pixelRatio).toBe(0.5);
      for (const [drawing, ratio] of [
        [rendering.main, rendering.dpr],
        [rendering.base, 0.5],
      ] as const) {
        expect(drawing.width).toBe(Math.round(drawing.cssWidth * ratio));
        expect(drawing.height).toBe(Math.round(drawing.cssHeight * ratio));
      }
      expect(rendering.base.sampling).toBe('pixelated');
      expect(rendering.main.sampling).toBe('auto');
      expect(rendering.baseSources).toContain('openmaptiles');
      expect(rendering.baseSources).not.toContain('properties');
      expect(rendering.mainSources).toContain('properties');
      expect(rendering.mainSources).not.toContain('openmaptiles');
      expect(rendering.buildings.length).toBeGreaterThan(0);
      for (const layer of rendering.buildings) {
        expect(layer.minzoom).toBeGreaterThanOrEqual(13);
        expect(layer.source).toBe('openmaptiles');
      }

      // Attribution belongs to the interactive layer and remains available to assistive tech.
      const attribution = page.locator('.main-map .map-canvas .maplibregl-ctrl-attrib');
      const link = attribution.getByRole('link', { name: 'OpenStreetMap', exact: true });
      if (!(await link.isVisible())) await attribution.locator('summary').click();
      await expect(link).toBeVisible();
      expect(
        await link.evaluate((element) => Boolean(element.closest('[aria-hidden="true"]'))),
      ).toBe(false);
    });

    await test.step('inclinar pelo controle e voltar à cartografia plana', async () => {
      const tilt = page.getByRole('button', { name: 'Vista inclinada', exact: true });
      await expect(tilt).toHaveAttribute('aria-pressed', 'false');
      await tilt.click();
      const overhead = page.getByRole('button', { name: 'Vista de cima', exact: true });
      await expect(overhead).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('status').filter({ hasText: 'Alturas aproximadas' }),
      ).toBeVisible();
      const tiltedView = await page.evaluate(() => {
        const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
        return {
          pitch: main.getPitch(),
          zoom: main.getZoom(),
          volumes: base.getLayoutProperty('building-volumes', 'visibility'),
          roofs: base.getLayoutProperty('building-roofs', 'visibility'),
        };
      });
      expect(tiltedView.pitch).toBeCloseTo(45);
      expect(tiltedView.zoom).toBeGreaterThanOrEqual(15);
      expect(tiltedView.volumes).toBe('visible');
      expect(tiltedView.roofs).toBe('none');
      await expectSynchronized(page);

      await overhead.click();
      await expect(tilt).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByRole('status').filter({ hasText: 'Alturas aproximadas' })).toHaveCount(
        0,
      );
      const flatView = await page.evaluate(() => {
        const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
        return {
          pitch: main.getPitch(),
          volumes: base.getLayoutProperty('building-volumes', 'visibility'),
          roofs: base.getLayoutProperty('building-roofs', 'visibility'),
        };
      });
      expect(flatView.pitch).toBeCloseTo(0);
      expect(flatView.volumes).toBe('none');
      expect(flatView.roofs).toBe('visible');
      await expectSynchronized(page);
    });

    await test.step('sincronizar câmera completa e tamanho após redimensionar', async () => {
      await page.evaluate(() => {
        const main = (window as unknown as MapWindow).aftermarketMap;
        main.jumpTo({
          center: [-47.2, -22.9],
          zoom: 12.4,
          bearing: 23,
          pitch: 25,
          roll: 3,
          padding: { top: 30, right: 40, bottom: 50, left: 60 },
        });
      });
      await expectSynchronized(page);
      const resized = {
        width: viewport.name === 'desktop' ? 1280 : 430,
        height: viewport.height - 80,
      };
      await page.setViewportSize(resized);
      await expectSynchronized(page);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { aftermarketMap: main, aftermarketBasemap: base } =
              window as unknown as MapWindow;
            return [
              main.getCanvas().clientWidth - base.getCanvas().clientWidth,
              main.getCanvas().clientHeight - base.getCanvas().clientHeight,
              main.getCanvas().clientWidth - main.getContainer().clientWidth,
              main.getCanvas().clientHeight - main.getContainer().clientHeight,
            ];
          }),
        )
        .toEqual([0, 0, 0, 0]);
      await expectSynchronized(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        resized.width,
      );
      await page.setViewportSize(viewport);
    });

    await test.step('reaproveitar os mapas entre telas, sem foco na página oculta', async () => {
      const filters = page.getByRole('group', { name: 'Filtrar mapa', exact: true });
      await filters.getByRole('button', { name: 'Terrenos à venda', exact: true }).click();
      const retained = await page.evaluateHandle(() => {
        const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
        return {
          main,
          base,
          mainContext: main.getCanvas().getContext('webgl2'),
          baseContext: base.getCanvas().getContext('webgl2'),
          center: main.getCenter().toArray(),
          zoom: main.getZoom(),
          bearing: main.getBearing(),
          pitch: main.getPitch(),
        };
      });
      const menu = page.getByRole('navigation', { name: 'Menu principal', exact: true });
      await menu.getByRole('button', { name: 'Comércio', exact: true }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Comprar mercadorias', exact: true }),
      ).toBeVisible();
      // A retained canvas must be invisible and excluded from keyboard/accessibility.
      await expect(page.locator('.main-map')).toHaveCount(1);
      await expect(page.locator('.main-map')).toBeHidden();
      await expect(filters).toHaveCount(0);
      await page.setViewportSize({ width: viewport.width + 20, height: viewport.height - 40 });
      await menu.getByRole('button', { name: 'Mapa', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.main-map')).toBeVisible();
      await expect(
        filters.getByRole('button', { name: 'Terrenos à venda', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(() =>
          page.evaluate((previous) => {
            const { aftermarketMap: main, aftermarketBasemap: base } =
              window as unknown as MapWindow;
            return {
              sameMain: main === previous.main,
              sameBase: base === previous.base,
              sameMainContext: main.getCanvas().getContext('webgl2') === previous.mainContext,
              sameBaseContext: base.getCanvas().getContext('webgl2') === previous.baseContext,
              camera: [
                ...main.getCenter().toArray(),
                main.getZoom(),
                main.getBearing(),
                main.getPitch(),
              ].every(
                (value, index) =>
                  Math.abs(
                    value -
                      [...previous.center, previous.zoom, previous.bearing, previous.pitch][index],
                  ) < 1e-8,
              ),
              width: main.getCanvas().clientWidth === main.getContainer().clientWidth,
              height: main.getCanvas().clientHeight === main.getContainer().clientHeight,
            };
          }, retained),
        )
        .toEqual({
          sameMain: true,
          sameBase: true,
          sameMainContext: true,
          sameBaseContext: true,
          width: true,
          height: true,
          camera: true,
        });
      await retained.dispose();
      await expectSynchronized(page);
      await filters.getByRole('button', { name: 'Tudo no mapa', exact: true }).click();
      await page.setViewportSize(viewport);
    });

    await test.step('selecionar a mesma propriedade por ponteiro e teclado sem cobrar', async () => {
      const lot = world.properties.find((property) => !property.ownerId)!;
      await page.evaluate((coordinates) => {
        (window as unknown as MapWindow).aftermarketMap.jumpTo({
          center: coordinates,
          zoom: 14,
          bearing: 0,
          pitch: 0,
          roll: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        });
      }, lot.coordinates);
      await expectSynchronized(page);
      await expect
        .poll(() =>
          page.evaluate(({ id, coordinates }) => {
            const main = (window as unknown as MapWindow).aftermarketMap;
            return main
              .queryRenderedFeatures(main.project(coordinates), { layers: ['property-dots'] })
              .some((feature) => feature.properties.id === id);
          }, lot),
        )
        .toBe(true);
      const point = await page.evaluate((coordinates) => {
        const main = (window as unknown as MapWindow).aftermarketMap;
        const point = main.project(coordinates);
        const rect = main.getCanvas().getBoundingClientRect();
        return { x: rect.left + point.x, y: rect.top + point.y };
      }, lot.coordinates);
      await page.mouse.click(point.x, point.y);
      const heading = page.getByRole('heading', { name: `Terreno em ${lot.city}`, exact: true });
      await expect(heading).toBeVisible();
      await page
        .getByRole('button', { name: 'Fechar detalhes da propriedade', exact: true })
        .click();
      await expect(heading).not.toBeVisible();
      await page.locator(`.map-access [data-property="${lot.id}"]`).focus();
      await page.keyboard.press('Enter');
      await expect(heading).toBeVisible();
      expect(unexpectedApi).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test('falha da cartografia aparece mesmo com a camada interativa carregada', async ({ page }) => {
  const { errors, unexpectedApi } = await fixture(page, true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as MapWindow).aftermarketMap?.getLayer('property-icons')),
      ),
    )
    .toBe(true);
  await expect(page.locator('.main-map .map-error')).toBeVisible();
  await expect(page.locator('.main-map .world-map')).toHaveAttribute('data-map-ready', 'false');
  await expect(page.getByRole('button', { name: 'Recarregar mapa', exact: true })).toBeVisible();
  await expect(page.locator('.main-map .map-loading')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(unexpectedApi).toEqual([]);
});

type BuildingScene = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: number;
    properties: { render_height: number };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }[];
};

async function installBuildingScene(
  page: Page,
  scene: BuildingScene,
  center: [number, number],
  zoom: number,
) {
  await page.evaluate(
    ({ scene, center, zoom }) => {
      const { aftermarketMap: main, aftermarketBasemap: base } = window as unknown as MapWindow;
      // Keep the production custom layer. Replace only its data source through
      // public APIs; querySourceFeatures and the renderer remain unmodified.
      for (const layer of base.getStyle().layers)
        if ('source' in layer && layer.source === 'openmaptiles') base.removeLayer(layer.id);
      base.removeSource('openmaptiles');
      base.addSource('openmaptiles', { type: 'geojson', data: scene, maxzoom: 14 });
      // Opacity zero keeps these real GeoJSON tiles available to source queries.
      base.addLayer({
        id: 'fixture-building-source',
        type: 'fill',
        source: 'openmaptiles',
        paint: { 'fill-opacity': 0 },
      });
      main.jumpTo({
        center,
        zoom,
        pitch: 0,
        bearing: 0,
        roll: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    },
    { scene, center, zoom },
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const base = (window as unknown as MapWindow).aftermarketBasemap;
        return Number(base.getCanvas().dataset.detailedBuildings ?? 0);
      }),
    )
    .toBe(scene.features.length);
  await expectSynchronized(page);
}

async function compareBuildingPixels(page: Page, hole?: [number, number], roof?: [number, number]) {
  return page.evaluate(
    async ({ hole, roof }) => {
      const base = (window as unknown as MapWindow).aftermarketBasemap;
      const canvas = base.getCanvas();
      const gl = canvas.getContext('webgl2')!;
      const readFrame = () =>
        new Promise<Uint8Array>((resolve) => {
          // The default drawing buffer may be discarded after compositing. Read it
          // synchronously in the real render event instead of enabling a test-only
          // rendering mode or intercepting draw calls.
          base.once('render', () => {
            const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(
              0,
              0,
              gl.drawingBufferWidth,
              gl.drawingBufferHeight,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            resolve(pixels);
          });
          base.triggerRepaint();
        });
      const before = await readFrame();
      base.removeLayer('pixel-buildings-detail');
      const after = await readFrame();
      let changed = 0;
      const colors = new Set<number>();
      for (let offset = 0; offset < before.length; offset += 4) {
        if (
          before[offset] === after[offset] &&
          before[offset + 1] === after[offset + 1] &&
          before[offset + 2] === after[offset + 2]
        )
          continue;
        changed++;
        colors.add((before[offset] << 16) | (before[offset + 1] << 8) | before[offset + 2]);
      }
      const deltaAt = (position: [number, number] | undefined) => {
        if (!position) return null;
        const point = base.project(position);
        const x = Math.floor((point.x * gl.drawingBufferWidth) / canvas.clientWidth);
        const y =
          gl.drawingBufferHeight -
          1 -
          Math.floor((point.y * gl.drawingBufferHeight) / canvas.clientHeight);
        const offset = (y * gl.drawingBufferWidth + x) * 4;
        return Math.max(
          ...[0, 1, 2].map((channel) =>
            Math.abs(before[offset + channel] - after[offset + channel]),
          ),
        );
      };
      return {
        changed,
        colors: colors.size,
        holeDelta: deltaAt(hole),
        roofDelta: deltaAt(roof),
        glError: gl.getError(),
        layerRemoved: !base.getLayer('pixel-buildings-detail'),
        metadataRemoved:
          canvas.dataset.detailedBuildings === undefined &&
          canvas.dataset.buildingVertices === undefined,
      };
    },
    { hole, roof },
  );
}

test('construções desenham pixels WebGL de footprints e preservam pátio e galpão próximo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { errors, unexpectedApi } = await fixture(page);
  await expect(page.locator('.main-map .world-map')).toHaveAttribute('data-map-ready', 'true');
  // Center inside one source tile, preventing clipping seams from turning this
  // controlled geometry test into a test of vector-tile buffering.
  const sourceTiles = 2 ** 14;
  const tileX = Math.floor(((-47.06 + 180) / 360) * sourceTiles);
  const tileY = Math.floor(
    ((1 - Math.asinh(Math.tan((-22.9 * Math.PI) / 180)) / Math.PI) / 2) * sourceTiles,
  );
  const center: [number, number] = [
    ((tileX + 0.5) / sourceTiles) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 0.5)) / sourceTiles))) * 180) / Math.PI,
  ];
  const ring = (x: number, y: number, radius: number): [number, number][] => [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x + radius, y + radius],
    [x - radius, y + radius],
    [x - radius, y - radius],
  ];
  const courtyard: [number, number] = [center[0] + 0.00035, center[1]];
  const scene: BuildingScene = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 1,
        properties: { render_height: 8 },
        geometry: { type: 'Polygon', coordinates: [ring(center[0] - 0.00035, center[1], 0.00013)] },
      },
      {
        type: 'Feature',
        id: 2,
        properties: { render_height: 24 },
        geometry: {
          type: 'Polygon',
          coordinates: [ring(...courtyard, 0.00022), ring(...courtyard, 0.00008)],
        },
      },
    ],
  };

  await test.step('compilar shader e desenhar telhados com pátio aberto', async () => {
    await installBuildingScene(page, scene, center, 18);
    const mesh = await page.evaluate(async () => {
      const base = (window as unknown as MapWindow).aftermarketBasemap;
      return {
        vertices: Number(base.getCanvas().dataset.buildingVertices),
        data: await (base.getSource('openmaptiles') as GeoJSONSource).getData(),
      };
    });
    expect(mesh.vertices).toBeGreaterThan(100);
    expect(mesh.vertices % 3).toBe(0);
    expect(mesh.data).toEqual(scene);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const base = (window as unknown as MapWindow).aftermarketBasemap;
          return JSON.parse(base.getCanvas().dataset.buildingProfile!).uploadCount ?? 0;
        }),
      )
      .toBeGreaterThan(0);
    // Camera-only changes must reuse geometry and the uploaded buffer. This
    // protects the actual integration, beyond the cache's pure unit tests.
    const workBefore = await page.evaluate(() => {
      const base = (window as unknown as MapWindow).aftermarketBasemap;
      return JSON.parse(base.getCanvas().dataset.buildingProfile!);
    });
    await page.evaluate(() => {
      const main = (window as unknown as MapWindow).aftermarketMap;
      main.jumpTo({ bearing: 5 });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const base = (window as unknown as MapWindow).aftermarketBasemap;
          return JSON.parse(base.getCanvas().dataset.buildingProfile!).reuseCount ?? 0;
        }),
      )
      .toBeGreaterThan(workBefore.reuseCount ?? 0);
    const workAfter = await page.evaluate(() => {
      const base = (window as unknown as MapWindow).aftermarketBasemap;
      return JSON.parse(base.getCanvas().dataset.buildingProfile!);
    });
    expect(workAfter.buildCount).toBe(workBefore.buildCount);
    expect(workAfter.uploadCount).toBe(workBefore.uploadCount);
    await page.evaluate(() => {
      (window as unknown as MapWindow).aftermarketMap.jumpTo({ bearing: 0 });
    });
    await expectSynchronized(page);
    const rendered = await compareBuildingPixels(page, courtyard, [
      courtyard[0] + 0.00015,
      courtyard[1],
    ]);
    expect(rendered.changed).toBeGreaterThan(100);
    expect(rendered.colors).toBeGreaterThan(10);
    expect(rendered.holeDelta).toBe(0);
    expect(rendered.roofDelta).toBeGreaterThan(0);
    expect(rendered.glError).toBe(0);
    expect(rendered.layerRemoved).toBe(true);
    expect(rendered.metadataRemoved).toBe(true);
    await expect(page.locator('.map-error')).toHaveCount(0);
  });

  await test.step('reabrir a tela e conservar o galpão que engloba o viewport', async () => {
    await page.reload();
    await expect(page.locator('.main-map .world-map')).toHaveAttribute('data-map-ready', 'true');
    const warehouse: BuildingScene = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 3,
          properties: { render_height: 10 },
          geometry: { type: 'Polygon', coordinates: [ring(...center, 0.003)] },
        },
      ],
    };
    await installBuildingScene(page, warehouse, center, 20);
    expect(
      await page.evaluate(() => {
        const base = (window as unknown as MapWindow).aftermarketBasemap;
        const bounds = base.getBounds();
        const features = base.querySourceFeatures('openmaptiles', { sourceLayer: 'building' });
        return features.some(
          (feature) =>
            feature.geometry.type === 'Polygon' &&
            feature.geometry.coordinates[0].every(
              ([lng, lat]: number[]) =>
                lng < bounds.getWest() ||
                lng > bounds.getEast() ||
                lat < bounds.getSouth() ||
                lat > bounds.getNorth(),
            ),
        );
      }),
    ).toBe(true);
    const rendered = await compareBuildingPixels(page);
    expect(rendered.changed).toBeGreaterThan(1000);
    expect(rendered.glError).toBe(0);
    expect(rendered.layerRemoved).toBe(true);
    expect(rendered.metadataRemoved).toBe(true);
    await expect(page.locator('.map-error')).toHaveCount(0);
  });
  expect(errors).toEqual([]);
  expect(unexpectedApi).toEqual([]);
});
