import { test, expect } from './fixtures';
import { type Page } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { TIME_SCALE } from '../../packages/simulation/src/model';

async function fitsViewport(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

for (const viewport of [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`navegação ${viewport.name}: mapa por teclado, loja, comércio e empresa preservam o mundo`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const world = createWorld(Date.now());
    const player = world.companies.find((company) => company.id === 'player')!;
    const store = world.establishments.find(
      (unit) => unit.companyId === 'player' && unit.category === 'retail',
    )!;
    const carrier = world.establishments.find(
      (unit) => unit.companyId === 'player' && unit.category === 'logistics',
    );
    const lot = world.properties.find((property) => !property.ownerId)!;
    const errors: string[] = [];
    const unexpectedApi: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    // A fixture só apresenta o mundo. Nenhuma ação deste fluxo pode enviar comandos ao servidor.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/world') return route.fulfill({ json: world });
      if (url.pathname === '/api/market-history')
        return route.fulfill({ json: { samples: [], trades: [] } });
      if (url.pathname.startsWith('/api/')) {
        unexpectedApi.push(`${route.request().method()} ${url.pathname}`);
        return route.fulfill({ status: 503, json: { error: 'API não prevista no teste.' } });
      }
      // Tiles e demais hosts externos: entregues ao bloqueio de ./fixtures (bloquearRedeExterna).
      return route.fallback();
    });
    await page.addInitScript((seasonId) => {
      if (!localStorage.getItem('aftermarket.navigation-fixture')) {
        localStorage.clear();
        localStorage.setItem('aftermarket.navigation-fixture', '1');
        localStorage.setItem('aftermarket.company', 'player');
        localStorage.setItem('aftermarket.page', 'inicio');
      }
      localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
    }, world.season.id);
    await page.goto('/jogar');
    const menu = page.getByRole('navigation', { name: 'Menu principal', exact: true });
    await expect(
      page.getByRole('heading', { level: 1, name: player.name, exact: true }),
    ).toBeVisible();
    await fitsViewport(page, viewport.width);

    await test.step('explicar o relógio e os dados simulados nas preferências', async () => {
      if (viewport.name === 'desktop')
        await page.getByRole('button', { name: 'Configurações', exact: true }).click();
      else {
        await page.locator('.profile-button').click();
        await page.getByRole('button', { name: 'Preferências e contas', exact: true }).click();
      }
      const preferences = page.getByRole('dialog');
      await expect(preferences).toBeVisible();
      await expect(
        preferences.getByRole('heading', { name: 'Preferências do mundo', exact: true }),
      ).toBeVisible();
      await expect(
        preferences.getByText(`1 minuto real = ${TIME_SCALE} minutos no jogo`, { exact: true }),
      ).toBeVisible();
      await expect(preferences.getByText('Dados simulados', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(preferences).not.toBeVisible();
    });

    await test.step('filtrar e selecionar terreno pelo teclado sem comprar', async () => {
      await menu.getByRole('button', { name: 'Mapa', exact: true }).focus();
      await page.keyboard.press('Enter');
      const filters = page.getByRole('group', { name: 'Filtrar mapa', exact: true });
      await filters.getByRole('button', { name: 'Terrenos à venda', exact: true }).click();
      await expect(
        filters.getByRole('button', { name: 'Terrenos à venda', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.map-access button:not([data-owner="available"])')).toHaveCount(0);
      const property = page.locator(`.map-access button[data-property="${lot.id}"]`);
      await property.focus();
      await expect(property).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('heading', { name: `Terreno em ${lot.city}`, exact: true }),
      ).toBeVisible();
      await fitsViewport(page, viewport.width);
      await page.screenshot({ path: `test-results/mapa-${viewport.name}.png`, fullPage: true });
      await page.getByRole('button', { name: /^Comprar terreno ·/ }).click();
      await expect(
        page.getByRole('heading', { name: 'Comprar terreno', exact: true }),
      ).toBeVisible();
      await fitsViewport(page, viewport.width);
    });

    await test.step('abrir a loja e suas quatro abas', async () => {
      await menu.getByRole('button', { name: 'Negócios', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Meus negócios', exact: true })).toBeVisible();
      const card = page
        .locator('article.neg-item')
        .filter({ has: page.getByRole('heading', { name: store.name, exact: true }) });
      await card.getByRole('button', { name: /^Abrir/ }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: store.name, exact: true }),
      ).toBeVisible();
      for (const name of ['Prateleira', 'Abastecimento', 'Equipe', 'Finanças']) {
        const tab = page.getByRole('tab', { name, exact: true });
        await tab.focus();
        await page.keyboard.press('Enter');
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await fitsViewport(page, viewport.width);
      }
      await page.screenshot({ path: `test-results/loja-${viewport.name}.png`, fullPage: true });
    });

    await test.step('visitar as abas de comércio e a frota', async () => {
      await menu.getByRole('button', { name: 'Comércio', exact: true }).click();
      const commerce = page.getByRole('navigation', { name: 'Comércio', exact: true });
      for (const [tab, heading] of [
        ['Comprar', 'Comprar mercadorias'],
        ['Cotações', 'Cotações'],
        ['Pedidos', 'Pedidos e entregas'],
        ['Contratos', 'Contratos públicos'],
      ]) {
        await commerce.getByRole('button', { name: tab, exact: true }).click();
        await expect(
          page.getByRole('heading', { level: 1, name: heading, exact: true }),
        ).toBeVisible();
        await expect(commerce.getByRole('button', { name: tab, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        await fitsViewport(page, viewport.width);
      }
      await menu.getByRole('button', { name: 'Negócios', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Meus Negócios', exact: true })
        .getByRole('button', { name: 'Frota', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { level: 1, name: carrier?.name ?? 'Minha frota', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('list', { name: 'Caminhões da frota', exact: true }),
      ).toBeVisible();
      await fitsViewport(page, viewport.width);
      await page.screenshot({ path: `test-results/frota-${viewport.name}.png`, fullPage: true });
    });

    await test.step('preservar o destino na recarga e buscar uma cidade pelo teclado', async () => {
      await menu.getByRole('button', { name: 'Empresa', exact: true }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Minha empresa', exact: true }),
      ).toBeVisible();
      await fitsViewport(page, viewport.width);
      await page.reload();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Minha empresa', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('aftermarket.page'))).toBe('company');
      const search = page.getByRole('textbox', { name: 'Buscar cidade, empresa ou recurso' });
      await search.fill('Campinas');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('group', { name: 'Filtrar mapa', exact: true })).toBeVisible();
      await fitsViewport(page, viewport.width);
    });
    expect(unexpectedApi).toEqual([]);
    expect(errors).toEqual([]);
  });
}
