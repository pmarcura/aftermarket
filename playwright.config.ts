import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5183',
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    env: {
      AFTERMARKET_DB_FILE: `.runtime/e2e/season-${Date.now()}.sqlite`,
      AFTERMARKET_PORT: '3013',
      AFTERMARKET_WEB_PORT: '5183',
    },
    url: 'http://127.0.0.1:5183',
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: 'list',
});
