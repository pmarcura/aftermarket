import { test, expect } from './fixtures';
import type * as maplibregl from 'maplibre-gl';
import { createWorld } from '../../packages/simulation/src/seed';
import type { Shipment } from '../../packages/simulation/src/model';

// Barra de modos do mapa: um modo por vez decide o que aparece; Fluxos mostra as cargas na
// estrada por trajeto, com painel por produto e legenda própria; Preços pede um produto.
test('modos do mapa: fluxos de recursos e preços por cidade', async ({ page }) => {
  test.setTimeout(60000);
  const world = createWorld(Date.now());
  const loja = world.establishments.find(
    (e) => e.companyId === 'player' && e.category === 'retail',
  )!;
  const fornecedor = world.establishments.find((e) => e.companyId !== 'player')!;
  const lojaP = world.properties.find((p) => p.id === loja.propertyId)!;
  const fornP = world.properties.find((p) => p.id === fornecedor.propertyId)!;
  world.shipments = [
    {
      id: 'carga-teste',
      buyerId: 'player',
      sellerId: fornecedor.companyId,
      originId: fornecedor.id,
      destinationId: loja.id,
      product: 'milk',
      quantity: 1200,
      cost: 0,
      freight: 0,
      carrierId: fornecedor.companyId,
      vehicleId: 'v-teste',
      departedAt: Date.now() - 60_000,
      arrivesAt: Date.now() + 3_600_000,
      delivered: false,
      distance: 30,
      route: [fornP.coordinates, lojaP.coordinates],
      routeSource: 'osrm',
    } as Shipment,
  ];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 30000 });

  const modos = page.getByRole('group', { name: 'Filtrar mapa', exact: true });
  await expect(modos.getByRole('button', { name: 'Negócios', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.map-legend-bar')).toContainText('Precisa de você');

  // Fluxos: painel com o leite a caminho da loja, legenda das cadeias e o trajeto no mapa
  await modos.getByRole('button', { name: 'Fluxos' }).click();
  const painel = page.getByRole('complementary', { name: 'Fluxos de recursos' });
  await expect(painel).toContainText('1 carga na estrada');
  await expect(painel.getByRole('button', { name: /Leite/ })).toBeVisible();
  await expect(page.locator('.map-legend-bar')).toContainText('Alimentos e agro');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const m = (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap!;
        const dados = (await (m.getSource('fluxos') as maplibregl.GeoJSONSource).getData()) as {
          features: unknown[];
        };
        return dados.features.length;
      }),
    )
    .toBe(1);
  // "Saindo": a loja não vende nada agora; o painel diz isso em vez de ficar em branco
  await painel.getByRole('button', { name: 'Saindo' }).click();
  await expect(painel).toContainText('Nenhuma venda sua na estrada agora');
  await painel.getByRole('button', { name: 'Chegando' }).click();
  await expect(painel).toContainText('1 carga na estrada');

  // Preços: um produto escolhido e placas por cidade
  await modos.getByRole('button', { name: 'Preços' }).click();
  const precos = page.getByRole('complementary', { name: 'Preços por cidade' });
  await expect(precos.getByRole('button', { pressed: true })).toHaveCount(1);
  await expect(page.locator('.main-map .maplibregl-marker').first()).toBeVisible();

  // Meus negócios filtra por cima do modo e volta
  await modos.getByRole('button', { name: 'Negócios', exact: true }).click();
  await modos.getByRole('button', { name: 'Meus negócios' }).click();
  await expect(modos.getByRole('button', { name: 'Meus negócios' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});
