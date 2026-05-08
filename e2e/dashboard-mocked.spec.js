import { test, expect } from '@playwright/test';

/**
 * E2E: Dashboard render dengan API mocking.
 *
 * Mock semua endpoint yang dashboard butuhkan, verifikasi sections render.
 */

const FAKE_TOKEN_PAYLOAD = JSON.stringify({
  state: { token: 'e2e-token', user: { id: 1, name: 'E2E' }, role: 'GUARD' },
  version: 0,
});

const mockResponse = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

test.describe('Dashboard (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth token
    await page.addInitScript((payload) => {
      localStorage.setItem('cifo-auth', payload);
    }, FAKE_TOKEN_PAYLOAD);

    // Mock all dashboard endpoints
    await page.route('**/api/alerts/active*', (route) =>
      route.fulfill(mockResponse({ alerts: [], total: 0 }))
    );
    await page.route('**/api/alerts/stats*', (route) =>
      route.fulfill(mockResponse({ active: 0, total: 0 }))
    );
    await page.route('**/api/cameras*', (route) =>
      route.fulfill(
        mockResponse({
          cameras: [
            { id: 'cam-1', label: 'Front', status: 'online', stream_url: '/x.m3u8', area: 'Lobby', lat: -6.2, lng: 106.8 },
          ],
          total: 1,
          online: 1,
          offline: 0,
        })
      )
    );
    await page.route('**/api/sensors*', (route) =>
      route.fulfill(
        mockResponse({
          success: true,
          sensors: [
            { id: 'sen-1', name: 'Living Room Door', type: 'door', location: 'Ground Floor', status: 'open', last_event_at: new Date().toISOString() },
          ],
          total: 1,
          summary: { clear: 0, open: 1, alert: 0, offline: 0 },
        })
      )
    );
    await page.route('**/api/activities/recent*', (route) =>
      route.fulfill(mockResponse([]))
    );
    await page.route('**/api/health*', (route) =>
      route.fulfill(mockResponse({ uptime: 12345, version: 'v1.0.0' }))
    );
    await page.route('**/api/metrics*', (route) =>
      route.fulfill(mockResponse({}))
    );
    // Catch-all untuk endpoint yang lupa di-mock
    await page.route('**/api/**', (route) =>
      route.fulfill(mockResponse({ success: true, data: [] }))
    );
  });

  test('renders TopBar with brand', async ({ page }) => {
    await page.goto('/security');
    await expect(page.getByText('CIFO GUARD')).toBeVisible({ timeout: 10_000 });
  });

  test('renders Overview metrics section', async ({ page }) => {
    await page.goto('/security');
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Active Alerts')).toBeVisible();
    await expect(page.getByText('Cameras Live')).toBeVisible();
  });

  test('renders Emergency section (NOT Security Mode — post #6/#7 cleanup)', async ({ page }) => {
    await page.goto('/security');
    // After #6/#7: section di-rename jadi "Emergency", hanya tombol Panic
    await expect(page.getByText('Emergency', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /panic/i })).toBeVisible();
  });

  test('does NOT render System Control section (removed in #6)', async ({ page }) => {
    await page.goto('/security');
    await page.waitForTimeout(2000);
    await expect(page.getByText('System Control')).not.toBeVisible();
  });

  test('does NOT render ARMED/DISARMED stat (removed in #6)', async ({ page }) => {
    await page.goto('/security');
    await page.waitForTimeout(2000);
    await expect(page.getByText('ARMED')).not.toBeVisible();
    await expect(page.getByText('DISARMED')).not.toBeVisible();
  });

  test('renders Sensor Status section dengan data dari mock', async ({ page }) => {
    await page.goto('/security');
    await expect(page.getByText('Sensor Status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Living Room Door')).toBeVisible();
  });
});
