import { test, expect } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute, advance, RuleError, quote } from '../../packages/simulation/src/engine';
import {
  ECONOMIC_INTERVAL,
  type World,
  type Command,
  type Position,
} from '../../packages/simulation/src/model';
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
  await page.route('**/api/world*', (route) => route.fulfill({ json: w }));
  await page.route('**/api/commands', async (route) => {
    try {
      execute(
        w,
        route.request().headers()['x-company-id'],
        route.request().postDataJSON() as Command,
        w.updatedAt,
      );
      w.revision++;
      await route.fulfill({ json: w });
    } catch (error) {
      await route.fulfill({
        status: error instanceof RuleError ? 409 : 500,
        json: { error: String(error) },
      });
    }
  });
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'company');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, w.season.id);
  await page.goto('/jogar');
  // Com atraso, o bloco de pagamentos já abre com as três saídas: pagar, crédito e cortar custos.
  const pagamentos = page.getByRole('region', { name: 'Pagamentos atrasados', exact: true });
  await expect(pagamentos).toBeVisible();
  await expect(
    pagamentos.getByRole('heading', { name: '1. Pagar o que está atrasado' }),
  ).toBeVisible();
  const confirmar = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar', exact: true });

  await pagamentos
    .getByRole('group', { name: 'Estado do crédito', exact: true })
    .getByRole('button', { name: 'SP', exact: true })
    .click();
  await pagamentos.getByRole('spinbutton', { name: /^Quanto pedir/ }).fill('100000');
  await pagamentos.getByRole('button', { name: 'Revisar crédito', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Contratar crédito de recuperação' }),
  ).toBeVisible();
  await confirmar.click();
  await expect.poll(() => outstandingLoans(w, 'player')).toBe(10000000);
  await expect(page.getByRole('list', { name: 'Créditos abertos', exact: true })).toBeVisible();

  await pagamentos
    .getByRole('spinbutton', { name: /^Quanto pagar/ })
    .fill((arrears(w, 'player') / 100).toFixed(2));
  await pagamentos.getByRole('button', { name: 'Revisar pagamento', exact: true }).click();
  await confirmar.click();
  await expect.poll(() => arrears(w, 'player')).toBe(0);
  await expect(page.getByRole('heading', { name: 'Pagamentos em dia', exact: true })).toBeVisible();

  const fabrica = page.getByRole('listitem').filter({ hasText: 'Indústria de Aço' });
  await fabrica.getByRole('button', { name: 'Suspender', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Suspender estrutura' }),
  ).toBeVisible();
  await confirmar.click();
  await expect(fabrica.getByText(/· 0 na equipe$/)).toBeVisible();
  await expect(fabrica.getByRole('button', { name: 'Reativar', exact: true })).toBeVisible();
  expect(w.establishments.find((e) => e.id === 'e-industry')?.mothballed).toBe(true);

  // Gráfico do caixa vira tabela legível; o extrato da empresa sai em CSV.
  await page.getByRole('button', { name: 'Ver valores', exact: true }).first().click();
  await expect(page.getByRole('table', { name: /Variação do caixa/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar extrato disponível', exact: true }).click();
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
  // O servidor roda a economia de verdade: os bots podem esgotar um fornecedor antes deste teste.
  // Escolhe uma oferta de minério com estoque e transportadora compatível depois de pedir a rota.
  const mundo = async () => (await (await request.get('/api/world')).json()) as World;
  let w = await mundo();
  let escolha:
    | {
        offerId: string;
        origem: World['establishments'][number];
        carrier: string;
        route: { coordinates: Position[] };
      }
    | undefined;
  for (const o of w.offers.filter((o) => o.product === 'iron')) {
    const origem = w.establishments.find((e) => e.id === o.establishmentId);
    if (!origem || origem.companyId === 'player' || (origem.inventory.iron ?? 0) < 1) continue;
    const road = await request.get(`/api/route?origin=${origem.propertyId}&destination=industry`);
    if (!road.ok()) continue;
    w = await mundo();
    const carrier = ['transbrasil', 'rodoleste', 'expresso', 'player'].find(
      (c) => quote(w, origem.id, 'e-industry', 'iron', 1, c).compatible,
    );
    if (carrier) {
      escolha = { offerId: o.id, origem, carrier, route: await road.json() };
      break;
    }
  }
  expect(escolha).toBeTruthy();
  const { offerId, origem, carrier, route } = escolha!;
  expect(route.coordinates).toHaveLength(3);
  const response = await request.post('/api/commands', {
    headers: { 'x-company-id': 'player', 'Idempotency-Key': crypto.randomUUID() },
    data: {
      type: 'trade',
      offerId,
      destinationId: 'e-industry',
      quantity: 1,
      carrierId: carrier,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  // O pacote do mundo não garante ordem: a remessa nova é a que não existia antes da compra.
  const after = (await response.json()) as World,
    s = after.shipments.find(
      (x) =>
        !w.shipments.some((old) => old.id === x.id) &&
        x.originId === origem.id &&
        x.destinationId === 'e-industry',
    )!;
  expect(s).toBeTruthy();
  expect(s.routeSource).toBe('osrm');
  expect(s.routeKey).toBeTruthy();
  expect(shipmentRoute(after, s)).toEqual(route.coordinates);
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'orders');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, after.season.id);
  await page.goto('/jogar');
  await page.getByRole('tab', { name: /^A caminho/ }).click();
  const carga = page
    .getByRole('article')
    .filter({ hasText: `Você recebe de ${origem.name} em Indústria de Aço` })
    .filter({ hasText: /Chegou\s*0 de 1 t/ });
  await expect(carga).toHaveCount(1);
  await carga.getByRole('button', { name: 'Ver no mapa', exact: true }).click();
  const marker = page.locator('[data-shipment-id="' + s.id + '"]');
  await expect(marker).toHaveAttribute('data-route-source', 'osrm', { timeout: 25000 });
  const p = Number(await marker.getAttribute('data-progress')),
    expected = positionAlongRoute(route.coordinates, p);
  expect(Number(await marker.getAttribute('data-longitude'))).toBeCloseTo(expected.position[0], 3);
  expect(Number(await marker.getAttribute('data-latitude'))).toBeCloseTo(expected.position[1], 3);
  await carga.getByRole('button', { name: 'Localizar', exact: true }).click();
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
