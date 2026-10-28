import { test, expect } from '@playwright/test';
test('as dez telas carregam, navegam e mantêm o estado do mundo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 25000 });
  // O mapa abre sem terreno escolhido; escolhe um disponível pelo teclado.
  await page.locator('.main-map .map-access button[data-owner="available"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Propriedade disponível' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/mapa-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Comprar propriedade', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Comprar propriedade', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Comércio' })
    .getByRole('button', { name: 'Oportunidades', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Análise de oportunidades' })).toBeVisible();
  await page.locator('.economic-map [data-map-ready="true"]').waitFor({ timeout: 25000 });
  await page.screenshot({ path: 'test-results/oportunidades-desktop.png', fullPage: true });
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Meus Negócios', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Meus Negócios', exact: true })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'Indústria de Aço' })
    .getByRole('button', { name: 'Gerenciar' })
    .click();
  await expect(page.getByRole('heading', { name: 'Operação industrial' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar produção', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Meus Negócios', exact: true })
    .click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Loja Campinas' })
    .getByRole('button', { name: 'Gerenciar' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Loja Campinas', exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Comprar mercadorias' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mercado-desktop.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Comércio' })
    .getByRole('button', { name: 'Entregas', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Entregas' })).toBeVisible();
  await page.getByRole('button', { name: 'Minha transportadora' }).click();
  await expect(
    page.getByRole('heading', { name: 'Transportadora Aurora', exact: true }),
  ).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Empresa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Empresa e Finanças' })).toBeVisible();
  await page.screenshot({ path: 'test-results/financas-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  expect(errors).toEqual([]);
});
test('a busca e a navegação funcionam em viewport móvel sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Oportunidades' }).click();
  await expect(page.getByRole('heading', { name: 'Análise de oportunidades' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/oportunidades-mobile.png', fullPage: true });
  await page.getByRole('navigation').getByRole('button', { name: 'Meus Negócios' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('navigation').getByRole('button', { name: 'Empresa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Empresa e Finanças' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
