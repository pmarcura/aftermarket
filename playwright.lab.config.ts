import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'lab.spec.ts',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5186',
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    env: { AFTERMARKET_WEB_PORT: '5186' },
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: 'list',
});
