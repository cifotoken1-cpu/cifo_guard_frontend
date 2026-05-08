# Kontrak API — CIFO Security System Backend

> Dokumen ini dihasilkan secara otomatis dari pemindaian codebase pada 2026-04-30.
> Semua endpoint dimount di bawah prefix `/api` (via `app.use('/api', router)` di `api/server.js`).

---

## Ringkasan

| Grup | Jumlah Endpoint | Autentikasi |
|------|----------------|-------------|
| Alert | 9 | Sebagian (JWT) |
| Camera (Controller) | 13 | Tidak |
| Camera (Legacy/Hardcoded) | 2 | Tidak |
| Team (Controller) | 15 | Tidak |
| Team (Legacy/Hardcoded) | 2 | Tidak |
| Activity | 19 | Sebagian (JWT) |
| Incident | ~8 | Tidak |
| Geofence | ~6 | Tidak |
| Map Pin | ~5 | Tidak |
| Basemap Config | ~4 | Tidak |
| Feature Flag | ~4 | Tidak |
| Maps | ~4 | Tidak |
| Visitor | ~5 | Tidak |
| Residential Map | ~4 | Tidak |
| Perumahan | 12 | Tidak |
| Panic | 1 | Tidak |
| Telemetry | 1 | Tidak |
| System | 1 | JWT + Role |
| Health | 1 | Tidak |

> ⚠️ **Catatan Inkonsistensi Routing:** Routes Camera, Team, dan Perumahan didefinisikan dengan prefix `/api/cameras`, `/api/team`, `/api/perumahan` di dalam `router.js` yang sudah dimount di `/api`. Ini menyebabkan path ganda (`/api/api/cameras`). Route yang benar menggunakan route modules (`router.use('/incidents', ...)`, dll.) atau direct routes tanpa prefix `/api/` di dalam router.

---

## 1. Panic Alert

### POST `/api/panic`
Membuat panic alert baru.

**Request Body:**
```json
{
  "type": "MEDICAL | CRIME | FIRE | OTHER",
  "userId": "string (3-64 chars)",
  "requestId": "string (8-128 chars, alphanumeric/-/_)",
  "gps": {
    "latitude": -90.0,
    "longitude": -180.0,
    "accuracy": 50
  }
}
```

**Response 200:**
```json
{
  "alertId": "string",
  "status": "ACTIVE",
  "ingest_latency_ms": 12
}
```

---

## 2. Alert Management

### GET `/api/alerts`
Mengambil daftar alert dengan filter.

**Query Parameters:** `status`, `type`, `userId`, `limit`, `since`

### GET `/api/alerts/:id`
Mengambil detail alert berdasarkan ID.

### POST `/api/alerts`
Membuat alert baru.

### PUT `/api/alerts/:id`
Memperbarui alert.

### PATCH `/api/alerts/:id`
Memperbarui status alert (via legacy route).

**Request Body:**
```json
{
  "status": "ACTIVE | RESOLVED | CANCELLED | IN_PROGRESS",
  "metadata": {}
}
```

### PATCH `/api/alerts/:id/acknowledge`
Mengakui (acknowledge) alert.

### PATCH `/api/alerts/:id/resolve`
Menyelesaikan alert.

### GET `/api/alerts/stats`
Mengambil statistik alert.

### GET `/api/alerts/:id/activity`
Mengambil log aktivitas untuk alert tertentu.

### POST `/api/alerts/:id/activities`
Menambahkan aktivitas ke alert. **Memerlukan autentikasi JWT.**

**Request Body:**
```json
{
  "type": "string",
  "description": "string",
  "metadata": {},
  "severity": "INFO | WARNING | ERROR"
}
```

---

## 3. Camera Management (Controller)

> ⚠️ Routes ini didefinisikan sebagai `/api/cameras` di dalam router yang dimount di `/api`, sehingga path efektif adalah `/api/api/cameras`. Kemungkinan ini perlu diperbaiki ke `/cameras`.

### GET `/api/cameras` (Legacy — data hardcoded)
Mengambil daftar kamera CCTV dengan status heartbeat terkini.

