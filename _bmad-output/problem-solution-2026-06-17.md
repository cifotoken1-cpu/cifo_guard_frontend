# Problem Solving Session: Refactor CIFO Guard → Produk CCTV AI Count Terpisah

**Date:** 2026-06-17
**Problem Solver:** LENOVO
**Problem Category:** Product Refactoring / Pivot

---

## PROBLEM DEFINITION

### Initial Problem Statement

Business Owner memberikan masukan: aplikasi CIFO Guard sudah terlalu banyak feature (Panic, Incident, Map, Visitor, Team, CCTV, dll). BO ingin fokus ke satu produk khusus CCTV yang bisa menghitung orang masuk ke area tertentu dan track durasi orang di dalam — per kamera.

### Refined Problem Statement

Aplikasi CIFO Guard saat ini adalah dashboard keamanan perumahan all-in-one dengan 7+ feature. BO memutuskan pivot: memisahkan komponen CCTV menjadi produk standalone bernama **CCTV AI Count** yang fokus pada:

1. **People counting** — hitung orang masuk/keluar area via feed kamera
2. **Duration tracking** — berapa lama orang berada di dalam area (per kamera)
3. **Existing CCTV monitoring** — gallery, HLS streaming, status, CRUD tetap dipertahankan

Feature non-CCTV (Panic Alert, Incident Management, Interactive Map, Visitor Management, Team Management) akan **di-disable** (bukan dihapus) untuk mengurangi kompleksitas dan fokus delivery.

Produk ini terpisah dari CIFO Guard — termasuk branding dan judul baru.

### Problem Context

- **Codebase saat ini:** React 18 + Vite, modular per-feature di `src/features/`
- **Repo baru:** GitLab `mincreng1/cctv-ai-count` (sudah dibuat)
- **Existing CCTV infra:** CamerasModal, CameraCard, CameraForm, HLS playback, heartbeat polling, WebSocket — semua sudah functional ~90%
- **Yang BELUM ada:** AI counting, duration tracking, branding baru
- **Target user:** Petugas (operator) yang memantau kamera
- **Backend:** Express + Sequelize + MySQL, camera endpoints sudah ada

### Success Criteria

1. Feature non-CCTV ter-disable — tidak muncul di UI, tidak ada route, tapi code tetap ada
2. Branding baru — judul, logo placeholder, warna tema bisa berbeda dari CIFO Guard
3. CCTV existing tetap berjalan — gallery, streaming, CRUD, status monitoring
4. Fitur baru **People Count**: menampilkan jumlah orang yang terdeteksi masuk per kamera
5. Fitur baru **Duration Tracking**: menampilkan durasi rata-rata orang di dalam area per kamera
6. Deployable sebagai produk terpisah ke GitLab repo `cctv-ai-count`

---

## DIAGNOSIS AND ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

| Dimensi | IS (masalah ada) | IS NOT (bukan masalah) |
|---|---|---|
| **Apa** | Terlalu banyak feature, produk tidak fokus | Bukan masalah kualitas code — fitur sudah jalan |
| **Apa** | Belum ada AI counting & duration tracking | Bukan masalah CCTV streaming — HLS sudah work |
| **Apa** | Branding masih CIFO Guard, bukan CCTV AI Count | Bukan masalah UI framework — React + Vite tetap dipakai |
| **Siapa** | BO minta pivot, petugas butuh tool fokus | Bukan user complaint — produk belum live |
| **Di mana** | Frontend UI — terlalu banyak menu & route | Backend — sudah modular, Vigi AI pipeline sudah ada |
| **Di mana** | Frontend — tidak ada UI people count & duration | Backend — `aiPipeline.js` sudah return `person_count` |
| **Kapan** | Sekarang — sebelum pilot | Bukan post-launch issue |

### Pola yang Muncul

1. **Backend sudah siap** — Vigi AI pipeline (`aiPipeline.js`) sudah return `person_count`, `tags` (termasuk "entering"/"exiting"), dan snapshot per event. Tinggal disambung ke frontend.
2. **Frontend butuh refactor** — disable 5+ feature, buat UI baru untuk counting dashboard, rebrand.
3. **Duration tracking = fitur derived** — kalau AI sudah detect "masuk" dan "keluar", duration = selisih timestamp. Backend perlu simpan log entry/exit per kamera, frontend tinggal tampilkan.
4. **Codebase modular** — feature-per-folder (`src/features/`) membuat disable mudah: hapus route, sembunyikan nav item.

### Root Cause Analysis (Five Whys)

