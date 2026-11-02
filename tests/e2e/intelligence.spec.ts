import { test, expect } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';
import { advance } from '../../packages/simulation/src/engine';
import { createClock, economicInterval } from '../../packages/simulation/src/clock';

// Os mundos destes testes nascem no relógio padrão (120×).
const ROUND = economicInterval(createClock());

test('titularidade, filtros vazios e análise profissional usam dados internos', async ({
  page,
}) => {
  test.setTimeout(60000);
  // Mundo de referência com algumas rodadas do motor: o histórico de preços e os negócios do
  // gráfico saem do próprio motor, não de números escritos no teste.
  const now = Date.now(),
    world = createWorld(now - 6 * ROUND);
  advance(world, now);
  expect(world.marketHistory.some((s) => s.product === 'iron')).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  // Mesmo recorte do servidor (`/api/market-history`), aplicado ao mundo desta fixture.
  await page.route('**/api/market-history?**', (route) => {
    const url = new URL(route.request().url()),
      product = url.searchParams.get('product'),
      regionId = url.searchParams.get('region') ?? '';
    return route.fulfill({
      json: {
        product,
        regionId,
        startedAt: world.economyStartedAt,
        seasonId: world.season.id,
        samples: world.marketHistory.filter(
          (s) => s.product === product && s.regionId === regionId,
        ),
        trades: world.ledger.filter(
          (e) => e.product === product && e.channel === 'wholesale' && !regionId,
        ),
      },
    });
  });
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');

  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 30000 });
  const filtros = page.getByRole('group', { name: 'Filtrar mapa', exact: true });
  await filtros.getByRole('button', { name: 'Meus negócios', exact: true }).click();
  await expect(filtros.getByRole('button', { name: 'Meus negócios' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const lotes = page.locator('.main-map .map-access button');
  await expect
    .poll(() =>
      lotes.evaluateAll((nodes) =>
        nodes.every((n) => (n as HTMLElement).dataset.owner === 'player'),
      ),
    )
    .toBe(true);
  expect(await lotes.count()).toBe(world.properties.filter((p) => p.ownerId === 'player').length);

  await page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Comércio', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Comércio' })
    .getByRole('button', { name: 'Cotações', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cotações' })).toBeVisible();
  // Nenhum filtro vem marcado: o quadro abre com todas as categorias.
  await expect(
    page
      .getByRole('radiogroup', { name: 'Categoria', exact: true })
      .getByRole('radio', { name: 'Tudo', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  const quadro = page.getByRole('list', { name: 'Quadro de cotações', exact: true });
  await expect(quadro.getByRole('article').first()).toBeVisible();

  // Ficha do produto: preço, estoque e histórico do mundo, com a tabela dos valores.
  await quadro
    .getByRole('article')
    .filter({ hasText: 'Minério de ferro' })
    .getByRole('heading', { name: 'Minério de ferro' })
    .getByRole('button')
    .click();
  const ficha = page.getByRole('dialog', { name: 'Minério de ferro' });
  await expect(ficha.getByRole('heading', { name: 'Preço ao longo do tempo' })).toBeVisible();
  await ficha.getByRole('button', { name: 'Ver valores', exact: true }).first().click();
  await expect(ficha.getByRole('table').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ficha).not.toBeVisible();

  // Análise avançada: período sem filtro, gráfico, tabela e velas de negócios executados.
  await page.locator('summary').filter({ hasText: 'Análise avançada' }).click();
  await page.getByLabel('Produto da análise', { exact: true }).selectOption('iron');
  await expect(page.getByRole('heading', { name: 'Minério de ferro', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Período do histórico', { exact: true })).toHaveValue('');
  // O ECharts troca o aria-label do gráfico pela descrição automática dele (ver Achados da 001b).
  const grafico = page.locator('.product-analysis .economic-chart');
  await expect(grafico.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Ver tabela', exact: true }).click();
  await expect(page.getByRole('table', { name: /^Observações de Minério de ferro/ })).toBeVisible();
  await page.getByLabel('Tipo de gráfico', { exact: true }).selectOption('candlestick');
  await expect(grafico.locator('canvas')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/economy/analysis-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: 'test-results/economy/analysis-desktop.png', fullPage: true });

  // Comprar abre sem produto nem filtro escolhido por conta própria.
  await page
    .getByRole('navigation', { name: 'Comércio' })
    .getByRole('button', { name: 'Comprar', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comprar mercadorias' })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Ver todas as ofertas' }).click();
  await expect(page.getByLabel('Produto', { exact: true })).toHaveValue('');
  await page.locator('summary').filter({ hasText: 'Mais filtros' }).click();
  await expect(page.getByLabel('Estado de origem', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Tipo de empresa', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});
