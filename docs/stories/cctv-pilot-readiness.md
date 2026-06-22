# CCTV Pilot Readiness Report

**Feature:** CCTV Camera Management & Live Monitoring
**Tujuan Dokumen:** Jawaban dev ke PM — apa yang dibutuhkan sebelum pilot project
**Date:** 2026-06-03
**Status:** Conditional GO — 2 item wajib harus fix dulu

---

## Ringkasan Eksekutif

Fitur CCTV ~90% siap untuk pilot **read-only** (lihat kamera, monitor status, streaming HLS). Namun ada **2 blocker keamanan** yang harus diselesaikan sebelum live ke user nyata.

---

## ✅ Sudah Siap — Bisa Pilot Sekarang

| Komponen | Keterangan |
|---|---|
| Gallery kamera (grid view) | Modal + halaman Media, grid 3 kolom |
| HLS video streaming | Playback otomatis, low-latency mode |
| Status online/offline/degraded | Badge real-time per kamera |
| Polling refresh otomatis | React Query refetch setiap 15 detik |
| Heartbeat per kamera | POST ke backend setiap 30 detik (staggered 500ms) |
| Motion alert indicator | Border merah pulse + label detect |
| Animated placeholder | Kamera tanpa streamUrl — gradient, bukan black screen |
| Fullscreen mode | Grid 4 kolom + featured kamera pertama |
| Empty state | Pesan "No cameras configured" + tombol Add |
| CRUD kamera (admin) | Tambah, edit, hapus via form — UI + API ada |
| Database kamera | Tabel `cameras` dengan 10 kamera seed data |
| Stats di TopBar & Dashboard | "N/M Online" + metric "Cameras Live" |

---

## 🔴 Blocker — Wajib Fix Sebelum Pilot

### Blocker 1: Endpoint CRUD Kamera Tidak Ada Auth

**Masalah:** POST/PUT/DELETE/PATCH `/api/cameras` tidak dilindungi token JWT.
Siapapun yang tahu URL backend bisa tambah, edit, atau hapus kamera **tanpa login**.

**Risiko:** Kamera bisa dihapus atau diubah oleh pihak tidak berwenang selama pilot.

**Fix:** Tambah middleware `verifyToken` + `requireRole(['ADMIN', 'SUPERVISOR'])` ke endpoint CRUD.

**File:** `backend/api/router.js` atau route kamera
**Effort:** ~30 menit

---

### Blocker 2: Status Kamera Tidak Broadcast Real-Time via WebSocket

**Masalah:** Heartbeat kamera masuk ke database, tapi event `camera_status_changed` **tidak di-emit** ke client lain. Status update hanya terlihat setelah polling 15 detik berikutnya — bukan real-time.

**Risiko:** Operator tidak langsung tahu kamera berubah offline. Delay hingga 15 detik.

**Fix:** Tambah `WebSocketService.broadcastToRoom('cameras_room', 'camera_status_changed', ...)` di heartbeat handler setelah update status DB.

**File:** `backend/controllers/CameraController.js` (heartbeat handler)
**Effort:** ~1 jam

---

## 🟡 Tech Debt — Bisa Pilot, Fix Sprint Berikutnya

| Issue | Dampak | Lokasi |
|---|---|---|
| `healthScore` hardcoded 90 | Angka health tidak real, misleading | `useCamerasStream.js:41` |
| `responseTime` random 50-250ms | Angka response time palsu | `useCamerasStream.js:41` |
| Koordinat kamera seed di Bandung | Pin kamera tidak muncul di peta perumahan | `migrations/001_create_cameras_table.sql` |
| Double-prefix `/api/api/` di DB endpoints | Routing bug — CRUD mungkin tidak jalan di beberapa env | `cameras.api.js` |
| Vigi AI camera (C240-01) — real atau mock? | Belum konfirmasi ke backend | `cameras.api.js:26-37` |

---

## ❌ Out of Scope v1.0.0 — Jangan Dijanjikan ke User Pilot

| Fitur | Status |
|---|---|
| Snapshot kamera | Tombol ada di UI, **tidak berfungsi** |
| Record kamera | Tombol ada di UI, **tidak berfungsi** |
| Single camera fullscreen expand | Belum diimplementasi |
| Vigi AI injection status | TBD — menunggu konfirmasi backend |

> ⚠️ Pastikan user pilot tidak menekan tombol Snapshot/Record — akan terlihat tidak ada respons.

---

## Estimasi Fix Blocker

| Fix | File | Effort |
|---|---|---|
| Auth middleware camera CRUD | `backend/api/router.js` | ~30 menit |
| WebSocket emit di heartbeat handler | `backend/controllers/CameraController.js` | ~1 jam |
| **Total** | | **~1.5 jam** |

---

## Checklist Pilot Go/No-Go

### Harus Selesai Sebelum Pilot

- [ ] **Blocker 1:** Auth middleware pada endpoint CRUD kamera
- [ ] **Blocker 2:** WebSocket emit `camera_status_changed` di heartbeat handler
- [ ] Koordinat kamera seed diupdate ke koordinat perumahan yang benar
- [ ] Konfirmasi stream URL kamera aktif dan bisa diakses dari network pilot
- [ ] Test HLS playback dari device yang dipakai saat pilot

### Nice to Have (Tidak Blocking)

- [ ] `healthScore` dari sensor nyata (bukan hardcoded 90)
- [ ] Fix double-prefix `/api/api/` routing
- [ ] Konfirmasi status Vigi AI camera dengan tim backend

---

## Technical Reference

### Flow Kamera

```
Backend DB (cameras table)
    ↓ GET /api/cameras (15 detik polling)
useCamerasStream.js
    ↓ normalizeCameraList()
camera.service.js
    ↓
CamerasModal / MediaView / TopBar / Dashboard
    ↑ WebSocket: camera_status_changed → invalidate query
```

### Endpoint yang Dipakai

| Method | Endpoint | Auth Sekarang | Seharusnya |
|--------|----------|---------------|------------|
| GET | `/api/cameras` | ✅ — | Tidak perlu auth (list publik OK) |
| POST | `/api/cameras/:id/heartbeat` | ❌ Tidak ada | Butuh verifyToken |
| POST | `/api/api/cameras` | ❌ Tidak ada | Butuh verifyToken + ADMIN |
| PUT | `/api/api/cameras/:id` | ❌ Tidak ada | Butuh verifyToken + ADMIN |
| PATCH | `/api/api/cameras/:id/status` | ❌ Tidak ada | Butuh verifyToken + ADMIN |
| DELETE | `/api/api/cameras/:id` | ❌ Tidak ada | Butuh verifyToken + ADMIN |

### Files Utama

| Area | File |
|------|------|
| Gallery modal | `src/features/cameras/CamerasModal.jsx` |
| Camera card + HLS | `src/features/cameras/CameraCard.jsx` |
| CRUD form | `src/features/cameras/CameraForm.jsx` |
| API layer | `src/api/cameras.api.js` |
| Hook (stream + polling) | `src/hooks/useCamerasStream.js` |
| Service (normalize) | `src/services/camera.service.js` |
| Media view | `src/features/media/MediaView.jsx` |
| Backend controller | `backend/controllers/CameraController.js` |
| DB schema | `backend/migrations/001_create_cameras_table.sql` |

---

_Disiapkan oleh: Dev Team_
_Source: Reverse engineering codebase 2026-06-03_
_Dokumen terkait: `docs/stories/cctv-cameras.md`_
