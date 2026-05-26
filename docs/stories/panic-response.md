# Story Card: Panic Alert Response

**Feature:** Panic Alert Response & Monitoring
**Status:** Implemented (~90%), dokumentasi baru
**Sprint:** v1.0.0
**Last Updated:** 2026-05-26

---

## User Story

**Sebagai** operator/admin CIFO Guard dashboard,
**Saya ingin** menerima, memonitor, dan menangani panic alert dari masyarakat secara real-time,
**Sehingga** saya bisa merespons situasi darurat dengan cepat dan terkoordinasi.

### Scope

**IN SCOPE (Dashboard):**
- Menerima panic alert dari sistem eksternal (masyarakat)
- Memonitor daftar alert aktif secara real-time
- Melihat detail alert (lokasi, tipe, waktu, elapsed timer)
- Melihat status broadcast ke responder (guard on-duty)
- Resolve alert yang sudah tertangani
- Trigger panic internal (untuk kebutuhan guard/testing)

**OUT OF SCOPE:**
- Sistem trigger panic masyarakat (aplikasi/device terpisah)
- Logika pemilihan responder (backend)
- Notifikasi push ke device responder (backend)
- Perbedaan flow per tipe alert (MEDICAL/CRIME/FIRE/OTHER sama, hanya label)

---

## Acceptance Criteria

### AC-1: Authentication Required

```
GIVEN user belum login
WHEN mengakses panic features
THEN user di-redirect ke halaman login
AND panic button tidak bisa digunakan
```

### AC-2: Receive Panic Alert (Real-time)

```
GIVEN user sudah login sebagai operator/admin
WHEN panic alert baru masuk dari sistem masyarakat
THEN alert muncul di daftar PanicMonitorView secara otomatis (via WebSocket)
AND toast notification tampil dengan info alert
AND badge count di sidebar ter-update
AND alert baru otomatis ter-select jika status ACTIVE
```

### AC-3: Alert List Display

```
GIVEN ada panic alerts di sistem
WHEN user membuka Panic Monitor
THEN semua alert tampil di panel kiri, diurutkan terbaru di atas
AND setiap alert menampilkan: avatar/inisial, judul, lokasi, timestamp, status badge
AND alert ACTIVE ditandai border merah + animasi pulse
AND alert ACKNOWLEDGED ditandai badge amber
AND alert RESOLVED ditandai badge hijau + opacity rendah
AND header menampilkan jumlah alert ACTIVE
```

### AC-4: Alert Detail View

```
GIVEN user memilih alert dari daftar
WHEN alert detail ditampilkan di panel tengah
THEN tampil: banner (icon + pulse untuk ACTIVE), status, jumlah responder,
     severity, timestamp, lokasi (alamat + zona + gedung), koordinat GPS (jika ada)
AND elapsed timer berjalan (update per detik) untuk alert ACTIVE/ACKNOWLEDGED
```

### AC-5: Elapsed Timer Behavior

```
GIVEN alert berstatus ACTIVE atau ACKNOWLEDGED
WHEN detail ditampilkan
THEN elapsed timer berjalan dari createdAt hingga sekarang, update per 1 detik

GIVEN alert berstatus RESOLVED
WHEN detail ditampilkan
THEN timer FREEZE di angka terakhir
AND tampilan berubah (warna hijau, label "Ditangani dalam X menit Y detik")
AND timer TIDAK berjalan lagi
```

### AC-6: Broadcast Panel & Responder Status

```
GIVEN alert dipilih dan memiliki recipients
WHEN broadcast panel ditampilkan di panel kanan
THEN semua responder (guard on-duty) tampil dengan delivery status:
     PENDING → "Pending"
     SENT → "On Route"
     DELIVERED → "Terkirim"
     ACKNOWLEDGED → "Diterima"
AND daftar responder otomatis dari backend (semua guard on-duty)
```

### AC-7: Resolve Alert