| # | Why | Answer |
|---|---|---|
| 1 | Kenapa produk perlu pivot? | Terlalu banyak feature, tidak fokus, sulit di-pilot |
| 2 | Kenapa terlalu banyak feature? | CIFO Guard dibangun sebagai all-in-one dashboard keamanan — semua masuk |
| 3 | Kenapa all-in-one jadi masalah? | Tidak ada satupun feature yang 100% selesai dan bisa dijual |
| 4 | Kenapa ~80% tidak cukup? | Untuk pilot, butuh 1 feature end-to-end solid (capture → process → display → value) |
| 5 | Kenapa CCTV AI Count dipilih? | Backend AI sudah ada, hardware kamera di lapangan, use case "hitung orang" punya value bisnis paling jelas & terukur |

**Root Cause:** Produk mencoba jadi segalanya sekaligus → tidak ada feature end-to-end ready. CCTV AI Count dipilih karena fondasi teknis paling matang + value bisnis paling tangible.

### Contributing Factors

| Factor | Dampak |
|---|---|
| AI pipeline sudah ada tapi belum tersambung ke UI | Backend detect orang, frontend tidak menampilkan |
| Tidak ada data model entry/exit | `person_count` per snapshot ada, tapi tidak ada log durasi |
| Branding terikat CIFO Guard | Susah pitch ke customer baru |
| Feature saling tergantung di routing/nav | Disable 1 feature perlu edit banyak tempat |

### System Dynamics

```
LOOP SAAT INI (vicious):
  Banyak Feature → Semua ~80% → Tidak bisa pilot → Tambah feature lagi

LOOP TARGET (virtuous):
  1 Feature fokus → 100% solid → Pilot berhasil → Iterate dari feedback user
```

Pivot ini memutus loop "banyak tapi setengah jadi" dan masuk ke loop "sedikit tapi tuntas."

---

## ANALYSIS

### Force Field Analysis

**Driving Forces (Mendorong Solusi):**

| Force | Kekuatan |
|---|---|
| Keputusan BO sudah final — pivot ke CCTV AI Count | ●●● Sangat kuat |
| Backend Vigi AI pipeline sudah ada (person_count, snapshot, tags) | ●●● Sangat kuat |
| Hardware kamera sudah di lapangan | ●●● Sangat kuat |
| Codebase frontend modular — feature-per-folder mudah disable | ●● Kuat |
| HLS streaming + gallery + CRUD sudah ~90% done | ●● Kuat |
| Use case "hitung orang" punya value bisnis jelas | ●● Kuat |
| Repo GitLab sudah dibuat | ● Moderate |

**Restraining Forces (Menghambat Solusi):**

| Force | Kekuatan |
|---|---|
| Duration tracking belum ada data model — perlu backend + frontend baru | ●● Kuat |
| Frontend counting dashboard belum ada sama sekali | ●● Kuat |
| Tim kecil — bandwidth dev terbatas | ●● Kuat |
| Auth middleware camera belum ada — security risk | ● Moderate |
| Branding hardcoded di banyak tempat | ● Moderate |
| Koordinat kamera seed tidak match lokasi real | ● Moderate |
| Disable feature tanpa break routing/nav perlu hati-hati | ● Moderate |

### Constraint Identification

| Constraint | Real vs Assumed | Bisa Dipengaruhi? |
|---|---|---|
| AI counting bergantung pada OpenRouter API (GPT-4o-mini) | Real | Ya — bisa switch model |
| Duration tracking butuh DB table baru + endpoint baru | Real | Ya — dev effort |
| Kamera harus support event detection (Vigi spesifik) | Real | Terbatas — hardware |
| Satu developer — bandwidth terbatas | Real | Ya — prioritas & phasing |
| Branding harus berubah sebelum demo ke customer | Real | Ya — quick win |

### Key Insights

1. **Driving forces lebih kuat dari restraining** — fondasi teknis solid, gap ada di "last mile" sambungkan AI ke UI.
2. **Bottleneck utama = dev bandwidth** — perlu prioritas ketat: disable dulu → branding → counting UI → duration (terakhir).
3. **Duration tracking constraint terberat** — satu-satunya yang butuh backend table baru + logic entry/exit + frontend baru. Bisa di-phase ke v1.1.
4. **Person count bisa pilot tanpa duration** — tampilkan jumlah orang terdeteksi per kamera real-time. Duration menyusul setelah pilot pertama.

---

## SOLUTION OPTIONS

### Methods Used

1. **Morphological Analysis** — pecah solusi jadi parameter independen, explore kombinasi
2. **SCAMPER** — Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse

### Koreksi Model dari BO

> **Bukan crowd counting** (berapa orang di frame pada satu waktu).
> **Visitor counting** — hitung pengunjung gedung menggunakan kamera di pintu.
> Orang masuk = +1, orang keluar = -1. Ketika semua keluar = 0.
> **Duration tracking = core v1.0** — catat waktu masuk, waktu keluar, hitung durasi.
> Setiap kamera = satu pintu/gerbang. Setiap "visit" = 1 record.

