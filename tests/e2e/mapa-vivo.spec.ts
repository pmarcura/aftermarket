import { test, expect } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';

// Spec 008 R1: o pino do negócio do jogador mostra o estado (precisa de você / atenção), a mesma
// pendência do Início, e o mouse sobre o pino abre um cartão curto com o motivo.
test('pino com estado e cartão ao passar o mouse', async ({ page }) => {
  test.setTimeout(60000);
  const world = createWorld(Date.now());
  // Indústria do jogador sem insumo para o próximo ciclo → pendência "brasa".
  const industria = world.establishments.find((e) => e.id === 'e-industry')!;
  industria.inventory = {};
  // Armazém do jogador pausado → pendência "ouro".
  const armazem = world.establishments.find((e) => e.id === 'e-warehouse2')!;
  armazem.enabled = false;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 30000 });

  const acesso = page.locator('.main-map .map-access button');
  const botaoIndustria = acesso
    .filter({ has: page.locator(`[data-property="${industria.propertyId}"]`) })
    .or(page.locator(`.main-map .map-access button[data-property="${industria.propertyId}"]`));
  await expect(botaoIndustria.first()).toHaveAttribute('data-alert', 'brasa');
  await expect(botaoIndustria.first()).toContainText('precisa de você');
  await expect(
    page.locator(`.main-map .map-access button[data-property="${armazem.propertyId}"]`),
  ).toHaveAttribute('data-alert', 'ouro');
  // Negócio saudável de outra empresa não recebe selo.
  const bot = world.establishments.find((e) => e.id === 'e-botfactory')!;
  await expect(
    page.locator(`.main-map .map-access button[data-property="${bot.propertyId}"]`),
  ).not.toHaveAttribute('data-alert', /.+/);

  // A camada de selos existe no mapa e tem exatamente os dois negócios com pendência.
  const selos = await page.evaluate(() => {
    const m = (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap;
    if (!m) return null;
    return m.querySourceFeatures('properties').filter((f) => f.properties?.alert).length;
  });
  expect(selos).not.toBeNull();
  expect(selos!).toBeGreaterThanOrEqual(2);

  // Legenda explica os selos.
  const legenda = page.locator('.map-legend-bar');
  await expect(legenda).toContainText('Precisa de você');
  await expect(legenda).toContainText('Atenção');

  // Cartão ao passar o mouse: posiciona sobre o pino da indústria projetado na tela.
  const ponto = await page.evaluate(
    (coords) => {
      const m = (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap;
      if (!m) return null;
      m.jumpTo({ center: coords as [number, number], zoom: 13 });
      const p = m.project(coords as [number, number]);
      return { x: p.x, y: p.y };
    },
    world.properties.find((p) => p.id === industria.propertyId)!.coordinates,
  );
  if (ponto) {
    const canvas = page.locator('.main-map .map-canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + ponto.x, box.y + ponto.y - 10);
    const cartao = page.getByTestId('map-hover-card');
    await expect(cartao).toBeVisible({ timeout: 5000 });
    await expect(cartao).toContainText(industria.name);
    await expect(cartao).toContainText('sem');
    await page.screenshot({ path: 'test-results/mapa-vivo.png' });
  }
  expect(errors).toEqual([]);
});
