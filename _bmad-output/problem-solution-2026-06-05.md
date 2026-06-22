# Problem Solving Session: Alat Advokasi Berbasis Data — Relokasi Fiber Optik Bandung

**Date:** 2026-06-05
**Problem Solver:** LENOVO
**Problem Category:** Infrastruktur Telekomunikasi / Advokasi & Negosiasi Kebijakan

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

Pemkot Bandung mewajibkan ISP-ISP untuk merelokasi kabel fiber optik dari udara ke bawah tanah. Proses ini dilakukan dengan memotong kabel di beberapa ruas jalan setiap hari, menyebabkan gangguan internet ke pelanggan termasuk rumah sakit dan sekolah. ISP harus menarik kabel baru dengan biaya sendiri, sementara kontraktor pihak ketiga yang menangani relokasi sering terlambat datang. Saat ini tidak ada mekanisme sistematis untuk merekam dan memvisualisasikan dampak dari pemotongan ini.

### Refined Problem Statement

ISP-ISP di Bandung tidak memiliki alat advokasi berbasis data yang terkonsolidasi untuk menegosiasikan jadwal dan mekanisme relokasi fiber optik yang tidak mengganggu layanan kritis (RS, sekolah, pemerintahan). Data dampak tersebar, tidak terstandar, dan tidak tersaji dalam format yang persuasif bagi pengambil kebijakan, media, dan regulator.

### Problem Context

- **Regulasi:** Pemkot Bandung mewajibkan relokasi kabel udara ke bawah tanah — relokasi mungkin memang harus terjadi, masalahnya di *cara* dan *timing*
- **Eksekusi:** Pemotongan kabel dilakukan harian di beberapa ruas jalan tanpa koordinasi yang memadai dengan ISP
- **Dampak layanan:** Gangguan internet ke pelanggan residensial, rumah sakit, sekolah
- **Biaya:** ISP menanggung biaya penarikan kabel baru untuk relokasi
- **Keterlambatan:** Kontraktor pihak ketiga relokasi sering terlambat — penyebab bisa kapasitas, proses izin galian, atau ketersediaan material (bukan hanya "telat")
- **Multi-ISP:** Beberapa ISP terdampak, masing-masing punya data sendiri di spreadsheet — sensitivitas data bisnis bisa jadi hambatan berbagi
- **Posisi legal:** Perlu diperjelas dasar hukum Pemkot dan posisi legal ISP terkait kabel udara
- **Tidak ada visibilitas:** Belum ada alat advokasi terpadu untuk menunjukkan skala dampak ke pengambil kebijakan, media, dan regulator
- **Koordinasi antar-dinas:** Dampak menyebar ke domain Dinas Pendidikan, Dinas Kesehatan, dll. — tapi tanggung jawab ada di Kominfo/PUPR, menciptakan ping-pong birokrasi
- **Jalur regulasi formal:** Belum jelas apakah ISP sudah melapor secara resmi ke Kominfo Pusat/BRTI sebagai jalur eskalasi

### Kebutuhan Per-Stakeholder

| Stakeholder | Kebutuhan | Implikasi untuk Platform |
|---|---|---|
| Pemkot | Bukti bahwa ISP beritikad baik, bukan sekadar protes | Platform harus menunjukkan rekam jejak compliance ISP |
| RS | Dokumentasi dampak gangguan layanan kesehatan | Data insiden gangguan SIMRS, rujukan BPJS |
| Sekolah | Dokumentasi dampak gangguan e-learning/ujian | Data insiden gangguan per-sekolah |
| Pelanggan | Timeline pemulihan & kompensasi | Transparansi status pemulihan per-area |
| Kontraktor | Rekam *penyebab* keterlambatan (izin, material, kapasitas) | Data keterlambatan harus granular, bukan hanya "telat" |
| Media | Angka headline yang quotable (total pelanggan, Rp kerugian) | Statistik agregat yang mudah dikutip |
| Regulator | Data formal dampak gangguan telekomunikasi | Statistik untuk mendukung pelaporan resmi |

### Asumsi yang Perlu Divalidasi

1. ISP kompetitor bersedia berbagi data operasional di platform bersama
2. Transparansi data akan mengubah perilaku/kebijakan Pemkot
3. Posisi legal ISP cukup kuat untuk bernegosiasi
4. Dashboard/platform cukup sebagai solusi — mungkin perlu jadi bagian strategi advokasi lebih besar
5. Pemkot belum memiliki data tandingan tentang ketidakpatuhan ISP

### Success Criteria

1. Platform advokasi berbasis data yang menyajikan dampak pemotongan secara terkonsolidasi
2. Multi-ISP bisa berkontribusi data dengan mekanisme yang melindungi sensitivitas bisnis
3. Data dari spreadsheet bisa diimpor/disinkronkan ke platform
4. Visualisasi persuasif (peta lokasi, timeline, statistik dampak) yang ditargetkan untuk pengambil kebijakan, media, dan regulator
5. Mendukung negosiasi jadwal dan mekanisme relokasi yang tidak mengganggu layanan kritis
6. **Angka quotable** — total pelanggan terdampak, total downtime, estimasi kerugian Rp untuk media
7. **Rekam jejak itikad baik ISP** — bukti compliance sebagai posisi negosiasi

---
