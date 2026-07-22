import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = String(process.env.E2E_BASE_URL || '').trim().replace(/\/$/, '');
const localBaseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  outputDir: 'test-results',
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: externalBaseUrl || localBaseUrl,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run serve:e2e',
        url: `${localBaseUrl}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        stdout: 'pipe',
        stderr: 'pipe',
        gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
      },
});
