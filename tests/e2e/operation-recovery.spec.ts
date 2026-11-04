import { test, expect } from './fixtures';
import { createScenario } from '../../packages/simulation/src/scenarios';
import { worldView } from '../../apps/server/src/view';

test('recupera operação após recarga e perda de resposta usando o mesmo recibo', async ({
  page,
}) => {
  const world = createScenario(Date.now(), 'playtest', 0, { scale: 20 });
  const view = worldView(world, 'player');
  const key = crypto.randomUUID();
  const command = {
    type: 'setPrice',
    establishmentId: view.establishments.find((e) => e.companyId === 'player')!.id,
    product: 'milk',
    price: 600,
  };
  const keys: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/world') return route.fulfill({ json: view });
    if (url.pathname === '/api/commands') {
      keys.push(route.request().headers()['idempotency-key']);
      expect(route.request().postDataJSON()).toEqual(command);
      if (keys.length === 1) return route.abort();
      return route.fulfill({ json: view });
    }
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(
    ({ season, key, command }) => {
      localStorage.setItem('aftermarket.page', 'inicio');
      localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
      sessionStorage.setItem(
        'aftermarket.command.player',
        JSON.stringify({ key, body: JSON.stringify(command) }),
      );
    },
    { season: world.season.id, key, command },
  );
  await page.goto('/jogar');
  await page.getByRole('button', { name: 'Consultar operação', exact: true }).click();
  await expect(
    page.getByText('Operação confirmada. Seus dados foram atualizados.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Consultar operação', exact: true })).toHaveCount(
    0,
  );
  expect(keys).toEqual([key, key]);
});
