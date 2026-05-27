# Story Card: CCTV Camera Management & Monitoring

**Feature:** CCTV Camera Management & Live Monitoring
**Status:** Implemented (~85%), dokumentasi baru
**Sprint:** v1.0.0
**Last Updated:** 2026-05-27

---

## User Story

**Sebagai** operator/admin CIFO Guard dashboard,
**Saya ingin** melihat, memantau, dan mengelola kamera CCTV secara real-time,
**Sehingga** saya bisa mengawasi kondisi area keamanan dari satu dashboard terpusat.

### Scope

**IN SCOPE:**
- Melihat daftar kamera CCTV aktif (gallery grid)
- Memutar stream HLS live dari tiap kamera
- Melihat status online/offline/error kamera secara real-time
- CRUD kamera (tambah, edit, hapus) untuk admin
- Melihat ringkasan stats kamera di dashboard (TopBar + CenterPanel)
- Fullscreen mode untuk gallery
- Motion alert indicator per kamera
- Animated placeholder saat stream tidak tersedia (by design)

**OUT OF SCOPE (v1.0.0):**
- Snapshot kamera (tombol ada, belum diimplementasi)
- Record kamera (tombol ada, belum diimplementasi)
- Single-camera fullscreen expand (belum diimplementasi)
- Vigi AI camera injection status (TBD — backend belum konfirmasi)
- Camera pins di Interactive Map (bagian dari feature Map terpisah)

---

## Acceptance Criteria

### AC-1: Authentication Required

```
GIVEN user belum login
WHEN mengakses fitur kamera
THEN user di-redirect ke halaman login
AND CamerasModal tidak bisa dibuka
```

### AC-2: Stats Kamera di Dashboard

```
GIVEN user sudah login
WHEN dashboard dibuka
THEN TopBar menampilkan "{online}/{total} Online" (klik → buka modal)
AND CenterPanel Overview menampilkan metric "Cameras Live" dengan jumlah kamera online
AND Live Cameras section menampilkan maksimal 3 kamera pertama
```

### AC-3: Buka Camera Gallery Modal

```
GIVEN user sudah login
WHEN user klik stat kamera di TopBar
  ATAU klik "View all" di CenterPanel
  ATAU klik "Fullscreen" di RightPanel
THEN CamerasModal terbuka
AND semua kamera tampil dalam grid (3 kolom default)
AND footer menampilkan "N/M online" + tombol "Add Camera"
```

### AC-4: Camera Card Display

```
GIVEN kamera memiliki streamUrl valid (HLS .m3u8)
WHEN CameraCard dirender
THEN video HLS diputar otomatis (low latency mode)
AND HUD overlay tampil: indikator LIVE (merah pulse), nama kamera, timestamp, badge resolusi

GIVEN kamera TIDAK memiliki streamUrl atau format bukan HLS
WHEN CameraCard dirender
THEN animated gradient background tampil sebagai placeholder (UX by design)
AND HUD overlay tetap tampil dengan info kamera
```

### AC-5: Motion Alert Indicator

```
GIVEN kamera mendeteksi motion (cam.motion === true)
WHEN CameraCard dirender
THEN border kamera beranimasi merah (pulse)
AND label deteksi tampil jika cam.detect tersedia ("⚠ Detect: [label]")
```

### AC-6: Real-time Status Update

```
GIVEN CamerasModal atau dashboard terbuka
WHEN status kamera berubah (WebSocket: camera_status_changed)
THEN data kamera ter-refresh otomatis tanpa reload halaman
AND polling backup setiap 15 detik untuk pastikan data fresh
AND heartbeat dikirim ke setiap kamera setiap 30 detik (staggered 500ms)
```

### AC-7: Fullscreen Mode

```
GIVEN CamerasModal terbuka
WHEN user klik tombol fullscreen
THEN grid berubah menjadi 4 kolom
AND kamera pertama tampil featured (full width)
WHEN user klik exit fullscreen
THEN grid kembali ke 3 kolom normal
```

### AC-8: Empty State

```
GIVEN belum ada kamera terdaftar di sistem
WHEN CamerasModal dibuka
THEN pesan "No cameras configured" tampil
AND tombol "Add First Camera" tampil
```

### AC-9: Tambah Kamera (Admin)

```
GIVEN user login sebagai admin
WHEN user klik "Add Camera" di modal
THEN CameraForm terbuka dalam overlay
AND form field tersedia: Name*, Label*, Area, Resolution (720p/1080p/2K/4K), Lat, Lng, Stream URL

WHEN user isi semua field wajib (name, label) dan klik "Save"
THEN POST ke backend berhasil
AND kamera baru muncul di gallery
AND form tertutup
AND modal refresh dengan data terbaru

GIVEN name atau label kosong
WHEN user klik "Save"
THEN form menampilkan error validasi
AND save tidak dieksekusi
```