#### Contoh Skenario Visitor Counting

```
Waktu   Event              currently_inside
─────   ─────              ────────────────
08:00   Orang A masuk      1
08:05   Orang B masuk      2
08:10   Orang C masuk      3
08:30   Orang A keluar     2    ← durasi A = 30 menit
09:00   Orang B keluar     1    ← durasi B = 55 menit
09:15   Orang C keluar     0    ← durasi C = 65 menit, gedung kosong
09:20   Orang D masuk      1
09:25   Orang E masuk      2
10:00   Orang D keluar     1    ← durasi D = 40 menit
10:30   Orang E keluar     0    ← gedung kosong lagi
```

**Formula:** `currently_inside = total_masuk - total_keluar`
- Idealnya ≥0, tapi **drift AKAN terjadi** (miss-detect, double-count) — counter bisa negatif atau over-count
- Semua orang keluar = 0
- **Drift management:** daily reset saat gedung tutup (harus ada momen "pasti 0"), drift alarm kalau |currently_inside| terlalu jauh dari expected, manual correction endpoint

#### Contoh Tampilan Dashboard

```
┌─────────────────┬──────────┬───────────────────────────┬───────────┐
│ Pintu/Kamera    │ Inside   │ Today                     │ Avg Durasi│
├─────────────────┼──────────┼───────────────────────────┼───────────┤
│ Gerbang Utama   │ 3 orang  │ 47 masuk, 44 keluar       │ 23 menit  │
│ Pintu Belakang  │ 0 orang  │ 12 masuk, 12 keluar       │ 8 menit   │
│ Pintu Samping   │ 1 orang  │ 5 masuk, 4 keluar         │ 15 menit  │
└─────────────────┴──────────┴───────────────────────────┴───────────┘
```

#### Apa yang BUKAN scope ini

- ❌ Crowd counting (berapa orang di frame)
- ❌ Face recognition (identitas personal)
- ❌ Security surveillance
- ❌ Multi-kamera Re-ID (1 orang masuk pintu A, keluar pintu B)

#### Apa yang ADALAH scope ini

- ✅ Visitor counting di pintu gedung via kamera
- ✅ Occupancy tracking real-time (berapa orang di dalam sekarang)
- ✅ Duration analytics (berapa lama visitor di dalam)
- ✅ Daily summary (total masuk/keluar per hari per pintu)

### Implikasi Teknis

- AI harus detect **arah gerakan** (masuk vs keluar) via tracking antar-frame + virtual line, bukan snapshot
- Data model: `crossing_events` table dengan `direction (in/out), timestamp, track_id`
- Data model Fase 2: `person_visits` table dengan `enter_time, exit_time, duration_seconds, photos, match_score, match_method`
- Real-time counter: `currently_inside = SUM(entered) - SUM(exited)` per kamera
- **Drift AKAN terjadi** — perlu: daily reset (momen "pasti 0"), drift alarm, manual correction endpoint
- **Site survey WAJIB sebelum coding** — sudut kamera, cahaya, lebar pintu, peak traffic menentukan fps & hardware
- **Python CV skillset terpisah** dari Node.js dev — 2 orang atau 1 orang belajar skill baru
- Re-ID Fase 2 butuh **hybrid approach** (embedding + temporal + height + color), bukan pure embedding
- Hardware sizing tergantung **peak traffic** per pintu, bukan generic spec

### Morphological Analysis (Revised)

| Parameter | Opsi A | Opsi B | Opsi C |
|---|---|---|---|
| **1. Disable strategy** | Feature flag (env var) | Hapus route + nav item | Conditional import (lazy) |
| **2. Entry/Exit detection** | AI direction inference (frame diff) | Dual-camera (in/out) | Tripwire line crossing |
| **3. Visit data model** | `camera_visits` table (enter/exit/duration) | Event log + aggregate query | In-memory counter (no history) |
| **4. Counting UI** | Dashboard tabel per kamera + live count | Overlay badge di CameraCard | Dedicated `/counting` page |
| **5. Duration display** | Per-visit list (masuk 09:01, keluar 09:14, 13m) | Rata-rata durasi per kamera | Live timer (orang masih di dalam) |
| **6. Branding** | Config file (title, color, logo) | Separate theme CSS | Fork codebase entirely |

### SCAMPER Applied (Revised)

