# Arsitektur — CIFO Security System Backend

> Dihasilkan pada: 2026-04-30

---

## Ringkasan Eksekutif

CIFO Security System Backend adalah **monolith berbasis Node.js/Express** yang melayani sistem Security Control Center. Arsitektur menggunakan pola **MVC Berlapis** dengan pemisahan yang jelas antara layer routing, controller, service, dan model. Sistem mendukung komunikasi real-time via Socket.io dan terhubung ke sistem CCTV eksternal (Vigi) serta layanan AI (OpenAI).

---

## Pola Arsitektur

**MVC Berlapis (Layered MVC)**

```
                    ┌─────────────────────────────┐
                    │      Frontend / Client        │
                    └──────────────┬──────────────┘
                                   │ HTTP REST / Socket.io
                    ┌──────────────▼──────────────┐
                    │      Middleware Layer          │
                    │  (Auth, CORS, Helmet,          │
                    │   Rate Limit, Compression)     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       Routes Layer             │
                    │  (api/router.js + route       │
                    │   modules: incidents,          │
                    │   geofences, visitors, dll.)   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Controller Layer          │
                    │  (AlertController,             │
                    │   CameraController,            │
                    │   IncidentController, dll.)    │
                    └──────────────┬──────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
  ┌────────────▼──────┐ ┌─────────▼────────┐ ┌───────▼────────┐
  │   Service Layer    │ │   Model Layer     │ │  External APIs  │
  │  (WebSocket,       │ │  (Sequelize ORM)  │ │  (Vigi CCTV,   │
  │   HealthMonitor,   │ │                   │ │   OpenAI,      │
  │   ActivityLogger,  │ │                   │ │   Tesseract)   │
  │   Vigi, AI         │ │                   │ │               │
  │   Pipeline)        │ │                   │ │               │
  └────────────────────┘ └────────┬──────────┘ └───────────────┘
                                  │
                    ┌─────────────▼───────────┐
                    │     Database Layer        │
                    │  MySQL (cifo_security)    │
                    │  Connection Pool: 10      │
                    └─────────────────────────┘
```

---

## Komponen Arsitektur

### 1. Entry Point (`api/server.js`)

- Inisialisasi Express app + HTTP server
- Mount router di `/api`
- Inisialisasi Socket.io via `WebSocketService.initialize(server)`
- Jalankan `HealthMonitorService` (node-cron, setiap 2 menit)
- Queue processor untuk alert broadcasting

### 2. Router (`api/router.js`)

Titik pusat registrasi semua route. Berisi dua jenis route:
- **Direct routes** — logika inline untuk panic, kamera legacy, tim legacy
- **Controller routes** — delegasi ke controller class
- **Route modules** — `router.use('/incidents', incidentRoutes)`, dll.

> ⚠️ **Inkonsistensi yang diketahui**: Beberapa controller (Camera, Team, Perumahan) terdaftar dengan prefix `/api/cameras` di dalam router yang sudah dimount di `/api`, menghasilkan path ganda `/api/api/cameras`. Perlu refaktor untuk konsistensi.

### 3. Middleware (`middleware/`)

| Middleware | Scope | Fungsi |
|-----------|-------|--------|
| `cors` | Global | Allow origins dari `CORS_ORIGIN` env |
| `helmet` | Global | Security headers |
| `express-rate-limit` | Per route group | Rate limiting |
| `compression` | Global | Gzip response |
| `morgan` | Global | HTTP request logging |
| `auth.js` / `auth-config.js` | Per route | JWT verification |
| `dev-auth.js` | Per route (dev) | Bypass auth di development |
| `metrics.js` | Per route | Tracking latency & request count |

### 4. Controller Layer (`controllers/`)

Setiap controller bertanggung jawab atas satu domain:

| Controller | Domain | Operasi Utama |
|-----------|--------|--------------|
| `AlertController` | Alert/Panic | CRUD, acknowledge, resolve, stats |
| `CameraController` | Kamera CCTV | CRUD, heartbeat, health logs, dashboard |
| `TeamController` | Tim Keamanan | CRUD, lokasi, shift, patroli |
| `ActivityController` | Log Aktivitas | CRUD, export CSV, trend analysis |
| `IncidentController` | Insiden | CRUD, duplicate check, timeline |
| `GeofenceController` | Geofence | CRUD, breach tracking |
| `MapPinController` | Pin Peta | CRUD |
| `BasemapConfigController` | Basemap SVG | CRUD, aktivasi |
| `FeatureFlagController` | Feature Flags | CRUD, toggle |
| `PerumahanController` | Perumahan | CRUD, fasilitas, laporan hunian |

