import { test, expect, type Page } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute, RuleError } from '../../packages/simulation/src/engine';
import { equipmentCostFor } from '../../packages/simulation/src/design';
import type { Command, World } from '../../packages/simulation/src/model';

async function fixture(page: Page, world: World, destination: 'map' | 'industry' = 'map') {
  const commands: Command[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  await page.route('**/api/commands', async (route) => {
    const command = route.request().postDataJSON() as Command;
    commands.push(command);
    try {
      execute(world, 'player', command, world.updatedAt);
      world.revision++;
      await route.fulfill({ json: world });
    } catch (error) {
      await route.fulfill({
        status: error instanceof RuleError ? 409 : 500,
        json: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  });
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      json: {
        tilejson: '3.0.0',
        tiles: [`${test.info().project.use.baseURL}/__opening/empty.pbf?z={z}&x={x}&y={y}`],
        minzoom: 0,
        maxzoom: 14,
        vector_layers: ['landcover', 'water', 'waterway', 'transportation'].map((id) => ({
          id,
          fields: {},
        })),
      },
    }),
  );
  await page.route('**/__opening/empty.pbf?**', (route) =>
    route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }),
  );
  await page.addInitScript(
    ({ season, destination }) => {
      localStorage.setItem('aftermarket.company', 'player');
      localStorage.setItem('aftermarket.page', destination);
      localStorage.setItem('aftermarket.business', 'e-newindustry');
      localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
    },
    { season: world.season.id, destination },
  );
  await page.goto('/jogar');
  return { commands, errors };
}

const totalMoney = (world: World) => world.companies.reduce((total, c) => total + c.balance, 0);

test('nova unidade separa imóvel, equipamento e equipe sem contratar automaticamente', async ({
  page,
}, testInfo) => {
  const world = createWorld(Date.now());
  const property = world.properties.find((p) => p.id === 'newindustry')!;
  const player = world.companies.find((c) => c.id === 'player')!;
  const beforeMoney = totalMoney(world),
    beforeBalance = player.balance;
  const { commands, errors } = await fixture(page, world);

  const propertyButton = page.locator('.main-map [data-property="newindustry"]');
  await propertyButton.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Comprar terreno ·/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comprar terreno' })).toBeVisible();
  await page.getByRole('button', { name: /^Confirmar compra ·/ }).click();
  const purchase = page.getByRole('dialog');
  await expect(purchase.getByRole('heading', { name: 'Dar nome ao novo negócio' })).toBeVisible();
  await purchase.getByLabel('Nome do estabelecimento', { exact: true }).fill('Fábrica em etapas');
  await purchase.getByRole('button', { name: /^Comprar por / }).click();

  await expect(page.getByRole('heading', { name: 'Fábrica em etapas', exact: true })).toBeVisible();
  const unit = world.establishments.find((e) => e.id === 'e-newindustry')!;
  expect(property.ownerId).toBe('player');
  expect(unit.employees).toBe(0);
  expect(unit.installed).toBe(false);
  expect(player.balance).toBe(beforeBalance - property.price);
  expect(totalMoney(world)).toBe(beforeMoney);

  const steel = world.season.config.recipes.find((r) => r.id === 'steel-bars')!;
  await page.getByRole('radio', { name: new RegExp(steel.name) }).click();
  const installation = page.getByRole('region', { name: 'Instalar equipamentos' });
  await installation
    .getByRole('spinbutton', { name: 'Linhas de equipamento', exact: true })
    .fill('1');
  await installation.getByRole('button', { name: /^Instalar por / }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByRole('heading', { name: 'Confirmar instalação' })).toBeVisible();
  await confirmation
    .getByRole('button', { name: 'Pagar equipamento e instalar', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Sua equipe', exact: true })).toBeVisible();
  expect(unit.installed).toBe(true);
  expect(unit.employees).toBe(0);
  expect(unit.equipmentLines).toBe(1);
  expect(unit.installationValue).toBe(equipmentCostFor(world, 'industry', 'steel-bars'));
  expect(player.balance).toBe(beforeBalance - property.price - unit.installationValue!);
  expect(totalMoney(world)).toBe(beforeMoney);

  await page.getByLabel('Funcionários desejados', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Contratar 18', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '18 pessoas contratadas', exact: false }),
  ).toBeVisible();
  expect(unit.employees).toBe(18);
  expect(commands.map((c) => c.type)).toEqual(['buyProperty', 'installBusiness', 'setWorkforce']);
  expect(totalMoney(world)).toBe(beforeMoney);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('opening-team.png'), fullPage: true });
});

test('especialidade que não cabe explica a área e não envia instalação nem cobrança', async ({
  page,
}, testInfo) => {
  const world = createWorld(Date.now());
  execute(
    world,
    'player',
    { type: 'buyProperty', propertyId: 'newindustry', name: 'Galpão pequeno' },
    world.updatedAt,
  );
  const property = world.properties.find((p) => p.id === 'newindustry')!;
  const profile = world.season.config.operations.profiles['steel-bars'];
  property.area = profile.areaM2 - 1;
  const before = structuredClone(world);
  const { commands, errors } = await fixture(page, world, 'industry');
  const installation = page.getByRole('region', { name: 'Instalar equipamentos' });
  const steel = world.season.config.recipes.find((r) => r.id === 'steel-bars')!;
  await installation.getByRole('radio', { name: new RegExp(steel.name) }).click();
  await expect(installation.getByRole('status')).toContainText('uma linha de');
  await expect(installation.getByRole('status')).toContainText(
    'Escolha outra especialidade ou um imóvel maior.',
  );
  const install = installation.getByRole('button', { name: /^Instalar por / });
  await expect(install).toBeDisabled();
  await install.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(commands).toEqual([]);
  expect(world).toEqual(before);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('opening-no-space.png'), fullPage: true });
});

test('unidade sem espaço para ampliar mantém as linhas e bloqueia nova cobrança', async ({
  page,
}) => {
  const world = createWorld(Date.now());
  execute(
    world,
    'player',
    { type: 'buyProperty', propertyId: 'newindustry', name: 'Unidade completa' },
    world.updatedAt,
  );
  const property = world.properties.find((p) => p.id === 'newindustry')!;
  property.area = world.season.config.operations.profiles['steel-bars'].areaM2;
  execute(
    world,
    'player',
    { type: 'installBusiness', establishmentId: 'e-newindustry', recipeId: 'steel-bars', lines: 1 },
    world.updatedAt,
  );
  const before = structuredClone(world);
  const { commands, errors } = await fixture(page, world, 'industry');
  await page.getByRole('tab', { name: 'Equipe', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Equipamentos e capacidade' }).click();
  const installation = page.getByRole('region', { name: 'Instalar equipamentos' });
  await expect(installation.getByRole('status')).toContainText('já atingiu o limite de 1 linha');
  await expect(installation.getByRole('button', { name: /^Instalar por / })).toBeDisabled();
  await expect(
    installation.getByRole('spinbutton', { name: 'Linhas de equipamento', exact: true }),
  ).toHaveCount(0);
  expect(commands).toEqual([]);
  expect(world).toEqual(before);
  expect(errors).toEqual([]);
});