```
GIVEN user adalah admin
AND alert berstatus ACTIVE atau ACKNOWLEDGED
WHEN user klik "Tandai Terkendali"
THEN PATCH /alerts/:id/resolve dipanggil
AND status alert berubah menjadi RESOLVED
AND tombol berubah menjadi "Sudah Terkendali" (disabled)
AND elapsed timer freeze + tampilan berubah (AC-5)
AND query cache ter-invalidate → list ter-update

GIVEN alert sudah RESOLVED
THEN tombol resolve disabled
```

### AC-8: Resolve Tidak Cancel Broadcast

```
GIVEN alert di-resolve
AND ada responder dengan status PENDING atau SENT
WHEN resolve berhasil
THEN notifikasi ke responder TETAP dikirim (tidak dibatalkan)
AND responder akan melihat alert sudah RESOLVED saat membuka
```

### AC-9: Internal Panic Trigger (Guard/Testing)

```
GIVEN user sudah login
WHEN user klik tombol Panic di dashboard
THEN PanicConfirmModal terbuka
AND GPS mulai diambil (loading state, max 8 detik)
AND user memilih tipe: MEDICAL, CRIME, FIRE, atau OTHER

WHEN user klik "Send Panic Alert"
THEN POST /api/panic dipanggil dengan { type, userId (dari auth), gps }
AND jika GPS gagal/denied, fallback lokasi tetap digunakan (alert TETAP terkirim)
AND toast tampil dengan alert ID dan latency
AND modal tertutup
AND query cache ter-invalidate
```

### AC-10: GPS Fallback

```
GIVEN GPS permission denied atau timeout (>8 detik)
WHEN panic alert dikirim
THEN alert TETAP terkirim dengan lokasi fallback
AND GPS status menampilkan indikator error/fallback
AND panic flow TIDAK terblokir oleh kegagalan GPS
```

### AC-11: Interactive Map Integration

```
GIVEN ada panic alerts dengan koordinat GPS (lat/lng)
WHEN user membuka Interactive Map
THEN panic alerts ditampilkan sebagai pin merah di peta
AND pin menampilkan info alert saat diklik
```

---

## Test Cases

### TC-1: Happy Path — Receive & Resolve Alert

```
GIVEN operator login sebagai admin
AND sistem masyarakat mengirim panic alert tipe MEDICAL

WHEN alert masuk via WebSocket
THEN alert muncul di list dengan status ACTIVE (border merah, pulse)
AND toast notification tampil
AND badge sidebar ter-update
AND alert otomatis ter-select

WHEN operator klik alert di list
THEN detail tampil: banner, lokasi, elapsed timer berjalan

WHEN operator lihat broadcast panel
THEN semua guard on-duty tampil dengan delivery status

WHEN operator klik "Tandai Terkendali"
THEN status berubah RESOLVED
AND timer freeze + tampil hijau "Ditangani dalam X menit Y detik"
AND tombol disabled "Sudah Terkendali"
AND list item: badge hijau, opacity rendah
```

### TC-2: Internal Panic Trigger

```
GIVEN guard login
WHEN klik tombol Panic di dashboard
THEN modal terbuka, GPS loading

WHEN pilih FIRE, klik "Send Panic Alert"
THEN POST /api/panic berhasil
AND toast tampil dengan alert ID
AND modal tertutup
AND alert baru muncul di Panic Monitor
```

### TC-3: GPS Fallback

```
GIVEN GPS permission denied
WHEN user buka PanicConfirmModal
THEN GPS status menampilkan error/fallback indicator

WHEN user tetap klik "Send Panic Alert"
THEN alert BERHASIL terkirim dengan lokasi fallback
AND toast tampil normal
```

### TC-4: Timer Bug Fix Verification (Bug #4)

```
GIVEN alert ACTIVE, elapsed timer berjalan (misal 00:05:23)
WHEN admin resolve alert
THEN timer FREEZE di angka saat resolve (misal 00:05:23)
AND tampilan berubah hijau: "Ditangani dalam 5 menit 23 detik"
AND timer TIDAK increment lagi (tunggu 10 detik, tetap 00:05:23)
```

### TC-5: Multiple Alert Types (Bug #2 Clarification)

```
GIVEN 4 tipe alert: MEDICAL, CRIME, FIRE, OTHER
WHEN masing-masing tipe di-trigger
THEN semua 4 tipe BERHASIL terkirim
AND flow identical (hanya label yang beda)
AND semua muncul di Panic Monitor dengan tipe yang benar
```

