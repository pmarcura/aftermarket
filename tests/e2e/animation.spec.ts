import { test, expect } from '@playwright/test';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute } from '../../packages/simulation/src/engine';

test('caminhão avança com o relógio contratado e mantém progresso após recarga', async ({
  page,
}) => {
  const now = Date.now(),
    world = createWorld(now);
  execute(
    world,
    'player',
    {
      type: 'trade',
      offerId: 'offer-ferrovale',
      destinationId: 'e-industry',
      quantity: 1,
      carrierId: 'transbrasil',
    },
    now,
  );
  const s = world.shipments[0];
  s.departedAt = now - 30000;
  s.pickupAt = now - 20000;
  s.roadDepartureAt = now - 10000;
  s.roadArrivalAt = now + 60000;
  s.arrivesAt = s.roadArrivalAt;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world', (route) => route.fulfill({ json: world }));
  await page.addInitScript(() => localStorage.setItem('aftermarket.page', 'logistics'));
  await page.goto('/jogar');
  const marker = page.locator(`[data-shipment-id="${s.id}"]`);
  await expect(marker).toBeVisible({ timeout: 25000 });
  await expect(marker).toHaveAttribute('title', /Em trânsito/);
  const first = Number(await marker.getAttribute('data-progress'));
  await expect
    .poll(async () => Number(await marker.getAttribute('data-progress')), { intervals: [200] })
    .toBeGreaterThan(first + 0.005);
  await page.reload();
  await expect(marker).toBeVisible({ timeout: 25000 });
  await expect
    .poll(async () => Number(await marker.getAttribute('data-progress')))
    .toBeGreaterThan(first);
  await page.screenshot({ path: 'test-results/economy/route-animation.png', fullPage: true });
  expect(errors).toEqual([]);
});