| Lens | Ide |
|---|---|
| **Substitute** | Ganti `person_count` snapshot → entry/exit event stream |
| **Combine** | Gabung CameraCard + live gate counter → "3 inside, avg 12m" |
| **Adapt** | Adapt motion alert logic → detect crossing threshold line |
| **Modify** | Modify AI prompt → "detect direction: entering or exiting" |
| **Put to other use** | Pakai heartbeat polling → juga poll visit count per kamera |
| **Eliminate** | Eliminate crowd heatmap — tidak relevan untuk gate counting |
| **Reverse** | Bukan "track semua orang" tapi "track setiap crossing event" |

### Generated Solutions (15 opsi, revised)

| # | Solusi | Tipe | Effort |
|---|---|---|---|
| 1 | Feature flag `VITE_PRODUCT=cctv-ai-count` — conditional render nav/route | Incremental | Rendah |
| 2 | Hapus route non-CCTV di router + sidebar | Incremental | Rendah |
| 3 | `src/config/product.js` — branding (title, color, logo) dari 1 file | Incremental | Rendah |
| 4 | **Backend `camera_visits` table** — `id, camera_id, enter_time, exit_time, duration_seconds` | Core | Medium |
| 5 | **AI prompt update** — detect "person entering" vs "person exiting" dari frame analysis | Core | Medium |
| 6 | **Backend endpoint `GET /api/cameras/:id/visits`** — list visits + currently_inside count | Core | Medium |
| 7 | **Backend endpoint `POST /api/cameras/:id/entry`** & `POST .../exit`** — AI calls saat detect crossing | Core | Medium |
| 8 | **Gate counter badge** di CameraCard — "3 inside" real-time | Core | Medium |
| 9 | **Dashboard `/counting`** — tabel semua kamera: nama, currently inside, total hari ini, avg duration | Core | Medium-High |
| 10 | **Visit log per kamera** — list: masuk 09:01, keluar 09:14, durasi 13m | Incremental | Medium |
| 11 | WebSocket push `gate_crossing` event → update counter tanpa polling | Incremental | Medium |
| 12 | Daily summary — total masuk/keluar per kamera per hari | Incremental | Low-Medium |
| 13 | Export CSV visit data — untuk analisis offline | Incremental | Low |
| 14 | Alert threshold — notif kalau `currently_inside > N` | Incremental | Medium |
| 15 | Historical chart — grafik entry/exit per jam per kamera | Breakthrough | High |

### Creative Alternatives (Wild Ideas)

| # | Ide | Kenapa Menarik |
|---|---|---|
| W1 | **Kiosk mode** — TV di pos security, setiap kamera tampilkan "Inside: 3, Avg: 8m" auto-rotate | Petugas cukup lihat TV |
| W2 | **Telegram bot** — push notif "Gerbang A: 5 orang masuk, 2 keluar, 3 masih di dalam" per jam | Zero UI effort |
| W3 | **Live timer** — kalau orang masih di dalam > threshold (misal 30m), warna berubah merah | Detect anomali durasi lama |
| W4 | **Tripwire visual** — garis virtual di video feed, flash hijau saat masuk, merah saat keluar | Visual feedback langsung |

---

## EVALUATION & SELECTION

### Evaluation Criteria

| Kriteria | Bobot | Alasan |
|---|---|---|
| **Core value** — fitur inti gate counting + duration? | 5 | Tanpa ini produk tidak jalan |
| **Feasibility** — bisa dikerjakan 1 dev? | 4 | Bandwidth terbatas |
| **Pilot readiness** — perlu untuk demo pertama? | 4 | BO mau segera pilot |
| **Dependency** — solusi lain bergantung pada ini? | 3 | Urutan implementasi |
| **Effort** — seberapa besar? | 2 | Prefer quick wins dulu |

### Decision Matrix (weighted score)

| # | Solusi | Core×5 | Feasible×4 | Pilot×4 | Dep×3 | Effort×2 | **Total** |
|---|---|---|---|---|---|---|---|
| 6 | Entry/exit API endpoints | 25 | 20 | 20 | 15 | 8 | **88** |
| 7 | GET /cameras/:id/visits | 25 | 20 | 20 | 12 | 8 | **84** |
| 4 | `camera_visits` table | 25 | 16 | 20 | 15 | 6 | **82** |
| 5 | AI detect masuk/keluar | 25 | 12 | 20 | 15 | 6 | **78** |
| 8 | Gate counter badge | 25 | 16 | 20 | 9 | 6 | **74** |
| 1 | Feature flag VITE_PRODUCT | 10 | 20 | 20 | 9 | 10 | **68** |
| 9 | Dashboard /counting | 25 | 12 | 20 | 9 | 4 | **68** |
| 2 | Hapus route non-CCTV | 10 | 20 | 20 | 3 | 10 | **62** |
| 3 | Branding config | 10 | 20 | 20 | 3 | 10 | **62** |
| 10-15 | v1.1 features | <52 | — | — | — | — | **<52** |

### Recommended Solution — Phased Bundle