### AC-10: Edit Kamera (Admin)

```
GIVEN user login sebagai admin
WHEN user hover pada CameraCard
THEN tombol edit (✎) muncul

WHEN user klik tombol edit
THEN CameraForm terbuka dengan data kamera ter-prefill

WHEN user ubah data dan klik "Save"
THEN PUT ke backend berhasil
AND kamera ter-update di gallery
```

### AC-11: Hapus Kamera (Admin)

```
GIVEN user login sebagai admin dan CameraForm untuk kamera tertentu terbuka
WHEN user klik "Delete"
THEN konfirmasi dialog muncul

WHEN user konfirmasi hapus
THEN DELETE ke backend berhasil
AND kamera hilang dari gallery
AND form tertutup
```

### AC-12: Media View (Dedicated Camera Page)

```
GIVEN user navigate ke halaman Media
WHEN halaman dirender
THEN SEMUA kamera tampil (tidak dibatasi 3)
AND HLS playback aktif untuk setiap kamera yang memiliki streamUrl
AND layout identik dengan CamerasModal
```

---

## Test Cases

### TC-1: Happy Path — Lihat & Monitor Kamera

```
GIVEN operator login
WHEN dashboard dibuka
THEN TopBar menampilkan "N/M Online" (contoh: "8/10 Online")
AND CenterPanel Overview menampilkan metric kamera
AND 3 kamera pertama tampil di Live Cameras section

WHEN operator klik "N/M Online" di TopBar
THEN CamerasModal terbuka dengan semua kamera dalam grid
AND kamera dengan streamUrl valid memutar video HLS
AND kamera tanpa streamUrl tampil animated placeholder
```

### TC-2: Real-time Status Update

```
GIVEN CamerasModal terbuka
WHEN backend mengirim WebSocket event "camera_status_changed"
THEN gallery otomatis refresh tanpa manual reload
AND status kamera ter-update (online/offline/error)

GIVEN tidak ada WS event dalam 15 detik
THEN React Query polling otomatis refetch data terbaru
```

### TC-3: Add Camera (Admin)

```
GIVEN admin login dan CamerasModal terbuka
WHEN admin klik "Add Camera"
THEN CameraForm terbuka kosong

WHEN admin isi: name="Pos 3 Belakang", label="CAM-03", area="Zone B",
     resolution="1080p", streamUrl="rtsp://192.168.1.103/stream"
AND klik "Save"
THEN kamera baru muncul di gallery
AND footer update "N+1/M Online"
```

### TC-4: Edit Camera

```
GIVEN admin hover pada kamera "CAM-01"
WHEN klik tombol edit (✎)
THEN CameraForm terbuka dengan data ter-prefill (name, label, area, dll)

WHEN admin ubah area menjadi "Zone A Extended" dan klik "Save"
THEN data ter-update di gallery
AND kamera card menampilkan area baru
```

### TC-5: Delete Camera

```
GIVEN admin buka edit form kamera "CAM-05"
WHEN klik "Delete"
THEN konfirmasi dialog: "Hapus kamera CAM-05?"

WHEN admin konfirmasi
THEN kamera hilang dari gallery
AND footer update count berkurang 1
```

### TC-6: Validasi Form

```
GIVEN CameraForm terbuka
WHEN admin klik "Save" tanpa mengisi name atau label
THEN error validasi tampil di field terkait
AND save TIDAK dieksekusi
AND form tetap terbuka
```

### TC-7: Animated Placeholder

```
GIVEN kamera "CAM-08" tidak memiliki streamUrl
WHEN CameraCard dirender
THEN animated gradient background tampil (bukan black screen)
AND HUD overlay tetap tampil: nama, timestamp, resolution
AND tidak ada error console
```

### TC-8: Motion Alert

```
GIVEN kamera "CAM-02" memiliki motion=true dari backend
WHEN CameraCard dirender
THEN border kamera beranimasi merah
AND jika cam.detect tersedia, label "⚠ Detect: [label]" tampil
```

### TC-9: Fullscreen Toggle

```
GIVEN CamerasModal terbuka (3 kolom)
WHEN user klik tombol expand fullscreen
THEN grid berubah 4 kolom
AND kamera pertama featured (full width)

WHEN user klik exit fullscreen
THEN grid kembali 3 kolom
```

### TC-10: Empty State