### 5. Service Layer (`services/`)

| Service | Fungsi |
|---------|--------|
| `WebSocketService` | Mengelola Socket.io rooms, broadcasting event ke frontend |
| `HealthMonitorService` | Cron job: monitor kamera, tim, performa sistem, cleanup data |
| `ActivityLogger` | Menulis log aktivitas ke database |
| `activity-service.js` | Service abstraction untuk operasi aktivitas |
| `vigi/vigiAuth.js` | Autentikasi ke sistem Vigi eksternal |
| `vigi/vigiEventListener.js` | Listen event dari Vigi (motion detection, dll.) |
| `vigi/vigiSnapshot.js` | Ambil snapshot kamera dari Vigi |
| `vigi/aiPipeline.js` | Proses alert dengan OpenAI untuk enrichment & klasifikasi |
| `vigi/alertEnricher.js` | Tambahkan konteks AI ke alert sebelum broadcast |

### 6. Model Layer (`models/`)

17 model Sequelize mendefinisikan skema database MySQL. Semua diinisialisasi di `models/index.js` dengan associations yang tepat.

### 7. In-Memory Storage (`api/store.js`, `api/queue.js`)

- `alertStore` — Cache alert aktif di memori (in-memory Map)
- `alertQueue` — Queue FIFO untuk proses alert sebelum persistensi ke DB

> **Catatan:** Alert store bersifat volatile — akan hilang saat server restart. Data permanen tersimpan di MySQL via AlertController.

---

## Alur Data: Panic Alert

```
1. Client → POST /api/panic
2. router.js → trackLatency middleware
3. AlertController.createPanicAlert()
4. Validasi GPS + type
5. alertStore.add() → cache di memori
6. alertQueue.enqueue() → antrian broadcast
7. [Async] aiPipeline.js → OpenAI analysis
8. alertEnricher.js → tambah konteks AI ke alert
9. alertQueue processor → WebSocketService.broadcastToRoom('alerts_room', 'alert_created', ...)
10. Socket.io → semua frontend clients yang subscribe
11. Response 200 kembali ke client
```

---

## Alur Data: Vigi Camera Event

```
1. Vigi System → WebSocket event (motion/alert)
2. vigiEventListener.js → tangkap event
3. aiPipeline.js → analisis dengan OpenAI
4. alertEnricher.js → buat alert terstruktur
5. AlertController.createAlert() → simpan ke MySQL
6. WebSocketService.broadcastToRoom() → broadcast ke frontend
```

---

## Keamanan

| Mekanisme | Implementasi |
|-----------|-------------|
| Autentikasi | JWT Bearer Token via `middleware/auth-config.js` |
| Password Hashing | bcryptjs |
| HTTP Security | Helmet (X-Frame-Options, CSP, HSTS, dll.) |
| CORS | Konfigurasi dari `CORS_ORIGIN` env var |
| Rate Limiting | express-rate-limit per endpoint group |
| Input Validation | Joi schema validation + custom validators di router |
| GPS Validation | Koordinat ±90/±180, akurasi < 100m |
| SQL Injection | Otomatis dilindungi oleh Sequelize ORM |

---

## Real-time Architecture

```
Frontend (Socket.io client)
    │
    │ connect → Socket.io
    ▼
WebSocketService.js (Socket.io server)
    │
    ├── Room: 'alerts_room'     ← alert events
    ├── Room: 'cameras_room'    ← camera status changes
    ├── Room: 'team_room'       ← team location updates
    └── Room: 'system_room'     ← system health alerts
```

---

## Konfigurasi Environment

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `PORT` | Port HTTP server | 3001 |
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_NAME` | Nama database | cifo_security |
| `DB_USER` | Username database | root |
| `DB_PASSWORD` | Password database | _(kosong)_ |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `*` |
| `JWT_SECRET` | Secret key untuk JWT | — |
| `NODE_ENV` | Environment mode | development |

---

## Skalabilitas & Keterbatasan

**Keterbatasan saat ini:**
- Alert store bersifat in-memory → tidak horizontal scalable tanpa shared cache (Redis)
- CCTV_CAMERAS hardcoded di `router.js` (18 kamera) → tidak dinamis dari database
- Mock data pada beberapa endpoint (team roster, alert activities) → perlu diganti dengan data nyata
- Inkonsistensi routing (`/api/api/cameras`) perlu diperbaiki

**Rekomendasi scale:**
- Ganti alert store dengan Redis untuk multi-instance
- Pindahkan kamera hardcoded ke database + seed
- Gunakan PM2 cluster mode untuk multi-core
