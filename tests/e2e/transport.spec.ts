import { test, expect } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute } from '../../packages/simulation/src/engine';
import { fleetAvailability } from '../../packages/simulation/src/transport';
import type { Command } from '../../packages/simulation/src/model';

test('frota mostra limite, ajusta quantidade; erro fica no modal e conexão persiste', async ({
  page,
}) => {
  const w = createWorld(Date.now()),
    origin = w.establishments.find((e) => e.id === 'e-mine')!,
    dest = w.establishments.find((e) => e.id === 'e-industry')!;
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  origin.inventory.iron = 500;
  dest.inventory = {};
  dest.capacityT = 10000;
  dest.capacityM3 = 10000;
  const road = {
    source: 'osrm' as const,
    profile: 'driving' as const,
    distanceKm: 100,
    durationSeconds: 6000,
    coordinates: [
      w.properties.find((p) => p.id === origin.propertyId)!.coordinates,
      w.properties.find((p) => p.id === dest.propertyId)!.coordinates,
    ],
    steps: [],
  };
  w.routes[`${origin.propertyId}:${dest.propertyId}`] = road;
  let reject = true;
  await page.route('**/api/world', (r) => r.fulfill({ json: w }));
  await page.route('**/api/route?**', (r) => r.fulfill({ json: road }));
  await page.route('**/api/commands', async (r) => {
    if (reject) {
      reject = false;
      await r.fulfill({
        status: 409,
        json: { error: 'A frota mudou. Revise os veículos livres antes de confirmar.' },
      });
      return;
    }
    execute(w, 'player', r.request().postDataJSON() as Command, w.updatedAt);
    await r.fulfill({ json: w });
  });
  await page.addInitScript(() => {
    localStorage.setItem('aftermarket.page', 'industry');
    localStorage.setItem('aftermarket.business', 'e-industry');
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Estoque', exact: true }).click();
  await page.getByRole('button', { name: 'Trazer de outro estoque', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Origem da transferência', { exact: true }).selectOption('e-mine');
  await dialog.getByLabel('Produto da transferência', { exact: true }).selectOption('iron');
  await dialog.getByLabel('Quantidade para transferir', { exact: true }).fill('99999');
  const own = dialog.locator('[data-carrier="player"]');
  await expect(own.getByText('Quantidade acima do máximo', { exact: true })).toBeVisible();
  await expect(
    own.getByRole('button', { name: 'Selecionar Minha frota', exact: true }),
  ).toBeDisabled();
  const max = Math.min(500, fleetAvailability(w, 'player', 'iron').maxQuantity);
  await own.getByRole('button', { name: /Usar máximo/ }).click();
  await expect(dialog.getByLabel('Quantidade para transferir', { exact: true })).toHaveValue(
    String(max),
  );
  await expect(own.getByText(/livres \/ .*veículos/)).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Confirmar transferência e transporte', exact: true })
    .click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('A frota mudou');
  expect(await alert.evaluate((e) => e.closest('dialog')?.open)).toBe(true);
  await page.screenshot({ path: 'test-results/design/fleet-alert-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await alert.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/design/fleet-alert-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Fechar mensagem', exact: true }).click();
  await dialog.getByRole('button', { name: 'Reposição automática', exact: true }).click();
  await dialog.getByLabel('Mínimo da conexão', { exact: true }).fill('10');
  await dialog.getByLabel('Alvo da conexão', { exact: true }).fill('100');
  await dialog.getByLabel('Orçamento da conexão', { exact: true }).fill('5000');
  await dialog.getByRole('button', { name: 'Ativar conexão de reposição', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(dest.supplyPolicy?.rules.find((r) => r.product === 'iron')).toMatchObject({
    originId: 'e-mine',
    minimum: 10,
    target: 100,
  });
  expect(dest.supplyPolicy?.enabled).toBe(true);
  expect(w.shipments).toHaveLength(0);
  await page.setViewportSize({ width: 1600, height: 1080 });
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Meus Negócios', exact: true })
    .click();
  const network = page.locator('section.panel').filter({
    has: page.getByRole('heading', { name: 'Minha rede de abastecimento', exact: true }),
  });
  await expect(network.getByText('Mineradora Horizonte', { exact: true })).toBeVisible();
  await expect(network.getByText('Indústria de Aço', { exact: true })).toBeVisible();
  await network.screenshot({ path: 'test-results/design/supply-network.png' });
  await network.getByRole('button', { name: 'Conectar estruturas', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByLabel('Origem da conexão', { exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByRole('dialog').getByLabel('Destino da conexão', { exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByRole('dialog').getByLabel('Produto da conexão', { exact: true }),
  ).toHaveValue('');
});

test('central agrupa caminhões por pedido e mantém leitura após recarga', async ({ page }) => {
  const now = Date.now(),
    w = createWorld(now);
  execute(
    w,
    'player',
    {
      type: 'transferStock',
      originId: 'e-mine',
      destinationId: 'e-industry',
      product: 'iron',
      quantity: 65,
      carrierId: 'player',
    },
    now,
  );
  expect(w.shipments.length).toBeGreaterThan(1);
  // Fixture de apresentação: domínio/recebimentos são cobertos nos testes econômicos.
  for (const s of w.shipments) {
    s.delivered = true;
    s.arrivesAt = now - 1;
  }
  await page.route('**/api/world', (r) => r.fulfill({ json: w }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
  const center = page.getByRole('region', { name: 'Central de notificações', exact: true });
  await expect(center.getByText('Recebimentos não lidos · 1', { exact: true })).toBeVisible();
  await expect(center.getByRole('button', { name: /Material recebido no estoque/ })).toHaveCount(1);
  await center.getByRole('button', { name: 'Marcar recebimentos como lidos', exact: true }).click();
  await expect(center.getByText('Nenhum novo recebimento.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
  await expect(center.getByText('Recebimentos não lidos · 0', { exact: true })).toBeVisible();
});