**Phase 0 — Rebrand (1 hari)**
- #1 Feature flag `VITE_PRODUCT=cctv-ai-count`
- #2 Hapus route non-CCTV
- #3 Branding config (judul, warna, logo)

**Phase 1 — Backend Core (2-3 hari)**
- #4 `camera_visits` table + migration
- #6 `POST /entry` & `POST /exit` endpoints
- #7 `GET /cameras/:id/visits` + `currently_inside` count

**Phase 2 — AI Integration (2-3 hari)**
- #5 Update AI prompt → detect "entering" vs "exiting"
- Hook AI pipeline output → auto-call entry/exit endpoints

**Phase 3 — Frontend Core (2-3 hari)**
- #8 Gate counter badge di CameraCard
- #9 Dashboard `/counting` — tabel + live count + avg duration

**v1.1 — After Pilot**
- #10 Visit log detail
- #11 WebSocket real-time push
- #12 Daily summary
- #13 Export CSV
- #14 Alert threshold
- #15 Historical chart

### Rationale

1. **Phase 0 duluan** — BO lihat "ini produk baru" tanpa perlu fitur baru. Quick win, confidence builder.
2. **Backend sebelum frontend** — API harus ada dulu supaya frontend punya data.
3. **AI integration terpisah** — paling risky (akurasi detect arah). Kalau AI belum sempurna, manual entry/exit via API tetap jalan untuk pilot.
4. **Duration otomatis dari data** — `exit_time - enter_time`, tidak perlu frontend timer.
5. **v1.0 tanpa WebSocket** — polling 15 detik cukup untuk counting dashboard.

### Concerns & Risks

| Concern | Mitigasi |
|---|---|
| AI akurasi arah dari 1 snapshot | Fallback: 2-frame comparison, atau manual entry/exit API untuk pilot awal |
| GPT-4o-mini mungkin tidak reliably detect in vs out | Dedicated vision model (YOLO + direction) sebagai v1.1 upgrade |
| Petugas harus manual input kalau AI belum siap | Provide simple form: pilih kamera → "Masuk" / "Keluar" button |

---

## IMPLEMENTATION PLAN (Revised — dengan masukan presales)

### Koreksi Arsitektur dari Presales Brief

| Asumsi Sebelumnya | Koreksi |
|---|---|
| GPT-4o-mini via OpenRouter untuk counting | **Python vision worker lokal** — YOLO nano + ByteTrack |
| Detect arah dari 1 snapshot | **Tracking antar-frame** + virtual line crossing |
| Duration = simple enter/exit | **2 level:** rata-rata (Fase 1, mudah) vs per-individu (Fase 2, Re-ID) |
| Node.js handle semuanya | **Python worker terpisah** → tulis ke DB ← Node.js baca |
| OpenRouter untuk counting core | OpenRouter **hanya** untuk laporan bahasa natural (opsional Fase 3) |
| Kamera kirim foto di event | **Event tanpa foto** — capture sendiri dari RTSP stream |

### Arsitektur Baru

```
Kamera VIGI C240
     │  RTSP stream  (+  Open API event lintas garis)
     ▼
Vision Worker (Python)
     │  YOLO nano → ByteTrack → virtual line → (Fase 2) Re-ID + capture
     ▼
Database (shared)
     │  event masuk/keluar, timestamp, arah, foto, skor
     ▼
Backend (Node.js) ← stack existing kita
     │  agregasi, API, autentikasi, logika bisnis
     ▼
Dashboard (React) ← frontend existing kita
     angka, laporan, durasi, antrian verifikasi
```

### Approach: Phased Rollout (Aligned with Presales)

### Phase 0 — Rebrand "CCTV AI Count" + Validasi Hardware

| # | Action | Detail |
|---|---|---|
| 0.1 | `src/config/product.js` | Branding: name, title, logo, color, sidebar menu |
| 0.2 | Env var `VITE_PRODUCT` | Default `cctv-ai-count` |
| 0.3 | Sidebar hide non-CCTV | Render dari `product.sidebar[]` |
| 0.4 | TopBar branding | Baca dari `product.title` |
| 0.5 | Router disable non-CCTV routes | Wrap routes |
| 0.6 | HTML title + logo | "CCTV AI Count" |
| 0.7 | **Validasi kamera** | Cek posisi/sudut, test RTSP access, test Open API `subscribeMsg` |
| 0.8 | **Sepakati definisi metrik** | Apa = "masuk", "keluar", "1 kunjungan" dengan PO |

### Fase 0.5 — Site Survey & RTSP Validation (WAJIB sebelum coding)

