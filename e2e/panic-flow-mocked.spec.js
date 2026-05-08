import { test, expect } from '@playwright/test';

/**
 * E2E: Panic confirmation modal flow.
 *
 * Click tombol Panic → modal muncul → pilih type → submit → verify
 * /api/panic dipanggil.
 */

const FAKE_TOKEN_PAYLOAD = JSON.stringify({
  state: { token: 'e2e-token', user: { id: 1, name: 'E2E' }, role: 'GUARD' },
  version: 0,
});

const mockJson = (data, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

test.describe('Panic flow (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('cifo-auth', payload);
    }, FAKE_TOKEN_PAYLOAD);

    // Generic mocks
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      // Default 200 dengan empty data — tests yang specific akan override
      if (url.match(/sensors/)) {
        return route.fulfill(mockJson({
          success: true, sensors: [], total: 0,
          summary: { clear: 0, open: 0, alert: 0, offline: 0 },
        }));
      }
      if (url.match(/cameras/)) {
        return route.fulfill(mockJson({ cameras: [], total: 0, online: 0, offline: 0 }));
      }
      route.fulfill(mockJson({ success: true, data: [], alerts: [] }));
    });
  });

  test('clicking Panic button opens confirmation modal', async ({ page }) => {
    await page.goto('/security');
    await page.getByRole('button', { name: /panic/i }).first().click();

    await expect(page.getByText(/Panic Alert/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Alert Type/i)).toBeVisible();
  });

  test('submitting panic alert hits POST /api/panic', async ({ page }) => {
    let panicRequested = false;
    let panicBody = null;

    // Override generic mock untuk /panic
    await page.route('**/api/panic', async (route) => {
      panicRequested = true;
      panicBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(mockJson({
        success: true,
        alertId: 'alert-123',
        ingest_latency_ms: 42,
      }));
    });

    await page.goto('/security');
    await page.getByRole('button', { name: /panic/i }).first().click();

    // Tunggu modal muncul, lalu klik Send
    await expect(page.getByText(/Panic Alert/i)).toBeVisible();
    await page.getByRole('button', { name: /send panic alert/i }).click();

    // Verifikasi: API dipanggil
    await page.waitForTimeout(1000);
    expect(panicRequested).toBe(true);
    expect(panicBody).toHaveProperty('type');
    expect(panicBody).toHaveProperty('userId');
  });

  test('cancel button closes modal without API call', async ({ page }) => {
    let panicCalled = false;
    await page.route('**/api/panic', (route) => {
      panicCalled = true;
      route.fulfill(mockJson({ success: true, alertId: 'x' }));
    });

    await page.goto('/security');
    await page.getByRole('button', { name: /panic/i }).first().click();

    await expect(page.getByText(/Panic Alert/i)).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    await page.waitForTimeout(500);
    await expect(page.getByText(/Panic Alert/i)).not.toBeVisible();
    expect(panicCalled).toBe(false);
  });
});
