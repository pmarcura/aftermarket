import { test, expect } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute, advance, RuleError } from '../../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL, type Command } from '../../packages/simulation/src/model';
import { institutional } from '../../packages/simulation/src/competition';
test('edital estadual mostra referência, disputa e todos os caminhões indo à prefeitura', async ({
  page,
}) => {
  const now = Date.now(),
    w = createWorld(now);
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  for (const c of w.companies)
    if (!institutional(c.id) && !['transbrasil', 'rodoleste', 'expresso'].includes(c.id))
      c.bot = false;
  const factory = w.establishments.find((e) => e.id === 'e-industry')!;
  factory.inventory.steel = 200;
  factory.quality!.steel = 95;
  advance(w, now + ECONOMIC_INTERVAL);
  const contract = w.infrastructure.find((c) => c.state === 'SP')!;
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
      advance(w, contract.biddingEndsAt!);
      await route.fulfill({ json: w });
    } catch (error) {
      await route.fulfill({
        status: error instanceof RuleError ? 409 : 500,
        json: { error: String(error) },
      });
    }
  });
  await page.addInitScript(() => localStorage.setItem('aftermarket.page', 'market'));
  await page.goto('/');
  await page.locator('summary').filter({ hasText: 'Contratos de infraestrutura' }).click();
  await page.getByLabel('Estado dos contratos públicos', { exact: true }).selectOption('SP');
  const card = page.locator('.commercial-order').filter({ hasText: `#${contract.id.slice(0, 6)}` });
  await expect(card.getByText('Referência interna', { exact: false })).toBeVisible();
  await card.getByRole('button', { name: 'Participar da disputa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Origem da proposta pública', { exact: true }).selectOption('e-industry');
  await dialog.getByLabel('Frota da proposta pública', { exact: true }).selectOption('transbrasil');
  await dialog.getByRole('button', { name: 'Registrar proposta', exact: true }).click();
  await expect(card.getByText('Em entrega', { exact: true })).toBeVisible();
  await card.locator('summary').click();
  await expect(card.getByRole('cell', { name: 'Vencedora', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/competition/public-contract.png', fullPage: true });
  await card.getByRole('button', { name: 'Acompanhar pedido e caminhões', exact: true }).click();
  await page
    .locator('.shipment-item')
    .filter({ hasText: contract.id.slice(0, 6).toUpperCase() })
    .click();
  await expect(page.locator('.shipment-truck')).toHaveCount(3);
  await expect(page.getByText('Prefeitura de Campinas', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/competition/public-delivery.png', fullPage: true });
  expect(errors).toEqual([]);
});
