import { test, expect } from './fixtures';
import type { World } from '../../packages/simulation/src/model';

test('compra, frete, entrega e produção alteram o estado real e persistem após recarregar', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/jogar');
  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await page.getByLabel('Produto', { exact: true }).selectOption('coal');
  await page.getByLabel('Destino da compra').selectOption('e-industry');
  await page.getByLabel('Quantidade de mercadoria').fill('3');
  await page
    .getByRole('row')
    .filter({ hasText: 'FerroVale Comercial' })
    .getByRole('button', { name: 'Selecionar', exact: true })
    .click();
  const before = (await (await request.get('/api/world')).json()) as World;
  await page.getByRole('button', { name: 'Continuar para frete' }).click();
  await page
    .getByRole('button', { name: /Selecionar /, exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Contratar e comprar' }).click();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Pagar / })
    .click();
  const bought = (await (await response).json()) as World;
  const shipment = bought.shipments.find((s) => !before.shipments.some((old) => old.id === s.id))!;
  expect(shipment).toBeTruthy();
  expect(shipment.product).toBe('coal');
  expect(shipment.quantity).toBe(3);
  const inventory = bought.establishments.find((e) => e.id === 'e-industry')!.inventory;
  expect(inventory.coal).toBe(
    before.establishments.find((e) => e.id === 'e-industry')!.inventory.coal,
  );
  await expect
    .poll(
      async () => {
        const world = (await (await request.get('/api/world')).json()) as World;
        return world.shipments.find((s) => s.id === shipment.id)?.delivered;
      },
      { timeout: 125000, intervals: [2000] },
    )
    .toBe(true);
  await page.reload();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Meus Negócios', exact: true })
    .click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Indústria de Aço' })
    .getByRole('button', { name: 'Gerenciar' })
    .click();
  const delivered = (await (await request.get('/api/world')).json()) as World;
  expect(delivered.establishments.find((e) => e.id === 'e-industry')!.inventory.coal).toBe(
    inventory.coal! + 3,
  );
  await page.getByRole('button', { name: 'Adicionar produção', exact: true }).click();
  const production = page.waitForResponse(
    (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar produção' }).click();
  const queued = (await (await production).json()) as World;
  expect(queued.establishments.find((e) => e.id === 'e-industry')!.inventory.coal).toBe(
    inventory.coal,
  );
  const job = queued.jobs.find((j) => !delivered.jobs.some((old) => old.id === j.id))!;
  await expect
    .poll(
      async () => {
        const world = (await (await request.get('/api/world')).json()) as World;
        return world.jobs.find((j) => j.id === job.id)?.completed;
      },
      { timeout: 40000, intervals: [2000] },
    )
    .toBe(true);
  const completed = (await (await request.get('/api/world')).json()) as World;
  expect(completed.establishments.find((e) => e.id === 'e-industry')!.inventory.steel).toBe(
    inventory.steel! + 8,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Operação industrial' })).toBeVisible();
  expect(errors).toEqual([]);
});
