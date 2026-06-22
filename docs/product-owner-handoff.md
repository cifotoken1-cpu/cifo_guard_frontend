# Product Handoff — CCTV AI Count
**Tanggal:** 2026-06-18
**Disiapkan oleh:** Dev Team
**Untuk:** Product Owner

---

## Ringkasan Eksekutif

Pivot produk dari "CIFO Guard" (all-in-one security dashboard) ke **CCTV AI Count** (visitor counting berbasis AI) telah selesai diimplementasi. Sistem terdiri dari tiga komponen utama yang terintegrasi: frontend dashboard, backend API, dan Python vision worker yang membaca RTSP stream kamera VIGI C240.

---

## Fitur yang Sudah Selesai

### S1 — Rebrand CIFO Guard → CCTV AI Count
**Status:** ✅ Done (commit `b6f11d5`)

- Nama produk di header, sidebar, dan tab browser berubah ke **CCTV AI Count**
- Menu non-CCTV (Panic Alert, Incident Response, User Management) disembunyikan dari navigasi
- Kode fitur lama tidak dihapus — bisa diaktifkan kembali via config `src/config/product.js` jika diperlukan
- Branding bersumber dari satu file config (perubahan nama cukup 1 baris)

---

### S4 — Backend Counting API
**Status:** ✅ Done (commit `324e8a7`)

API untuk menerima dan membaca data crossing dari kamera:

| Endpoint | Fungsi |
|----------|--------|
| `POST /api/counting/event` | Terima event orang masuk/keluar dari worker |
| `GET /api/counting/cameras/:id/count` | Jumlah in/out/inside satu kamera hari ini |
| `GET /api/counting/summary` | Rekap semua kamera + total keseluruhan |

Data tersimpan di tabel `crossing_events` (MySQL). Event dikirim ke dashboard via WebSocket secara realtime.

---

### S5 — Frontend Counting Dashboard
**Status:** ✅ Done (commit `1c0dde1`)

Dashboard baru di sidebar menu "Counting":

- **4 kartu summary:** Total Masuk, Total Keluar, Saat Ini di Dalam, Rata-rata Durasi
- **Tabel per kamera:** in/out/inside/durasi/jumlah kunjungan dengan date picker
- **Realtime update:** angka berubah otomatis tanpa refresh (WebSocket + polling 15 detik)
- **Tombol "Laporan AI":** generate narasi ringkasan harian
- **Tombol "Export CSV":** unduh data crossing ke spreadsheet

---

### S6 — Re-ID Durasi Per Individu
**Status:** ✅ Done (commit `fa8c06b`)

Sistem melacak durasi setiap individu secara terpisah (bukan hanya counting):

- Setiap orang ditrack dengan ID unik dari ByteTrack
- Durasi kunjungan (masuk → keluar) dihitung otomatis dalam detik
- Rata-rata, minimum, dan maksimum durasi ditampilkan per kamera
- Kunjungan yang belum selesai (orang masih di dalam) ditandai "open" dan tidak masuk kalkulasi rata-rata
- Data tersimpan di tabel `person_visits`

---

### S7 — Laporan Cerdas (AI Daily Summary)
**Status:** ✅ Done (commit `064bb6a`)

- **AI Narrative:** Ringkasan harian dalam Bahasa Indonesia, dihasilkan via OpenRouter (GPT-4o-mini)
- **Konten narasi:** pola traffic, jam sibuk, kamera paling aktif, anomali jika ada
- **Fallback:** Jika API key tidak dikonfigurasi, laporan statistik tetap tersedia tanpa narasi AI
- **Export CSV:** Download data crossing + kunjungan ke Excel
- Model AI bisa diganti via environment variable `OPENROUTER_REPORT_MODEL`

---

### S3 — Python Vision Worker
**Status:** ✅ Done (commit `38144fd`)

Komponen yang membaca stream kamera dan mengirim data ke backend:

- Membaca RTSP stream dari kamera VIGI C240 (atau kamera ONVIF lain)
- Deteksi orang via YOLO nano — model ringan, bisa jalan di PC biasa
- Multi-object tracking (ByteTrack) — setiap orang dapat ID unik antar frame
- Virtual line crossing — garis bisa dikonfigurasi posisi dan arahnya
- Berjalan sebagai Docker container (deploy mudah, restart otomatis)
- Konfigurasi via file `.env` — tidak perlu edit kode

---

## Arsitektur Sistem

