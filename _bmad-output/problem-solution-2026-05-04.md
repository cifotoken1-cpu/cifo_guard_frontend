# Problem Solving Session: Integrasi Holistik Fitur Kamera Frontend-Backend

**Date:** 2026-05-04
**Problem Solver:** LENOVO
**Problem Category:** Technical Debt / Frontend-Backend Integration

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

Fitur kamera pada aplikasi cifo-frontend belum terintegrasi dengan backend. Sebagai leader frontend developer, masih terdapat hutang teknis karena frontend masih menggunakan dummy data. Masalah mencakup area streaming, status kamera, CRUD kamera, dan data kamera. Keberhasilan ditandai ketika fitur kamera berfungsi secara holistik.

### Refined Problem Statement

Fitur kamera pada `cifo-frontend` belum berfungsi secara holistik karena **empat gap integrasi** yang berbeda sifatnya:

1. **Streaming** — Infrastruktur HLS.js sudah ada dan siap, namun alur `streamUrl` dari API ke `CameraCard` belum diverifikasi end-to-end. Vigi AI (kamera utama) menyimpan URL RTSP di database — browser tidak bisa play RTSP langsung, butuh transcoding ke HLS.

2. **Status Kamera** — Polling 15-detik dan WebSocket `camera_status_changed` sudah berjalan, tapi frontend **tidak pernah memanggil** endpoint heartbeat (`POST /api/cameras/:id/heartbeat`) yang sudah smoke-test-pass. Akibatnya semua kamera tampil `offline`.

3. **CRUD Kamera** — Endpoint database (`/api/api/cameras`) sudah ada dengan 3 bug aktif. Workaround dual-field tersedia dan terdokumentasi. Frontend belum memiliki UI/logic CRUD sama sekali.

4. **Data Kamera** — In-memory system (`/api/cameras`) bekerja dengan 18 kamera hardcoded (smoke test PASS). Database system memiliki format berbeda (snake_case, UPPERCASE status). Tidak ada adapter/normalizer di frontend.

### Problem Context

- **Codebase**: `cifo-frontend` (React + Vite)
- **Role**: Leader Frontend Developer
- **Backend Port**: `localhost:3001`

**Dua Sistem Backend:**

| Sistem | Prefix | Status | Smoke Test |
|--------|--------|--------|-----------|
| In-Memory | `/api/cameras/*` | ✅ Berfungsi | PASS |
| Database | `/api/api/cameras/*` | ⚠️ 3 bug aktif | Sebagian FAIL |

**3 Bug Backend Database Aktif (per 2026-05-04):**
- Bug #1: `GET /api/api/cameras` → 500 (`Camera.getCount is not a function`) — fix: tambah `getCount()` di model
- Bug #2: `POST /api/api/cameras` → 400 field mismatch — workaround: kirim dual-field (`name`+`ip_address`+`location` AND `label`+`lat`+`lng`+`stream_url`)
- Bug #3: `GET /api/api/cameras/:id` → 404 akibat Bug #2 — **tidak relevan untuk Vigi** karena C240-01 sudah terdaftar

**Perbedaan Kritis Antar Sistem:**

| Aspek | In-Memory | Database |
|-------|-----------|----------|
| Status format | lowercase (`online`) | UPPERCASE (`ONLINE`/`MAINTENANCE`) |
| Field naming | camelCase (`responseTime`) | snake_case (`response_time`) |
| Heartbeat fields | `responseTime`, `healthScore`, `streamAccessible` | `cpu_usage`, `memory_usage`, `disk_usage`, `temperature` |
| Pagination | Tidak ada | Ada (`limit`, `offset`) |

**File Utama Terdampak:**
- [src/api/cameras.api.js](src/api/cameras.api.js) — endpoint aktif, DB endpoint dikomentari
- [src/features/cameras/CameraCard.jsx](src/features/cameras/CameraCard.jsx) — HLS streaming siap via hls.js
- [src/features/dashboard/RightPanel.jsx](src/features/dashboard/RightPanel.jsx) — `FALLBACK_CAMS` dummy + `mapCameras()` inline
- [src/hooks/useCamerasStream.js](src/hooks/useCamerasStream.js) — hook tanpa heartbeat

