# Problem Solving Session: Ketiadaan Dokumentasi Testing Camera API untuk Frontend Developer

**Tanggal:** 2026-05-04
**Problem Solver:** Amet
**Kategori Masalah:** Kesenjangan Dokumentasi / Knowledge Gap

---

## 🎯 PENDEFINISIAN MASALAH

### Pernyataan Masalah Awal

Sebagai QA Lead, saya kesulitan dalam mendokumentasikan testing camera — termasuk cara kerja streaming, status listener yang error karena RTO, dan smoke test — sehingga frontend developer tidak bisa mandiri dalam menguji dan menggunakan Camera API.

### Pernyataan Masalah yang Diperhalus

Pada sistem CIFO Security Backend, tidak ada dokumentasi testing Camera API yang memadai, menyebabkan 2 frontend developer tidak dapat memverifikasi fungsionalitas kamera secara mandiri. Masalah ini diperparah oleh adanya dua sistem camera yang berjalan paralel (in-memory dan database-backed) dengan nilai status yang tidak konsisten, mengakibatkan streaming tidak muncul dan status listener error akibat heartbeat timeout (60 detik).

### Konteks Masalah

**Kondisi Teknis yang Ditemukan:**
- **Dua sistem camera paralel:**
  - Sistem 1 (in-memory): `GET /cameras` & `POST /cameras/:id/heartbeat` — data hardcoded di `api/router.js`, 18 kamera CCTV Bandung
  - Sistem 2 (database): `GET /api/cameras` & `POST /api/cameras/:id/heartbeat` — via `CameraController.js` + MySQL
- **Status values tidak konsisten:**
  - Sistem in-memory: `online` / `offline` / `degraded` / `error` (huruf kecil)
  - Sistem database: `ONLINE` / `OFFLINE` / `MAINTENANCE` / `ERROR` (huruf besar)
- **Streaming HLS:** Stream URL berformat `.m3u8`, field `streamUrl` (in-memory) atau `stream_url` (DB), field `stream_accessible` di health log
- **Heartbeat Timeout (RTO):** `HEARTBEAT_TIMEOUT = 60000ms` — kamera dianggap offline jika tidak ada heartbeat dalam 60 detik
- **WebSocket (Socket.IO):** Event `camera_status_update` untuk real-time updates
- **Test file ada:** `api/__tests__/camera.test.js` sudah ada tapi belum terdokumentasi untuk frontend
- **Tidak ada dokumentasi testing** sebelumnya

**Pemangku Kepentingan:**
- QA Lead (Amet) — pembuat dokumentasi
- 2 Frontend Developer — pengguna dokumentasi

### Kriteria Sukses

1. 2 frontend developer dapat menjalankan smoke test camera secara mandiri tanpa bertanya
2. Frontend developer memahami perbedaan endpoint `/cameras` vs `/api/cameras`
3. Ada panduan langkah-demi-langkah untuk memverifikasi streaming camera berfungsi
4. Ada panduan troubleshoot ketika status listener menampilkan error RTO/heartbeat timeout
5. Ada test checklist yang bisa dijalankan berulang setiap rilis

---

## 🔍 DIAGNOSIS DAN ANALISIS AKAR MASALAH

### Batas Masalah (Is/Is Not)

| Dimensi | IS (Terjadi) | IS NOT (Tidak Terjadi) |
|---|---|---|
| **Di mana** | Frontend saat integrasi Camera API | Backend — API berjalan normal |
| **Di mana** | Saat load streaming `.m3u8` | Di `camera.test.js` — test sudah ada |
| **Di mana** | Saat memanggil endpoint status/heartbeat | Untuk developer yang sudah kenal sistem |
| **Kapan** | Saat integrasi pertama kali | Saat heartbeat dikirim < 60 detik |
| **Kapan** | Saat heartbeat timeout 60 detik terlewati | Setelah dokumentasi tersedia |
| **Siapa** | 2 frontend developer | Backend developer, end user |
| **Apa** | Tidak ada panduan endpoint, streaming, RTO | Bug di backend (kode berfungsi) |
| **Apa** | Dua sistem paralel membingungkan (`/cameras` vs `/api/cameras`) | Masalah autentikasi atau performa |

**Pola yang Muncul:**
1. **Dua sistem, satu kebingungan** — `/cameras` (in-memory, 18 kamera hardcoded) dan `/api/cameras` (database-backed) berjalan paralel dengan format status berbeda
2. **Streaming gagal bukan karena bug** — `stream_accessible` tersedia di health log, tapi frontend tidak tahu cara menggunakannya
3. **RTO adalah behavior by design, bukan error** — Heartbeat timeout 60 detik adalah desain yang disengaja; frontend perlu tahu ini agar tidak salah diagnosa

### Analisis Akar Masalah

**Metode:** Five Whys

