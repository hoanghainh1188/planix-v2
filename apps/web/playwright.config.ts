import { defineConfig, devices } from '@playwright/test';

export const E2E_WEB_PORT = 5174;

/** End-to-end journeys against real PostgreSQL, Mailpit, API server and Vite (quickstart.md). */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    locale: 'en-US',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
