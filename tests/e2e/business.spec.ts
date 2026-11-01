import { test, expect } from './fixtures';
import { type Page } from '@playwright/test';
import type { World } from '../../packages/simulation/src/model';
async function actor(page: Page, id: string) {
  await page.evaluate((id) => {
    localStorage.setItem('aftermarket.company', id);
    localStorage.setItem('aftermarket.page', 'market');
  }, id);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comprar mercadorias' })).toBeVisible();
}
async function orders(page: Page) {
  await page.locator('summary').filter({ hasText: 'Pedidos e negociações' }).click();
}
test('negocia pedido real, agrupa caminhões e configura abastecimento e educação', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const setup = await request.post('/api/commands', {
    headers: { 'x-company-id': 'player2', 'Idempotency-Key': crypto.randomUUID() },
    data: { type: 'buyProperty', propertyId: 'newindustry', name: 'Unidade de Teste Comercial' },
  });
  expect(setup.ok(), await setup.text()).toBe(true);
  const install = await request.post('/api/commands', {
    headers: { 'x-company-id': 'player2', 'Idempotency-Key': crypto.randomUUID() },
    data: {
      type: 'installBusiness',
      establishmentId: 'e-newindustry',
      recipeId: 'steel-bars',
      lines: 1,
    },
  });
  expect(install.ok(), await install.text()).toBe(true);
  await page.goto('/jogar');
  await actor(page, 'player2');
  await orders(page);
  await page.getByRole('button', { name: 'Publicar pedido de compra', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Destino do pedido aberto', { exact: true })
    .selectOption('e-newindustry');
  await dialog.getByLabel('Mercadoria do pedido aberto', { exact: true }).selectOption('iron');
  await dialog.getByLabel('Quantidade do pedido aberto', { exact: true }).fill('65');
  await dialog.getByLabel('Preço do pedido aberto', { exact: true }).fill('500');
  await dialog.getByLabel('Frete do pedido aberto', { exact: true }).fill('10000');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Publicar pedido sem cobrança', exact: true }).click();
  const world = (await (await created).json()) as World,
    order = world.orders.at(-1)!;
  expect(order.sellerId).toBe('');
  await actor(page, 'player');
  await orders(page);
  let card = page.locator('.commercial-order').filter({ hasText: `#${order.id.slice(0, 6)}` });
  await card.getByRole('button', { name: 'Fazer proposta', exact: true }).click();
  await dialog.getByLabel('Origem da proposta', { exact: true }).selectOption('e-industry');
  await dialog.getByLabel('Preço proposto', { exact: true }).fill('490');
  await dialog
    .getByRole('button', { name: 'Selecionar TransBrasil Logística', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await actor(page, 'player2');
  await orders(page);
  card = page.locator('.commercial-order').filter({ hasText: `#${order.id.slice(0, 6)}` });
  await card.getByRole('button', { name: 'Contrapropor', exact: true }).click();
  await dialog.getByLabel('Preço proposto', { exact: true }).fill('480');
  await dialog.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await actor(page, 'player');
  await orders(page);
  card = page.locator('.commercial-order').filter({ hasText: `#${order.id.slice(0, 6)}` });
  await card.getByRole('button', { name: 'Revisar e aceitar', exact: true }).click();
  const accepted = page.waitForResponse(
    (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Confirmar aceitação e transporte', exact: true })
    .click();
  const after = (await (await accepted).json()) as World;
  expect(after.orders.find((o) => o.id === order.id)?.status).toBe('accepted');
  expect(after.shipments.filter((s) => s.orderId === order.id)).toHaveLength(3);
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Comércio' })
    .getByRole('button', { name: 'Entregas', exact: true })
    .click();
  await page
    .locator('.shipment-item')
    .filter({ hasText: order.id.slice(0, 6).toUpperCase() })
    .click();
  await expect(page.getByRole('heading', { name: 'Caminhões deste pedido' })).toBeVisible();
  await expect(page.locator('.shipment-truck')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/competition/private-order.png', fullPage: true });
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Meus Negócios', exact: true })
    .click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Indústria de Aço' })
    .getByRole('button', { name: 'Gerenciar', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Abastecimento', exact: true }).click();
  const planner = page.locator('.supply-planner');
  await planner.getByRole('tab', { name: 'Avançada', exact: true }).click();
  await planner.getByLabel('Ativar abastecimento automático', { exact: true }).check();
  await planner
    .getByLabel('Origem do abastecimento', { exact: true })
    .selectOption('internal-only');
  await planner.getByLabel('Orçamento de abastecimento', { exact: true }).fill('50000');
  await planner.getByLabel('Mínimo de Minério de ferro', { exact: true }).fill('100');
  await planner.getByLabel('Alvo de Minério de ferro', { exact: true }).fill('200');
  await planner.getByLabel('Mercadoria da projeção', { exact: true }).selectOption('iron');
  await expect(planner.locator('canvas')).toBeVisible();
  await planner
    .getByRole('button', { name: 'Salvar regras de abastecimento', exact: true })
    .click();
  await expect(page.getByText('Regras de abastecimento salvas.', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/competition/supply-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Estoque', exact: true }).click();
  await page.getByRole('button', { name: 'Trazer de outro estoque', exact: true }).click();
  await dialog.getByLabel('Origem da transferência', { exact: true }).selectOption('e-mine');
  await dialog.getByLabel('Produto da transferência', { exact: true }).selectOption('iron');
  await dialog.getByLabel('Quantidade para transferir', { exact: true }).fill('1');
  await dialog.getByRole('button', { name: 'Selecionar Minha frota', exact: true }).click();
  const moved = page.waitForResponse(
    (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Confirmar transferência e transporte', exact: true })
    .click();
  const movedWorld = (await (await moved).json()) as World;
  expect(
    movedWorld.shipments.some(
      (s) => s.originId === 'e-mine' && s.destinationId === 'e-industry' && s.quantity === 1,
    ),
  ).toBe(true);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('tab', { name: 'Funcionários', exact: true }).click();
  await page.getByLabel('Funcionários desejados', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Aplicar equipe', exact: true }).click();
  await page
    .getByRole('button', { name: 'Planejar investimento em educação', exact: true })
    .click();
  await page.getByRole('button', { name: 'Pagar educação e iniciar', exact: true }).click();
  await expect(page.getByText('Treinamento pago em andamento', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/competition/workforce-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