| Why | Pertanyaan | Jawaban |
|---|---|---|
| Why 1 | Mengapa frontend tidak bisa menguji Camera API? | Tidak ada dokumentasi testing camera |
| Why 2 | Mengapa tidak ada dokumentasi? | Tidak pernah dibuat saat fitur dikembangkan |
| Why 3 | Mengapa tidak dibuat saat pengembangan? | Tidak ada requirement yang mewajibkan dokumentasi sebagai syarat selesai |
| Why 4 | Mengapa tidak ada requirement itu? | Tim prioritaskan delivery fitur, dokumentasi dianggap bisa "nanti" |
| Why 5 | Mengapa selalu ditunda? | Tidak ada template/artefak yang memudahkan — membuat dokumentasi terasa berat |

**Akar Penyebab Utama:** Tidak ada kultur dan proses dokumentasi yang terintegrasi dalam siklus pengembangan, diperparah ketiadaan artefak pendukung (template, Postman collection, Swagger) yang menurunkan biaya pembuatan dokumentasi.

### Faktor-Faktor Penyumbang

**Fishbone Analysis:**

| Kategori | Faktor Penyumbang |
|---|---|
| **Manusia** | QA Lead adalah satu-satunya yang memahami sistem camera secara keseluruhan; Frontend tidak familiar dengan HLS streaming |
| **Proses** | Tidak ada handover backend→frontend; Dokumentasi bukan syarat merge/release; Tidak ada review dokumentasi |
| **Artefak/Kode** | Dua endpoint paralel (`/cameras` vs `/api/cameras`); Status value tidak konsisten (lowercase vs UPPERCASE); `camera.test.js` ada tapi tidak dikomunikasikan |
| **Environment** | Tim kecil dengan pressure delivery tinggi; Tidak ada Swagger/Postman collection |
| **Metode** | Tidak ada template dokumentasi testing; Tidak ada smoke test checklist yang terdefinisi |

### Dinamika Sistem

**Reinforcing Loop (memperburuk masalah):**
> Tidak ada dokumentasi → Frontend bertanya ke QA Lead → QA Lead sibuk jawab pertanyaan berulang → Makin tidak ada waktu buat dokumentasi → Frontend makin bergantung → *(kembali ke awal)*

**Delay Kritis:**
Masalah streaming & RTO sudah ada sejak fitur dikembangkan, baru terasa menyakitkan saat frontend aktif mengintegrasikan — urgensi terasa mendadak.

**Leverage Point:**
Membuat dokumentasi komprehensif sekali akan memutus loop ketergantungan dan membebaskan kapasitas QA Lead secara permanen.

---

## 📊 ANALISIS

### Analisis Force Field

**Gaya Pendorong (Mendukung Solusi):**
1. Frontend developer sedang aktif mengintegrasikan sekarang — urgensi nyata ⭐⭐⭐
2. QA Lead memahami sistem secara keseluruhan — pengetahuan ada ⭐⭐⭐
3. Kode sudah ada dan berfungsi — tidak perlu dokumentasi fitur yang belum jadi ⭐⭐⭐
4. `camera.test.js` sudah ada — bisa jadi referensi contoh request/response ⭐⭐
5. Semua endpoint terdefinisi jelas di `api/router.js` ⭐⭐
6. Hanya 2 frontend developer — scope kecil, feedback cepat ⭐⭐

**Gaya Penghambat (Menghambat Solusi):**
1. Tidak ada template dokumentasi — mulai dari nol terasa berat ⭐⭐⭐
2. Dua sistem camera paralel perlu dijelaskan + diberi disclaimer ⭐⭐
3. Inkonsistensi status value (lowercase vs UPPERCASE) ⭐⭐
4. Teknis HLS streaming butuh penjelasan khusus ⭐⭐
5. Pressure delivery — waktu dokumentasi terbatas ⭐⭐

### Identifikasi Kendala

| Constraint | Nyata / Asumsi | Catatan |
|---|---|---|
| Waktu QA Lead terbatas | **Nyata** | Perlu format efisien — tulis sekali, pakai berulang |
| Dua sistem paralel harus didokumentasikan keduanya | **Nyata** | Harus eksplisit mana yang dipakai frontend saat ini |
| "Harus dokumentasi lengkap sebelum bisa dipakai" | Asumsi | Smoke test minimal sudah cukup untuk mulai |
| "Harus perbaiki inkonsistensi kode dulu" | Asumsi | Dokumentasi bisa menjelaskan inkonsistensi tanpa memperbaikinya |

**Constraint Utama / Bottleneck:**
Waktu QA Lead terbatas + ketiadaan template = menulis dokumentasi terasa panjang. Bukan masalah pengetahuan.

### Wawasan Kunci

