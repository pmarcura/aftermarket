import { test, expect } from '@playwright/test';
import type { World } from '../../packages/simulation/src/model';
test('nova unidade separa imóvel, equipamento e equipe sem contratar automaticamente', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
  });
  await page.goto('/jogar');
  await page.getByRole('button', { name: 'Comprar propriedade', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: false }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do estabelecimento', { exact: true }).fill('Fábrica em etapas');
  await dialog.getByRole('button', { name: /Comprar por / }).click();
  await expect(
    page.getByRole('heading', { name: 'Instalar antes de operar', exact: true }),
  ).toBeVisible();
  let world = (await (await request.get('/api/world')).json()) as World,
    unit = world.establishments.find((e) => e.name === 'Fábrica em etapas')!;
  expect(unit.employees).toBe(0);
  expect(unit.installed).toBe(false);
  await page.getByLabel('Especialidade da instalação', { exact: true }).selectOption('steel-bars');
  await page.screenshot({ path: 'test-results/design/opening-budget.png', fullPage: true });
  await page
    .getByRole('button', { name: 'Revisar investimento em equipamento', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Pagar equipamento e instalar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Equipe, remuneração e educação', exact: true }),
  ).toBeVisible();
  world = (await (await request.get('/api/world')).json()) as World;
  unit = world.establishments.find((e) => e.id === unit.id)!;
  expect(unit.installed).toBe(true);
  expect(unit.employees).toBe(0);
  expect(unit.installationValue).toBe(35000000);
  await page.getByLabel('Funcionários desejados', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Aplicar equipe', exact: true }).click();
  await expect(page.getByText('18 contratados', { exact: true })).toBeVisible();
});