**Response 200:**
```json
{
  "cameras": [...],
  "total": 18,
  "online": 15,
  "offline": 3,
  "degraded": 0,
  "error": 0,
  "timestamp": 1714435200000
}
```

### POST `/api/cameras/:id/heartbeat` (Legacy)
Menerima heartbeat dari kamera.

**Request Body:**
```json
{
  "status": "online | offline | degraded | error",
  "responseTime": 120,
  "healthScore": 95,
  "streamAccessible": true
}
```

### GET `/api/api/cameras` (Controller)
Mengambil semua kamera dari database.

### GET `/api/api/cameras/stats`
Statistik kamera.

### GET `/api/api/cameras/dashboard`
Data dashboard kamera.

### GET `/api/api/cameras/area/:area`
Kamera berdasarkan area.

### GET `/api/api/cameras/status/:status`
Kamera berdasarkan status.

### GET `/api/api/cameras/:id`
Detail kamera berdasarkan ID.

### POST `/api/api/cameras`
Membuat kamera baru.

### PUT `/api/api/cameras/:id`
Memperbarui kamera.

### PATCH `/api/api/cameras/:id/status`
Memperbarui status kamera.

### PATCH `/api/api/cameras/bulk-status`
Memperbarui status beberapa kamera sekaligus.

### DELETE `/api/api/cameras/:id`
Menghapus kamera.

### POST `/api/api/cameras/:id/heartbeat`
Heartbeat kamera (via Controller).

### GET `/api/api/cameras/:id/health-logs`
Log kesehatan kamera.

---

## 4. Team Management (Controller)

> ⚠️ Sama seperti Camera, route Controller menggunakan `/api/team` di dalam router → path efektif `/api/api/team`.

### GET `/api/team` (Legacy — data hardcoded)
Mengambil daftar tim keamanan (mock data).

**Query Parameters:** `status` (ON_DUTY | OFF_DUTY | PATROLLING | BREAK), `role`

### GET `/api/security/team/status`
Ringkasan status tim keamanan (mock data).

### GET `/api/api/team`
Semua anggota tim dari database.

### GET `/api/api/team/stats`
Statistik tim.

### GET `/api/api/team/on-duty`
Anggota yang sedang bertugas.

### GET `/api/api/team/by-role/:role`
Filter berdasarkan role.

### GET `/api/api/team/by-shift/:shift`
Filter berdasarkan shift.

### GET `/api/api/team/:id`
Detail anggota tim.

### POST `/api/api/team`
Membuat anggota tim baru.

### PUT `/api/api/team/:id`
Memperbarui anggota tim.

### PATCH `/api/api/team/:id/status`
Memperbarui status anggota.

### PATCH `/api/api/team/:id/location`
Memperbarui lokasi anggota.

### DELETE `/api/api/team/:id`
Menghapus anggota tim.

### GET `/api/api/team/:id/location-history`
Riwayat lokasi anggota.

### GET `/api/api/team/locations/current`
Lokasi terkini semua anggota.

### GET `/api/api/team/patrol/routes`
Rute patroli.

### GET `/api/api/team/activity/summary`
Ringkasan aktivitas tim.

---

## 5. Activity Logging

### GET `/api/activities`
Semua aktivitas dengan filter.

### GET `/api/activities/stats`
Statistik aktivitas.

### GET `/api/activities/recent`
Aktivitas terbaru.

### GET `/api/activities/type/:type`
Filter berdasarkan tipe.

### GET `/api/activities/severity/:severity`
Filter berdasarkan severity.

### GET `/api/activities/actor/:actor`
Filter berdasarkan aktor.

### GET `/api/activities/reference/:refId`
Filter berdasarkan reference ID.

### GET `/api/activities/trends`
Tren aktivitas.

### GET `/api/activities/top-actors`
Aktor terbanyak.

### GET `/api/activities/critical`
Aktivitas kritis.

### GET `/api/activities/:id`
Detail aktivitas.

### POST `/api/activities`
Membuat aktivitas baru.

