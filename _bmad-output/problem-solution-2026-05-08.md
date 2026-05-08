# Problem Solving Session: Audit Dummy vs API-Connected di CIFO Guard Frontend

**Date:** 2026-05-08
**Problem Solver:** LENOVO
**Problem Category:** Technical Debt / Brownfield Code Audit / Visibility

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

> "Saya bingung mana komponen yang masih pakai dummy data dan mana yang sudah terhubung ke API. Sukses berarti secara eksplisit tahu area-area mana saja yang masih menggunakan dummy data / placeholder."

### Refined Problem Statement

Frontend CIFO Guard adalah codebase brownfield dengan **status integrasi yang tidak terdokumentasi per komponen**. Sebagian fitur sudah penuh terhubung ke backend (via React Query + Axios + WebSocket), sebagian masih menampilkan **dummy data, hardcoded constant, fallback value, atau placeholder visual**, dan sebagian lagi adalah **hybrid** (real API tapi dengan fallback hardcoded saat backend belum siap atau saat error).

Tidak ada **inventaris terpusat** maupun **penanda di kode** yang memungkinkan developer/QA tahu status integrasi tiap komponen secara instan. Akibatnya:

1. **Regression susah dikejar** — perubahan backend bisa merusak komponen "real" tanpa terdeteksi karena bercampur dengan komponen "dummy" yang stabil.
2. **Risiko demo palsu** — data dummy bisa tampil di stakeholder demo tanpa disadari, merusak kepercayaan.
3. **Backlog integrasi tidak terukur** — tidak ada angka pasti "berapa % UI sudah real" untuk perencanaan sprint.
4. **Onboarding lambat** — developer baru harus *trial-and-error* untuk tahu komponen mana yang aman dimodifikasi.

### Problem Context

- **Stack:** React 18 + Vite + TanStack Query + Zustand + Socket.io + HLS.js
- **Struktur:** 10 feature folder di `src/features/` (auth, dashboard, alerts, panic, panic-monitor, cameras, incident-response, interactive-map, media, users)
- **Layer integrasi:** `src/api/` (10 file), `src/hooks/` (8 hook stream), `src/store/` (3 zustand store)
- **Konteks brownfield yang relevan** (dari `README.md` Known Issues & deep-dive doc):
  - `cameras.api.js` masih pakai endpoint legacy `/api/cameras` dengan **18 kamera hardcoded** + injeksi Vigi AI (bukan database real)
  - **Arm/Disarm system** belum punya endpoint backend → `useSystemStore.armed` hanya local state + persisted localStorage
  - **Mode selector** (Home/Night/Silent) belum ada di backend → local state saja
  - **Sensor list** di CenterPanel diderivasi dari `activities/recent` (bukan endpoint dedicated `/api/sensors`)
  - **GPS fallback** (`FALLBACK_GPS` di `utils/geo.js`) dipakai di panic flow saat browser geolocation gagal
  - **Animated background placeholder** di `CameraCard` saat `cam.streamUrl` tidak ada / bukan `.m3u8`
  - **Mockup HTML** di root repo (`Incident Response.html`, `Interactive Map.html`, dll.) — apakah masih jadi referensi atau sudah obsolete?
- **Tipe "dummy" yang mungkin ada:**
  - Hardcoded constants / mock arrays
  - Fallback values saat API error
  - Placeholder visual (animated bg, skeleton, lorem ipsum)
  - Local-only state (zustand) yang seharusnya disinkronkan ke backend
  - Derived/inferred data dari endpoint lain (sensor dari activities)
  - Deprecated endpoint (legacy `/api/cameras` vs `/api/api/cameras` database)

### Success Criteria

Sesi ini berhasil jika menghasilkan:

1. **Inventaris eksplisit** semua area yang masih pakai dummy/placeholder data, terklasifikasi per:
   - File & line (file_path:line_number)
   - Feature folder
   - Tipe dummy (hardcoded, fallback, placeholder, derived, local-only)
   - Status integrasi target (real-API, hybrid, dummy-only)
   - Trigger pemicu (default, error fallback, backend-not-ready, design-only)