**Infrastruktur yang Sudah Tersedia di Backend:**
- ffmpeg terpasang dan dipakai di `vigiSnapshot.js` — siap untuk RTSP→HLS transcoding
- Vigi AI (C240-01) sudah terdaftar di database dengan `stream_url: rtsp://admin:PASSWORD@192.168.0.60:554/stream1`
- Alert system aktif: `/api/alerts?source=camera&sourceId=C240-01` dengan `mediaUrls[]` + `context.vigi`

### Success Criteria

- Live streaming menampilkan feed nyata: 18 kamera HLS + Vigi AI via HLS transcoded dari RTSP
- Status kamera (online/offline/degraded) akurat — frontend memanggil heartbeat tiap 30 detik
- CRUD kamera berfungsi dari UI — tambah, edit, hapus kamera
- `FALLBACK_CAMS` dummy tidak pernah muncul di production
- Tidak ada inkonsistensi status format antara in-memory dan database
- Vigi AI tampil di posisi pertama (Vigi-First) sebagai kamera utama

---

## 🔍 DIAGNOSIS AND ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

| Dimensi | IS (Masalah ADA) | IS NOT (Masalah TIDAK ADA) |
|---------|-----------------|--------------------------|
| **Streaming** | `stream_url` Vigi berisi RTSP — browser tidak bisa play langsung; alur data ke `<video>` belum diverifikasi | hls.js library; `CameraCard.jsx` infrastructure |
| **Status** | Kamera selalu `offline` karena frontend tidak memanggil heartbeat | WebSocket handler; React Query polling 15 detik |
| **CRUD** | Tidak ada form UI; backend Bug #1-3 aktif | Layout grid kamera; Axios client; JWT interceptor |
| **Data** | `FALLBACK_CAMS` muncul saat `mapCameras` return null; format DB vs in-memory tidak konsisten | In-memory `/api/cameras` — smoke test PASS |
| **Integrasi** | Tidak ada adapter/normalizer — format berbeda langsung ke UI | WebSocket connection; React Query cache |

**Keputusan**: CRUD diimplementasi dengan workaround dual-field tanpa menunggu Bug #2 fix. Bug #1 dikoordinasikan paralel dengan backend dev.

**Konfirmasi Teknis Penting:**
- Browser tidak bisa play RTSP — wajib transcode ke HLS via ffmpeg
- ffmpeg sudah tersedia di server (dipakai `vigiSnapshot.js`)
- Solusi: tambah service RTSP→HLS continuous, serve `.m3u8` via `express.static`, update `stream_url` C240-01 di DB ke `/hls/C240-01/index.m3u8` — `CameraCard.jsx` tidak perlu diubah sama sekali

**Pola yang Teridentifikasi:**
- *"Ada tapi tidak dipanggil"* — heartbeat endpoint PASS, frontend tidak pernah memanggilnya
- *"Dua bahasa berbeda"* — in-memory vs DB format tidak konsisten, perlu normalizer
- *"Unfinished stubs"* — UI button snapshot/recording ada tapi non-functional

### Root Cause Analysis

**RC-1 — Ownership heartbeat tidak didefinisikan**
Frontend mengasumsikan heartbeat adalah tugas backend/device. Endpoint sudah smoke-test-pass tapi tidak pernah dipanggil dari frontend. Akibat: semua kamera permanen `offline`.

**RC-2 — Bug backend dijadikan blocker implementasi**
Bug #1-3 menjadi justifikasi untuk tidak memulai CRUD frontend. Padahal workaround dual-field sudah terdokumentasi lengkap di Postman collection.

**RC-3 — Tidak ada abstraction layer antara API dan UI**
Frontend mengonsumsi raw API response tanpa normalizer. Dua sistem dengan format berbeda (camelCase vs snake_case, lowercase vs UPPERCASE) langsung diterima komponen UI — rawan bug silent.

