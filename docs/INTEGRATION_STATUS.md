# Integration Status — Audit Inventaris

**Dokumen:** `docs/INTEGRATION_STATUS.md`
**Versi:** v1.0 (initial audit)
**Tanggal:** 2026-05-08
**Auditor:** Dr. Quinn (problem-solving session) + PO review pending
**Sumber sesi diagnosa:** [`_bmad-output/problem-solution-2026-05-08.md`](../_bmad-output/problem-solution-2026-05-08.md)

---

## Tujuan Dokumen

Daftar eksplisit semua area di frontend yang **masih menggunakan dummy data, placeholder, fallback hardcoded, atau local-only state** — agar developer, QA, dan PO punya satu sumber kebenaran tentang status integrasi.

---

## Klasifikasi Status

| Kategori | Arti | Aksi |
|---|---|---|
| 🟢 **REAL** | Penuh terhubung ke backend API | Tidak ada — hanya reference |
| 🟡 **HYBRID** | Real API + fallback hardcoded (sengaja, valid by design) | Dokumentasikan dengan marker `// @stub: hybrid` |
| 🟠 **BACKEND-BLOCKED** | Dummy karena endpoint backend belum ada | Koordinasi dengan tim backend; swap saat siap |
| 🔴 **LEGACY** | Dummy lama yang harus dihapus / diganti | Replace dengan integrasi real |
| ⚪ **TBD** | Status belum diputuskan (butuh keputusan PO/tim) | Tentukan kategori |

---

## Konvensi Marker `// @stub:`

Setiap dummy/placeholder/fallback di kode HARUS punya marker grep-able:

```
// @stub: <kategori> — <alasan singkat>. Lihat #<issue-number>, INTEGRATION_STATUS.md #<row>.
```

**Contoh:**

```js
// @stub: hybrid — fallback default saat browser geolocation gagal/denied. Lihat #3, INTEGRATION_STATUS.md #5.
export const FALLBACK_GPS = { ... };

// @stub: backend-blocked — endpoint POST /api/system/arm belum ada (lihat #6, INTEGRATION_STATUS.md #2)
armed: false,

// @stub: legacy — endpoint /api/cameras return 18 kamera hardcoded di backend memory (lihat #9, #10, INTEGRATION_STATUS.md #1)
list: async () => { ... }
```

**Audit cepat:**

```bash
# Lihat semua marker yang ada di kode:
grep -rn "@stub:" src/

# Hitung per kategori:
grep -rn "@stub: legacy" src/ | wc -l
grep -rn "@stub: backend-blocked" src/ | wc -l
grep -rn "@stub: hybrid" src/ | wc -l
```

---

## Ringkasan (Quick Stats)