| # | Action | Detail |
|---|---|---|
| 0.5.1 | **Site survey pintu** | Sudut kamera, lebar pintu, kondisi cahaya (siang/malam), volume traffic per jam puncak |
| 0.5.2 | **Test RTSP stream** | Latency, resolusi, stability, apakah bisa diakses dari server/mini-PC |
| 0.5.3 | **Test Open API `subscribeMsg`** | Apakah CrossLineDetection event bisa diterima dari C240 |
| 0.5.4 | **Estimate peak traffic** | Berapa orang/menit di jam sibuk → menentukan fps requirement → menentukan hardware |
| 0.5.5 | **Validasi "momen pasti 0"** | Kapan gedung benar-benar kosong? 24 jam? Ada momen tutup? → menentukan reset strategy |
| 0.5.6 | **Python dev availability** | Hire, outsource, atau train existing dev? Konfirmasi sebelum Fase 1 |

**Gate decision:** Jika RTSP tidak accessible atau sudut kamera tidak memadai, **STOP** — fix hardware dulu sebelum Fase 1.

### Fase 1 — Penghitungan + Durasi Rata-rata (Quick Win)

| # | Action | Komponen | Detail |
|---|---|---|---|
| 1.1 | **Setup Python vision worker** | NEW service | Python project terpisah, baca RTSP stream |
| 1.2 | **YOLO nano deteksi orang** | vision worker | Ultralytics YOLO, model nano, ~10-15 fps |
| 1.3 | **ByteTrack tracking** | vision worker | ID konsisten antar-frame, 1 orang = 1 track |
| 1.4 | **Virtual line crossing logic** | vision worker | Garis di pintu, detect arah masuk/keluar |
| 1.5 | **DB migration `crossing_events`** | backend | `id, camera_id, direction (in/out), timestamp, track_id` |
| 1.6 | **Worker → DB insert** | vision worker | Setiap crossing = 1 row ke database |
| 1.7 | **Backend API endpoints** | Node.js | `GET /counting/summary` — occupancy, total in/out, avg duration |
| 1.8 | **Frontend dashboard `/counting`** | React | Tabel per kamera: currently inside, total hari ini, avg duration |
| 1.9 | **CameraCard badge** | React | "Inside: 3" badge overlay |
| 1.10 | **Worker deployment** | DevOps | Docker container (`Dockerfile` + `docker-compose.yml`), auto-restart on crash (`restart: unless-stopped`) |
| 1.11 | **Worker health check** | vision worker + backend | Worker expose `GET /health` (fps, last_event_time, uptime, camera_connected). Backend poll health setiap 30s, alert kalau worker down >2 menit |
| 1.12 | **Worker monitoring dashboard** | React | Status widget: worker up/down, current fps, last crossing event timestamp, RTSP stream status |
| 1.13 | **Crash recovery** | vision worker | On restart: baca last counter dari DB (bukan reset 0), log gap duration, emit `worker_restarted` event |

**Deliverable Fase 1:** Angka masuk/keluar real-time + okupansi + durasi **rata-rata** per kamera. Worker deployed via Docker dengan health check + auto-restart + crash recovery.

### Fase 2 — Durasi Per Individu (Re-ID)

| # | Action | Komponen | Detail |
|---|---|---|---|
| 2.1 | **RTSP frame capture** saat crossing | vision worker | Ambil foto dari stream pada momen crossing |
| 2.2 | **Re-ID hybrid matching** | vision worker | **Bukan pure embedding** — gabungan: appearance embedding (OSNet), temporal proximity (FIFO heuristic), height estimation, clothing color histogram |
| 2.3 | **DB table `person_visits`** | backend | `id, camera_id, enter_time, exit_time, duration, enter_photo, exit_photo, match_score, match_method, verified` |
| 2.4 | **Matching logic** | vision worker | Exit person → score kandidat "inside" by weighted hybrid (embedding 40% + temporal 25% + height 20% + color 15%) |
| 2.5 | **Confidence scoring** | vision worker | Skor tinggi → auto-match; skor ragu → flag manual verification |
| 2.6 | **Verification queue UI** | React | Antrian foto masuk/keluar, petugas confirm/reject match |
| 2.7 | **Field accuracy test** | manual | Uji dengan data nyata di lokasi pilot |

**Deliverable Fase 2:** Durasi per individu dengan foto. Skor tinggi = otomatis. Skor ragu = verifikasi manusia.

### Fase 3 — Laporan Cerdas (Opsional)

| # | Action | Detail |
|---|---|---|
| 3.1 | Ringkasan harian bahasa natural | OpenRouter/GPT — "Hari ini 47 orang masuk, rata-rata 23 menit" |
| 3.2 | Tanya-jawab data | Chat interface untuk query counting data |
| 3.3 | Export CSV/PDF | Laporan periodik |

### Dependency Graph (Revised)