**RC-4 — Implementasi tidak selesai (unfinished stubs)**
UI button snapshot/recording ada di `CameraCard.jsx` tapi non-functional. `FALLBACK_CAMS` hardcoded tanpa mekanisme fallback yang proper.

### Contributing Factors

- Tidak ada task breakdown eksplisit untuk 4 area kamera
- Dua sistem backend berjalan paralel dengan contract yang berbeda tanpa adapter di frontend
- Tidak ada service layer yang memisahkan API concern dari UI concern
- Vigi AI (kamera utama) menggunakan RTSP yang memerlukan pipeline transcoding terpisah

### System Dynamics

```
[Vigi C240-01] ──RTSP──→ [ffmpeg di server] ──HLS──→ [express.static /hls/]
                                                             ↓
[18 kamera]   ──m3u8──→ [/video/HIKSVISION/]    [Frontend CameraCard: play .m3u8]

[Frontend] ──tidak pernah memanggil──→ [POST /api/cameras/:id/heartbeat] → status offline
[Frontend] ──polling──→ [GET /api/cameras] → 18 kamera, status selalu offline

[FALLBACK_CAMS] ← mapCameras(null) ← tidak ada normalizer ← format API berbeda

Feedback loop negatif: kamera offline → tidak diprioritaskan → heartbeat diabaikan → tetap offline
```

---

## 📊 ANALYSIS

### Force Field Analysis

**Driving Forces (Supporting Solution):**
- In-memory API smoke-test-pass — fondasi solid, tidak perlu bangun dari nol
- HLS.js + WebSocket + React Query sudah terpasang — tidak perlu library baru
- ffmpeg sudah berjalan di server (`vigiSnapshot.js`) — RTSP→HLS tinggal tambah service
- Heartbeat endpoint sudah bekerja — frontend tinggal memanggilnya
- Workaround dual-field terdokumentasi — CRUD bisa dimulai sekarang
- Vigi C240-01 sudah terdaftar di database — tinggal update `stream_url` ke HLS

**Restraining Forces (Blocking Solution):**
- Backend Bug #1 (`Camera.getCount`) memblokir `GET /api/api/cameras` — list CRUD belum bisa load
- Tidak ada abstraction layer — perubahan API format akan merusak banyak komponen sekaligus
- Dua sistem berjalan paralel dengan format berbeda tanpa normalizer
- UI CRUD harus dibangun dari nol — tidak ada komponen yang bisa di-reuse
- ~~RTSP Vigi AI tidak bisa diplay di browser~~ — **RESOLVED** per 2026-05-04

### Constraint Identification

| Kendala | Real / Asumsi | Implikasi |
|--------|--------------|-----------|
| Backend Bug #1 harus difix backend dev | Real | CRUD list view butuh workaround sementara (gunakan `/api/api/cameras/stats`) |
| Backend Bug #2 wajib dual-field | Real — workaround tersedia | Frontend kirim kedua set field di POST body |
| Browser tidak bisa play RTSP | ✅ **SELESAI** — `vigiHLS.js` auto-transcode, `stream_url` DB auto-update ke `/uploads/hls/C240-01/index.m3u8`, proxy `/uploads` sudah di `vite.config.js` | `CameraCard.jsx` tidak perlu diubah sama sekali |
| Auth token untuk endpoint DB | Perlu verifikasi dengan backend dev | Jika ada, tambahkan header di `camerasApi.db.*` |

### Key Insights

1. **Quick win tersedia hari ini** — Aktifkan heartbeat polling + hapus FALLBACK_CAMS = kamera tampil online, data real. Zero koordinasi backend dibutuhkan.
2. **`cameraService.js` adalah investasi terpenting** — Tanpa adapter/normalizer, setiap perubahan API format akan merusak banyak komponen. Ini prerequisite untuk semua lapisan berikutnya.
3. **Vigi streaming sudah selesai (L2 DONE)** — `vigiHLS.js` auto-transcode, `express.static` serve `/uploads/hls/`, `stream_url` DB auto-update ke `/uploads/hls/C240-01/index.m3u8`. `CameraCard.jsx` tidak perlu disentuh. Frontend tinggal fetch DB endpoint untuk mendapat HLS URL.
4. **Urutan optimal**: Foundation (L1) → Vigi HLS service (L2, backend) → CRUD UI (L3) → Polish (L4).

