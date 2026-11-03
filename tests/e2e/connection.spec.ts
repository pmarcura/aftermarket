import { expect, test } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';

test('uma API sem resposta tem prazo limite, não acumula pedidos e permite reconexão', async ({
  page,
}) => {
  const world = createWorld(Date.now());
  let recover = false,
    requests = 0;
  await page.clock.install();
  await page.route('**/api/world*', (route) => {
    requests++;
    if (recover) return route.fulfill({ json: world });
    // Leave the connection pending: the production AbortController must end it.
    return new Promise<void>(() => {});
  });
  await page.addInitScript((season) => {
    localStorage.clear();
    localStorage.setItem('aftermarket.page', 'company');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, world.season.id);
  await page.goto('/jogar');
  await expect(page.getByText('Conectando à economia…', { exact: true })).toBeVisible();
  await page.clock.runFor(12000);
  expect(requests).toBe(1);
  await page.clock.runFor(3100);
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await expect(page.getByText('Conectando à economia…', { exact: true })).toHaveCount(0);
  recover = true;
  const beforeRetry = requests;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha empresa', exact: true })).toBeVisible();
  expect(requests).toBe(beforeRetry + 1);
});
