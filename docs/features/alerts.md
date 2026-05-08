# Fitur: Alerts

**Path:** `src/features/alerts/`

Modal daftar alert aktif + toast stack untuk notifikasi real-time.

---

## Tujuan

Menampilkan alert aktif yang masuk dari backend dan menyediakan aksi resolve / dismiss. Toast stack memberi feedback langsung saat alert baru muncul lewat WebSocket.

---

## Komponen

### `AlertsModal.jsx`

Modal yang menampilkan list alert aktif dengan badge count.

- List dari `useActiveAlerts()` (auto-sync via WS).
- Tombol **Resolve All** → `Promise.all(alerts.map(a => alertsApi.resolve(a.id)))`.
- Tombol **Resolve** per item → `alertsApi.resolve(id)`.
- Tombol **Dismiss** menutup modal lewat `useUIStore.closeModal()`.
- Setelah mutation sukses → `qc.invalidateQueries(['alerts'])`.

### `ToastStack.jsx`

Floating notification stack di pojok layar.

- Subscribe `onSocket(['alert_created'], handler)` saat mount.
- Handler push toast ke `useUIStore.toasts`.
- Toast auto-dismiss setelah 6 detik.

---

## API & Hook

| API / Hook | Endpoint | Konsumer |
|---|---|---|
| `useActiveAlerts()` | `GET /api/alerts?status=ACTIVE` (+ WS) | `AlertsModal` |
| `alertsApi.resolve(id)` | `PATCH /api/alerts/:id/resolve` | `AlertsModal` (resolve & resolveAll) |
| `onSocket(['alert_created'], handler)` | WS event | `ToastStack` |

Sumber: `src/api/alerts.api.js`, `src/hooks/useAlertsStream.js`, `src/api/socket.js`.

---

## State / Store

- **`useUIStore`** — `modal` (apakah `'alerts'` aktif), `closeModal()`, `addToast()`, `toasts[]`.

---

## Props

Tidak ada props eksternal — semua state datang dari store dan React Query.

---

## Catatan Integrasi

- **Real-time refresh:** `useActiveAlerts()` di-bridge dengan event `alert_created` dan `alert_updated` — invalidate query saat event masuk.
- **Toast vs Modal:** ToastStack tetap aktif walau modal tertutup (always mounted di `DashboardPage`). Modal hanya tampil saat `useUIStore.modal === 'alerts'`.
- **Resolve All** menggunakan `Promise.all` paralel — jika salah satu gagal, sisanya tetap commit. Pertimbangkan retry strategy jika backend rate-limit.
- **Toast lifecycle:** ID toast adalah timestamp; jika dua event datang dalam ms yang sama bisa konflik. Gunakan UUID jika ini jadi masalah.

---

## Lihat Juga

- [Panic Monitor](./panic-monitor.md) — untuk monitor khusus panic alert
- [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) — Detail backend Alert
