import { test, expect } from '@playwright/test';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute } from '../../packages/simulation/src/engine';
import { positionAlongRoute, routeLengths } from '../../packages/simulation/src/geometry';
import { shipmentRoadPath } from '../../packages/simulation/src/road-path';
import type { Position } from '../../packages/simulation/src/model';

type MapWindow = Window & {
  aftermarketMap: LibreMap;
  aftermarketBasemap: LibreMap;
};

test('caminhão avança com o relógio contratado e mantém progresso após recarga', async ({
  page,
}, testInfo) => {
  const world = createWorld(Date.UTC(2026, 9, 30, 12));
  const offer = world.offers.find((item) => item.id === 'offer-ferrovale')!;
  const origin = world.establishments.find((unit) => unit.id === offer.establishmentId)!;
  const destination = world.establishments.find((unit) => unit.id === 'e-industry')!;
  const from = world.properties.find((property) => property.id === origin.propertyId)!;
  const to = world.properties.find((property) => property.id === destination.propertyId)!;
  // Deliberately curved road fixture, not a claim about actual road geography.
  const path: Position[] = [
    from.coordinates,
    [
      (from.coordinates[0] + to.coordinates[0]) / 2 + 0.003,
      (from.coordinates[1] + to.coordinates[1]) / 2 - 0.004,
    ],
    to.coordinates,
  ];
  world.requireRoadRoutes = true;
  for (const property of [from, to])
    property.roadAccess = {
      status: 'connected',
      originalCoordinates: property.coordinates,
      checkedAt: world.updatedAt,
      network: 'fixture',
    };
  world.routes[`${from.id}:${to.id}`] = {
    source: 'osrm',
    profile: 'driving',
    coordinates: path,
    distanceKm: routeLengths(path).at(-1)!,
    durationSeconds: 3600,
    fetchedAt: world.updatedAt,
    steps: [],
  };
  execute(
    world,
    'player',
    {
      type: 'trade',
      offerId: offer.id,
      destinationId: destination.id,
      quantity: 1,
      carrierId: 'transbrasil',
    },
    world.updatedAt,
  );
  const shipment = world.shipments.at(-1)!;
  expect(shipment.routeSource).toBe('osrm');
  expect(shipmentRoadPath(world, shipment)).toEqual(path);
  // Preserve the contract produced by the real command; only the browser clock moves.
  const departure = shipment.roadDepartureAt!;
  const duration = shipment.roadArrivalAt! - departure;
  const firstTime = departure + duration * 0.2;
  const laterTime = departure + duration * 0.65;
  const worldBeforeBrowsing = JSON.stringify(world);
  const errors: string[] = [];
  const unexpectedApi: string[] = [];
  const baseUrl = testInfo.project.use.baseURL;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(firstTime);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/world') return route.fulfill({ json: world });
    if (url.pathname === '/api/market-history')
      return route.fulfill({ json: { samples: [], trades: [] } });
    if (url.pathname.startsWith('/api/')) {
      unexpectedApi.push(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({ status: 503, json: { error: 'API não prevista na fixture.' } });
    }
    if (url.pathname === '/__animation/empty.pbf')
      return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf' });
    if (url.hostname === 'tiles.openfreemap.org')
      return route.fulfill({
        json: {
          tilejson: '3.0.0',
          tiles: [`${baseUrl}/__animation/empty.pbf?z={z}&x={x}&y={y}`],
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
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1')
      return route.fulfill({ status: 200, body: '' });
    return route.continue();
  });
  await page.addInitScript((seasonId) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'orders');
    localStorage.setItem('aftermarket.firstSteps', 'closed');
    localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');

  async function openShipmentMap() {
    await expect(
      page.getByRole('heading', { name: 'Pedidos e entregas', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: /^A caminho/ }).click();
    await page.getByRole('button', { name: 'Ver no mapa', exact: true }).click();
    await expect(page.locator('.ped-mapa [data-map-ready="true"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const main = (window as unknown as MapWindow).aftermarketMap;
          return (main.getSource('routes') as GeoJSONSource).getData();
        }),
      )
      .toEqual({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } },
        ],
      });
  }

  const marker = page.locator(`[data-shipment-id="${shipment.id}"]`);
  async function expectTruckAt(progress: number) {
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('title', /Em trânsito/);
    await expect(marker).toHaveAttribute('data-route-source', 'osrm');
    await expect
      .poll(async () => Math.abs(Number(await marker.getAttribute('data-progress')) - progress))
      .toBeLessThan(0.0001);
    const expected = positionAlongRoute(path, progress).position;
    await expect
      .poll(async () =>
        Math.max(
          Math.abs(Number(await marker.getAttribute('data-longitude')) - expected[0]),
          Math.abs(Number(await marker.getAttribute('data-latitude')) - expected[1]),
        ),
      )
      .toBeLessThan(1e-6);
    await marker.scrollIntoViewIfNeeded();
    // Test the rendered marker, not just its data: both canvases must project its
    // position to the same screen pixel while the camera finishes fitting the route.
    await expect
      .poll(() =>
        page.evaluate(
          ({ id, expectedPosition }) => {
            const { aftermarketMap: main, aftermarketBasemap: base } =
              window as unknown as MapWindow;
            const element = document.querySelector(`[data-shipment-id="${id}"]`)!;
            const rect = element.getBoundingClientRect();
            const canvas = main.getCanvas().getBoundingClientRect();
            const mainPoint = main.project(expectedPosition);
            const basePoint = base.project(expectedPosition);
            return Math.max(
              Math.abs(rect.left + rect.width / 2 - canvas.left - mainPoint.x),
              Math.abs(rect.top + rect.height / 2 - canvas.top - mainPoint.y),
              Math.abs(mainPoint.x - basePoint.x),
              Math.abs(mainPoint.y - basePoint.y),
            );
          },
          { id: shipment.id, expectedPosition: expected },
        ),
      )
      .toBeLessThan(2);
  }

  await openShipmentMap();
  await expectTruckAt(0.2);
  await page.clock.setFixedTime(laterTime);
  await expectTruckAt(0.65);
  await page.reload();
  await openShipmentMap();
  await expectTruckAt(0.65);
  await page.screenshot({ path: testInfo.outputPath('route-animation.png'), fullPage: true });
  expect(JSON.stringify(world)).toBe(worldBeforeBrowsing);
  expect(unexpectedApi).toEqual([]);
  expect(errors).toEqual([]);
});
