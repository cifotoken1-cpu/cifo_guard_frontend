# Fitur: Panic

**Path:** `src/features/panic/`

Modal konfirmasi sebelum trigger panic alert — pemilihan tipe + pengambilan GPS + POST ke backend.

---

## Tujuan

Memastikan panic alert hanya dikirim setelah pengguna mengkonfirmasi, dengan koordinat GPS terverifikasi (atau fallback) dan tipe panic yang dipilih eksplisit.

---

## Komponen

### `PanicConfirmModal.jsx`

Modal dengan tiga bagian:

1. **Warning banner** — peringatan bahwa aksi ini akan broadcast emergency.
2. **Type picker** — grid 4 tombol: `MEDICAL`, `CRIME`, `FIRE`, `OTHER`. Default `MEDICAL`.
3. **GPS status box** — status: `idle | loading | ok | error`. Saat `ok` tampilkan lat, lng, dan accuracy.
4. **Action buttons** — `Send Panic Alert` (disabled saat loading) & `Cancel`.

Flow:

1. Saat modal open, `useEffect` panggil `getGPS()` (`utils/geo.js`).
2. Jika gagal/timeout → fallback ke `FALLBACK_GPS` dengan `gpsState='error'` (alert tetap bisa dikirim).
3. Submit → generate `requestId` UUID → `alertsApi.triggerPanic({ type, userId, gps, requestId })`.
4. Sukses → `addToast()` dengan `alertId` & `ingest_latency_ms`, set `system.mode = 'panic'`, close modal.
5. Reset state saat modal di-close.

---

## API & Hook

| API / Util | Endpoint / Sumber | Catatan |
|---|---|---|
| `alertsApi.triggerPanic(body)` | `POST /api/panic` | Idempoten via `requestId` |
| `getGPS()` | `src/utils/geo.js` | Promise wrapper di `navigator.geolocation` |
| `FALLBACK_GPS` | `src/utils/geo.js` | Konstanta default jika GPS gagal |

Payload `triggerPanic`:

```json
{
  "requestId": "uuid-v4",
  "userId": "guard-001",
  "type": "MEDICAL",
  "gps": { "lat": -6.2088, "lng": 106.8456, "accuracy": 10 }
}
```

---

## State / Store

- **`useUIStore`** — `modal`, `closeModal`, `addToast`
- **`useSystemStore`** — `setMode` (set ke `'panic'` setelah sukses)
- **`useAuthStore`** — `user.id` untuk `userId` payload
- **Component state** — `type`, `gpsState` (`idle | loading | ok | error`), `gpsCoords`, `gpsError`

---

## Props

Tidak ada — controlled lewat `useUIStore.modal === 'panic-confirm'`.

---

## Catatan Integrasi

- **Idempotency:** `requestId` di-generate baru setiap kali tombol dipencet. Backend pakai field ini sebagai unique key — request ulang dengan ID sama akan respond 200 (bukan 201) dengan alert lama. Lihat [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §2.1.
- **GPS opsional:** Backend menerima panic alert tanpa koordinat. Kalau `getGPS()` reject (denied/timeout), payload tetap dikirim dengan `FALLBACK_GPS`.
- **Validasi payload:** `requestId` 8–128 char alfanumerik/`-`/`_`; UUID v4 kompatibel. `gps.lat` ±90, `gps.lng` ±180.
- **Toast pasca sukses** include `latency_ms` ingest backend — berguna untuk monitoring SLA panic.
- **Mode switch** ke `'panic'` adalah local state saja sampai backend implement endpoint mode (Known Issue #3 di README).

---

## Lihat Juga

- [Panic Monitor](./panic-monitor.md) — untuk memonitor panic alert yang sudah di-trigger
- [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §2 — Pipeline panic alert lengkap
