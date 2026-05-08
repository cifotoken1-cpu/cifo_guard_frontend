# Indeks Dokumentasi — CIFO Security System Backend

> Dihasilkan pada: 2026-04-30 | Scan level: Quick | Mode: initial_scan | Terakhir diperbarui: 2026-05-05
> Ini adalah entry point utama untuk dokumentasi proyek — mulai dari sini.

---

## Ringkasan Proyek

| Atribut | Nilai |
|---------|-------|
| **Tipe** | Monolith |
| **Bahasa Utama** | JavaScript (Node.js ≥16) |
| **Arsitektur** | MVC Berlapis (Routes → Controllers → Services → Models) |
| **Framework** | Express.js 4.x |
| **Database** | MySQL + Sequelize ORM |

---

## Referensi Cepat

- **Entry point:** `api/server.js`
- **Base URL:** `http://localhost:3001/api`
- **Health check:** `GET http://localhost:3001/health`
- **Tech stack:** Express.js + MySQL + Socket.io + OpenAI + Vigi CCTV
- **Pola arsitektur:** MVC Berlapis
- **Controllers:** Alert, Camera, Team, Activity, Incident, Geofence, MapPin, Perumahan, BasemapConfig, FeatureFlag

---

## Dokumentasi yang Dihasilkan

- [Ringkasan Proyek](./project-overview.md)
- [Arsitektur Sistem](./architecture.md)
- [Struktur Direktori](./source-tree-analysis.md)
- [API Contracts](./api-contracts-backend.md)
- [Data Models & Skema DB](./data-models-backend.md)
- [Panduan Pengembangan](./development-guide.md)

---

## Dokumentasi yang Ada (Pre-existing)

- [README.md](../README.md) — Dokumentasi utama (instalasi, API overview, environment vars)
- [BACKEND_API_REQUIREMENTS.md](../BACKEND_API_REQUIREMENTS.md) — Status implementasi API (diperbarui 2026-04-30)

---

## Memulai (Getting Started)

```bash
# 1. Install dependencies
npm install

# 2. Buat database MySQL
mysql -u root -e "CREATE DATABASE cifo_security CHARACTER SET utf8mb4;"

# 3. Jalankan migrasi
npm run migrate

# 4. Buat file .env (lihat development-guide.md untuk isi lengkap)
cp .env.example .env  # atau buat manual

# 5. Jalankan server development
npm run dev
```

Server berjalan di: `http://localhost:3001`

---

## Untuk Pengembangan Fitur Baru (Brownfield PRD)

Saat merencanakan fitur baru, gunakan dokumen berikut sebagai referensi:

1. **[Arsitektur](./architecture.md)** — Pahami pola yang ada sebelum menambahkan
2. **[API Contracts](./api-contracts-backend.md)** — Cek endpoint yang sudah ada
3. **[Data Models](./data-models-backend.md)** — Cek tabel yang sudah ada
4. **[Source Tree](./source-tree-analysis.md)** — Pahami di mana menempatkan kode baru

### Deep-Dive Documentation

Analisis exhaustive untuk area spesifik:

- [Respons Insiden & Alert Panic Deep-Dive](./deep-dive-insiden-dan-alert-panic.md) — Analisis komprehensif fitur pencatatan insiden, panic button, dan AI pipeline VIGI (13 file, ~3600 LOC) — Dibuat 2026-05-05

---

## Isu Prioritas yang Perlu Ditangani

| Prioritas | Isu | File |
|-----------|-----|------|
| 🔴 Tinggi | Bug routing double `/api/api/cameras` | `api/router.js` |
| 🟡 Sedang | Mock data hardcoded (kamera, tim) | `api/router.js` |
| 🟡 Sedang | Alert activities masih return mock data | `api/router.js` |
| 🟢 Rendah | Emergency contacts API belum ada | — |
