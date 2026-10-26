import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const issues: string[] = [];
page.on('pageerror', (e) => issues.push(e.message));
page.on('requestfailed', (r) => {
  if (!r.failure()?.errorText.includes('ABORTED'))
    issues.push(`${r.url()}: ${r.failure()?.errorText}`);
});
await mkdir('.runtime/review', { recursive: true });
await page.goto('http://127.0.0.1:5173/');
await page.getByRole('navigation').getByRole('button', { name: 'Mapa', exact: true }).click();
await page
  .locator('.main-map .map-marker')
  .first()
  .waitFor({ timeout: 25000 })
  .catch(() => undefined);
await page.waitForTimeout(2500);
await page.screenshot({ path: '.runtime/review/mapa.png', fullPage: true });
console.log(
  JSON.stringify({
    markers: await page.locator('.main-map .map-marker').count(),
    issues: issues.slice(0, 12),
  }),
);
await browser.close();
