import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config untuk CIFO Guard Frontend E2E tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',

  // Maksimum waktu test individu (ms)
  timeout: 30_000,

  // Retry kalau fail (di CI saja)
  retries: process.env.CI ? 2 : 0,

  // Parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter: HTML untuk visual debug, list untuk console
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  // Shared settings
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Auto-start `vite preview` saat run lokal supaya tests punya target
  // (skip di CI kalau env sudah punya server running)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 60_000,
      },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Tambah firefox/webkit di iterasi berikutnya jika perlu
  ],
});
