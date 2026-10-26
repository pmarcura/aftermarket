import { test, expect } from '@playwright/test';

test('titularidade, filtros vazios e análise profissional usam dados internos', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('.main-map [data-map-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Minhas propriedades', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.main-map .map-marker')
        .evaluateAll((nodes) => nodes.every((n) => (n as HTMLElement).dataset.owner === 'player')),
    )
    .toBe(true);
  expect(await page.locator('.main-map .map-marker').count()).toBeGreaterThan(0);
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Oportunidades', exact: true })
    .click();
  for (const label of [
    'Categoria de oportunidade',
    'Mercadoria de oportunidade',
    'Estado de oportunidade',
    'Município de oportunidade',
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await expect(page.locator('.commodity-card')).toHaveCount(10);
  await page.getByLabel('Mercadoria de oportunidade', { exact: true }).selectOption('iron');
  await page.getByRole('button', { name: 'Ver mais', exact: false }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Minério de ferro', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Ver mais detalhes', exact: true }).click();
  await expect(dialog.getByLabel('Período do histórico', { exact: true })).toHaveValue('');
  await expect(dialog.locator('canvas')).toBeVisible();
  await dialog.getByRole('button', { name: 'Ver tabela', exact: true }).click();
  await expect(dialog.locator('table')).toBeVisible();
  await dialog.getByLabel('Tipo de gráfico', { exact: true }).selectOption('candlestick');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/economy/analysis-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: 'test-results/economy/analysis-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  await page.getByRole('tab', { name: 'Avançada', exact: true }).click();
  await page.locator('.economic-map [data-map-ready="true"]').waitFor({ timeout: 25000 });
  await expect(page.locator('.economic-bubble').first()).toBeVisible();
  const clusters = page.locator('.economic-bubble').filter({ hasText: /praças/ });
  if (await clusters.count()) {
    const before = await page.locator('.economic-bubble').count();
    await clusters.first().click();
    await expect.poll(() => page.locator('.economic-bubble').count()).toBeGreaterThan(before);
    await expect(page.getByLabel('Município de oportunidade', { exact: true })).toHaveValue('');
  }
  await page.screenshot({
    path: 'test-results/economy/opportunities-advanced.png',
    fullPage: true,
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Mercado', exact: true }).click();
  await expect(page.getByLabel('Produto', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Destino da compra', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Quantidade de mercadoria', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Ordenar ofertas', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});
