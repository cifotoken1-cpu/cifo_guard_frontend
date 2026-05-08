# Ringkasan Proyek — CIFO Security System Backend

> Dihasilkan pada: 2026-04-30

---

## Identitas Proyek

| Atribut | Nilai |
|---------|-------|
| **Nama** | CIFO Security System Backend |
| **Versi** | 1.0.0 |
| **Deskripsi** | Backend API untuk sistem keamanan CIFO yang mengelola kamera CCTV, tim keamanan, insiden, alert, dan aktivitas keamanan |
| **Tipe Repository** | Monolith |
| **Bahasa Utama** | JavaScript (Node.js ≥16) |
| **Pola Arsitektur** | MVC Berlapis (Routes → Controllers → Services → Models) |
| **Database** | MySQL |
| **License** | MIT |

---

## Tujuan Sistem

CIFO Security System adalah platform **Security Control Center** yang menyediakan:

- **Monitoring CCTV Real-time** — Integrasi dengan sistem Vigi untuk mengakses feed kamera langsung
- **Manajemen Tim Keamanan** — Tracking lokasi real-time, manajemen shift, status tugas
- **Respons Insiden** — Pencatatan, tracking, dan penyelesaian insiden keamanan
- **Alert Panic** — Sistem panic button dengan analisis AI dan broadcast real-time
- **Peta Interaktif** — Basemap SVG dengan geofencing, pin lokasi, dan peta perumahan
- **Registrasi Visitor** — OCR KTP menggunakan Tesseract.js untuk proses check-in

---

## Tech Stack Ringkas

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js ≥16 |
| Framework | Express.js 4.x |
| Database | MySQL + Sequelize ORM |
| Real-time | Socket.io + WebSockets |
| Auth | JWT + bcryptjs |
| AI/OCR | OpenAI + Tesseract.js |
| Eksternal | Vigi CCTV System |
| Logging | Winston + daily-rotate |
| Testing | Jest + Supertest |

---

## Komponen Utama

### API Layer
- **10 Controller** — Alert, Camera, Team, Activity, Incident, Geofence, MapPin, Perumahan, BasemapConfig, FeatureFlag
- **17 Model Sequelize** — Mewakili semua entitas domain
- **13 Migrasi** — Evolusi skema dari awal hingga penambahan kolom AI (2026-04-28)

### Integrasi Eksternal
- **Vigi CCTV** — Koneksi WebSocket ke sistem kamera eksternal, event listener, snapshot
- **OpenAI** — Pipeline AI untuk analisis dan pengayaan alert otomatis
- **Tesseract.js** — OCR untuk membaca data KTP saat registrasi pengunjung

### Real-time
- **Socket.io** — Komunikasi duplex ke frontend (alert, status tim, kamera)
- **node-cron** — Health monitoring otomatis setiap 2 menit

---

## Port & Endpoint Utama

| Layanan | Port Default | Konfigurasi |
|---------|-------------|-------------|
| HTTP API | 3001 | `PORT` env var |
| WebSocket | Sama (via Socket.io) | Melekat pada HTTP server |
| Database | 3306 | `DB_PORT` env var |

**Base URL:** `http://localhost:3001/api`

**Health Check:** `GET http://localhost:3001/health`

---

## Status Implementasi

Semua komponen utama **sudah diimplementasikan** per 2026-04-30:

| Fitur | Status |
|-------|--------|
| Camera Management | ✅ Lengkap |
| Team Management | ✅ Lengkap |
| Alert/Panic System | ✅ Lengkap + AI enrichment |
| Incident Management | ✅ Lengkap |
| Geofence | ✅ Lengkap |
| Map Pins & Basemap | ✅ Lengkap |
| Visitor Registration (OCR) | ✅ Lengkap |
| Feature Flags | ✅ Lengkap |
| WebSocket Real-time | ✅ Lengkap |
| Vigi Integration | ✅ Lengkap |
| AI Pipeline | ✅ Lengkap |
| Health Monitoring | ✅ Lengkap |

---

## Dokumentasi Terkait

- [Arsitektur](./architecture.md) — Desain sistem dan keputusan teknis
- [API Contracts](./api-contracts-backend.md) — Semua endpoint & format request/response
- [Data Models](./data-models-backend.md) — Skema database lengkap
- [Source Tree](./source-tree-analysis.md) — Struktur direktori dengan anotasi
- [Development Guide](./development-guide.md) — Setup lokal dan panduan pengembangan
- [Index](./index.md) — Indeks lengkap dokumentasi