1. **Mulai dari smoke test, bukan dokumentasi lengkap** — Frontend butuh "bisa jalan dulu". Smoke test checklist adalah quick win yang langsung mengurangi pertanyaan berulang.
2. **Dokumentasikan inkonsistensi secara eksplisit** — Jadikan fakta dua sistem sebagai bagian dokumentasi: "Gunakan `/cameras` untuk X, `/api/cameras` untuk Y."
3. **Leverage `camera.test.js`** — File ini sudah berisi contoh request/response valid. Jadi tulang punggung dokumentasi tanpa mulai dari nol.
4. **Gaya pendorong lebih kuat dari penghambat** — Urgensi + pengetahuan + kode berfungsi = kondisi ideal. Yang dibutuhkan hanya struktur yang tepat.

---

## 💡 GENERASI SOLUSI

### Metode yang Digunakan

1. **Assumption Busting** — Memecah asumsi tentang bentuk dan scope dokumentasi
2. **Reverse Brainstorming** — Flip masalah: "Bagaimana memastikan frontend TIDAK PERNAH bisa testing?" lalu balik hasilnya
3. **SCAMPER** — Terapkan 7 lensa kreatif pada artefak yang sudah ada (kode, test file)

### Solusi yang Dihasilkan

| # | Ide | Tipe |
|---|---|---|
| 1 | Postman Collection yang bisa langsung diimport & dijalankan | Tool-based |
| 2 | Co-creation: Frontend tanya, QA jawab → otomatis jadi FAQ | Process-based |
| 3 | Dokumentasikan inkonsistensi status value sebagai "Known Behavior" | Documentation |
| 4 | Scope minimal: fokus 3 topik saja (streaming, heartbeat, RTO) | Scoping |
| 5 | Smoke test script self-documenting — jalankan dulu, pahami dari output | Tool-based |
| 6 | Contoh JSON request/response lengkap untuk setiap endpoint | Documentation |
| 7 | "Endpoint Decision Guide" — kapan pakai `/cameras` vs `/api/cameras` | Documentation |
| 8 | curl commands copy-paste ready di setiap endpoint | Documentation |
| 9 | Error message guide — RTO, Camera Not Found, Invalid Status | Documentation |
| 10 | Streaming Troubleshoot Flowchart — "tidak muncul? → cek ini → lakukan ini" | Documentation |
| 11 | Adaptasi `camera.test.js` dengan komentar penjelasan untuk frontend | Code-based |
| 12 | `CAMERA_TESTING.md` — smoke test checklist + troubleshoot dalam satu file | Documentation |
| 13 | Camera API Cheat Sheet — satu halaman, format tabel, semua endpoint | Documentation |
| 14 | Skip teori, langsung "Langkah 1-2-3 untuk testing" tanpa pembukaan panjang | Documentation |
| 15 | "Known Issues & Workarounds" — mulai dari masalah nyata yang sudah dialami | Documentation |

### Alternatif Kreatif

- **Ide Wild:** Tambahkan endpoint debug khusus `GET /cameras/debug` yang mengembalikan status lengkap + penjelasan dalam satu response — dokumentasi hidup yang selalu up-to-date
- **Ide Wild:** Buat test environment seeder — script yang mengisi database dengan camera data valid sehingga frontend bisa testing tanpa setup manual
- **Kombinasi terkuat:** Ide 4 (scope minimal) + Ide 12 (satu file) + Ide 8 (curl ready) + Ide 10 (troubleshoot flowchart) = dokumentasi yang bisa selesai cepat, langsung berguna, dan mudah di-maintain

---

## ⚖️ EVALUASI SOLUSI

### Kriteria Evaluasi

*(Akan diisi di Step 6)*

### Analisis Solusi

*(Akan diisi di Step 6)*

### Solusi yang Direkomendasikan

*(Akan diisi di Step 6)*

### Rasional

*(Akan diisi di Step 6)*

---

## 🚀 RENCANA IMPLEMENTASI

### Pendekatan Implementasi

*(Akan diisi di Step 7)*

### Langkah Aksi

*(Akan diisi di Step 7)*

### Timeline dan Milestone

*(Akan diisi di Step 7)*

### Sumber Daya yang Dibutuhkan

*(Akan diisi di Step 7)*

### Pihak yang Bertanggung Jawab

*(Akan diisi di Step 7)*

---

## 📈 PEMANTAUAN DAN VALIDASI

### Metrik Sukses

*(Akan diisi di Step 8)*

### Rencana Validasi

*(Akan diisi di Step 8)*

### Mitigasi Risiko

*(Akan diisi di Step 8)*

### Pemicu Penyesuaian

*(Akan diisi di Step 8)*

---

## 📝 PELAJARAN YANG DIPETIK

*(Opsional — Step 9)*

---

_Dibuat menggunakan BMAD Creative Intelligence Suite - Problem Solving Workflow_