2. **Penanda yang machine-readable** — bisa di-grep developer/CI tanpa harus membaca seluruh kode
3. **Definisi "selesai"** untuk tiap entry — apa yang harus dilakukan agar entry tersebut keluar dari list (endpoint X aktif, hapus fallback, dst.)
4. **Mekanisme yang sustainable** — agar developer baru tidak menambah dummy baru tanpa terdaftar di inventaris

---

## 🔍 DIAGNOSIS AND ROOT CAUSE ANALYSIS

_Pending — Step 2 ke depan._

### Problem Boundaries (Is/Is Not)

#### 🟢 IS — Di mana masalah MUNCUL

| Area | File | Tipe Dummy |
|---|---|---|
| Camera list (legacy) | `src/api/cameras.api.js` `list()` | 18 kamera hardcoded + injeksi Vigi AI |
| Camera card placeholder | `src/features/cameras/CameraCard.jsx` | Animated background bila `streamUrl` kosong / non-`.m3u8` |
| Panic GPS fallback | `src/utils/geo.js` | `FALLBACK_GPS` constant saat geolocation gagal |
| System armed status | `src/store/system.store.js` | Local-only state (no backend endpoint) |
| System mode (Home/Night/Silent) | `src/store/system.store.js` | Local-only state (no backend endpoint) |
| Sensor list di home view | `src/features/dashboard/CenterPanel.jsx` | Diderivasi dari `activities/recent` (bukan endpoint dedicated) |
| HTML mockups di root | `Incident Response.html`, `Interactive Map.html`, `Panic Alerts.html`, `Team Management.html`, `Visitor Registration.html` | Mockup statis — status referensi/obsolete belum jelas |
| Default initial state | Beberapa komponen mungkin punya placeholder text/skeleton | Belum diaudit |

#### 🔴 IS NOT — Di mana masalah TIDAK muncul (sudah real-API)

| Area | Bukti Real Integrasi |
|---|---|
| Auth flow | `authApi.login/logout/changePassword` |
| Alerts modal & stats | `useActiveAlerts`, `useAlertStats` + WS `alert_created`/`alert_updated` |
| Incident kanban & detail | `useIncidents`, `useIncidentDetail` + WS `incident_*` |
| Panic monitor | `usePanicAlerts` + WS legacy `ALERT_CREATED`/`ALERT_UPDATED` |
| User management CRUD | `usersApi.list/create/update/delete/changeRole/unlock` |
| Trigger panic alert | `alertsApi.triggerPanic` POST `/api/panic` |
| System health | `useHealth`, `useMetrics` |
| Camera heartbeat | `camerasApi.heartbeat` polling 30s |

#### 🕒 WHEN — Kapan dummy muncul vs tidak

| Muncul saat | Tidak muncul saat |
|---|---|
| Backend endpoint belum diimplementasi (arm, mode, sensors) | Backend up & endpoint sudah ada |
| `streamUrl` kosong / format non-HLS | `streamUrl` valid `.m3u8` |
| Geolocation API gagal/denied | GPS izin granted & sukses |
| First-render sebelum query selesai | Data sudah cache/refetch |
| Token kedaluwarsa → empty state | Authenticated session |

#### 👥 WHO — Siapa yang terdampak

- Developer — ambiguitas, takut break "real"
- QA — sulit menyusun test plan
- Stakeholder demo — risiko data palsu dilihat sebagai real
- Backend engineer — tidak tahu prioritas endpoint
- Onboarding dev baru — trial-and-error mahal

**Tidak terdampak:** End user runtime — kalau backend hidup, mereka dapat data real.

#### 🎯 WHAT — Apa masalahnya & BUKAN masalahnya

| Masalah | BUKAN masalah |
|---|---|
| Tidak ada inventaris status integrasi | Performance / load time |
| Tidak ada penanda di kode | Security / authz |
| Mixing real + dummy tanpa label | Design / UX visual |
| Local-only state menyamar sebagai system state | Keberadaan fallback (sebagian sengaja) |
| HTML mockup di root tanpa status jelas | Kode yang sudah real |

#### 💡 Pola yang Muncul

Sebagian besar dummy adalah **konsekuensi ketidaksiapan backend** (arm/mode/sensors/cameras-database), bukan kemalasan frontend. Ini membedakan **dummy yang sengaja (fallback UX yang valid)** dari **dummy yang tertinggal (legacy yang harus diganti)**. Solusi inventaris harus bisa membedakan kedua kategori ini.

