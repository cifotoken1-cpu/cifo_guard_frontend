import { test, expect } from '@playwright/test';

/**
 * E2E: Sensor Status section render dengan berbagai data state.
 *
 * Verifikasi #8 implementation: useSensors() hook fetch dari /api/sensors,
 * render di Sensor Status section, dan empty state jujur (bukan
 * DEFAULT_SENSORS hardcoded).
 */

const FAKE_TOKEN = JSON.stringify({
  state: { token: 'e2e', user: { id: 1 }, role: 'GUARD' },
  version: 0,
});

const mockJson = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const setupMocks = async (page, sensorsResponse) => {
  await page.addInitScript((payload) => {
    localStorage.setItem('cifo-auth', payload);
  }, FAKE_TOKEN);

  await page.route('**/api/sensors*', (route) => route.fulfill(mockJson(sensorsResponse)));

  // Default mocks untuk endpoint lain
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.match(/cameras/)) {
      return route.fulfill(mockJson({ cameras: [], total: 0, online: 0, offline: 0 }));
    }
    route.fulfill(mockJson({ success: true, data: [], alerts: [] }));
  });
};

test.describe('Sensor Status section (mocked /api/sensors)', () => {
  test('renders sensor entries from API', async ({ page }) => {
    await setupMocks(page, {
      success: true,
      sensors: [
        {
          id: 'sen-1',
          name: 'Living Room Door',
          type: 'door',
          location: 'Ground Floor',
          status: 'open',
          last_event_at: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          id: 'sen-2',
          name: 'Garage Motion',
          type: 'motion',
          location: 'Exterior',
          status: 'alert',
          last_event_at: new Date(Date.now() - 3_600_000).toISOString(),
        },
      ],
      total: 2,
      summary: { clear: 0, open: 1, alert: 1, offline: 0 },
    });

    await page.goto('/security');
    await expect(page.getByText('Sensor Status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Living Room Door')).toBeVisible();
    await expect(page.getByText('Garage Motion')).toBeVisible();
  });

  test('renders empty state ketika sensors array kosong', async ({ page }) => {
    await setupMocks(page, {
      success: true,
      sensors: [],
      total: 0,
      summary: { clear: 0, open: 0, alert: 0, offline: 0 },
    });

    await page.goto('/security');
    await expect(page.getByText(/no sensor activity yet/i)).toBeVisible({ timeout: 10_000 });

    // Regression: pastikan TIDAK ada data hardcoded muncul
    // (DEFAULT_SENSORS sudah dihapus di #8 cleanup — ini regression test)
    await expect(page.getByText('TV Cabinet PIR')).not.toBeVisible();
    await expect(page.getByText('First Hallway Motion')).not.toBeVisible();
  });

  test('Open Sensors metric reflects summary.open dari API', async ({ page }) => {
    await setupMocks(page, {
      success: true,
      sensors: [],
      total: 5,
      summary: { clear: 2, open: 3, alert: 0, offline: 0 },
    });

    await page.goto('/security');

    // Metric "Open Sensors" harus tampilkan 3 (sesuai summary, bukan filter sendiri)
    const openMetric = page.locator('text=Open Sensors').locator('..').locator('..');
    await expect(openMetric).toContainText('3');
  });

  test('hits /api/sensors endpoint dengan benar', async ({ page }) => {
    let sensorsCalled = false;
    let calledUrl = '';

    await page.addInitScript((payload) => {
      localStorage.setItem('cifo-auth', payload);
    }, FAKE_TOKEN);

    await page.route('**/api/sensors*', (route) => {
      sensorsCalled = true;
      calledUrl = route.request().url();
      route.fulfill(mockJson({ success: true, sensors: [], total: 0, summary: {} }));
    });
    await page.route('**/api/**', (route) =>
      route.fulfill(mockJson({ success: true, data: [], alerts: [] }))
    );

    await page.goto('/security');
    await page.waitForTimeout(2000);

    expect(sensorsCalled).toBe(true);
    expect(calledUrl).toMatch(/\/api\/sensors/);
  });
});