```
GIVEN tidak ada kamera di database
WHEN CamerasModal dibuka
THEN pesan "No cameras configured" tampil
AND tombol "Add First Camera" tampil dan dapat diklik
```

---

## Definition of Done

### Functional
- [ ] Semua 12 AC terpenuhi dan terverifikasi
- [ ] TC-1 (happy path view) PASS
- [ ] TC-3 (add camera) PASS
- [ ] TC-5 (delete camera) PASS
- [ ] TC-7 (placeholder behavior) PASS — tidak ada black screen

### Technical
- [ ] Tidak ada console error saat gallery dibuka
- [ ] WebSocket reconnect otomatis setelah disconnect
- [ ] Heartbeat polling tidak menyebabkan thundering herd (staggered 500ms)
- [ ] HLS cleanup benar saat component unmount (Hls.destroy())
- [ ] Query cache invalidation bekerja setelah create/update/delete

### Out of Scope (Eksplisit TIDAK dikerjakan di v1.0.0)
- [ ] ~~Snapshot button~~ — UI ada, belum diimplementasi
- [ ] ~~Record button~~ — UI ada, belum diimplementasi
- [ ] ~~Single camera expand~~ — belum diimplementasi
- [ ] ~~Vigi AI injection status~~ — TBD backend
- [ ] ~~Camera pins di Interactive Map~~ — fitur Map terpisah

---

## Technical Reference

### Files

| Area | File |
|------|------|
| Gallery modal | `src/features/cameras/CamerasModal.jsx` |
| Camera card + HLS | `src/features/cameras/CameraCard.jsx` |
| CRUD form | `src/features/cameras/CameraForm.jsx` |
| API layer | `src/api/cameras.api.js` |
| Hook (stream + polling) | `src/hooks/useCamerasStream.js` |
| Service (normalize) | `src/services/camera.service.js` |
| UI store (modal) | `src/store/ui.store.js` |
| Media view | `src/features/media/MediaView.jsx` |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cameras` | List semua kamera (legacy, DB-backed) |
| POST | `/api/cameras/:id/heartbeat` | Heartbeat ping per kamera |
| POST | `/api/api/cameras` | Buat kamera baru (DB endpoint) |
| PUT | `/api/api/cameras/:id` | Update kamera |
| PATCH | `/api/api/cameras/:id/status` | Update status kamera |
| DELETE | `/api/api/cameras/:id` | Hapus kamera |
| GET | `/api/api/cameras/stats` | Stats count kamera |

> ⚠️ Double-prefix `/api/api/` pada DB endpoints adalah known issue — backend routing belum difix.

### WebSocket Events

| Event | Source | Action |
|-------|--------|--------|
| `camera_status_changed` | Backend (cameras_room) | Invalidate query → refresh gallery |

### Polling & Heartbeat

| Mechanism | Interval | Purpose |
|-----------|----------|---------|
| React Query refetch | 15 detik | Pastikan data fresh |
| Heartbeat POST | 30 detik per kamera | Lapor status ke backend |

### Normalized Camera Shape

```javascript
{
  id: string,
  name: string,        // dari label > name > "Camera N"
  res: string,         // "720p"|"1080p"|"2K"|"4K"
  bg: string,          // "cam-bg-1"|"cam-bg-2"|"cam-bg-3" (rotasi)
  streamUrl: string|null,
  status: string,      // "online"|"offline"|"degraded"|"error"
  lastHeartbeat: timestamp|null,
  healthScore: number, // 0-100 (saat ini hardcoded 90 di heartbeat payload)
  responseTime: number, // ms (saat ini random 50-250 — tech debt)
  motion: boolean,
  detect: string|null,
  area: string|null,
  lat: number|null,
  lng: number|null,
}
```

---

## Known Issues & Tech Debt

| Issue | Lokasi | Status | AC Terkait |
|-------|--------|--------|-----------|
| `healthScore: 90` hardcoded di heartbeat | `useCamerasStream.js:41` | Tech debt | AC-6 |
| `responseTime` random 50-250ms (fake) | `useCamerasStream.js:41` | Tech debt | AC-6 |
| Double-prefix `/api/api/` di DB endpoints | `cameras.api.js` | Known bug backend | AC-9, AC-10, AC-11 |
| Vigi AI C240-01 injection — real or mock? | `cameras.api.js:26-37` | TBD — perlu konfirmasi backend | — |
| Snapshot/Record button — UI only | `CameraCard.jsx` | Not implemented | Out of scope |

---

_Generated from codebase analysis 2026-05-27_
_Source: `src/features/cameras/`, `src/api/cameras.api.js`, `src/hooks/useCamerasStream.js`_