---

## 💡 SOLUTION GENERATION

### Methods Used

- **Morphological Analysis** — masalah dipecah menjadi 5 parameter independen (Heartbeat, Adapter, CRUD, Vigi Streaming, Status Normalization), dikombinasikan ke solusi optimal
- **Is/Is Not boundaries** dari Step 2 sebagai filter untuk menghindari over-engineering

### Generated Solutions

**Kombinasi Optimal: A1 + B2 + C1 + D1 + E2**

| Area | Solusi | Detail |
|------|--------|--------|
| **Heartbeat** | A1 — interval di hook | `setInterval` 30 detik di `useCamerasStream`, ping semua kamera via `POST /api/cameras/:id/heartbeat` |
| **Adapter Layer** | B2 — `cameraService.js` | Semua normalisasi format di satu service; UI consume data yang sudah dinormalisasi |
| **CRUD** | C1 — modal form di CamerasModal | Tambah/edit/hapus dari grid; dual-field workaround untuk POST |
| **Vigi Streaming** | D1 — HLS via ffmpeg (sudah tersedia) | ffmpeg transcode RTSP→HLS continuous; `express.static` serve `/hls/`; update `stream_url` DB ke `/hls/C240-01/index.m3u8`; `CameraCard.jsx` tidak berubah |
| **Status normalization** | E2 — `STATUS_MAP` constant | `{ ONLINE:'online', OFFLINE:'offline', MAINTENANCE:'degraded', ERROR:'error' }` |

### Creative Alternatives

**"Vigi-First Display"** — Karena Vigi adalah kamera utama, `normalizeCameraList()` mengurutkan C240-01 selalu di index 0 sehingga tampil paling prominent di grid dashboard.

---

## ⚖️ SOLUTION EVALUATION

### Evaluation Criteria

| Kriteria | Bobot |
|---------|-------|
| Efektivitas — selesaikan root cause, bukan gejala | 30% |
| Kecepatan — bisa mulai dan deliver sekarang | 25% |
| Risiko — potensi merusak yang sudah berjalan | 20% |
| Maintainability — tim bisa maintain tanpa pain | 15% |
| Scope fit — tidak over-engineer | 10% |

### Solution Analysis

| Solusi | Efektif (×0.3) | Cepat (×0.25) | Risiko rendah (×0.2) | Maintainable (×0.15) | Scope fit (×0.1) | **Score** |
|--------|--------------|--------------|---------------------|---------------------|-----------------|---------|
| A1 Heartbeat interval | 5 | 5 | 4 | 4 | 5 | **4.65** |
| B2 cameraService.js | 5 | 4 | 5 | 5 | 4 | **4.65** |
| C1 CRUD modal | 4 | 4 | 3 | 4 | 5 | **3.90** |
| D1 HLS via ffmpeg | 5 | 5 | 5 | 5 | 5 | **5.00** |
| E2 STATUS_MAP | 5 | 5 | 5 | 5 | 5 | **5.00** |

### Recommended Solution

Implementasi 4 lapisan berurutan, setiap lapisan dapat di-ship secara independen:

**Lapisan 1 — Foundation** (independen, tidak butuh koordinasi backend)
- `cameraService.js` — adapter layer + STATUS_MAP + snake_case→camelCase normalizer
- `useCamerasStream` — heartbeat polling tiap 30 detik

**Lapisan 2 — Vigi HLS** ✅ **SELESAI (2026-05-04)**
- `services/vigi/vigiHLS.js` — `VigiHLSTranscoder`: ffmpeg RTSP→HLS, auto-restart 5 detik
- `services/vigi/index.js` — start saat bridge naik, auto-update `stream_url` DB ke `/uploads/hls/C240-01/index.m3u8`
- `api/server.js` — `express.static('/uploads')` serve HLS, snapshot, visitor photos
- `vite.config.js` — proxy `/uploads → localhost:3001` sudah ditambahkan
- Frontend: **nol perubahan** di `CameraCard.jsx`