| Kategori | Jumlah Entry | Marker `@stub:` di kode |
|---|---|---|
| 🟢 Real | (di luar scope dokumen ini — lihat `docs/features/*.md`) | — |
| 🟢 **Resolved** (sebelumnya legacy/blocked) | **1** (#1 cameras: DB-backed sejak 2026-05-08) | — |
| 🟡 Hybrid | 2 | ✅ 2 marker |
| 🟠 Backend-Blocked | 5 | ✅ 4 marker |
| 🔴 Legacy | 0 | — |
| ⚪ TBD | 2 | — |
| **Total entry yang membutuhkan perhatian** | **9** | **6 ditandai** |

**GitHub backlog:** issue #2, #3, #4, #5 (epic) + #6–#13 (action items). Lihat label `tracking`, `integration:*`.

---

## Inventaris Audit (7 Known Issues + 1 derived)

### Tabel Master

| # | Area | File / Lokasi | Kategori | Penjelasan | Aksi yang Diperlukan | Blocker / Dependency | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | ~~**18 kamera hardcoded + injeksi Vigi AI**~~ → **DB-backed via Camera.getAll()** | `backend/api/router.js` (legacy `GET /cameras`); `src/api/cameras.api.js` (`list()`) | 🟢 RESOLVED (2026-05-08) | Konstanta `CCTV_CAMERAS` (164 baris, 18 kamera hardcoded) dihapus dari backend. Legacy endpoint `/api/cameras` sekarang query `Camera.getAll()` dari DB. Heartbeat POST validation ganti pakai `Camera.getById()`. Frontend tidak perlu di-update karena URL & response shape preserved. | — | — | — | ✅ Resolved — closes #10 |
| 2 | **Arm/Disarm system** | `src/store/system.store.js` (`armed`, `setArmed`) | 🟠 BACKEND-BLOCKED | State `armed` hanya local + persisted ke `localStorage`. Tidak ada koordinasi server-side; guard A "arm" tidak terlihat oleh guard B. | Backend implement `POST /api/system/arm`, `POST /api/system/disarm`, `GET /api/system/status`, WS `system_status_changed`. Frontend swap dari local state ke API call. | Backend team | Backend dev → Frontend dev | Marker ✅ + issue [#6](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/6) |
| 3 | **Mode selector (Home / Night / Silent)** | `src/store/system.store.js` (`mode`, `setMode`); UI di `src/features/dashboard/CenterPanel.jsx`, `src/features/panic/PanicConfirmModal.jsx` | 🟠 BACKEND-BLOCKED | Mode tidak tersinkronisasi antar device. Saat ini hanya local state. Workaround: `feature_flags` table dengan key `system.mode`. | Backend implement `POST/GET /api/system/mode` (atau via `feature_flags`), WS `system_mode_changed`. Frontend swap. | Backend team | Backend dev → Frontend dev | Marker ✅ + issue [#7](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/7) |
| 4 | **Sensor list** (door / motion / glass) | `src/features/dashboard/CenterPanel.jsx` (derive dari `useRecentActivities`) | 🟠 BACKEND-BLOCKED | Sensor list diderivasi dari `GET /api/activities/recent` dengan filter type berdasarkan deskripsi. Race condition saat WS event masuk; filter berbasis text matching, fragile. | Backend implement `GET /api/sensors` dengan field `id`, `type`, `status`, `location`, `last_event_at` + WS `sensor_status_changed`. Frontend tambah hook `useSensors()`. | Backend team | Backend dev → Frontend dev | Marker ✅ + issue [#8](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/8) |
| 5 | **GPS fallback** | `src/utils/geo.js` (`FALLBACK_GPS` constant); dipakai di `src/features/panic/PanicConfirmModal.jsx` | 🟡 HYBRID | Konstanta default saat browser geolocation gagal/denied. **Sengaja** — panic flow tetap bisa kirim alert walau tanpa GPS akurat. | Tandai dengan `// @stub: hybrid`. Tidak perlu dihapus. | — (by design) | Frontend dev | ✅ Marker added |
| 6 | **Animated background placeholder** (CameraCard) | `src/features/cameras/CameraCard.jsx` | 🟡 HYBRID | Placeholder visual cyberpunk saat `cam.streamUrl` kosong / non-`.m3u8`. **Sengaja** — UX lebih baik daripada blank. | Tandai dengan `// @stub: hybrid`. Tidak perlu dihapus. | — (by design) | Frontend dev | ✅ Marker added |
| 7 | **HTML mockups di root repo** | `Incident Response.html`, `Interactive Map.html`, `Panic Alerts.html`, `Team Management.html`, `Visitor Registration.html` | ⚪ TBD | 5 file HTML mockup di repo root. **Status kabur**: masih jadi referensi desain, atau sudah obsolete karena React app sudah implement? | **PO decision:** (a) Audit per file → React app sudah cover atau belum, (b) Kalau sudah cover → pindah ke `docs/mockups/` atau hapus, (c) Update README dengan konvensi mockup. | Keputusan PO | PO + Frontend dev | Pending — issue [#11](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/11) |
| 8 | **Vigi AI camera injection** (turunan dari #1) | `src/api/cameras.api.js` (logic injeksi di `list()`) | ⚪ TBD | Apakah injeksi data Vigi AI di list legacy sudah merepresentasikan integrasi real ke pipeline AI, atau ini juga mockup? Perlu klarifikasi. | Klarifikasi dengan backend: apakah `/api/cameras` real-mengembalikan kamera Vigi yang ter-AI-detect? Kalau ya → reklasifikasi jadi 🟢. Kalau tidak → 🔴. | Backend team | Backend dev untuk klarifikasi | Pending |
| 9 | **`DEFAULT_SENSORS` hardcoded** (6 sensor fallback) | `src/features/dashboard/CenterPanel.jsx:300` | 🟠 BACKEND-BLOCKED | Saat `useRecentActivities()` kosong, `deriveSensors()` return 6 sensor hardcoded (Living Room Door, Garage Motion, dst.) untuk UI tetap "ada isinya" saat dev. Akan tampil di production juga kalau backend belum kirim activities. | Hapus konstanta setelah `/api/sensors` siap (lihat entry #4) — replace dengan empty state component yang lebih jujur. | Issue [#8](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/8) | Frontend dev | Marker ✅ added |

---

## Detail Per Entry

### 🔴 #1 — 18 Kamera Hardcoded di `cameras.api.js`

**File:**
```
src/api/cameras.api.js (function list())
```

**Bukti dummy:**
- Konstanta array berisi 18 kamera (id, name, location, dst.) di-return langsung tanpa fetch ke backend
- Endpoint `GET /api/cameras` di backend sebenarnya juga sudah jadi (legacy hardcoded di backend)
- Endpoint database `GET /api/api/cameras` (yang real) tidak bisa diakses karena bug backend (#4)

**Konsekuensi runtime:**
- Camera grid di UI tampak penuh dengan 18 kamera, tapi semua statis — tidak ada CRUD nyata
- `CameraForm` (add/edit/delete) memang panggil `db.create/update/delete`, tapi resultnya tidak terlihat di list karena list pakai endpoint yang berbeda

**Definition of Done untuk swap ke real:**
- [ ] Issue #4 (backend `/api/api/cameras` bug) selesai
- [ ] `useCameras()` di `src/hooks/useCamerasStream.js` ganti dari `camerasApi.list()` ke `camerasApi.db.list()`
- [ ] Hapus 18 hardcoded camera dari `cameras.api.js`
- [ ] Test create/update/delete via `CameraForm` muncul di list real-time

---

### 🟠 #2 — Arm/Disarm System

**File:**
```
src/store/system.store.js (state armed, action setArmed)
src/features/dashboard/CenterPanel.jsx (System Control buttons)
src/features/dashboard/Sidebar.jsx (badge ARMED/DISARMED)
src/features/dashboard/TopBar.jsx (status row)
```

**Bukti dummy:**
- Tidak ada panggilan API saat `setArmed()` dipanggil — hanya update zustand store
- State persisted ke `localStorage` key `cifo-system` (zustand `persist` middleware)
- Multi-device tidak akan synchronized

**Definition of Done untuk swap ke real:**
- [ ] Backend: `POST /api/system/arm`, `POST /api/system/disarm`, `GET /api/system/status`
- [ ] Backend: WebSocket broadcast `system_status_changed`
- [ ] Frontend: `system.store.js` ganti `setArmed()` jadi async API call (dengan optimistic update)
- [ ] Frontend: subscribe WS `system_status_changed` untuk sync antar-device
- [ ] Frontend: hapus persist middleware untuk `armed` (atau keep sebagai cache)

---

### 🟠 #3 — Mode Selector (Home / Night / Silent / Panic)

**File:**
```
src/store/system.store.js (state mode, action setMode)
src/features/dashboard/CenterPanel.jsx (mode selector buttons)
src/features/panic/PanicConfirmModal.jsx (set mode='panic' setelah trigger)
```

**Bukti dummy:**
- `setMode()` hanya update zustand state
- Tidak ada API call

**Workaround sementara (opsional):**
Pakai tabel `feature_flags` dengan key `system.mode` (saran dari `docs/deep-dive-insiden-dan-alert-panic.md`).

**Definition of Done untuk swap ke real:**
- [ ] Backend: `POST /api/system/mode { mode }`, `GET /api/system/mode`, WS `system_mode_changed`
- [ ] Frontend: `system.store.js` ganti `setMode()` jadi API call
- [ ] Frontend: `CenterPanel` mode selector dan `PanicConfirmModal` panggil API
- [ ] Frontend: subscribe WS `system_mode_changed`

---

### 🟠 #4 — Sensor List

**File:**
```
src/features/dashboard/CenterPanel.jsx (home view sensors panel)
```

**Bukti dummy:**
- Sensor (door, motion, glass) **tidak ada endpoint dedicated**
- Diderivasi dari `useRecentActivities()` dengan filter `type` berdasarkan kata kunci di deskripsi activity
- Logic derivasi ada di `CenterPanel.jsx` (text matching pada `description`)

**Konsekuensi:**
- Race condition: saat WS `alert_created` masuk, list activities di-invalidate; sensor count "berkedip"
- Filter teks fragile — perubahan format deskripsi backend bisa hancurkan derivasi
- Tidak ada single source of truth untuk status sensor

**Definition of Done untuk swap ke real:**
- [ ] Backend: `GET /api/sensors` dengan field `{ id, type: door|motion|glass, status: online|offline|triggered, location, last_event_at }`
- [ ] Backend: WS `sensor_status_changed`
- [ ] Frontend: file baru `src/api/sensors.api.js`
- [ ] Frontend: file baru `src/hooks/useSensorsStream.js`
- [ ] Frontend: `CenterPanel` ganti dari derive-from-activities ke `useSensors()`
- [ ] Frontend: hapus logic text matching

---

### 🟡 #5 — GPS Fallback (`FALLBACK_GPS`)

**File:**
```
src/utils/geo.js (constant FALLBACK_GPS)
src/features/panic/PanicConfirmModal.jsx (consumer)
```

**Bukti hybrid (sengaja):**
- `FALLBACK_GPS` adalah koordinat default (mis. center map / kantor pusat)
- Dipakai saat `getGPS()` reject (geolocation denied/timeout/error)
- Backend menerima panic alert tanpa GPS akurat — fallback memastikan flow tetap jalan

**Acceptance (cukup di-label):**
- [ ] Tambah komentar `// @stub: hybrid — fallback default saat geolocation gagal/denied` di atas konstanta `FALLBACK_GPS`
- [ ] Dokumentasikan rasional di `docs/features/panic.md` (sebagian sudah ada)

---

### 🟡 #6 — Animated Background Placeholder di CameraCard

**File:**
```
src/features/cameras/CameraCard.jsx (rendering branch saat streamUrl tidak valid)
```

**Bukti hybrid (sengaja):**
- Saat `cam.streamUrl` kosong atau bukan `.m3u8`, tampilkan animated background cyberpunk placeholder
- Lebih baik daripada blank/error icon untuk UX dashboard 24/7
- Tidak menyembunyikan status — `live indicator` tetap menunjukkan kondisi real

**Acceptance (cukup di-label):**
- [ ] Tambah komentar `// @stub: hybrid — animated placeholder saat HLS stream tidak tersedia` di branch rendering
- [ ] Dokumentasikan rasional di `docs/features/cameras.md` (sebagian sudah ada)

---

### ⚪ #7 — Mockup HTML di Root Repo

**File:**
```
/Incident Response.html
/Interactive Map.html
/Panic Alerts.html
/Team Management.html
/Visitor Registration.html
```

**Status saat ini:** TBD — perlu keputusan PO.

**Pertanyaan untuk PO:**
1. Apakah file ini masih jadi referensi desain untuk fitur yang **belum** di-React? (Mis. `Visitor Registration.html` — apakah React app sudah punya fitur visitor registration?)
2. Kalau sudah obsolete, mau **archive** ke `docs/mockups/` atau **hapus**?
3. Kalau ada yang masih relevan, mau dibikinkan README di `docs/mockups/README.md` yang explain status tiap file?

**Audit awal (perlu konfirmasi):**

| File | Fitur React Equivalent | Status Audit |
|---|---|---|
| `Incident Response.html` | `src/features/incident-response/` | ✅ React app sudah implement → kandidat archive/delete |
| `Interactive Map.html` | `src/features/interactive-map/` | ✅ React app sudah implement → kandidat archive/delete |
| `Panic Alerts.html` | `src/features/panic-monitor/` | ✅ React app sudah implement → kandidat archive/delete |
| `Team Management.html` | `src/features/users/` (sebagian) | ⚠️ Mungkin belum 1:1; cek scope team management |
| `Visitor Registration.html` | ❌ Belum ada di React | 🔴 Masih jadi referensi desain, JANGAN hapus |

**Definition of Done:**
- [ ] PO konfirmasi audit di atas
- [ ] File yang obsolete → pindah ke `docs/mockups/legacy/` atau hapus
- [ ] File yang masih referensi → pindah ke `docs/mockups/active/` dengan README
- [ ] README repo update dengan link ke `docs/mockups/`

---

### ⚪ #8 — Vigi AI Camera Injection (Derived)

**File:**
```
src/api/cameras.api.js (logic di list() yang inject Vigi AI camera)
```

**Pertanyaan klarifikasi untuk backend:**
- Apakah `GET /api/cameras` (legacy) sudah me-return kamera Vigi yang real (dari pipeline AI di `services/vigi/`), atau injeksinya di-mock di frontend?
- Kalau dari pipeline AI real → reklasifikasi jadi 🟢 REAL
- Kalau di-mock di frontend → reklasifikasi jadi 🔴 LEGACY (gabung dengan #1)

**Aksi:**
- [ ] Tanya backend lead, update kategori di tabel master

---

## Definition of Done — Inventaris ini Sendiri

Sesuai DoD task: *"Inventaris dalam format spreadsheet/markdown tersedia dan di-review oleh PO."*

- [x] Inventaris dalam format markdown tersedia (file ini)
- [x] 7 Known Issues yang disebutkan PO ter-cover (+ 1 derived = #8)
- [x] Setiap entry punya: lokasi file, kategori, penjelasan, aksi, blocker, owner, status
- [x] Tabel master ringkas + detail per entry
- [x] Pertanyaan terbuka di-flag eksplisit (entry TBD)
- [ ] **Review oleh PO** ← menanti

---

## Cara Pakai Dokumen Ini

### Untuk PO

1. **Review tabel master** — pastikan klasifikasi sesuai prioritas tim
2. **Konfirmasi entry TBD** (#7 dan #8) — kasih keputusan agar bisa dipindahkan ke kategori definitif
3. **Translate ke ClickUp** — setiap row jadi 1 task dengan field: Title, Status, Owner, Blocker, Description (dari kolom "Penjelasan" + "Aksi")
4. **Set sprint goal** misalnya: *"Reduce 🟠 backend-blocked count from 4 to 2 by [date]"*

### Untuk Frontend Dev

1. Tambah marker `// @stub: <kategori> — <alasan>` di setiap baris dummy yang teridentifikasi (entry #1–#6)
2. Saat menambah dummy baru, **wajib** update tabel master di file ini
3. Saat menyelesaikan entry, **wajib** centang DoD checklist + ubah Status

### Untuk Backend Dev

1. Lihat entry 🟠 BACKEND-BLOCKED — itu daftar endpoint yang ditunggu frontend
2. Konfirmasi entry #8 (Vigi AI injection) — frontend perlu klarifikasi

---

## Versioning

| Versi | Tanggal | Perubahan | Author |
|---|---|---|---|
| v1.0 | 2026-05-08 | Initial audit dari problem-solving session + 7 Known Issues | Dr. Quinn (sesi BMAD) |
| v1.1 | _TBD_ | Review PO + update kategori entry TBD | _PO_ |

---

_Sumber sesi diagnosa: [`_bmad-output/problem-solution-2026-05-08.md`](../_bmad-output/problem-solution-2026-05-08.md)_
_Konvensi marker: `// @stub: <kategori> — <alasan>` (TBD adopsi via ESLint rule)_
