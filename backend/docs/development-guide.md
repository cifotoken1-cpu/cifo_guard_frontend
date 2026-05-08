# Panduan Pengembangan — CIFO Security System Backend

> Dihasilkan pada: 2026-04-30

---

## Prasyarat

| Kebutuhan | Versi Minimum | Perintah Verifikasi |
|-----------|--------------|---------------------|
| Node.js | 16.0.0 | `node --version` |
| npm | 8.0.0 | `npm --version` |
| MySQL | 5.7+ / 8.x | `mysql --version` |
| Git | Apa saja | `git --version` |

---

## Setup Lokal

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```sql
-- Buat database di MySQL
CREATE DATABASE cifo_security CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
# Jalankan semua migrasi
npm run migrate
# atau: node scripts/migrate.js
```

Jalankan file SQL secara berurutan jika menggunakan file .sql langsung:
```
migrations/001_create_cameras_table.sql
migrations/002_create_team_members_table.sql
migrations/003_create_activities_table.sql
migrations/004_create_perumahan_tables.sql
migrations/005_create_geofence_tables.sql
migrations/006_create_map_pin_table.sql
migrations/007_create_basemap_config_table.sql
migrations/008_create_feature_flag_table.sql
migrations/009_create_incident_tables.sql
migrations/010_create_alert_tables.sql
```

Lalu jalankan Sequelize migrations:
```bash
node migrations/20250127-create-visitor-system.js
node migrations/20250127-update-visitor-status-enum.js
```

Dan jalankan SQL tambahan:
```
migrations/20260428_120000_add_ai_columns_to_alerts.sql
```

### 3. Konfigurasi Environment

Buat file `.env` di root proyek:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cifo_security
DB_USER=root
DB_PASSWORD=your_password

# Auth
JWT_SECRET=your_jwt_secret_key_here

# CORS (frontend URL, comma-separated untuk multiple)
CORS_ORIGIN=http://localhost:3000

# Vigi CCTV (opsional jika tidak testing integrasi)
VIGI_HOST=
VIGI_USERNAME=
VIGI_PASSWORD=

# OpenAI (opsional jika tidak testing AI pipeline)
OPENAI_API_KEY=
```

### 4. Seed Data (Opsional)

```bash
npm run seed
# atau: node scripts/seed.js
```

### 5. Jalankan Server

```bash
# Production
npm start

# Development (hot reload dengan nodemon)
npm run dev
```

Server berjalan di: `http://localhost:3001`
Health check: `http://localhost:3001/health`

---

## Perintah Umum

| Perintah | Fungsi |
|----------|--------|
| `npm start` | Jalankan server production |
| `npm run dev` | Jalankan dengan hot reload (nodemon) |
| `npm test` | Jalankan semua tests |
| `npm run test:watch` | Test dengan watch mode |
| `npm run test:coverage` | Test dengan laporan coverage |
| `npm run lint` | Periksa kode dengan ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run migrate` | Jalankan migrasi database |
| `npm run seed` | Seed data awal |

---

## Testing

Framework: **Jest** + **Supertest**

```bash
# Jalankan semua test
npm test

# Test dengan coverage report
npm run test:coverage

# Test dengan watch mode (auto re-run saat file berubah)
npm run test:watch
```

### File Test

| File | Scope |
|------|-------|
| `api/__tests__/camera.test.js` | Camera endpoints |
| `api/__tests__/incidents.test.js` | Incident endpoints |
| `api/__tests__/ingestion.test.js` | Alert ingestion |
| `api/__tests__/panic.test.js` | Panic alert flow |
| `services/vigi/aiPipeline.test.js` | AI pipeline unit test |
| `services/vigi/vigi-unit.test.js` | Vigi service unit test |
| `services/vigi/vigi.test.js` | Vigi integration test |

### Generate Token untuk Testing

```bash
node scripts/generate-token.js
```

---

## Menambahkan Fitur Baru

Ikuti pola yang sudah ada:

1. **Buat model** di `models/NamaModel.js` (Sequelize)
2. **Buat migrasi** di `migrations/NNN_create_nama_table.sql`
3. **Buat controller** di `controllers/NamaController.js`
4. **Buat route module** di `routes/nama-routes.js` (atau `api/nama-routes.js`)
5. **Daftarkan route** di `api/router.js`:
   ```js
   const namaRoutes = require('../routes/nama-routes');
   router.use('/nama', namaRoutes);
   ```
6. **Tambahkan ke models/index.js** jika ada associations baru
7. **Update WebSocket events** jika butuh real-time
8. **Tulis test** di `api/__tests__/nama.test.js`

> ⚠️ **Jangan** tambahkan routes dengan prefix `/api/` di dalam router.js — router sudah dimount di `/api`. Gunakan path relatif seperti `/nama`, bukan `/api/nama`.

---

## Logging

Sistem menggunakan **Winston** dengan level berikut:

| Level | Kapan digunakan |
|-------|----------------|
| `error` | Error yang memerlukan perhatian segera |
| `warn` | Warning yang perlu dimonitor |
| `info` | Informasi umum operasi (startup, koneksi) |
| `debug` | Detail untuk debugging (aktif di development) |

Log disimpan di direktori `logs/` dengan rotasi harian.

---

## Deployment Production

1. Set `NODE_ENV=production`
2. Konfigurasi database dengan SSL
3. Setup reverse proxy (nginx) ke port 3001
4. Konfigurasi SSL certificates
5. Set `CORS_ORIGIN` ke domain frontend production
6. Gunakan PM2 untuk process management:
   ```bash
   pm2 start api/server.js --name cifo-backend
   pm2 save
   pm2 startup
   ```
7. Pastikan direktori `logs/` dan `uploads/` writable
8. Monitor via `GET /health`

---

## Troubleshooting

### Database connection error
- Cek `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` di `.env`
- Pastikan MySQL service berjalan
- Pastikan database `cifo_security` sudah dibuat

### JWT error (401 Unauthorized)
- Generate token baru: `node scripts/generate-token.js`
- Cek `JWT_SECRET` sama antara `.env` dan token generator
- Di development, gunakan `dev-auth.js` middleware untuk bypass

### Route tidak ditemukan (404)
- Ingat base URL adalah `/api/...`
- Cek inkonsistensi routing: beberapa routes terdaftar sebagai `/api/api/cameras` (bug yang diketahui)
- Gunakan `GET /health` untuk verifikasi server berjalan

### Socket.io tidak terhubung
- Pastikan `CORS_ORIGIN` mencakup domain frontend
- Cek tidak ada proxy yang memblokir upgrade WebSocket
