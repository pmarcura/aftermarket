import { test, expect } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';

// Garante A2 da spec 002: o navegador de teste nunca alcança tiles.openfreemap.org nem
// router.project-osrm.org. O mapa carrega com tiles vazios locais; qualquer outro host
// externo é respondido com 204 e registrado.
test('mapa abre sem rede externa: tiles e roteador ficam na máquina', async ({
  page,
  redeExterna,
}) => {
  const world = createWorld(Date.UTC(2026, 9, 28, 12));
  const saidas: string[] = [];
  const falhas: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') saidas.push(request.url());
  });
  page.on('requestfailed', (request) => falhas.push(request.url()));
  await page.route('**/api/world*', (route) => route.fulfill({ json: world }));
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'map');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await page.locator('.main-map [data-map-ready="true"]').waitFor({ timeout: 30000 });
  // O mapa pediu o TileJSON externo e a fixture respondeu localmente.
  expect(saidas.some((url) => url.startsWith('https://tiles.openfreemap.org/'))).toBe(true);
  // Nenhuma requisição externa chegou à rede: todas foram respondidas pela fixture.
  expect(falhas.filter((url) => !url.startsWith('http://127.0.0.1'))).toEqual([]);
  for (const url of redeExterna.bloqueadas) expect(url).not.toMatch(/tiles\.openfreemap\.org/);
  const resposta = await page.evaluate(() =>
    fetch('https://router.project-osrm.org/route/v1/driving/0,0;1,1').then((r) => r.status),
  );
  expect(resposta).toBe(204);
  expect(redeExterna.bloqueadas).toContain(
    'https://router.project-osrm.org/route/v1/driving/0,0;1,1',
  );
});
