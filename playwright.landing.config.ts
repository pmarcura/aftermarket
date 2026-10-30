import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'landing.spec.ts',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    channel: process.env.PLAYWRIGHT_CHANNEL === 'msedge' ? 'msedge' : undefined,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    env: { AFTERMARKET_WEB_PORT: '5187' },
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: 'list',
});
