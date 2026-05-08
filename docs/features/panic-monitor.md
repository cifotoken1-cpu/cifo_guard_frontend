# Fitur: Panic Monitor

**Path:** `src/features/panic-monitor/`

Monitor real-time untuk panic alerts — list panic, detail dengan elapsed timer, dan responder broadcast status.

---

## Tujuan

Memberi operator pusat kendali tampilan terpusat untuk panic alert aktif: siapa yang trigger, kapan, di mana, siapa responder yang dikirimi notifikasi, dan status delivery-nya.

---

## Komponen

### `PanicMonitorView.jsx`

Root view. State `selectedAlert` — auto-select panic aktif pertama saat data masuk. Compose tiga komponen utama.

### `PanicAlertList.jsx`

Card berisi list panic alerts.

- Status badge: **AKTIF** (hijau pulse), **INVESTIGASI**, **SELESAI**.
- Setiap item: avatar inisial pelapor, lokasi, waktu, status delivery agregat.
- Click item → `onSelect(alert)`.

### `PanicAlertDetail.jsx`

Panel detail untuk panic terpilih.

- Banner status + tipe panic.
- **Elapsed timer** format `MM:SS` — update setiap 1 detik via `setInterval` (cleanup di `useEffect` return).
- KPI row: status, jumlah responder, severity, waktu terjadi.
- Block GPS (lat, lng, accuracy) + deskripsi.

### `PanicBroadcastPanel.jsx`

Daftar responder yang dikirimi notifikasi.

- Per responder: avatar, nama, sent time, status delivery.
- Badge status delivery di-mapping dari backend:
  - `PENDING` → "Pending"
  - `SENT` → "On Route"
  - `DELIVERED` → "Terkirim"
  - `ACKNOWLEDGED` → "Diterima"
- Tombol **Tandai Terkendali** → `alertsApi.resolve(alert.id)`.

---

## API & Hook

| Hook / API | Endpoint | Konsumer |
|---|---|---|
| `usePanicAlerts(params)` | `GET /api/alerts?category=PANIC_BUTTON` (+ WS) | `PanicMonitorView` |
| `usePanicAlertDetail(id)` | `GET /api/alerts/:id` | `PanicMonitorView` (alert terpilih) |
| `alertsApi.resolve(id)` | `PATCH /api/alerts/:id/resolve` | `PanicBroadcastPanel` |

Sumber: `src/api/alerts.api.js`, `src/hooks/usePanicAlerts.js`.

---

## State / Store

- Component state `selectedAlert` di `PanicMonitorView`.
- Tidak menggunakan store global selain implicit React Query cache.

---

## Props

| Komponen | Props |
|---|---|
| `PanicAlertList` | `alerts: Alert[]`, `selectedId: string`, `onSelect: (alert) => void` |
| `PanicAlertDetail` | `alert: Alert` |
| `PanicBroadcastPanel` | `alert: Alert` (termasuk `recipients[]`) |

---

## Catatan Integrasi

- **WS sync:** `usePanicAlerts` listen `ALERT_CREATED` & `ALERT_UPDATED` (legacy ws server, bukan Socket.io — lihat [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §3.1).
- **Elapsed timer cleanup wajib** — tanpa `clearInterval` di `useEffect` return akan terjadi memory leak saat ganti `selectedAlert`.
- **Response shape variasi:** hook menormalisasi `data.alerts | data.data | data.rows | data` — field `recipients` mungkin tidak selalu ada di list endpoint, gunakan `usePanicAlertDetail` untuk data lengkap.
- **Resolve** akan invalidate `['panic-alerts']`; UI akan refresh otomatis dan auto-select panic aktif berikutnya jika ada.

---

## Lihat Juga

- [Panic](./panic.md) — Trigger panic alert dari dalam aplikasi
- [Alerts](./alerts.md) — Modal alert umum (non-panic-specific)