### Root Cause Analysis

**Metode:** Fishbone Diagram (lebar) + Five Whys (mendalam pada cabang Tooling/Kode).

#### Fishbone — 4 cabang penyebab

**🧑 People / Proses**
- Tidak ada code review checklist yang menanyakan "ini real atau dummy?"
- Definition of Done untuk story tidak menyebutkan "marker integrasi"
- Onboarding informal — knowledge tinggal di kepala dev senior

**🔧 Tooling / Kode**
- Tidak ada konvensi penanda yang seragam (TODO/FIXME/`@stub` dipakai bebas)
- Tidak ada lint rule yang flag hardcoded mock data
- Hooks abstrak menyembunyikan asal data — sulit di-grep
- Tidak ada feature flag eksplisit "use real" vs "use mock"

**🔌 Backend Dependency**
- Beberapa endpoint belum jadi (arm, mode, sensors, cameras-DB) — frontend pioneer pakai mock
- Tidak ada kontrak API formal yang versioned (OpenAPI / Postman tracked)
- Tidak ada ritual "swap to real" saat backend siap

**📚 Dokumentasi / Komunikasi**
- Known Issues tersebar di README, deep-dive doc, dan komentar kode
- HTML mockup di root tanpa label live/obsolete
- Tidak ada "integration health" dashboard atau report

#### Five Whys — Cabang Tooling

| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Kenapa developer tidak tahu mana yang dummy? | Tidak ada penanda di kode |
| 2 | Kenapa tidak ada penanda? | Konvensi tidak pernah disepakati |
| 3 | Kenapa tidak pernah disepakati? | Saat awal fokus *ship fitur*; mocking dianggap sementara |
| 4 | Kenapa "sementara" jadi permanen? | Tidak ada mekanisme yang mengingatkan ulang (list, lint, tag) |
| 5 | **Kenapa tidak ada mekanisme pengingat?** | **Status integrasi tidak diperlakukan sebagai *first-class metadata* dalam workflow tim — hanya tribal knowledge** |

#### 🎯 Root Cause Utama

> **Status integrasi (real / hybrid / dummy) tidak diperlakukan sebagai metadata kelas pertama di codebase.** Tidak ada artefak (file, marker, lint, dashboard) yang membuat status ini visible by default — sehingga pengetahuan terdegradasi menjadi tribal knowledge yang menguap saat turnover atau saat developer pindah konteks.

### Contributing Factors

1. **Tooling kosong** — tidak ada konvensi marker, lint rule, atau index file
2. **Proses kosong** — code review tidak menanyakan status integrasi; DoD tidak menyebutkan
3. **Backend dependency yang nyata** — sebagian dummy memang konsekuensi tak bisa dihindari, tapi tidak terdaftar kapan harus diganti
4. **Dokumentasi tersebar** — Known Issues di 3 tempat berbeda (README, deep-dive doc, komentar kode); tidak ada single source of truth

### System Dynamics

- 🔁 **Reinforcing loop (vicious cycle):** Fitur baru → dummy ad-hoc untuk *unblock* development → makin sulit melacak → developer pasrah → dummy baru ditambah tanpa ritual cleanup → semakin kabur.
- ⏳ **Backend delay loop:** Backend punya delay implementasi yang tidak terukur → tidak ada trigger eksplisit untuk frontend "swap to real" → fallback yang awalnya sementara membatu jadi permanen.
- 🧠 **Tribal knowledge decay:** Setiap turnover atau context-switch (developer pindah ke fitur lain) menggerus pengetahuan informal tentang status integrasi, tanpa artefak persisten yang menggantikannya.

---

## 📊 ANALYSIS

_Pending._

### Force Field Analysis

#### 🔋 Driving Forces (Mendorong)

