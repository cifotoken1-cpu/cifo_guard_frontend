# Status Implementasi API — CIFO Security System Backend

> Dokumen ini diperbarui pada 2026-04-30 berdasarkan pemindaian codebase terkini.
> Dokumen asli berisi daftar "endpoint yang dibutuhkan" — dokumen ini menggantikannya dengan status implementasi aktual.

---

## Ringkasan Status

Semua fitur utama **sudah diimplementasikan**. Tidak ada "missing endpoint" mayor yang tersisa.

| Domain | Status | Catatan |
|--------|--------|---------|
| Panic Alert System | ✅ Lengkap | `POST /api/panic` + AI enrichment |
| Alert Management | ✅ Lengkap | CRUD + acknowledge/resolve + stats |
| Camera Management | ✅ Lengkap | CRUD + heartbeat + health logs + dashboard |
| Team Management | ✅ Lengkap | CRUD + lokasi + shift + patroli |
| Security Activities | ✅ Lengkap | CRUD + export CSV + trend + top actors |
| Incident Management | ✅ Lengkap | CRUD + timeline/activities + duplicate check |
| Geofence | ✅ Lengkap | CRUD + breach tracking |
| Map Pins | ✅ Lengkap | CRUD |
| Basemap Config | ✅ Lengkap | CRUD + SVG basemap |
| Feature Flags | ✅ Lengkap | CRUD + toggle |
| Maps | ✅ Lengkap | Basemap + pins |
| Visitor Registration | ✅ Lengkap | CRUD + OCR KTP (Tesseract.js) |
| Residential Map | ✅ Lengkap | Route module tersedia |
| Perumahan Management | ✅ Lengkap | CRUD + fasilitas + laporan hunian |
| WebSocket Real-time | ✅ Lengkap | Socket.io: alert, kamera, tim, sistem |
| AI Pipeline | ✅ Lengkap | OpenAI enrichment pada alert (ditambahkan 2026-04-28) |

---

## ⚠️ Isu yang Diketahui

### 1. Inkonsistensi Routing (Bug)

Routes berikut didefinisikan dengan prefix `/api/` di dalam `router.js` yang sudah dimount di `/api`, menghasilkan path ganda:

| Route di router.js | Path Efektif (BUG) | Path yang Seharusnya |
|---------------------|-------------------|----------------------|
| `GET /api/cameras` | `GET /api/api/cameras` | `GET /api/cameras` |
| `GET /api/team` | `GET /api/api/team` | `GET /api/team` |
| `GET /api/perumahan` | `GET /api/api/perumahan` | `GET /api/perumahan` |

**Solusi:** Hapus prefix `/api/` dari definisi routes Camera, Team, dan Perumahan di `api/router.js`.

### 2. Data Hardcoded (Mock Data)

Beberapa endpoint masih menggunakan data hardcoded/mock yang belum terhubung ke database:

| Endpoint | Status |
|----------|--------|
| `GET /api/cameras` (legacy route) | 18 kamera hardcoded di router.js |
| `GET /api/team` (legacy route) | 5 anggota tim mock data di router.js |
| `GET /api/security/team/status` | Mock data dari TEAM_ROSTER hardcoded |
| `GET /api/alerts/:id/activity` | Mock activities (2 item statik) |

**Solusi:** Hapus legacy routes dan pastikan frontend menggunakan Controller routes.

### 3. Emergency Contacts API (Belum Ada)

Endpoint emergency contacts dari spesifikasi asli belum diimplementasikan:
- `GET /api/emergency/contacts`
- `POST /api/emergency/call`
- `GET /api/emergency/protocols`
- `POST /api/emergency/broadcast`

**Status:** Rendah prioritas. Bisa diimplementasikan di sprint berikutnya jika dibutuhkan frontend.

---

## Controllers yang Tersedia (Aktual)

| Controller | File | Endpoint Utama |
|-----------|------|---------------|
| AlertController | `controllers/AlertController.js` | `/api/alerts` |
| CameraController | `controllers/CameraController.js` | `/api/api/cameras` *(lihat bug routing)* |
| TeamController | `controllers/TeamController.js` | `/api/api/team` *(lihat bug routing)* |
| ActivityController | `controllers/ActivityController.js` | `/api/activities` |
| IncidentController | `controllers/IncidentController.js` | `/api/incidents` |
| GeofenceController | `controllers/GeofenceController.js` | `/api/geofences` |
| MapPinController | `controllers/MapPinController.js` | `/api/map-pins` |
| BasemapConfigController | `controllers/BasemapConfigController.js` | `/api/basemap-config` |
| FeatureFlagController | `controllers/FeatureFlagController.js` | `/api/feature-flags` |
| PerumahanController | `controllers/PerumahanController.js` | `/api/api/perumahan` *(lihat bug routing)* |

---

## Models yang Ada (Aktual)

17 model Sequelize:
`Alert`, `AlertRecipient`, `Camera`, `CameraHealthLog`, `FeatureFlag`, `Geofence`, `GeofenceBreach`, `Incident`, `MapPin`, `Perumahan`, `QRCode`, `SecurityActivity`, `TeamLocationHistory`, `TeamMember`, `VisitorRegistration`

---

## Services yang Ada (Aktual)

| Service | Fungsi |
|---------|--------|
| WebSocketService | Socket.io rooms + broadcast |
| HealthMonitorService | Cron monitoring setiap 2 menit |
| ActivityLogger | Log aktivitas ke database |
| Vigi services | Integrasi sistem CCTV eksternal |
| AI Pipeline | Analisis alert dengan OpenAI |

---

## WebSocket Events yang Diimplementasikan

### Server → Client
| Event | Trigger |
|-------|---------|
| `alert_created` | Alert/panic baru masuk |
| `alert_updated` | Status alert berubah |
| `camera_status_changed` | Status kamera berubah |
| `team_location_changed` | Lokasi tim diperbarui |
| `security_alert` | Alert keamanan broadcast |
| `system_stats` | Statistik sistem periodik |
| `health_alert` | Alert kesehatan sistem |

### Client → Server
| Event | Fungsi |
|-------|--------|
| `authenticate` | Auth koneksi WebSocket |
| `join_room` | Bergabung ke specific room |
| `camera_status_update` | Update status kamera |
| `team_location_update` | Update lokasi tim |
| `security_alert` | Kirim alert dari client |

---

## Referensi Dokumentasi Lengkap

- **Semua endpoint detail:** `docs/api-contracts-backend.md`
- **Skema database:** `docs/data-models-backend.md`
- **Arsitektur sistem:** `docs/architecture.md`
- **Panduan development:** `docs/development-guide.md`
- **Struktur direktori:** `docs/source-tree-analysis.md`