### PUT `/api/activities/:id`
Memperbarui aktivitas.

### DELETE `/api/activities/:id`
Menghapus aktivitas.

### POST `/api/activities/log-incident`
Log insiden.

### POST `/api/activities/log-patrol`
Log patroli.

### POST `/api/activities/log-visitor`
Log kunjungan.

### DELETE `/api/activities/cleanup/:days`
Membersihkan aktivitas lama (N hari).

### GET `/api/activities/export/csv`
Export aktivitas ke CSV. **Memerlukan JWT + role ADMIN/SUPER_ADMIN/SUPERVISOR.**

---

## 6. Incident Management

Route module: `router.use('/incidents', incidentRoutes)` → `api/incident-routes.js`

### GET `/api/incidents`
Semua insiden dengan filter (status, type, priority).

### POST `/api/incidents`
Membuat insiden baru.

**Tipe valid:** `SECURITY_BREACH | FIRE | MEDICAL_EMERGENCY | THEFT | VANDALISM | SUSPICIOUS_ACTIVITY | EQUIPMENT_FAILURE | POWER_OUTAGE | FLOOD | EARTHQUAKE | PANIC_ALERT | UNAUTHORIZED_ACCESS | OTHER | SECURITY | MAINTENANCE | EMERGENCY | TECHNICAL`

**Prioritas valid:** `LOW | MEDIUM | HIGH | CRITICAL`

### GET `/api/incidents/:id`
Detail insiden.

### PATCH `/api/incidents/:id`
Memperbarui insiden.

### POST `/api/incidents/:id/activities`
Menambahkan aktivitas ke insiden.

### GET `/api/incidents/:id/activities`
Aktivitas insiden.

---

## 7. Geofence Management

Route module: `router.use('/geofences', geofenceRoutes)` → `api/geofence-routes.js`

### GET `/api/geofences`
Semua geofence.

### POST `/api/geofences`
Membuat geofence baru.

### GET `/api/geofences/:id`
Detail geofence.

### PUT `/api/geofences/:id`
Memperbarui geofence.

### DELETE `/api/geofences/:id`
Menghapus geofence.

### GET `/api/geofences/:id/breaches`
Pelanggaran geofence.

---

## 8. Map Pins

Route module: `router.use('/map-pins', mapPinRoutes)` → `routes/map-pin-routes.js`

### GET `/api/map-pins`
Semua pin peta.

### POST `/api/map-pins`
Membuat pin baru.

### GET `/api/map-pins/:id`
Detail pin.

### PUT `/api/map-pins/:id`
Memperbarui pin.

### DELETE `/api/map-pins/:id`
Menghapus pin.

---

## 9. Basemap Configuration

Route module: `router.use('/basemap-config', basemapConfigRoutes)` → `routes/basemap-config-routes.js`

### GET `/api/basemap-config`
Konfigurasi basemap aktif.

### POST `/api/basemap-config`
Membuat konfigurasi basemap.

### PUT `/api/basemap-config/:id`
Memperbarui basemap.

### DELETE `/api/basemap-config/:id`
Menghapus basemap.

---

## 10. Feature Flags

Route module: `router.use('/feature-flags', featureFlagRoutes)` → `routes/feature-flag-routes.js`

### GET `/api/feature-flags`
Semua feature flag.

### POST `/api/feature-flags`
Membuat feature flag.

### GET `/api/feature-flags/:key`
Nilai feature flag berdasarkan key.

### PUT `/api/feature-flags/:key`
Memperbarui feature flag.

---

## 11. Maps

Route module: `router.use('/maps', mapsRoutes)` → `routes/maps-routes.js`

### GET `/api/maps`
Data peta.

### GET `/api/maps/basemap`
Konfigurasi basemap untuk peta.

### GET `/api/maps/pins`
Pin peta.

### POST `/api/maps/pins`
Membuat pin peta.

---

## 12. Visitor Registration

Route module: `router.use('/visitor', visitorRoutes)` → `routes/visitor.js`

### GET `/api/visitor`
Daftar registrasi visitor.

