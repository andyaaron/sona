import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the real admin + real API in the Local profile (no Azure): the API
 * signs every request in as the configured dev user, specs switch that user's role
 * through the Local-only helper (e2e/fixtures/roles.ts). Both servers are started
 * here when not already running.
 */
export default defineConfig({
  testDir: './e2e',
  // Specs mutate the one dev user's role and share a database — run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'dotnet run --project ../sona.server --no-launch-profile',
      // Probe the https endpoint directly: the http port only answers with a 307 to it.
      url: 'https://localhost:7296/api/user',
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Local',
        ASPNETCORE_URLS: 'https://localhost:7296;http://localhost:5032',
      },
    },
    {
      command: 'pnpm dev',
      url: 'https://localhost:5173',
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