```
Phase 0 (Rebrand) ──→ demo "produk baru" ke BO
     │
Fase 0.5 (Site Survey + RTSP Validation + Python Dev Decision)
     │  ← GATE: RTSP OK? Sudut OK? Dev confirmed?
     │
Fase 1 (Python Worker + Backend API + Frontend Dashboard)
     │  counting + avg duration ✓
     │
Fase 2 (Re-ID Hybrid + Photo + Verification Queue)
     │  durasi per individu ✓
     │
Fase 3 (OpenRouter laporan bahasa natural) ← opsional
```

### Resources (Revised)

| Resource | Status | Notes |
|---|---|---|
| Database | ✅ Existing | Shared antara Python worker & Node.js |
| Kamera VIGI C240 | ✅ Di lapangan | Perlu validasi sudut + RTSP access |
| **Python CV dev** | ⚠️ **Skillset berbeda dari Node.js dev** | Vision worker — YOLO, ByteTrack, Re-ID. Ini bukan tugas Node.js dev belajar sambil jalan. Hire/outsource/train — putuskan di Fase 0.5 |
| Node.js dev | ✅ Existing | Backend API + agregasi |
| React dev | ✅ Same as Node.js dev | Dashboard counting |
| **GPU/Mini-PC** | ⚠️ Perlu — **sizing tergantung peak traffic** | Peak <5 orang/menit: i5/N100 cukup. Peak 5-15: GTX 1650. Peak >15: RTX 3050+. Confirm di Fase 0.5 site survey |
| OpenRouter API | ✅ Existing | Hanya Fase 3 (opsional) |
| YOLO nano model | ✅ Open-source | Ultralytics, gratis |
| ByteTrack | ✅ Open-source | Gratis |
| OSNet/torchreid | ✅ Open-source | Fase 2, gratis |

### Responsible Parties (Revised)

| Phase | Owner | Reviewer | Keputusan PO Dibutuhkan |
|---|---|---|---|
| Phase 0 — Rebrand + HW | Dev | BO | Approve branding + definisi metrik |
| Fase 1 — Counting | Dev + Python dev | QA | — |
| Fase 2 — Re-ID | Python dev | BO | Terima bahwa tidak 100% otomatis? |
| Fase 3 — Laporan | Dev | PM | Perlu atau tidak? |

### Keputusan yang Harus Dijawab PO

1. Kebutuhan utama: durasi **rata-rata** (Fase 1 cukup) atau **per individu** (perlu Fase 2)?
2. Terima bahwa durasi per individu **tidak 100% otomatis** — sebagian perlu verifikasi manusia?
3. Opsi badge/QR sebagai alternatif akurat — memungkinkan?
4. Satu pintu atau banyak pintu?

### Keputusan untuk Tech Lead

1. Setuju arsitektur Python worker + Node.js backend via shared DB?
2. Hardware yang tersedia/dianggarkan (GPU vs CPU-only)?
3. Komunikasi real-time: DB polling vs WebSocket vs message queue?
4. Skema DB final (field skor, status verifikasi, foto storage)?

---

## MONITORING & VALIDATION

### Success Metrics

| Metrik | Target | Cara Ukur | Frekuensi |
|---|---|---|---|
| Counting accuracy | ≥95% vs manual count | Petugas hitung 1 jam, bandingkan | Minggu 1 pilot |
| Direction accuracy (in/out) | ≥90% | Sample 50 crossing, validasi arah | Minggu 1 pilot |
| Occupancy drift | Selisih ≤2 vs headcount fisik | Bandingkan setiap 2 jam | Harian |
| System uptime | ≥99% jam operasi | Worker + backend monitoring | Harian |
| Latency event → DB | <3 detik | Timestamp crossing vs DB insert | Spot check |
| Re-ID match accuracy (Fase 2) | ≥80% auto-match benar | Sample 30 pasangan, validasi foto | Minggu 1 Fase 2 |
| Verification queue (Fase 2) | <20% dari total | Unverified / total | Harian |
| Dashboard load time | <2 detik | Browser DevTools | Spot check |
| Rebrand completeness | 0 referensi "CIFO Guard" | Manual walkthrough | Sekali |

### Validation Plan

**Fase 0 — Rebrand:**
- Walkthrough semua halaman — 0 teks/logo "CIFO Guard"
- Sidebar hanya CCTV + Counting
- Non-CCTV routes → 404 / redirect
- `document.title` = "CCTV AI Count"

**Fase 1 — Counting:**
- Pintu test 1 jam: petugas hitung manual vs sistem
- Occupancy test: headcount fisik vs `currently_inside`
- Edge case: 2 orang masuk bersamaan
- Edge case: orang berbalik di tengah (tidak jadi masuk)
- Night test: occupancy stabil 0 (no phantom counts)
- API test: Postman collection counting endpoints
- Dashboard test: angka update setiap 15s