### TC-6: Permission — Non-Admin Cannot Resolve

```
GIVEN user login sebagai GUARD (bukan admin)
WHEN melihat alert detail
THEN tombol "Tandai Terkendali" TIDAK tampil atau disabled
```

### TC-7: Real-time Update via WebSocket

```
GIVEN Panic Monitor terbuka
WHEN alert baru masuk (WebSocket: ALERT_CREATED, category=PANIC_BUTTON)
THEN list otomatis refresh tanpa manual reload
AND alert baru muncul di posisi teratas

WHEN alert di-resolve oleh admin lain (WebSocket: ALERT_UPDATED)
THEN status di list otomatis berubah ke RESOLVED
```

---

## Definition of Done

### Functional
- [ ] Semua 11 AC terpenuhi dan terverifikasi
- [ ] TC-1 (happy path) PASS end-to-end
- [ ] TC-4 (timer bug #4) PASS — timer freeze saat resolved
- [ ] TC-5 (4 tipe alert) PASS — semua tipe bisa dikirim
- [ ] TC-6 (permission) PASS — hanya admin bisa resolve

### Technical
- [ ] Tidak ada console error di browser saat flow normal
- [ ] WebSocket reconnect otomatis setelah disconnect
- [ ] Query cache invalidation bekerja (data fresh setelah mutasi)
- [ ] `DEFAULT_USER_ID` tidak dipakai saat user sudah login (userId dari auth token)

### Out of Scope (Eksplisit TIDAK dikerjakan di v1.0.0)
- [ ] ~~OCR/scan KTP~~ — nanti
- [ ] ~~Perbedaan flow per tipe alert~~ — semua tipe sama
- [ ] ~~Pilih responder manual~~ — otomatis dari backend
- [ ] ~~Cancel broadcast saat resolve~~ — notif tetap jalan
- [ ] ~~Sistem trigger masyarakat~~ — terpisah

---

## Technical Reference

### Files

| Area | File |
|------|------|
| Trigger modal | `src/features/panic/PanicConfirmModal.jsx` |
| Monitor view | `src/features/panic-monitor/PanicMonitorView.jsx` |
| Alert list | `src/features/panic-monitor/PanicAlertList.jsx` |
| Alert detail + timer | `src/features/panic-monitor/PanicAlertDetail.jsx` |
| Broadcast panel | `src/features/panic-monitor/PanicBroadcastPanel.jsx` |
| API layer | `src/api/alerts.api.js` |
| Hooks | `src/hooks/usePanicAlerts.js` |
| GPS utility | `src/utils/geo.js` |
| Config (panic types) | `src/config.js` |
| UI store (modal) | `src/store/ui.store.js` |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/panic` | Trigger panic alert |
| GET | `/api/alerts?category=PANIC_BUTTON` | List panic alerts |
| GET | `/api/alerts/:id` | Alert detail + recipients |
| PATCH | `/api/alerts/:id/resolve` | Resolve alert |
| PATCH | `/api/alerts/:id/acknowledge` | Acknowledge alert |

### WebSocket Events

| Event | Source | Action |
|-------|--------|--------|
| `ALERT_CREATED` (category=PANIC_BUTTON) | Backend | Invalidate query + toast |
| `ALERT_UPDATED` (category=PANIC_BUTTON) | Backend | Invalidate query |

---

## Known Bugs to Fix

| Bug | Dari | AC Terkait | Status |
|-----|------|-----------|--------|
| Timer jalan terus saat resolved | QA Report #4 | AC-5 | Open |
| "Dari 4 tombol hanya 1 fungsi" | QA Report #2 | AC-9, TC-5 | Needs clarification — semua 4 tipe harus fungsi |
| `DEFAULT_USER_ID = 'guard-001'` hardcoded | Code review | AC-1, AC-9 | Tech debt — harus pakai auth token |

---

_Generated from brainstorming session 2026-05-26 + codebase analysis_
_Source: `_bmad-output/brainstorming/brainstorming-session-2026-05-26-001.md`_
