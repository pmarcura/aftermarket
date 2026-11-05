import { test, expect } from './fixtures';
import { createScenario } from '../../packages/simulation/src/scenarios';
import { worldView } from '../../apps/server/src/view';
import { marketHistories } from '../../apps/server/src/market-history';
import type { ProductId } from '../../packages/simulation/src/model';

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`Início com 550 empresas: histórico agrupado e navegação ${viewport.width}`, async ({
    page,
  }, info) => {
    const world = createScenario(Date.now(), 'playtest', 0, { scale: 20 });
    const view = worldView(world, 'player');
    const errors: string[] = [],
      historyUrls: string[] = [],
      mutations: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') {
        mutations.push(url.pathname);
        return route.abort();
      }
      if (url.pathname === '/api/world') return route.fulfill({ json: view });
      if (url.pathname === '/api/market-history') {
        historyUrls.push(url.href);
        const ids = url.searchParams.get('products')?.split(',') as ProductId[];
        return route.fulfill({ json: marketHistories(world, ids) });
      }
      return route.fulfill({ status: 404, json: { error: 'Não previsto na fixture.' } });
    });
    await page.addInitScript((season) => {
      localStorage.clear();
      localStorage.setItem('aftermarket.page', 'inicio');
      localStorage.setItem('aftermarket.firstSteps', 'closed');
      localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
    }, world.season.id);
    await page.goto('/jogar');
    await expect(
      page.getByRole('heading', { name: 'Silva Participações', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pregão', exact: true })).toBeVisible();
    await expect.poll(() => historyUrls.length).toBeGreaterThan(0);
    expect(historyUrls.every((url) => new URL(url).searchParams.has('products'))).toBe(true);
    // React StrictMode can start and cancel the first effect; no 8-product fan-out.
    expect(historyUrls.length).toBeLessThanOrEqual(2);
    const menu = page.getByRole('navigation', { name: 'Menu principal', exact: true });
    await menu.getByRole('button', { name: 'Empresa', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Minha empresa', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'Início', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Silva Participações', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
    await info.attach('loading.json', {
      body: JSON.stringify(
        await page.evaluate(() => ({
          navigation: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
          paint: performance.getEntriesByType('paint').map((entry) => entry.toJSON()),
        })),
      ),
      contentType: 'application/json',
    });
    await page.screenshot({
      path: `test-results/performance/inicio-${viewport.width}.png`,
      fullPage: false,
    });
  });
}

test('respostas HTTP usam gzip e a leitura agrupada conserva o endpoint individual', async ({
  request,
}) => {
  const world = await request.get('/api/world', { headers: { 'Accept-Encoding': 'gzip' } });
  expect(world.ok()).toBe(true);
  expect(world.headers()['content-encoding']).toBe('gzip');
  const grouped = await request.get('/api/market-history?products=steel,coal&region=', {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  expect(grouped.ok()).toBe(true);
  const individual = await request.get('/api/market-history?product=steel&region=');
  const [many, one] = await Promise.all([grouped.json(), individual.json()]);
  expect(many.steel.samples).toEqual(one.samples);
  expect(many.steel.trades).toEqual(
    one.trades.map(({ at, from, to, product, quantity, unitPrice }: Record<string, unknown>) => ({
      at,
      from,
      to,
      product,
      quantity,
      unitPrice,
    })),
  );
  expect((await request.get('/api/market-history?products=invalid')).status()).toBe(400);
});

test('API pendente não acumula consultas e Tentar novamente reconecta', async ({ page }) => {
  const world = createScenario(Date.now(), 'playtest');
  let recover = false,
    requests = 0;
  await page.clock.install();
  await page.route('**/api/world*', (route) => {
    requests++;
    if (recover) return route.fulfill({ json: world });
    return new Promise<void>(() => {});
  });
  await page.addInitScript((season) => {
    localStorage.clear();
    localStorage.setItem('aftermarket.page', 'company');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await expect(page.getByText('Conectando à economia…', { exact: true })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThan(0);
  const initial = requests;
  await page.clock.runFor(12000);
  expect(requests).toBe(initial);
  await page.clock.runFor(3100);
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  recover = true;
  const before = requests;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha empresa', exact: true })).toBeVisible();
  expect(requests).toBe(before + 1);
});