**Fase 2 — Re-ID:**
- Match test: 30 orang masuk lalu keluar — % cocok benar
- Similar appearance: 5 orang seragam — bisa dibedakan?
- Long stay: masuk pagi keluar sore — penampilan berubah
- Verification UI: confirm/reject <10 detik per case
- Duration accuracy: sistem vs stopwatch manual

### Risk Mitigation

| Risk | Mitigasi | Trigger Pivot |
|---|---|---|
| Miss-detect cahaya pintu | Test malam/siang, adjust confidence | Accuracy <85% after tuning |
| 2+ orang berdempetan | Tuning ByteTrack | Under-count >10% consistent |
| RTSP stream putus | Auto-reconnect + alert | >5 min downtime tanpa recovery |
| GPU tidak tersedia | CPU-only (YOLO nano 10fps) | Fps <5 → upgrade |
| Python dev unavailable | Outsource / VIGI built-in counting | Delay >2 minggu |
| Re-ID akurasi rendah | Fallback avg duration + badge/QR | Auto-match <60% |
| Occupancy drift | Daily reset + drift alarm | Drift >5 per hari |
| PO mau multi-pintu | 1 pintu dulu, multi = scope terpisah | Jangan commit pre-Fase 1 |

### Adjustment Triggers

| Kondisi | Action |
|---|---|
| Counting accuracy <90% setelah 1 minggu | Stop, review angle + YOLO config + lighting |
| Occupancy drift >3/hari | Daily reset + investigate false crossing |
| Re-ID auto-match <70% | Fallback avg duration + manual log |
| Worker crash >3x/hari | Review memory/CPU, lighter model |
| PO: "avg duration cukup" | Skip Fase 2, go to Fase 3 |
| Hardware budget rejected | VIGI built-in People Counting alternative |

---

## LESSONS LEARNED

### Key Learnings

1. **Presales input mengubah arsitektur fundamental.** Asumsi awal (GPT-4o-mini via OpenRouter) salah total untuk use case ini. Computer vision butuh model lokal + tracking antar-frame — bukan LLM snapshot. Lesson: konsultasi domain expert sebelum arsitektur, bukan sesudah.

2. **Terminologi matters.** "Gate counting" vs "crowd counting" vs "visitor counting" — satu kata bisa bikin seluruh tim salah arah. Lesson: align definisi di awal, pakai contoh skenario konkret (timeline masuk/keluar).

3. **2 level kesulitan yang sangat berbeda.** Counting (Fase 1) = matang, >95% akurat. Duration per individu (Fase 2) = Re-ID, tidak 100% otomatis. Lesson: jangan bundle mudah + sulit — fase terpisah, deliver value cepat.

4. **"Terlalu banyak fitur" = "tidak ada 1 fitur yang selesai 100%."** Root cause bukan kode buruk — positioning terlalu luas. Pivot ke 1 use case spesifik lebih kuat dari all-in-one 80%.

5. **Hardware constraint validasi awal.** Kamera VIGI C240 event API tidak kirim foto — mengubah arsitektur. Lesson: baca API docs sebelum desain.

6. **Counter AKAN drift — bukan "apakah" tapi "seberapa cepat."** Asumsi "tidak pernah negatif" salah. Perlu drift management dari hari 1: daily reset, alarm, manual correction.

7. **Site survey sebelum coding.** Sudut kamera, lebar pintu, cahaya, peak traffic — semua ini menentukan hardware dan fps requirement. Coding tanpa site survey = membangun di atas asumsi.

8. **Python CV ≠ Node.js dev.** 2 skillset berbeda. Jangan asumsi 1 orang bisa handle keduanya tanpa waktu belajar signifikan.

9. **Re-ID butuh hybrid, bukan pure embedding.** Appearance embedding saja tidak robust (jaket lepas, tas baru). Perlu gabungan: temporal proximity, height, color histogram.

### What Worked

- Morphological Analysis → generate opsi sistematis
- Phased approach → cegah scope creep, Fase 1 bisa pilot tanpa Fase 2
- Presales brief di tengah proses → koreksi arsitektur sebelum coding
- Decision matrix → prioritas eksplisit, bukan gut feeling
- Contoh skenario konkret → hilangkan ambiguitas

### What to Avoid

- Jangan arsitektur sebelum validasi domain expert
- Jangan asumsi API capability — baca docs dulu
- Jangan campur "mudah" + "sulit" dalam 1 fase
- Jangan pakai terminologi teknis ke PO — "pencocokan foto masuk-keluar", bukan "Re-ID embedding"

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
_Session completed: Steps 1-9_
_Date: 2026-06-17_