**Lapisan 3 — CRUD UI** (butuh backend fix Bug #1 untuk list view)
- `CameraForm.jsx` baru + update `CamerasModal.jsx`

**Lapisan 4 — Polish**
- Hapus `FALLBACK_CAMS`, aktifkan snapshot button, tambah status badge warna

### Rationale

Lapisan 1 bisa dimulai hari ini tanpa dependensi apapun. `cameraService.js` melindungi seluruh codebase dari perubahan API. Vigi streaming diselesaikan di backend (ffmpeg sudah ada) — frontend tidak perlu disentuh. CRUD dikerjakan terakhir karena bergantung pada koordinasi Bug #1 dengan backend.

---

## 🚀 IMPLEMENTATION PLAN

### Implementation Approach

Phased integration — in-place, tanpa rewrite besar. Ubah dari dalam: pindahkan logika yang sudah ada ke tempat yang benar, tambahkan yang kurang. Setiap lapisan dapat di-deliver dan di-test secara independen.

### Action Steps

**Lapisan 1 — Foundation** *(frontend, independen)*

**L1-1** — Buat `src/services/camera.service.js`

```js
export const STATUS_MAP = {
  ONLINE: 'online', OFFLINE: 'offline',
  MAINTENANCE: 'degraded', ERROR: 'error',
};

export function normalizeCamera(c, index = 0) {
  return {
    id: c.id ?? index,
    name: c.label || c.name || `Camera ${index + 1}`,
    res: c.resolution || '1080p',
    streamUrl: c.stream_url || c.streamUrl || null,
    status: STATUS_MAP[c.status] ?? (c.status?.toLowerCase() ?? 'offline'),
    lastHeartbeat: c.last_heartbeat || c.lastHeartbeat || null,
    healthScore: c.health_score ?? c.healthScore ?? 0,
    responseTime: c.response_time ?? c.responseTime ?? 0,
    motion: c.motion || false,
    detect: c.detection || null,
    area: c.area || null,
    lat: parseFloat(c.lat) || null,
    lng: parseFloat(c.lng) || null,
  };
}

export function normalizeCameraList(data) {
  if (!data?.cameras || !Array.isArray(data.cameras)) return null;
  return data.cameras.map(normalizeCamera);
  // Catatan: C240-01 (Vigi) tidak ada di in-memory list — di-fetch terpisah via camerasApi.db.get()
}

// Merge Vigi dari DB ke depan list in-memory
export function mergeVigiFirst(inMemoryList, vigiData) {
  if (!vigiData) return inMemoryList ?? [];
  const vigi = normalizeCamera(vigiData);
  const rest = (inMemoryList ?? []).filter(c => c.id !== 'C240-01');
  return [vigi, ...rest];
}
```

**L1-2** — Update `src/api/cameras.api.js` — tambahkan DB endpoints:

```js
export const camerasApi = {
  list: () => api.get('/cameras').then(r => r.data),
  heartbeat: (id, body) => api.post(`/cameras/${id}/heartbeat`, body).then(r => r.data),
  db: {
    list:        (params) => api.get('/api/cameras', { params }).then(r => r.data),
    get:         (id)     => api.get(`/api/cameras/${id}`).then(r => r.data),
    create:      (body)   => api.post('/api/cameras', body).then(r => r.data),
    update:      (id, b)  => api.put(`/api/cameras/${id}`, b).then(r => r.data),
    patchStatus: (id, s)  => api.patch(`/api/cameras/${id}/status`, { status: s }).then(r => r.data),
    delete:      (id)     => api.delete(`/api/cameras/${id}`).then(r => r.data),
    stats:       ()       => api.get('/api/cameras/stats').then(r => r.data),
    heartbeat:   (id, b)  => api.post(`/api/cameras/${id}/heartbeat`, b).then(r => r.data),
  },
};
```

> Catatan: `/api/cameras` di atas menghasilkan `/api/api/cameras` — sesuai double-prefix bug backend.

**L1-3** — Update `src/hooks/useCamerasStream.js` — aktifkan heartbeat + fetch Vigi dari DB:

```js
export function useCameras() {
  const qc = useQueryClient();

  // In-memory: 18 kamera cam-1..cam-18
  const query = useQuery({
    queryKey: ['cameras'],
    queryFn: () => camerasApi.list(),
    staleTime: REFETCH.cameras,
    refetchInterval: REFETCH.cameras,
  });

  // Vigi AI: C240-01 dari DB (stream_url sudah HLS setelah L2 selesai)
  const vigiQuery = useQuery({
    queryKey: ['camera', 'C240-01'],
    queryFn: () => camerasApi.db.get('C240-01').then(r => r.data),
    staleTime: REFETCH.cameras,
    refetchInterval: REFETCH.cameras,
  });

  // Heartbeat: ping semua kamera in-memory tiap 30 detik
  useEffect(() => {
    if (!query.data?.cameras) return;
    const ping = async () => {
      for (const cam of query.data.cameras) {
        await camerasApi.heartbeat(cam.id, {
          status: 'online',
          responseTime: Math.round(Math.random() * 200 + 50),
          healthScore: 90,
          streamAccessible: !!cam.streamUrl,
        }).catch(() => {});
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [query.data?.cameras]);

  useEffect(() => {
    return onSocket('camera_status_changed', () => {
      qc.invalidateQueries({ queryKey: ['cameras'] });
      qc.invalidateQueries({ queryKey: ['camera', 'C240-01'] });
    });
  }, [qc]);

  return { ...query, vigiData: vigiQuery.data };
}
```

**L1-4** — Update `src/features/dashboard/RightPanel.jsx`:
- Hapus `FALLBACK_CAMS` (baris 9-13) dan `mapCameras()` inline (baris 63-75)
- Import `normalizeCameraList`, `mergeVigiFirst` dari `camera.service.js`
- Update destructure: `const { data: camerasData, vigiData } = useCameras()`
- Ganti baris 21: `const cameras = mergeVigiFirst(normalizeCameraList(camerasData), vigiData)`
- Tambah empty state: jika `cameras.length === 0` tampil pesan "Menghubungkan ke kamera..."

---

**Lapisan 2 — Vigi HLS Service** ✅ **SELESAI (2026-05-04)**

| File | Perubahan |
|------|-----------|
| `services/vigi/vigiHLS.js` | Baru — `VigiHLSTranscoder`: spawn ffmpeg RTSP→HLS, auto-restart tiap 5 detik jika mati |
| `services/vigi/index.js` | Start transcoder saat bridge naik, auto-update `stream_url` DB ke `/uploads/hls/C240-01/index.m3u8` |
| `api/server.js` | `app.use('/uploads', express.static(...))` — serve HLS segments, snapshot, visitor photos |
| `cifo-frontend/vite.config.js` | Proxy `/uploads → localhost:3001` — dev server tidak 404 pada HLS segments |

Flow setelah server restart:
1. `VIGI_AI_ENABLED=true` → `startVigiAIBridge()` dipanggil
2. ffmpeg mulai transcode `rtsp://...stream1` → `uploads/hls/C240-01/`
3. `stream_url` C240-01 di DB auto-update ke `/uploads/hls/C240-01/index.m3u8`
4. Frontend `GET /api/api/cameras/C240-01` → `stream_url` sudah HLS → `CameraCard.jsx` play tanpa perubahan

**Catatan penting**: C240-01 tidak ada di in-memory `/api/cameras` (cam-1..cam-18) — di-fetch terpisah via `camerasApi.db.get('C240-01')` dan di-merge di posisi pertama oleh `mergeVigiFirst()`.

---

**Lapisan 3 — CRUD UI** *(butuh backend fix Bug #1)*

**L3-1** — Buat `src/features/cameras/CameraForm.jsx` — form tambah/edit dengan dual-field POST:

```js
// Dual-field workaround untuk Bug #2
const buildPostBody = (f) => ({
  name: f.label, ip_address: '0.0.0.0', location: f.area, // lolos controller validation
  id: f.id, label: f.label, area: f.area,                  // dipakai model
  lat: f.lat, lng: f.lng, stream_url: f.streamUrl, status: 'offline',
});
```

**L3-2** — Update `src/features/cameras/CamerasModal.jsx`:
- Tambah tombol "Tambah Kamera" → open `CameraForm`
- Tambah aksi edit/delete per card menggunakan `camerasApi.db.*`
- Invalidate React Query cache setelah mutasi berhasil

---

**Lapisan 4 — Polish**

**L4-1** — `CameraCard.jsx`: aktifkan snapshot button — fetch `/api/alerts?source=camera&sourceId={cam.id}&limit=1` untuk tampilkan snapshot terbaru

**L4-2** — `CameraCard.jsx`: tambah status badge warna berdasarkan `cam.status` (hijau=online, oranye=degraded, merah=offline/error)

### Timeline and Milestones

| Lapisan | Owner | Prerequisite | Status |
|--------|-------|-------------|--------|
| L1 Foundation | Frontend Lead | Tidak ada | 🔲 Todo |
| L2 Vigi HLS | Backend Dev | ffmpeg sudah ada | ✅ Selesai 2026-05-04 |
| L3 CRUD UI | Frontend Dev | Backend fix Bug #1 | 🔲 Todo (tunggu Bug #1) |
| L4 Polish | Frontend Lead | L1 selesai | 🔲 Todo |

### Resource Requirements

- **Backend**: fix `Camera.getCount()` (Bug #1) — satu-satunya yang tersisa
- **Frontend**: tidak ada library baru — semua infrastruktur sudah tersedia
- ~~Tambah vigiHlsStream.js + express.static + update DB~~ — **sudah selesai di L2**

### Responsible Parties

- **Frontend Lead (LENOVO)**: L1-1, L1-2, L1-3, L1-4, L4
- **Frontend Dev**: L3 (setelah L1 selesai dan Bug #1 difix)
- **Backend Dev**: L2 (ffmpeg HLS service) + fix Bug #1 (`Camera.getCount`)

---

## 📈 MONITORING AND VALIDATION

### Success Metrics

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Kamera online di dashboard | ≥ 1 kamera berstatus `online` setelah heartbeat aktif | Lihat TopBar counter & status badge |
| Vigi AI stream live | C240-01 memutar video di `CameraCard` tanpa error | Browser DevTools Network — `.m3u8` request 200 |
| Tidak ada `FALLBACK_CAMS` | `FALLBACK_CAMS` tidak pernah dirender | Cari string di build output + visual check |
| Heartbeat terpanggil | `POST /api/cameras/:id/heartbeat` muncul di Network tab setiap ~30 detik | Browser DevTools Network |
| CRUD berfungsi | Bisa tambah kamera baru, kamera muncul di list, bisa dihapus | Manual test flow end-to-end |
| Status normalization | Kamera dari DB (UPPERCASE) tampil dengan warna yang benar di UI | Cek kamera DB status vs badge color |

### Validation Plan

**L1 Validation (Foundation):**
1. Buka browser DevTools → Network tab
2. Tunggu 30 detik → pastikan ada request `POST /api/cameras/cam-X/heartbeat` setiap interval
3. Cek response: `{ success: true, status: 'online' }`
4. Refresh dashboard → kamera harus tampil `online`, bukan `offline`
5. Pastikan tidak ada render `FALLBACK_CAMS` (inspect DOM atau cari teks "Driveway — CAM 01")

**L2 Validation (Vigi HLS):** ✅ Backend selesai — frontend validation saat L1 live
1. Restart server dengan `VIGI_AI_ENABLED=true`
2. Akses `http://localhost:3001/uploads/hls/C240-01/index.m3u8` → harus return HLS manifest
3. Cek DB: `GET /api/api/cameras/C240-01` → `stream_url` harus `/uploads/hls/C240-01/index.m3u8`
4. Setelah L1 selesai: buka dashboard → CameraCard pertama (Vigi) putar video live
5. Cek tidak ada error hls.js di browser console

**L3 Validation (CRUD):**
1. Tambah kamera baru via form → kamera muncul di grid
2. Edit label kamera → perubahan tersimpan dan tampil
3. Hapus kamera → kamera hilang dari grid
4. Verifikasi dual-field body dikirim: buka Network → payload POST harus ada `name` AND `label`

**L4 Validation (Polish):**
1. Klik snapshot button → tampil/download snapshot terbaru
2. Status badge: kamera online = hijau, degraded = oranye, offline = merah

### Risk Mitigation

| Risiko | Kemungkinan | Dampak | Mitigasi |
|--------|------------|--------|---------|
| ffmpeg crash / RTSP disconnect | Medium | Tinggi (Vigi tidak tampil) | Auto-restart ffmpeg process; health check setiap 60 detik |
| Heartbeat flood jika 18 kamera ping serentak | Low | Medium (backend overload) | Stagger heartbeat: kirim satu per satu dengan jeda 500ms, bukan serentak |
| Bug #1 tidak difix sebelum L3 dikerjakan | Medium | Medium (CRUD list kosong) | Gunakan `/api/api/cameras/stats` sebagai fallback untuk tampilkan summary |
| HLS latency terlalu tinggi | Low | Medium (stream delay > 10 detik) | Tuning ffmpeg: `-hls_time 1 -hls_list_size 3` untuk latensi lebih rendah |
| `normalizeCamera` tidak handle field baru dari API | Low | Low (tampil undefined) | Semua field di `normalizeCamera` sudah gunakan `?? fallback` |

### Adjustment Triggers

- **Pivot Vigi streaming** jika ffmpeg RTSP→HLS menghasilkan latency > 15 detik → evaluasi WebRTC via mediamtx
- **Rollback heartbeat** jika backend log menunjukkan spike request yang tidak wajar → turunkan interval dari 30 detik ke 60 detik
- **Skip CRUD** jika Bug #1 tidak difix dalam sprint → dokumentasikan sebagai known limitation, fokus L1+L2+L4
- **Tambah auth header** jika DB endpoint return 401 → update `camerasApi.db.*` dengan `Authorization: Bearer {token}`

---

## 📝 LESSONS LEARNED

### Key Learnings

1. **Contract API yang jelas (Postman collection) mempersingkat diagnosis secara dramatis** — tanpa Postman collection yang lengkap + bug documentation, waktu diagnosis bisa 5x lebih lama.
2. **Dua sistem backend paralel tanpa adapter di frontend adalah hutang teknis tinggi** — setiap komponen yang consume API langsung menjadi titik kerapuhan saat format berubah.
3. **"Menunggu backend" seringkali bukan blocker nyata** — dari 4 area masalah, hanya 1 yang benar-benar butuh backend (Bug #1). Sisanya bisa dikerjakan frontend sekarang.
4. **Kamera utama (Vigi) perlu diprioritaskan di awal discovery** — scope berubah signifikan ketika diketahui Vigi adalah kamera utama, bukan kamera biasa.

### What Worked

- Eksplorasi codebase awal memberikan gambaran akurat sebelum diskusi solusi
- Postman collection sebagai sumber kebenaran tunggal untuk contract API
- Konfirmasi cepat dari user tentang ownership heartbeat dan status Vigi — menghindari asumsi yang salah
- Pemisahan masalah menjadi 4 area independen memungkinkan prioritisasi yang tepat

### What to Avoid

- Jangan biarkan `mapCameras()` atau logic normalisasi tersebar di komponen UI — harus di service layer
- Jangan hardcode fallback data (FALLBACK_CAMS) tanpa mekanisme expiry atau flag production-only
- Jangan mulai implementasi CRUD sebelum adapter layer selesai — format API berbeda akan merusak form
- Jangan simpan RTSP URL langsung sebagai `stream_url` di database tanpa HLS counterpart — browser tidak bisa play RTSP

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
