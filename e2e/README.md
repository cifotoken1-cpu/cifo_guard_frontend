# E2E Tests (Playwright)

End-to-end tests untuk CIFO Guard Frontend menggunakan [Playwright](https://playwright.dev/).

## Setup Lokal (Pertama Kali)

```bash
# Install dependencies (kalau belum)
npm install

# Install Chromium browser binary (~150MB)
npx playwright install chromium

# Optional: install semua browser (chromium + firefox + webkit)
npx playwright install
```

> ⚠️ **Note untuk CI/sandbox:** Browser download dari `cdn.playwright.dev`
> bisa diblok di environment yang punya allowlist ketat. Solusi: tambah
> `cdn.playwright.dev` ke allowlist, atau pre-bake browser binary di
> Docker image.

## Menjalankan Tests

```bash
# Run semua tests (headless)
npm run test:e2e

# Run dengan UI debugger
npm run test:e2e:ui

# Run satu file
npx playwright test e2e/login.spec.js

# Run dalam mode debug (step-by-step)
npx playwright test --debug

# Run dengan headed browser (lihat browser saat test jalan)
npx playwright test --headed
```

## Struktur Test

| File | Coverage | Strategi |
|---|---|---|
| `login.spec.js` | LoginPage render + form interaction | Static rendering — no API needed |
| `auth-redirect.spec.js` | Unauthenticated redirect ke /login | localStorage manipulation |
| `dashboard-mocked.spec.js` | Dashboard render dengan API mocks | `route.fulfill()` mock all endpoints |
| `panic-flow-mocked.spec.js` | Panic confirmation modal flow | Mock `/api/panic` POST |
| `sensors-render-mocked.spec.js` | Sensor section render dengan data | Mock `/api/sensors` |

## Pola Mocking API

Karena E2E test **TIDAK** butuh real backend (untuk speed + isolasi), semua
network call di-mock di-level Playwright menggunakan `route.fulfill()`.

Contoh:

```js
test.beforeEach(async ({ page }) => {
  // Mock semua /api/* return success default
  await page.route('**/api/sensors*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        sensors: [{ id: 'sen-1', name: 'Test Sensor', type: 'door', status: 'open' }],
        total: 1,
        summary: { clear: 0, open: 1, alert: 0, offline: 0 },
      }),
    })
  );
});
```

## Mode "Real Backend" (Opsional)

Untuk test integration sebenarnya (bukan mocked):

1. Start backend: `cd ../cifo_guard_backend && npm run dev`
2. Pastikan DB seeded dengan migration 013
3. Run dengan env var:
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e
   ```
4. Skip atau remove `route.fulfill()` di beberapa test untuk hit real API

## Troubleshooting

**Error: `browserType.launch: Executable doesn't exist`**
→ Run `npx playwright install chromium`

**Error: `vite preview` listening on different port**
→ Set `PLAYWRIGHT_BASE_URL=http://localhost:<port>`

**Test hangs forever**
→ Check kalau `webServer.command` (di `playwright.config.js`) punya output yang Playwright tunggu. Default `npm run preview` start di port 4173.

## Refs

- [Playwright Docs](https://playwright.dev/docs/intro)
- [`docs/INTEGRATION_STATUS.md`](../docs/INTEGRATION_STATUS.md)
- Branch testing strategy ada di issue tracker GitHub
