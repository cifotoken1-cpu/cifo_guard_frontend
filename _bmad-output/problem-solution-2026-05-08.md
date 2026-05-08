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

_Pending — Step 3._

### Contributing Factors

_Pending._

### System Dynamics

_Pending._

---

## 📊 ANALYSIS

_Pending._

### Force Field Analysis

_Pending._

### Constraint Identification

_Pending._

### Key Insights

_Pending._

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
