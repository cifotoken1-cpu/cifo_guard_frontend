# Analisis Struktur Direktori — CIFO Security System Backend

> Dihasilkan pada: 2026-04-30 | Quick Scan

---

## Struktur Direktori Lengkap

```
backend/                              # Root proyek (C:\www\backend)
│
├── api/                              # 🔑 Server & routing utama
│   ├── server.js                     # Entry point: Express app, HTTP server, Socket.io
│   ├── router.js                     # Semua route API didaftarkan di sini
│   ├── store.js                      # In-memory alert store (cache sementara)
│   ├── queue.js                      # Alert queue processor
│   ├── team-routes.js                # Route modul: /api/team (extended)
│   ├── incident-routes.js            # Route modul: /api/incidents
│   ├── geofence-routes.js            # Route modul: /api/geofences
│   └── __tests__/                    # Test integrasi API
│       ├── camera.test.js
│       ├── incidents.test.js
│       ├── ingestion.test.js
│       └── panic.test.js
│
├── controllers/                      # 🎮 Lapisan request handling
│   ├── AlertController.js            # CRUD alert + acknowledge/resolve
│   ├── CameraController.js           # CRUD kamera + heartbeat + health logs
│   ├── TeamController.js             # CRUD tim + lokasi + shift
│   ├── ActivityController.js         # CRUD aktivitas + export CSV
│   ├── IncidentController.js         # CRUD insiden + duplicate check
│   ├── GeofenceController.js         # CRUD geofence + breach tracking
│   ├── MapPinController.js           # CRUD map pins
│   ├── BasemapConfigController.js    # CRUD konfigurasi basemap SVG
│   ├── FeatureFlagController.js      # CRUD feature flags
│   └── PerumahanController.js        # CRUD perumahan + fasilitas
│
├── models/                           # 📦 Sequelize ORM models
│   ├── index.js                      # Inisialisasi Sequelize + semua associations
│   ├── Alert.js                      # Model: alerts (+ kolom AI)
│   ├── AlertRecipient.js             # Model: alert_recipients
│   ├── Camera.js                     # Model: cameras
│   ├── CameraHealthLog.js            # Model: camera_health_logs
│   ├── FeatureFlag.js                # Model: feature_flags
│   ├── Geofence.js                   # Model: geofences
│   ├── GeofenceBreach.js             # Model: geofence_breaches
│   ├── Incident.js                   # Model: incidents
│   ├── MapPin.js                     # Model: map_pins
│   ├── Perumahan.js                  # Model: perumahan_info + perumahan_facilities
│   ├── QRCode.js                     # Model: qr_codes
│   ├── SecurityActivity.js           # Model: security_activities
│   ├── TeamLocationHistory.js        # Model: team_location_history
│   ├── TeamMember.js                 # Model: team_members
│   └── VisitorRegistration.js        # Model: visitor_registrations
│
├── routes/                           # 🛣️ Route modules tambahan
│   ├── basemap-config-routes.js      # Route: /api/basemap-config
│   ├── feature-flag-routes.js        # Route: /api/feature-flags
│   ├── map-pin-routes.js             # Route: /api/map-pins
│   ├── maps-routes.js                # Route: /api/maps
│   ├── residential-map-routes.js     # Route: /api/residential-map
│   └── visitor.js                    # Route: /api/visitor (OCR + Multer)
│
├── services/                         # ⚙️ Business logic & integrasi eksternal
│   ├── index.js                      # Export semua services
│   ├── ActivityLogger.js             # Logger aktivitas ke database
│   ├── activity-service.js           # Service layer untuk aktivitas
│   ├── HealthMonitorService.js       # Monitoring kesehatan sistem (node-cron)
│   ├── WebSocketService.js           # Socket.io service (rooms, broadcast)
│   ├── websocket-service.js          # WebSocket service (ws, untuk Vigi)
│   └── vigi/                         # 🎥 Integrasi Vigi CCTV system
│       ├── index.js                  # Export Vigi services
│       ├── vigiAuth.js               # Autentikasi ke Vigi
│       ├── vigiEventListener.js      # Event listener dari Vigi
│       ├── vigiSnapshot.js           # Ambil snapshot kamera
│       ├── aiPipeline.js             # Pipeline analisis AI (OpenAI)
│       ├── alertEnricher.js          # Memperkaya alert dengan konteks AI
│       ├── aiPipeline.test.js        # Test unit aiPipeline
│       ├── vigi-unit.test.js         # Test unit Vigi
│       ├── vigi.test.js              # Test integrasi Vigi
│       ├── test-vigi-manual.js       # Script test manual
│       ├── test-aiPipeline-manual.js # Script test AI manual
│       ├── test-populate-alerts.js   # Script populate data test
│       └── test-e2e.js               # Test end-to-end
│
├── middleware/                        # 🔒 Cross-cutting concerns
│   ├── auth.js                       # JWT verification middleware (utama)
│   ├── auth-config.js                # Konfigurasi auth: verifyToken, requireRole
│   ├── dev-auth.js                   # Auth bypass untuk development
│   └── metrics.js                    # Request metrics tracking
│
├── migrations/                        # 🗄️ Database migrations
│   ├── 001_create_cameras_table.sql
│   ├── 002_create_team_members_table.sql
│   ├── 003_create_activities_table.sql
│   ├── 004_create_perumahan_tables.sql
│   ├── 005_create_geofence_tables.sql
│   ├── 006_create_map_pin_table.sql
│   ├── 007_create_basemap_config_table.sql
│   ├── 008_create_feature_flag_table.sql
│   ├── 009_create_incident_tables.sql
│   ├── 010_create_alert_tables.sql
│   ├── 20250127-create-visitor-system.js   # Sequelize migration
│   ├── 20250127-update-visitor-status-enum.js
│   └── 20260428_120000_add_ai_columns_to_alerts.sql
│
├── config/                            # ⚙️ Konfigurasi
│   └── database.js                   # Sequelize connection pool config
│
├── utils/                             # 🛠️ Utility functions
│   ├── geo-utils.js                  # Utilitas koordinat GPS
│   └── validation-utils.js           # Helper validasi input
│
├── scripts/                           # 📜 Script operasional
│   ├── migrate.js                    # Runner migrasi database
│   ├── seed.js                       # Seeder data awal
│   └── generate-token.js             # Generator JWT token untuk testing
│
├── data/                              # 📁 Data statis / file pendukung
├── uploads/                           # 📁 File upload (foto visitor, KTP)
├── docs/                              # 📚 Dokumentasi proyek (folder ini)
│
├── package.json                       # 📋 Manifest npm
├── .env                               # 🔑 Environment variables (TIDAK di-commit)
├── README.md                          # Dokumentasi utama
└── BACKEND_API_REQUIREMENTS.md        # Spesifikasi kebutuhan API (diperbarui)
```

---

## Entry Points

| File | Deskripsi |
|------|-----------|
| `api/server.js` | Entry point utama — jalankan dengan `npm start` |
| `models/index.js` | Inisialisasi semua model Sequelize & associations |
| `api/router.js` | Registrasi semua route API |

---

## Direktori Kritis

| Direktori | Peran | Frekuensi Perubahan |
|-----------|-------|---------------------|
| `controllers/` | Request handler + koordinasi bisnis logic | Tinggi |
| `models/` | Definisi skema database | Sedang |
| `routes/` | Definisi path endpoint | Sedang |
| `services/vigi/` | Integrasi CCTV + AI pipeline | Tinggi |
| `migrations/` | Evolusi skema database | Rendah |
| `middleware/` | Auth & cross-cutting | Rendah |

---

## Titik Integrasi

```
api/server.js
    ├── → MySQL (via config/database.js + Sequelize)
    ├── → Socket.io (WebSocketService ← Frontend clients)
    ├── → Vigi CCTV System (ws WebSocket ← vigiEventListener.js)
    └── → OpenAI API (aiPipeline.js ← alert enrichment)
```
