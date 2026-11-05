import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Isolated browser benchmark: all API responses are fixture snapshots, never a
// live command, saved-world tick or external network. Compare web delivery only.
const world = JSON.parse(readFileSync('.runtime/performance/view.json', 'utf8'));
const actor = world.companies.find((c: { id: string }) => c.id === 'player');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const reports = [];
try {
  for (const port of [5191, 5192]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    let requests = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', () => requests++);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/world') return route.fulfill({ json: world });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      if (url.hostname !== '127.0.0.1') return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    await page.addInitScript((season) => {
      localStorage.clear();
      localStorage.setItem('aftermarket.page', 'inicio');
      localStorage.setItem('aftermarket.firstSteps', 'closed');
      localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
    }, world.season.id);
    const start = performance.now();
    await page.goto(`http://127.0.0.1:${port}/jogar`);
    await page.getByRole('heading', { name: actor.name, exact: true }).waitFor();
    const readyMs = performance.now() - start;
    const menu = page.getByRole('navigation', { name: 'Menu principal', exact: true });
    const navigateAt = performance.now();
    await menu.getByRole('button', { name: 'Empresa', exact: true }).click();
    await page.getByRole('heading', { name: 'Minha empresa', exact: true }).waitFor();
    const navigateMs = performance.now() - navigateAt;
    reports.push({
      port,
      mode: port === 5191 ? 'development' : 'production-preview',
      readyMs,
      navigateMs,
      requests,
      errors,
      timing: await page.evaluate(() => ({
        paint: performance.getEntriesByType('paint').map((e) => e.toJSON()),
        resources: performance.getEntriesByType('resource').length,
      })),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
mkdirSync('test-results/performance', { recursive: true });
writeFileSync(
  'test-results/performance/page.json',
  JSON.stringify(
    {
      scope: 'One local run per mode, same saved-view fixture; API/network/DB excluded, not FPS',
      reports,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(reports));