| Kekuatan | Mengapa Mendukung |
|---|---|
| Codebase relatif kecil & fokus (10 fitur, ~30 file inti) | Audit tractable dalam beberapa sesi |
| `docs/features/` baru di-commit (per-fitur) | Tinggal tambah kolom "Status Integrasi" |
| Vite + ESLint sudah terpasang | Lint rule custom siap dipakai |
| Konvensi React Query konsisten (`useXxxStream` pattern) | Real API mudah di-grep |
| TanStack Query DevTools tersedia | Verifikasi runtime mana yang nge-fetch |
| Motivasi user (Anda) hadir | Sesi ini sendiri bukti komitmen |
| Backend Known Issues sudah didokumentasikan | Daftar dummy "diharuskan" setengah jadi |

#### 🪨 Restraining Forces (Menahan)

| Kekuatan | Mengapa Menahan |
|---|---|
| Backend belum siap (arm/mode/sensors/cameras-DB) | Sebagian dummy tak bisa dihilangkan, hanya ditandai |
| Tidak ada test coverage real-vs-dummy | Tidak ada safety net |
| Tribal knowledge di kepala dev senior | Audit butuh interview, bukan grep saja |
| HTML mockup di root status kabur | Butuh keputusan strategis |
| Risiko "audit one-off" jadi dokumen mati | Solusi harus enforce-able |
| Fokus ship fitur tetap berlanjut | Audit berkompetisi dengan fitur baru |

#### Net Force

Driving forces secara teknis lebih kuat (codebase kecil, dokumentasi siap, tooling siap), tapi restraining forces lebih strategis (sustainability, kompetisi waktu). **Implikasi:** solusi harus murah eksekusi awal **tapi** membangun mekanisme sustainable.

### Constraint Identification

**Bottleneck #1 (utama):** Tidak ada **single source of truth (SSOT)** terpusat yang merekam status integrasi setiap area. Semua tooling lain (lint, code review, marker) adalah *enforcement*; tanpa SSOT terisi, enforcement tidak punya patokan.

**Bottleneck #2 (sekunder):** Ketiadaan **konvensi marker di kode** yang me-link ke SSOT. Tanpa marker, SSOT cepat usang karena tidak ada *bidirectional traceability*.

| Bottleneck | Real / Asumsi | Bisa Kita Pengaruhi? |
|---|---|---|
| Tidak ada SSOT terpusat | Real | ✅ Penuh |
| Tidak ada konvensi marker | Real | ✅ Penuh |
| Backend belum siap | Real (konteks) | ⚠️ Sebagian — butuh koordinasi |
| Tidak ada lint enforcement | Asumsi → akan jadi real | ✅ Penuh |
| Tribal knowledge | Real | ✅ Sebagian — bisa diekstraksi |

### Key Insights

🔬 **5 AHA insights yang mengkristal:**

1. **Solusinya adalah "sistem audit yang hidup", bukan one-off** — root cause adalah metadata-blindness, sekedar Excel akan kembali ke tribal knowledge dalam 2 sprint.

2. **Klasifikasi 4 kategori status integrasi** adalah kunci bahasa bersama:
   - 🟢 `real` — full API integration
   - 🟡 `hybrid-fallback` — real API + fallback hardcoded saat error (sengaja, valid)
   - 🟠 `backend-blocked` — dummy karena endpoint belum ada (perlu trigger swap)
   - 🔴 `legacy-mock` — dummy lama yang harus dihapus segera

3. **Sebagian besar dummy ber-konteks**, bukan kemalasan. Solusi tidak boleh "menuduh" tim — harus membedakan *yang sengaja* dari *yang tertinggal*.

4. **Quick win tersedia:** `docs/features/*.md` yang baru di-commit sudah merekam hook & API per fitur. Tinggal tambah kolom "Status Integrasi" → SSOT v1 dengan biaya sangat rendah.

5. **Lever paling efektif:** Bukan lint rule (prescriptive di awal), bukan dashboard (mahal). Tapi **konvensi penanda kode + tabel inventaris di repo** — dua artefak yang hidup berdampingan dengan cross-reference.

---

## 💡 SOLUTION GENERATION

_Pending._

### Methods Used

_Pending._

### Generated Solutions

_Pending._

### Creative Alternatives

_Pending._

---

## ⚖️ SOLUTION EVALUATION

_Pending._

---

## 🚀 IMPLEMENTATION PLAN

_Pending._

---

## 📈 MONITORING AND VALIDATION

_Pending._

---

## 📝 LESSONS LEARNED

_Pending._

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
