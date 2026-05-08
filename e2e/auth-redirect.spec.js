import { test, expect } from '@playwright/test';

/**
 * E2E: Auth-protected route redirects.
 *
 * Tests bahwa unauthenticated user di-redirect ke /login.
 */
test.describe('Auth redirect', () => {
  test('redirects unauthenticated user from / to /login', async ({ page }) => {
    // Pastikan tidak ada token di localStorage
    await page.addInitScript(() => localStorage.clear());

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('redirects unauthenticated user from /security to /login', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());

    await page.goto('/security');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('redirects unknown path to /security (which redirects to /login)', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());

    await page.goto('/this-path-does-not-exist');
    // /not-exist -> /security (catch-all) -> /login (auth gate)
    await expect(page).toHaveURL(/\/login$/);
  });

  test('user with token NOT redirected (stays on /security)', async ({ page }) => {
    // Set fake token via localStorage (zustand persist key: cifo-auth)
    await page.addInitScript(() =>
      localStorage.setItem(
        'cifo-auth',
        JSON.stringify({
          state: { token: 'fake-jwt', user: { id: 1, name: 'Test' }, role: 'GUARD' },
          version: 0,
        })
      )
    );

    // Mock all API calls supaya dashboard tidak crash
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/security$/);
  });
});
