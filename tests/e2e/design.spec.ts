import { test, expect } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute, advance, RuleError, quote } from '../../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL, type World, type Command } from '../../packages/simulation/src/model';
import { arrears, outstandingLoans } from '../../packages/simulation/src/design';
import { positionAlongRoute } from '../../packages/simulation/src/geometry';
import { shipmentRoute } from '../../packages/simulation/src/road-path';

test('recuperação explica atrasados, crédito, quitação e suspensão; gráfico exporta dados legíveis', async ({
  page,
}) => {
  const now = Date.now(),
    w = createWorld(now);
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
    e.inventory = {};
  }
  for (const c of w.companies)
    if (c.id !== 'treasury' && !c.id.startsWith('treasury:') && c.id !== 'consumers') c.bot = false;
  const player = w.companies.find((c) => c.id === 'player')!,
    families = w.companies.find((c) => c.id === 'consumers')!;
  families.balance += player.balance;
  player.balance = 0;
  advance(w, now + ECONOMIC_INTERVAL);
  expect(arrears(w, 'player')).toBeGreaterThan(0);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world', (route) => route.fulfill({ json: w }));
  await page.route('**/api/commands', async (route) => {
    try {
      execute(
        w,
        route.request().headers()['x-company-id'],
        route.request().postDataJSON() as Command,
        w.updatedAt,
      );
      await route.fulfill({ json: w });
    } catch (error) {
      await route.fulfill({
        status: error instanceof RuleError ? 409 : 500,
        json: { error: String(error) },
      });
    }
  });
  await page.addInitScript(() => localStorage.setItem('aftermarket.page', 'company'));
  await page.goto('/jogar');
  await expect(
    page.getByRole('heading', { name: 'Caixa, compromissos e recuperação', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Estado do crédito', { exact: true }).selectOption('SP');
  await page.getByLabel('Principal solicitado', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Revisar crédito e parcelas', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar operação', exact: true })
    .click();
  await expect.poll(() => outstandingLoans(w, 'player')).toBe(10000000);
  await page
    .getByLabel('Pagamento de atrasados', { exact: true })
    .fill((arrears(w, 'player') / 100).toFixed(2));
  await page.getByRole('button', { name: 'Revisar pagamento', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar operação', exact: true })
    .click();
  await expect.poll(() => arrears(w, 'player')).toBe(0);
  const section = page.getByRole('row').filter({ hasText: 'Indústria de Aço' });
  await section.getByRole('button', { name: 'Suspender estrutura', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar operação', exact: true })
    .click();
  await expect(section.getByText('0 funcionários', { exact: true })).toBeVisible();
  const chart = page.locator('.chart-frame').first();
  await chart.locator('summary').click();
  await chart.getByRole('button', { name: 'Ver valores', exact: true }).click();
  await expect(chart.locator('table')).toBeVisible();
  const download = page.waitForEvent('download');
  await chart.getByRole('button', { name: 'CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('.csv');
  await page.screenshot({ path: 'test-results/design/recovery-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/design/recovery-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('servidor contrata rota curva, caminhão segue geometria e preserva contrato na recarga', async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const road = await request.get('/api/route?origin=ferrovale&destination=industry');
  expect(road.ok()).toBe(true);
  const route = await road.json();
  expect(route.coordinates).toHaveLength(3);
  const w = (await (await request.get('/api/world')).json()) as World;
  const carrier = ['transbrasil', 'rodoleste', 'expresso', 'player'].find(
    (c) => quote(w, 'e-ferrovale', 'e-industry', 'iron', 1, c).compatible,
  )!;
  expect(carrier).toBeTruthy();
  const response = await request.post('/api/commands', {
    headers: { 'x-company-id': 'player', 'Idempotency-Key': crypto.randomUUID() },
    data: {
      type: 'trade',
      offerId: 'offer-ferrovale',
      destinationId: 'e-industry',
      quantity: 1,
      carrierId: carrier,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const after = (await response.json()) as World,
    s = after.shipments.at(-1)!;
  expect(s.routeSource).toBe('osrm');
  expect(s.routeKey).toBeTruthy();
  expect(shipmentRoute(after, s)).toEqual(route.coordinates);
  await page.addInitScript(() => localStorage.setItem('aftermarket.page', 'logistics'));
  await page.goto('/jogar');
  await page.getByLabel('Buscar pedidos logísticos', { exact: true }).fill(s.batchId!.slice(0, 6));
  await page.locator('.shipment-item').first().click();
  const marker = page.locator('[data-shipment-id="' + s.id + '"]');
  await expect(marker).toHaveAttribute('data-route-source', 'osrm');
  const p = Number(await marker.getAttribute('data-progress')),
    expected = positionAlongRoute(route.coordinates, p);
  expect(Number(await marker.getAttribute('data-longitude'))).toBeCloseTo(expected.position[0], 3);
  expect(Number(await marker.getAttribute('data-latitude'))).toBeCloseTo(expected.position[1], 3);
  await page
    .getByRole('button', { name: /Localizar / })
    .first()
    .click();
  await expect(marker).toHaveClass(/focused/);
  await page.screenshot({ path: 'test-results/design/road-geometry.png', fullPage: true });
  await page.reload();
  const persisted = (await (await request.get('/api/world')).json()) as World,
    same = persisted.shipments.find((x) => x.id === s.id)!;
  expect([same.cost, same.freight, same.arrivesAt, same.quantity, same.routeKey]).toEqual([
    s.cost,
    s.freight,
    s.arrivesAt,
    s.quantity,
    s.routeKey,
  ]);
});
