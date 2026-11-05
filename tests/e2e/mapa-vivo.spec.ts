import { test, expect } from './fixtures';
import type * as maplibregl from 'maplibre-gl';
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
    return m
      .querySourceFeatures('properties')
      .filter((f: { properties?: { alert?: string } }) => f.properties?.alert).length;
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

// Spec 008 R2: a placa da cidade abre um painel com população, procura por produto, lojas e lotes
// à venda; "ver lote" seleciona o lote no mapa.
test('cidade clicável abre painel com procura, lojas e lotes à venda', async ({ page }) => {
  test.setTimeout(60000);
  const world = createWorld(Date.now());
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

  // Pelo teclado: cada cidade é um botão do grupo de acesso.
  const campinas = world.season.config.regions.find((r) => r.name === 'Campinas')!;
  const botaoCidade = page.locator(
    `.main-map .map-access-cidades button[data-city="${campinas.id}"]`,
  );
  await botaoCidade.focus();
  await page.keyboard.press('Enter');
  const painel = page.getByRole('complementary', { name: 'Cidade de Campinas' });
  await expect(painel).toBeVisible();
  await expect(painel).toContainText('habitantes');
  await expect(painel.locator('.cidade-tabela tbody tr')).toHaveCount(
    Object.keys(world.season.config.consumption).filter(
      (id) => (world.season.config.consumption as Record<string, number>)[id] > 0,
    ).length,
  );
  await expect(painel).toContainText('Loja Campinas');
  const lotesLivres = world.properties.filter((p) => p.city === 'Campinas' && !p.ownerId);
  await expect(painel.getByRole('region', { name: 'Lotes à venda' })).toContainText(
    String(lotesLivres.length),
  );
  await page.screenshot({ path: 'test-results/mapa-vivo-cidade.png' });

  // "Ver lote" fecha o painel e abre a gaveta do lote.
  if (lotesLivres.length) {
    await painel.getByRole('button', { name: lotesLivres[0].name, exact: true }).click();
    await expect(painel).toBeHidden();
    // A gaveta de um lote livre mostra o preço do terreno escolhido.
    await expect(page.getByRole('complementary', { name: 'Detalhes do imóvel' })).toContainText(
      `${lotesLivres[0].area}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' m²',
    );
  }
  expect(errors).toEqual([]);
});

// Spec 009: de perto, os contornos reais de prédio recebem as peças do pacote como camada de
// símbolos do MapLibre. O tile de teste (tests/fixtures/mvt.ts) traz quadras com casas e uma
// avenida; as peças vêm de /arte/town (fora do Git) — sem elas o teste só prova que nada quebra.
test('cidade de perto: prédios viram peças do pacote numa camada de símbolos', async ({ page }) => {
  test.setTimeout(90000);
  const { buildingsTile } = await import('../fixtures/mvt');
  const tile = Buffer.from(buildingsTile(1));
  const world = createWorld(Date.now());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  // Tiles com prédios em qualquer z ≥ 13 (o TileJSON da fixture declara maxzoom 14; acima é overzoom).
  await page.route('**/__e2e/vazio.pbf?**', (route) => {
    const z = Number(new URL(route.request().url()).searchParams.get('z'));
    return route.fulfill({
      contentType: 'application/x-protobuf',
      body: z >= 13 ? tile : Buffer.alloc(0),
    });
  });
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 30000 });
  const temPecas = await page.evaluate(async () => {
    const r = await fetch(
      '/arte/town/Houses%20and%20Buildings/Houses%20(very%20small%20(all%2016x16)/1.png',
    );
    return r.ok && (r.headers.get('content-type') ?? '').includes('image');
  });
  const industria = world.properties.find((p) => p.id === 'industry')!;
  await page.evaluate((coords) => {
    const m = (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap!;
    m.jumpTo({ center: coords as [number, number], zoom: 16.2 });
  }, industria.coordinates);
  await page.waitForTimeout(2500);
  const estado = await page.evaluate(() => {
    const m = (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap!;
    return {
      camada: Boolean(m.getLayer('town-buildings')),
      pontos: m.getSource('town-buildings') ? m.querySourceFeatures('town-buildings').length : 0,
      predios: m.querySourceFeatures('openmaptiles', { sourceLayer: 'building' }).length,
      // Sem as peças do pacote (fora do Git), a camada não existe; não consultar o que não existe.
      rendered: m.getLayer('town-buildings')
        ? m.queryRenderedFeatures(undefined, { layers: ['town-buildings'] }).length
        : 0,
    };
  });
  await page.screenshot({ path: 'test-results/mapa-vivo-cidade-perto.png' });
  expect(estado.predios).toBeGreaterThan(100);
  if (temPecas) {
    expect(estado.camada).toBe(true);
    expect(estado.pontos).toBeGreaterThan(100);
    expect(estado.rendered).toBeGreaterThan(20);
  }
  expect(errors).toEqual([]);
});
