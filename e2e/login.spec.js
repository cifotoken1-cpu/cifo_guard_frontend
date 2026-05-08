import { test, expect } from '@playwright/test';

/**
 * E2E: LoginPage render + form interaction.
 *
 * No API calls needed — pure rendering test.
 * Verifies bahwa login form render dan form fields bisa diisi.
 */
test.describe('LoginPage', () => {
  test.beforeEach(async ({ page }) => {
    // Pastikan localStorage bersih (no auth token)
    await page.addInitScript(() => localStorage.clear());
  });

  test('renders brand and login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('CIFO GUARD')).toBeVisible();
    await expect(page.getByText('Security Command Center')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('typing in username/password updates input values', async ({ page }) => {
    await page.goto('/login');

    const username = page.getByLabel('Username');
    const password = page.getByLabel('Password');

    await username.fill('guard-001');
    await password.fill('secret123');

    await expect(username).toHaveValue('guard-001');
    await expect(password).toHaveValue('secret123');
  });

  test('shows error message when login fails', async ({ page }) => {
    // Mock failed login response
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Username atau password salah' }),
      })
    );

    await page.goto('/login');
    await page.getByLabel('Username').fill('wrong');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: /login/i }).click();

    // Tunggu error muncul (max 5 detik)
    await expect(page.locator('text=/salah|invalid|gagal/i')).toBeVisible({ timeout: 5000 });
  });

  test('shows footer text', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Authorized Access Only')).toBeVisible();
  });
});