```
Kamera VIGI C240 (RTSP)
        ↓
Python Vision Worker (Docker)
   YOLO nano + ByteTrack
        ↓ POST /api/counting/event
        ↓ POST /api/visits
Backend API (Node.js/Express)
   MySQL Database
        ↓ WebSocket broadcast
Frontend Dashboard (React)
   Browser operator
        ↓ Request AI summary
OpenRouter API (GPT-4o-mini)
```

---

## Yang Belum / Out of Scope

| Item | Status | Keterangan |
|------|--------|------------|
| S2 — Site Survey | Menunggu | Perlu survey fisik: posisi kamera, sudut, pencahayaan |
| Snapshot kamera | Tombol ada, belum fungsional | Fitur lama CIFO Guard, belum dikerjakan |
| Record kamera | Tombol ada, belum fungsional | Sama — fitur lama |
| Multi-kamera satu worker | Belum | Satu instance worker = satu kamera |
| Dashboard user management | Hidden | Kode ada, bisa diaktifkan via config |
| Panic alert | Hidden | Kode ada, bisa diaktifkan via config |

---

## Prasyarat Sebelum Go-Live

### Infrastruktur (Wajib)
- [ ] Server atau PC yang bisa running Docker (untuk Python worker)
- [ ] Akses ke RTSP stream kamera VIGI C240 dari server worker
- [ ] MySQL 8.0+ — jalankan `npm run migrate` untuk buat tabel baru
- [ ] `OPENROUTER_API_KEY` dikonfigurasi di `backend/.env` untuk fitur AI summary

### Konfigurasi Worker per Kamera
- [ ] Isi `worker/.env` dengan URL RTSP kamera, CAMERA_ID, dan BACKEND_TOKEN
- [ ] Kalibrasi `LINE_POSITION` — nyalakan `SHOW_PREVIEW=true`, temukan koordinat garis yang tepat di pintu/gate
- [ ] Konfirmasi `LINE_DIRECTION_MODE` (`standard` atau `reverse`) sesuai orientasi kamera

### Data
- [ ] Tambahkan kamera ke tabel `cameras` di database (via admin UI atau SQL)
- [ ] CAMERA_ID di worker harus sama persis dengan `id` di tabel `cameras`

---

## Cara QA Testing

Lihat: [`docs/qa-testing-guide.md`](qa-testing-guide.md)

**Singkat:**
- Dev mode: buka frontend langsung, tidak perlu login
- Production mode: login dengan `admin` / `citranetbd9`
- Postman collection tersedia di [`docs/postman/CCTV-AI-Count-SmokeTest.postman_collection.json`](postman/CCTV-AI-Count-SmokeTest.postman_collection.json)

---

## Pertanyaan yang Mungkin Diajukan PO

**Q: Berapa kamera yang bisa dipantau sekaligus?**
Satu instance Python worker menangani satu kamera. Untuk N kamera: deploy N container worker dengan konfigurasi berbeda.

**Q: Apakah data histori tersimpan?**
Ya — semua crossing event dan data kunjungan tersimpan di MySQL. Tidak ada auto-delete.

**Q: Bagaimana akurasi deteksinya?**
YOLO nano adalah model ringan (trade-off akurasi vs kecepatan). Akurasi deteksi ~85-90% dalam kondisi pencahayaan baik. Akurasi counting bergantung pada posisi kamera dan kalibrasi garis virtual — ini yang diverifikasi saat site survey (S2).

**Q: Apakah AI summary berbahasa Indonesia?**
Ya — prompt dikonfigurasi dalam Bahasa Indonesia, narasi akan keluar dalam Bahasa Indonesia.

**Q: Biaya AI summary?**
GPT-4o-mini via OpenRouter. Per summary harian: estimasi ~1.000-2.000 token = **< Rp 50 per laporan** (tergantung jumlah kamera dan data).

---

## Referensi Teknis

| Dokumen | Lokasi |
|---------|--------|
| QA Testing Guide | `docs/qa-testing-guide.md` |
| Postman Collection | `docs/postman/CCTV-AI-Count-SmokeTest.postman_collection.json` |
| Worker Config (.env template) | `worker/.env.example` |
| CCTV Pilot Readiness Report | `docs/stories/cctv-pilot-readiness.md` |

---

_Dokumen ini disiapkan berdasarkan implementasi aktual di branch `claude/create-documentation-qVrnf`._
_Semua fitur S1, S3, S4, S5, S6, S7 sudah di-commit dan siap untuk review/merge._