### POST `/api/visitor`
Mendaftarkan visitor baru (dengan upload foto/KTP via Multer + OCR Tesseract.js).

### GET `/api/visitor/:id`
Detail visitor.

### PUT `/api/visitor/:id`
Memperbarui data visitor.

### DELETE `/api/visitor/:id`
Menghapus data visitor.

---

## 13. Residential Map

Route module: `router.use('/residential-map', residentialMapRoutes)` → `routes/residential-map-routes.js`

---

## 14. Perumahan Management

> ⚠️ Sama dengan Camera/Team, menggunakan prefix `/api/perumahan` di dalam router → path efektif `/api/api/perumahan`.

### GET `/api/api/perumahan`
Semua data perumahan.

### GET `/api/api/perumahan/stats`
Statistik perumahan.

### GET `/api/api/perumahan/search`
Pencarian perumahan.

### GET `/api/api/perumahan/occupancy-report`
Laporan hunian.

### GET `/api/api/perumahan/:id`
Detail perumahan.

### POST `/api/api/perumahan`
Membuat perumahan baru.

### PUT `/api/api/perumahan/:id`
Memperbarui perumahan.

### DELETE `/api/api/perumahan/:id`
Menghapus perumahan.

### GET `/api/api/perumahan/:id/facilities`
Fasilitas perumahan.

### POST `/api/api/perumahan/:id/facilities`
Menambahkan fasilitas.

### PUT `/api/api/perumahan/facilities/:facilityId`
Memperbarui fasilitas.

### DELETE `/api/api/perumahan/facilities/:facilityId`
Menghapus fasilitas.

---

## 15. Telemetry

### POST `/api/telemetry/map`
Menerima data telemetri peta (single event atau batch).

**Request Body (batch):**
```json
{
  "events": [
    {
      "event": "string",
      "data": {},
      "timestamp": "ISO8601",
      "sessionId": "string",
      "userId": "string"
    }
  ],
  "batchId": "string",
  "source": "string"
}
```

---

## 16. System Activity

### POST `/api/system/:id/activities`
Log aktivitas sistem. **Memerlukan JWT + role ADMIN/SUPER_ADMIN.**

---

## 17. Health Check

### GET `/health`
Status kesehatan server (tidak melalui prefix `/api`).

**Response 200:**
```json
{
  "status": "OK",
  "timestamp": 1714435200000,
  "alerts": 5,
  "connections": 3,
  "services": {
    "api": "running",
    "websocket": "3 connections",
    "store": "5 alerts",
    "queue": "0 pending"
  },
  "uptime": 3600000,
  "version": "1.0.0"
}
```

---

## 18. Metrics

### GET `/api/metrics`
Metrik API dan sistem (requests, latency, store, queue).

---

## WebSocket Events (Socket.io)

Server berjalan di port yang sama dengan HTTP via `socket.io`.

### Client → Server
| Event | Deskripsi |
|-------|-----------|
| `authenticate` | Autentikasi koneksi WebSocket |
| `join_room` | Bergabung ke room tertentu |
| `camera_status_update` | Update status kamera |
| `team_location_update` | Update lokasi tim |
| `security_alert` | Kirim alert keamanan |

### Server → Client
| Event | Deskripsi |
|-------|-----------|
| `authenticated` | Konfirmasi autentikasi |
| `alert_created` | Alert baru dibuat |
| `alert_updated` | Alert diperbarui |
| `camera_status_changed` | Status kamera berubah |
| `team_location_changed` | Lokasi tim berubah |
| `security_alert` | Broadcast alert keamanan |
| `system_stats` | Statistik sistem |
| `health_alert` | Alert kesehatan sistem |

---

## Autentikasi

Endpoints yang memerlukan autentikasi menggunakan JWT Bearer Token:

```
Authorization: Bearer <token>
```

Middleware: `middleware/auth-config.js` → `verifyToken`, `requireRole(['ADMIN', ...])`

Role yang tersedia (dari `verifyToken`): `ADMIN`, `SUPER_ADMIN`, `SUPERVISOR`, `GUARD`, dll.
