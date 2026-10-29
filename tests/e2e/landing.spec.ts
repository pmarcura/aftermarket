import { expect, test } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'reference', width: 736, height: 886 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`apresentação ${viewport.name} carrega a arte sem acessar o mundo nem transbordar`, async ({
    page,
  }) => {
    const apiRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Aonde você quiser.' })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('img[src="/arte/landing/planeta-brasil.png"]')
          .first()
          .evaluate((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          }),
      )
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (font) =>
            font.family.replaceAll(/['"]/g, '') === 'Press Start 2P' && font.status === 'loaded',
        ),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Navegação da apresentação' })
        .getByRole('link', { name: 'Entrar no jogo' }),
    ).toHaveAttribute('href', '/jogar');
    // O jogo consulta a API a cada 3 s; a apresentação deve continuar independente dela.
    if (viewport.name === 'desktop') await page.waitForTimeout(3250);
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/landing-${viewport.name}.png`, fullPage: true });
    if (viewport.name === 'reference')
      await page
        .locator('.landing-artboard')
        .screenshot({ path: 'test-results/landing-composition.png' });
  });
}

test('entrar abre o mundo de teste e preserva o destino do jogador', async ({ page }) => {
  const world = createWorld(Date.UTC(2026, 9, 28, 12));
  const errors: string[] = [];
  const unexpectedApi: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/world') {
      await route.fulfill({ json: world });
      return;
    }
    unexpectedApi.push(route.request().url());
    await route.fulfill({ status: 503, json: { error: 'API não prevista no teste.' } });
  });
  await page.addInitScript((seasonId) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'businesses');
    localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
  }, world.season.id);
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Navegação da apresentação' })
    .getByRole('link', { name: 'Entrar no jogo' })
    .click();
  await expect(page).toHaveURL(/\/jogar$/);
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meus Negócios', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('aftermarket.company'))).toBe('player');
  expect(unexpectedApi).toEqual([]);
  expect(errors).toEqual([]);
});

test('teclado abre o jogo e uma API indisponível oferece nova tentativa', async ({ page }) => {
  await page.route('**/api/world*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Mundo indisponível no teste isolado.' } }),
  );
  await page.goto('/');
  const enter = page
    .getByRole('navigation', { name: 'Navegação da apresentação' })
    .getByRole('link', { name: 'Entrar no jogo' });
  await enter.focus();
  await expect(enter).toBeFocused();
  const worldRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/world',
  );
  await page.keyboard.press('Enter');
  await worldRequest;
  await expect(page).toHaveURL(/\/jogar$/);
  await expect(
    page.getByText('Não foi possível conectar ao mundo.', { exact: false }),
  ).toBeVisible();
  const retry = page.getByRole('button', { name: 'Tentar novamente' });
  await expect(retry).toBeVisible();
  const retryRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/world',
  );
  await retry.click();
  await retryRequest;
});

test('atalho Como jogar e respostas da apresentação funcionam', async ({ page }) => {
  await page.goto('/landing');
  await page
    .getByRole('navigation', { name: 'Navegação da apresentação' })
    .getByRole('link', { name: 'Como jogar' })
    .click();
  await expect(page).toHaveURL(/\/landing#como-jogar$/);
  await expect(page.locator('#como-jogar')).toBeInViewport();
  const answer = page.locator('details').first();
  const question = answer.locator('summary');
  await question.click();
  await expect(answer).toHaveAttribute('open', '');
  await question.click();
  await expect(answer).not.toHaveAttribute('open', '');
});

test('laboratório mantém sua rota e abre sem consultar a API do mundo', async ({ page }) => {
  const worldRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/world') worldRequests.push(request.url());
  });
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Entender antes de ajustar.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Áreas do laboratório' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir jogo' })).toHaveAttribute('href', '/jogar');
  expect(worldRequests).toEqual([]);
});
