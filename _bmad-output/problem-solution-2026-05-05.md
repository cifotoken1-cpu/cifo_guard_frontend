# Problem Solving Session: Implementasi Halaman Monitoring Panic Alert & Incident Response Dashboard CIFO

**Date:** 2026-05-05
**Problem Solver:** LENOVO
**Problem Category:** Frontend Feature Planning / API Integration

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

Fitur Alert Panic dan Respons Insiden sudah diimplementasikan di backend, namun belum ada halaman/view dedicated di frontend dashboard untuk memantau keduanya. Tim design sudah membuat 3 mockup HTML yang menjadi acuan visual. Developer frontend perlu rencana yang jelas sebelum mulai mengimplementasikan.

### Refined Problem Statement

Dashboard frontend CIFO belum memiliki tiga halaman yang sudah didesain oleh tim:

1. **Panic Alerts** (`Panic Alerts.html`) — monitoring real-time panic button dari pengguna + broadcast ke responder
2. **Incident Response** (`Incident Response.html`) — Kanban tracking siklus hidup insiden keamanan
3. **Interactive Map** (`Interactive Map.html`) — peta perumahan dengan pin lokasi insiden, panic, dan kamera

Tanpa perencanaan yang matang, developer berisiko:
- Terkoneksi ke WebSocket yang salah (backend menggunakan DUA WebSocket berbeda)
- Menggunakan endpoint yang diketahui buggy (notes, escalate, timeline, radius, stats)
- Salah format koordinat GPS antara Incident (`latitude/longitude`) dan Alert (`lat/lng`)
- Merender field yang tidak ada di backend (deviceId, battery, phone tidak ada di model Alert)
- Membuat struktur komponen yang tidak sesuai dengan layout mockup

### Problem Context

**Stack Frontend (yang sudah ada):**
- React 18 + React Router v6 (SPA — semua route render DashboardPage)
- Zustand v4 (3 stores: auth, system, ui) — semua persisted ke localStorage
- React Query v5 untuk server state + caching
- Socket.io-client — HANYA Socket.io, **belum ada native WebSocket**
- Axios dengan JWT interceptor
- Design system cyberpunk (CSS variables, tema gelap, animasi SVG) — **mockup menggunakan design system yang sama**
- Fitur berjalan: AlertsModal, CameraCard HLS, PanicConfirmModal (kirim), ToastStack

**Kondisi Backend (dari dokumen deep-dive):**

| Endpoint | Status | Catatan |
|----------|--------|---------|
| `GET /api/incidents` | ✅ Berfungsi | Support filter: status, priority, type, limit, offset |
| `GET /api/incidents/:id` | ✅ Berfungsi | Include activities (bukan via timeline endpoint) |
| `PUT /api/incidents/:id` | ✅ Berfungsi | Update status, priority, assignedTo |
| `GET /api/alerts` | ✅ Berfungsi | Filter: type, severity, status, isEmergency, source, category |
| `GET /api/alerts/:id` | ✅ Berfungsi | Include AlertRecipient records |
| `PATCH /api/alerts/:id/acknowledge` | ✅ Berfungsi | |
| `PATCH /api/alerts/:id/resolve` | ✅ Berfungsi | |
| `POST /api/incidents/:id/notes` | ❌ BUGGY | Field `notes` di-comment di model Sequelize |
| `POST /api/incidents/:id/escalate` | ❌ BUGGY | Field escalation di-comment di model |
| `GET /api/incidents/:id/timeline` | ❌ BUGGY | Sequelize include ke raw MySQL model → error |
| `GET /api/incidents/stats/dashboard` | ⚠️ Berisiko | Route order bug — mungkin di-match ke `/:id` |
| `GET /api/alerts/radius` | ❌ CRASH | PostGIS syntax di MySQL |
| `GET /api/alerts/stats` | ❌ CRASH | `::float` syntax PostgreSQL |
| `GET /api/alerts?search=...` | ❌ CRASH | `Op.iLike` tidak ada di MySQL |

**WebSocket Backend:**

| Service | Library | Path | Digunakan untuk | Events |
|---------|---------|------|-----------------|--------|
| WebSocketService.js | Socket.io | `/socket.io` | Incident events | `incident_created`, `incident_updated`, `incident_assigned`, `incident_escalated`, `high_priority_incident` |
| websocket-service.js | ws (legacy) | `/` (default ws) | Alert events | `ALERT_CREATED`, `ALERT_UPDATED` |

**Frontend saat ini hanya punya Socket.io. Alert events (panic + CCTV) tidak akan diterima.**

### Success Criteria

1. Developer memiliki dokumen rencana yang mereferensi mockup secara eksplisit
2. Struktur komponen per halaman sudah terdefinisi sesuai layout mockup
3. Setiap elemen UI mockup sudah dipetakan ke data backend yang real vs yang perlu diadaptasi
4. Navigasi Sidebar sudah direncanakan (3 nav item baru)
5. WebSocket dual-connection plan sudah jelas
6. Endpoint yang boleh dan tidak boleh dipakai sudah terdokumentasi per halaman
7. Edge cases (GPS null, field tidak ada di model, endpoint buggy) sudah direncanakan penanganannya

---

## 🔍 DIAGNOSIS DAN ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

**Masalah ADA di:**
- Tidak ada implementasi 3 halaman yang sudah didesain tim (`Panic Alerts`, `Incident Response`, `Interactive Map`)
- Frontend hanya punya Socket.io; alert events dari panic/CCTV dikirim via `ws` legacy → tidak diterima
- Tidak ada API module untuk incidents di frontend
- Model Alert backend tidak memiliki field `deviceId`, `battery`, `phone` yang ada di mockup Panic Alerts → perlu adaptasi
- Field timeline dan notes di mockup Incident Response punya backend buggy → perlu workaround
- Tidak ada `/features/incidents/` folder

**Masalah TIDAK ADA di:**
- Backend API (sudah siap untuk endpoint yang tidak buggy)
- Design system (mockup menggunakan CSS variables yang sama dengan dashboard)
- Infrastruktur dasar (React Query, Zustand, Socket.io sudah jalan)
- Navigasi Sidebar (sudah ada, tinggal tambah 3 item)

### Root Cause Analysis

**Akar masalah:**
Gap antara desain UI (mockup sudah selesai) dan implementasi (belum dimulai), tanpa handoff plan yang memetakan setiap elemen mockup ke kontrak API backend.

**Penyebab turunan:**
1. Backend menggunakan 2 WebSocket berbeda — technical debt yang menciptakan kompleksitas integrasi
2. Beberapa field di mockup (battery, phone, deviceId) tidak ada di model Alert backend — mockup dibuat sebelum backend API finalized
3. Beberapa field di model backend di-comment — endpoint buggy yang terlihat ada tapi tidak bisa dipakai
4. Timeline insiden di mockup menggunakan data statis — perlu fallback ke activities array

### Contributing Factors

- Mockup menggunakan data statis (hardcoded) → developer perlu mapping ke API response yang sebenarnya
- GPS format berbeda antara Incident (`latitude/longitude`) dan Alert (`lat/lng`) → mudah tertukar
- `panic_alerts` table (diisi AI pipeline) tidak punya API → frontend tidak bisa query langsung, gunakan `alerts` table dengan filter `source=camera`
- Interactive Map mockup menggunakan SVG dengan koordinat piksel hardcoded → untuk data real, perlu normalisasi koordinat GPS ke koordinat SVG viewport

### System Dynamics

```
[Jalur 1 — Panic Button]
Pengguna Mobile → POST /api/panic → Alert.create() (category=PANIC_BUTTON)
                                  → ws broadcast: ALERT_CREATED
                                  → Frontend: native ws listener → invalidate ['alerts','panic']
                                  → Panic Alerts page: list ter-update + toast merah

[Jalur 2 — CCTV AI]
Kamera VIGI → AI Pipeline → Alert.create() (source=camera, severity=HIGH/CRITICAL)
                          → ws broadcast: ALERT_CREATED
                          → Frontend: native ws listener → invalidate ['alerts','cctv']
                          → (Tidak ada halaman CCTV terpisah — panic alert page fokus ke panic_button)
                          → Interactive Map: pin baru muncul di peta

[Jalur 3 — Incident]
Security Officer → Frontend Incident Response page → POST/PUT /api/incidents
                                                   → Socket.io: incident_created / incident_updated
                                                   → Kanban board ter-update real-time
```

---

## 📊 ANALISIS

### Force Field Analysis

**Driving Forces (Mendukung Solusi):**
- Mockup sudah selesai — developer tidak perlu mendesain UI dari nol, hanya implement
- Design system sudah ada dan konsisten dengan mockup (CSS variables sama)
- Backend API sudah terdokumentasi dengan detail (field, format, bug-nya sekalian)
- Stack teknis sudah solid (React Query, Zustand, Socket.io, uuid semuanya sudah terinstall)
- Pattern komponen sudah ada (AlertsModal, CameraCard, ToastStack bisa jadi referensi)
- Navigasi SPA berbasis `activeNav` Zustand — tinggal tambah 3 nilai baru

**Restraining Forces (Menghalangi Solusi):**
- Frontend perlu tambah native WebSocket (`ws`) tanpa ganggu Socket.io yang sudah jalan
- Beberapa elemen mockup (battery, phone, AI confidence untuk panic) tidak ada di backend → perlu adaptasi atau dihilangkan di implementasi
- Timeline insiden (mockup Incident Response) menggunakan endpoint buggy → harus pakai activities array sebagai fallback
- Notes textarea di mockup Incident Response menggunakan endpoint buggy → harus disabled/read-only
- Interactive Map menggunakan koordinat piksel SVG hardcoded → perlu sistem normalisasi untuk data real

### Constraint Identification

**Constraint utama:** Native WebSocket harus ditambah TANPA merusak Socket.io

**Constraint lain:**
- Endpoint buggy tidak boleh dipanggil (crash silent atau crash dengan error)
- GPS format: Alert pakai `location.lat/lng`, Incident pakai `location.latitude/longitude`
- Field yang tidak ada di model harus punya fallback UI (bukan crash)
- Navigasi baru harus ikuti pola `activeNav` yang sudah ada

### Key Insights

1. **Insight kritis — WebSocket:** Frontend perlu native WebSocket TERPISAH dari Socket.io. Tanpa ini, semua alert events (panic + CCTV) tidak akan diterima real-time.

2. **Insight mockup vs backend — Panic Alerts:** Field `deviceId`, `battery`, `phone` yang ada di mockup tidak ada di model Alert backend. Untuk MVP: hilangkan atau tampilkan dari `metadata` jika tersedia. Field yang tersedia: `alertId`, `status`, `createdAt`, `location.lat/lng`, `userId` (via sourceId atau context).

3. **Insight mockup vs backend — Incident Timeline:** Mockup menampilkan timeline investigasi yang detail. Backend endpoint timeline BUGGY. Solusi: gunakan `activities` array dari `GET /api/incidents/:id` sebagai sumber data timeline.

4. **Insight mockup vs backend — Incident Notes:** Mockup punya textarea untuk notes. Backend endpoint notes BUGGY. Solusi: tampilkan textarea sebagai disabled dengan tooltip "Fitur sedang dalam maintenance".

5. **Insight navigasi:** 3 mockup = 3 nav item baru di Sidebar. Ikuti pola `activeNav` yang ada.

6. **Insight Interactive Map:** Peta SVG di mockup menggunakan koordinat piksel hardcoded (layout perumahan). Untuk MVP: render pin incident/panic dari koordinat GPS nyata dengan normalisasi sederhana ke viewport SVG. Guards, visitors, geofence tetap sebagai data statis/mockup sampai backend menyediakan API.

---

## 💡 SOLUTION GENERATION

### Methods Used

- **Morphological Analysis** — memetakan setiap komponen mockup ke data backend, layer demi layer
- **Assumption Busting** — identifikasi asumsi tersembunyi: "semua field di mockup ada di backend" → tidak, perlu adaptasi
- **PDCA Cycle** — urutan implementasi iteratif: WebSocket → API → Hooks → Components per halaman → Navigasi

### Generated Solutions

**Opsi yang dikonfirmasi berdasarkan mockup:**

Karena mockup sudah mendefinisikan 3 halaman terpisah dengan layout spesifik (bukan 1 combined view), solusi yang tepat adalah:
- **3 nav item baru di Sidebar** → masing-masing menampilkan view fullscreen di area CenterPanel
- Mengikuti pola `activeNav` Zustand yang sudah ada
- Tidak perlu route React Router baru — cukup switch content di CenterPanel berdasarkan `activeNav`

---

## ⚖️ EVALUASI SOLUSI

### Evaluation Criteria

| Kriteria | Bobot |
|---------|-------|
| Fidelitas terhadap mockup | Sangat Tinggi |
| Konsistensi dengan pola SPA yang ada | Tinggi |
| Field yang real vs field yang perlu adaptasi | Tinggi |
| Tidak merusak fitur yang sudah ada | Tinggi |

### Recommended Solution

**3 view terpisah via `activeNav`:** Tambah 3 nav item di Sidebar (`activeNav = 'panic' | 'incidents' | 'map'`). CenterPanel switch ke view yang sesuai. Masing-masing view mengikuti layout 3-column atau 2-column dari mockup secara ketat.

### Rationale

- Mockup sudah menjawab pertanyaan "bagaimana UI-nya" — tinggal implement
- Pola activeNav Zustand tidak perlu diubah arsitekturnya
- Tidak perlu routing baru di App.jsx
- Design system yang sama memastikan konsistensi visual

---

## 🚀 IMPLEMENTATION PLAN

### Mockup Reference

| File | activeNav value | Layout | Komponen Utama |
|------|----------------|--------|----------------|
| `Panic Alerts.html` | `'panic'` | 3-col: `340px 1fr 360px` | PanicAlertList + PanicAlertDetail + BroadcastPanel |
| `Incident Response.html` | `'incidents'` | Stats bar + 2-col: `1fr 420px` | IncidentStats + KanbanBoard + IncidentDetailPane |
| `Interactive Map.html` | `'map'` | 3-col: `280px 1fr 320px` | LayerControl + MapCanvas + MapInfoPane |

---

### LAYER 0 — Native WebSocket (BLOCKER — kerjakan pertama)

**File baru: `/src/api/ws.js`**

```javascript
// Setup koneksi native WebSocket terpisah dari Socket.io
// Digunakan untuk menerima ALERT_CREATED dan ALERT_UPDATED dari websocket-service.js (ws legacy)
// JANGAN digabung ke socket.js (itu Socket.io, berbeda protokol/server)

let ws = null;
const handlers = new Set();

export function connectWs() {
  const url = (import.meta.env.VITE_WS_URL || window.location.origin)
    .replace(/^http/, 'ws');
  ws = new WebSocket(url);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handlers.forEach(h => h(msg));
  };
  ws.onclose = () => setTimeout(connectWs, 3000); // auto-reconnect
}

export function disconnectWs() { ws?.close(); }

export function onWsMessage(handler) {
  handlers.add(handler);
  return () => handlers.delete(handler); // returns unsubscribe fn
}
```

**Update: `/src/App.jsx`**
```javascript
// Tambah di sebelah connectSocket() yang sudah ada
import { connectWs, disconnectWs } from './api/ws';

useEffect(() => {
  connectSocket();
  connectWs();       // ← tambahkan ini
  return () => {
    disconnectSocket();
    disconnectWs();  // ← dan ini
  };
}, []);
```

---

### LAYER 1 — API Modules

**File baru: `/src/api/incidents.api.js`**

```javascript
import { apiClient } from './client';

export const incidentsApi = {
  // ✅ Gunakan untuk Kanban board — filter per status
  list: (params) => apiClient.get('/incidents', { params }),
    // params yang valid: status, priority, type, assignedTo, reportedBy, limit, offset
    // Contoh: { status: 'OPEN', limit: 50 }

  // ✅ Gunakan untuk detail insiden — gunakan activities[] bukan timeline endpoint
  detail: (id) => apiClient.get(`/incidents/${id}`),
    // Response include: activities[], reporter, assignedMember

  // ✅ Gunakan untuk update status dari Kanban (drag) atau tombol "Tandai Selesai"
  updateStatus: (id, body) => apiClient.put(`/incidents/${id}`, body),
    // body: { status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }

  // ❌ JANGAN IMPLEMENTASIKAN — endpoint berikut BUGGY:
  // addNote: (id, body) => ...      // POST /incidents/:id/notes — field notes di-comment
  // escalate: (id, body) => ...     // POST /incidents/:id/escalate — field escalation di-comment
  // getTimeline: (id) => ...        // GET /incidents/:id/timeline — Sequelize include error
  // getDashboardStats: () => ...    // GET /incidents/stats/dashboard — route order bug risk
};
```

**Update: `/src/api/alerts.api.js`** — tambah method baru, JANGAN hapus yang lama:

```javascript
// Tambahkan di bawah method yang sudah ada:

// ✅ Untuk Panic Alerts page
listPanic: (params = {}) => apiClient.get('/alerts', {
  params: { category: 'PANIC_BUTTON', sortBy: 'created_at', sortOrder: 'DESC', ...params }
}),

// ✅ Untuk pin CCTV alert di Interactive Map
listCCTV: (params = {}) => apiClient.get('/alerts', {
  params: { source: 'camera', sortBy: 'created_at', sortOrder: 'DESC', ...params }
}),

// ✅ Detail alert — include AlertRecipient records (untuk broadcast panel)
detail: (id) => apiClient.get(`/alerts/${id}`),

// ❌ JANGAN IMPLEMENTASIKAN:
// getByRadius: ...   // GET /alerts/radius — PostGIS crash
// getStats: ...      // GET /alerts/stats — ::float PostgreSQL crash
// search: ...        // GET /alerts?search= — Op.iLike crash
```

---

### LAYER 2 — Hooks

**File baru: `/src/hooks/usePanicAlerts.js`**

```javascript
// Query untuk list panic alerts + real-time update via native WebSocket
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { alertsApi } from '../api/alerts.api';
import { onWsMessage } from '../api/ws';

export function usePanicAlerts(params = {}) {
  const qc = useQueryClient();

  // Invalidate saat ws menerima ALERT_CREATED dengan category=PANIC_BUTTON
  useEffect(() => {
    return onWsMessage((msg) => {
      if (msg.type === 'ALERT_CREATED' && msg.data?.category === 'PANIC_BUTTON') {
        qc.invalidateQueries({ queryKey: ['alerts', 'panic'] });
        // Tambah toast merah via useUIStore().addToast()
      }
      if (msg.type === 'ALERT_UPDATED' && msg.data?.category === 'PANIC_BUTTON') {
        qc.invalidateQueries({ queryKey: ['alerts', 'panic'] });
      }
    });
  }, [qc]);

  return useQuery({
    queryKey: ['alerts', 'panic', params],
    queryFn: () => alertsApi.listPanic(params),
    staleTime: 10_000,
  });
}

export function usePanicAlertDetail(id) {
  return useQuery({
    queryKey: ['alerts', 'panic', 'detail', id],
    queryFn: () => alertsApi.detail(id),
    enabled: !!id,
  });
}
```

**File baru: `/src/hooks/useIncidents.js`**

```javascript
// Query untuk Kanban board + real-time via Socket.io
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { incidentsApi } from '../api/incidents.api';
import { onSocket } from '../api/socket';

export function useIncidents(params = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = onSocket(['incident_created', 'incident_updated', 'incident_assigned'], () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    });
    return unsub;
  }, [qc]);

  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => incidentsApi.list(params),
    staleTime: 15_000,
  });
}

export function useIncidentDetail(id) {
  return useQuery({
    queryKey: ['incidents', 'detail', id],
    queryFn: () => incidentsApi.detail(id),
    enabled: !!id,
  });
}
```

**File baru: `/src/hooks/useMapPins.js`**

```javascript
// Agregasi pins untuk Interactive Map dari incidents + alerts
export function useMapPins() {
  const { data: incidents } = useIncidents({ limit: 100, status: 'OPEN,IN_PROGRESS' });
  const { data: panicAlerts } = usePanicAlerts({ status: 'ACTIVE,ACKNOWLEDGED', limit: 50 });
  const { data: cameras } = useCameras(); // sudah ada

  return {
    incidentPins: (incidents?.data || [])
      .filter(i => i.location?.latitude && i.location?.longitude)
      .map(i => ({ id: i.id, type: 'incident', name: i.title, sub: i.incidentNumber,
        x: normalizeLng(i.location.longitude), y: normalizeLat(i.location.latitude),
        color: priorityColor(i.priority) })),

    panicPins: (panicAlerts?.alerts || [])
      .filter(a => a.location?.lat && a.location?.lng)
      .map(a => ({ id: a.id, type: 'panic', name: a.title || 'Panic Alert', sub: a.alertId,
        x: normalizeLng(a.location.lng), y: normalizeLat(a.location.lat),
        color: 'var(--red)' })),

    cameraPins: (cameras || [])
      .map(c => ({ id: c.id, type: 'cctv', name: c.name, sub: `${c.resolution || '1080p'} · ${c.status}`,
        x: normalizeLng(c.longitude), y: normalizeLat(c.latitude),
        color: 'var(--cyan)' })),
  };
}

// Normalisasi koordinat GPS → koordinat SVG viewport (1200x700)
// Batas perumahan perlu dikonfirmasi dengan tim (lat/lng min-max)
function normalizeLat(lat) { /* map lat ke 60–640 */ }
function normalizeLng(lng) { /* map lng ke 60–1140 */ }
```

---

### LAYER 3 — Components per Halaman

---

#### HALAMAN 1: Panic Alerts (`Panic Alerts.html`)

**Folder baru: `/src/features/panic-monitor/`**

```
panic-monitor/
  PanicMonitorView.jsx       ← view utama, grid 3-col: 340px 1fr 360px
  PanicAlertList.jsx         ← kolom kiri: daftar alert dengan status badge
  PanicAlertDetail.jsx       ← kolom tengah: detail + AI block + GPS mini-map + audio
  PanicBroadcastPanel.jsx    ← kolom kanan: daftar recipients + action buttons
  panic-monitor.module.css   ← CSS dari Panic Alerts.html (copy + adapt ke module)
```

**Elemen yang DITAMPILKAN (ada di backend):**

| Elemen | Field Backend |
|--------|---------------|
| Alert ID | `alert.alertId` — format `YYYYMMDD-NNNN` atau requestId |
| Nama / judul | `alert.title` — jika null, fallback ke `alert.alertId` |
| Lokasi | `alert.location?.address \|\| alert.location?.zone \|\| alert.location?.building \|\| 'Lokasi tidak tersedia'` |
| Status badge | `alert.status`: ACTIVE→AKTIF, ACKNOWLEDGED→INVESTIGASI, RESOLVED→SELESAI |
| Waktu dibuat | `new Date(alert.createdAt).toLocaleTimeString('id-ID')` |
| Elapsed timer | `Date.now() - new Date(alert.createdAt)` — hitung di frontend, update tiap detik |
| Jumlah responder | `alert.acknowledgedCount` atau `recipients.length` |
| GPS | `alert.location?.lat` + `alert.location?.lng` — tampilkan koordinat atau SVG pin; jika null, hilangkan blok GPS sama sekali |
| Recipients list | `GET /api/alerts/:id` → `recipients[]` (AlertRecipient records) |
| Recipient name | `recipient.userId` — tampilkan sebagai ID atau nama jika ada |
| Recipient status | `recipient.deliveryStatus`: SENT→"On Route", DELIVERED→"Terkirim", ACKNOWLEDGED→"Diterima", PENDING→"Pending" |
| Tombol "Tandai Terkendali" | `PATCH /api/alerts/:id/resolve` |

**Elemen mockup yang DIHILANGKAN (tidak ada di backend):**
- KPI row: Device ID, Battery, Phone → **tidak dirender**
- Blok AI Analysis (Confidence Score, AI reasoning) → **tidak dirender** untuk panic button manual
- Audio Stream (live transcript) → **tidak dirender**
- Kolom jarak responder (120m, 280m) → **tidak dirender**
- Tombol Broadcast Ulang, Conference Call, Eskalasi POLRI → **tidak dirender**

---

#### HALAMAN 2: Incident Response (`Incident Response.html`)

**Folder baru: `/src/features/incident-response/`**

```
incident-response/
  IncidentResponseView.jsx   ← view utama: stats bar + grid 2-col (1fr 420px)
  IncidentStats.jsx          ← 5 kartu statistik di atas kanban
  IncidentKanban.jsx         ← 4 kolom kanban board
  IncidentCard.jsx           ← satu card di kanban (bisa diklik)
  IncidentDetailPane.jsx     ← panel kanan: detail + timeline + notes (disabled) + actions
  IncidentTimeline.jsx       ← timeline dari activities[] bukan dari /timeline endpoint
  incident-response.module.css
```

**Mapping Kolom Kanban → Backend Status:**

| Kolom Mockup | Backend Status | Query |
|-------------|----------------|-------|
| Dilaporkan | `OPEN` | `GET /api/incidents?status=OPEN` |
| Investigasi | `IN_PROGRESS` (fase awal) | Tidak ada status terpisah di backend — gabungkan dengan "Dikerjakan" ATAU filter by `assignedTo=null` |
| Dikerjakan | `IN_PROGRESS` (sudah assigned) | `GET /api/incidents?status=IN_PROGRESS` |
| Selesai | `RESOLVED` + `CLOSED` | `GET /api/incidents?status=RESOLVED,CLOSED` |

**Rekomendasi penyederhanaan:** Gunakan 3 kolom saja (OPEN, IN_PROGRESS, RESOLVED) karena backend tidak membedakan "investigasi" dari "dikerjakan". Atau, bedakan dengan `assignedTo`:
- "Dilaporkan": status=OPEN
- "Dalam Proses": status=IN_PROGRESS  
- "Selesai": status=RESOLVED atau CLOSED

**Elemen yang DITAMPILKAN (ada di backend):**

| Elemen | Field Backend |
|--------|---------------|
| Incident ID | `incident.incidentNumber` — format `INC-YYYY-NNNNNN` |
| Judul | `incident.title` |
| Kategori badge | `incident.type` — tampilkan as-is atau mapping ke label Indonesia |
| Priority badge | `incident.priority`: LOW/MEDIUM/HIGH/CRITICAL |
| Status kolom | `incident.status` |
| Lokasi | `incident.location?.name` |
| Pelapor | `incident.reporter?.name \|\| incident.reportedBy` |
| Petugas | `incident.assignedMember?.name \|\| 'Belum ditugaskan'` |
| Dibuat | `new Date(incident.createdAt).toLocaleString('id-ID')` |
| Update terakhir | `formatDistanceToNow(incident.updatedAt)` via date-fns |
| Timeline investigasi | `incident.activities[]` dari `GET /api/incidents/:id` — **BUKAN** dari endpoint `/timeline` (buggy) |
| Tombol "Tandai Selesai" | `PUT /api/incidents/:id` dengan `{ status: 'RESOLVED' }` |

**Elemen mockup yang DIHILANGKAN (tidak ada di backend):**
- Textarea catatan/notes → **tidak dirender** (`POST /api/incidents/:id/notes` buggy)
- Tombol "Eskalasi" → **tidak dirender** (`POST /api/incidents/:id/escalate` buggy)

**Mapping Stats Bar (5 kartu):**

| Kartu Mockup | Sumber Data | Cara Hitung |
|-------------|-------------|-------------|
| Insiden Hari Ini | `GET /api/incidents?limit=200` | Hitung client-side: filter by `createdAt >= today` |
| Kritis Aktif | Data yang sama | filter `priority=CRITICAL && status!=RESOLVED&&!=CLOSED` |
| Dalam Proses | Data yang sama | filter `status=IN_PROGRESS` |
| Selesai (24j) | Data yang sama | filter `status=RESOLVED && resolvedAt >= 24j lalu` |
| Avg. Resolution | Data yang sama | rata-rata `getDurationMinutes()` dari yang resolved |

> **CATATAN:** JANGAN gunakan `GET /api/incidents/stats/dashboard` — ada bug route order yang bisa match ke `/:id`. Hitung stats client-side dari data list yang sudah di-fetch.

**Komponen `IncidentTimeline.jsx`:**
```javascript
// Gunakan incident.activities[] bukan endpoint /timeline
// activities[] ada di response GET /api/incidents/:id
// Format: { id, type, description, createdAt, userId }
// Mapping type → dot color:
// INCIDENT_CREATED → red
// STATUS_CHANGED → amber/cyan
// INCIDENT_ASSIGNED → cyan
// other → gray
```

---

#### HALAMAN 3: Interactive Map (`Interactive Map.html`)

**Folder baru: `/src/features/interactive-map/`**

```
interactive-map/
  InteractiveMapView.jsx     ← view utama: grid 3-col (280px 1fr 320px)
  MapLayerControl.jsx        ← kolom kiri: toggle layers + geofence list
  MapCanvas.jsx              ← kolom tengah: SVG map dengan pins animasi
  MapPin.jsx                 ← satu pin (guard/incident/panic/cctv/visitor)
  MapInfoPane.jsx            ← kolom kanan: pin detail + POI list + statistik hari ini
  interactive-map.module.css
```

**Layer yang DIRENDER (ada di backend):**

| Layer | Sumber Data |
|-------|-------------|
| Insiden Aktif — pin merah | `GET /api/incidents?status=OPEN,IN_PROGRESS` — filter yang punya `location.latitude/longitude` |
| Panic Alert — pin merah pulse | `GET /api/alerts?category=PANIC_BUTTON&status=ACTIVE,ACKNOWLEDGED` — filter yang punya `location.lat/lng` |
| Kamera CCTV — pin cyan | `camerasApi.list()` — sudah ada di codebase |
| Basemap (gedung, jalan, area) | SVG hardcoded — seperti mockup, tidak butuh API |

**Layer mockup yang DIHILANGKAN (tidak ada di backend):**
- Anggota Tim / guard pins → **tidak dirender**
- Visitor Aktif → **tidak dirender**
- Geofence Zones → **tidak dirender** (tidak ada API; basemap static cukup)
- Heatmap toggle → **tidak dirender** (tidak ada data historis dari API)

**Panel kanan (MapInfoPane) yang DITAMPILKAN:**
- Detail pin yang diklik: type, name, koordinat GPS (`location.latitude/longitude` atau `location.lat/lng`)
- Untuk Incident pin: `incidentNumber`, `title`, `priority`, `status`
- Untuk Panic pin: `alertId`, `status`, `createdAt`
- Untuk CCTV pin: `name`, `status`

**Panel kanan yang DIHILANGKAN:**
- POI statis (Gerbang, Kolam, Taman) → **tidak dirender** (tidak ada API)
- Statistik hari ini (Patroli Selesai, Total Visitor) → **tidak dirender** (tidak ada API)

**Normalisasi GPS → SVG Viewport (1200×700):**
```javascript
// Koordinat batas perumahan perlu dikonfirmasi dengan tim backend/ops
// Placeholder sementara:
const MAP_BOUNDS = {
  latMin: -6.245, latMax: -6.225,   // konfirmasi
  lngMin: 106.835, lngMax: 106.860  // konfirmasi
};

function latToY(lat) {
  return 60 + ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * 580;
}
function lngToX(lng) {
  return 60 + ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * 1080;
}
```

**Catatan GPS null pada pins:**
```javascript
// Incident: location?.latitude dan location?.longitude
// Alert: location?.lat dan location?.lng
// Jika null → jangan render pin, jangan crash
const incidentPins = incidents
  .filter(i => i.location?.latitude != null && i.location?.longitude != null)
  .map(i => ({ ...i, svgX: lngToX(i.location.longitude), svgY: latToY(i.location.latitude) }));
```

---

### LAYER 4 — Navigasi

**Update: `/src/features/dashboard/Sidebar.jsx`**

Tambahkan 3 nav item baru setelah "Security":

```javascript
const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: <HomeIcon />,     badge: 0 },
  { id: 'lights',    label: 'Lights',    icon: <LightsIcon />,   badge: 0 },
  { id: 'security',  label: 'Security',  icon: <ShieldIcon />,   badge: alertCount },
  { id: 'media',     label: 'Media',     icon: <MediaIcon />,    badge: 0 },
  // ↓ BARU
  { id: 'panic',     label: 'Panic',     icon: <BellIcon />,     badge: activePanicCount },
  { id: 'incidents', label: 'Insiden',   icon: <AlertIcon />,    badge: openIncidentCount },
  { id: 'map',       label: 'Peta',      icon: <MapIcon />,      badge: 0 },
];
```

Badge data untuk nav item baru:
- `activePanicCount` → `usePanicAlerts({ status: 'ACTIVE' }).data?.count || 0`
- `openIncidentCount` → `useIncidents({ status: 'OPEN' }).data?.length || 0`

**Update: `/src/features/dashboard/CenterPanel.jsx`**

```javascript
// Tambah di ATAS conditional rendering yang sudah ada (urutan penting)
import { PanicMonitorView } from '../panic-monitor/PanicMonitorView';
import { IncidentResponseView } from '../incident-response/IncidentResponseView';
import { InteractiveMapView } from '../interactive-map/InteractiveMapView';

export function CenterPanel() {
  const { activeNav, sectionVisibility } = /* stores */;

  // ↓ BARU — switch ke view khusus
  if (activeNav === 'panic')     return <PanicMonitorView />;
  if (activeNav === 'incidents') return <IncidentResponseView />;
  if (activeNav === 'map')       return <InteractiveMapView />;

  // Default: render existing 6 sections seperti sekarang
  return (
    <div className={styles.panel}>
      {sectionVisibility.overview && <OverviewSection />}
      {/* ... etc */}
    </div>
  );
}
```

**Update: `/src/store/system.store.js`** (dokumentasi saja):
```javascript
// activeNav valid values (update comment):
// 'home' | 'lights' | 'security' | 'media' | 'panic' | 'incidents' | 'map'
```

---

### Timeline (Urutan Prioritas)

```
[1] /src/api/ws.js                           ← BLOCKER semua fitur real-time
    Update /src/App.jsx (connectWs)

[2] /src/api/incidents.api.js
    Update /src/api/alerts.api.js (listPanic, listCCTV, detail)

[3] /src/hooks/usePanicAlerts.js
    /src/hooks/useIncidents.js
    /src/hooks/useMapPins.js

[4] /src/features/panic-monitor/
      PanicAlertList.jsx
      PanicAlertDetail.jsx
      PanicBroadcastPanel.jsx
      PanicMonitorView.jsx

[5] /src/features/incident-response/
      IncidentStats.jsx
      IncidentKanban.jsx + IncidentCard.jsx
      IncidentTimeline.jsx (gunakan activities[], bukan /timeline endpoint)
      IncidentDetailPane.jsx (notes disabled, eskalasi disabled)
      IncidentResponseView.jsx

[6] /src/features/interactive-map/
      MapLayerControl.jsx
      MapCanvas.jsx + MapPin.jsx
      MapInfoPane.jsx
      InteractiveMapView.jsx
      Konfirmasi MAP_BOUNDS dengan tim

[7] Update Sidebar.jsx (3 nav item baru + badge hooks)
    Update CenterPanel.jsx (3 kondisi activeNav baru)

[8] Testing & polish (edge cases GPS null, field null, ws reconnect)
```

### Resources Needed

- **Tidak ada dependency baru** — semua sudah terinstall (uuid, date-fns, react-query, zustand, socket.io-client, axios)
- Native WebSocket tersedia di browser tanpa library tambahan
- SVG map tidak perlu library peta eksternal (ikuti pendekatan mockup)

### Responsible Parties

- **Frontend Developer** — implementasi semua file di atas mengikuti mockup
- **Backend Team** — konfirmasi 2 hal:
  1. URL exact untuk panic: `/api/panic` atau `/api/alerts/panic`?
  2. Koordinat batas perumahan (lat/lng min-max untuk normalisasi SVG map)
- **QA** — test scenarios kritis (lihat Validation Plan)

---

## 📈 MONITORING DAN VALIDASI

### Success Metrics

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| Panic alert muncul di halaman Panic Alerts tanpa refresh | < 3 detik dari tombol ditekan | Manual test: kirim via Postman → pantau dashboard |
| Kanban Incident Response update saat incident baru dibuat | < 5 detik | Socket.io event `incident_created` → invalidate |
| Pin muncul di peta saat incident/alert baru | < 10 detik | Manual test |
| Tombol "Tandai Selesai" mengubah status di DB | Status = RESOLVED | Check via `GET /api/incidents/:id` setelah klik |
| Tombol "Tandai Terkendali" (panic) mengubah status | Status = RESOLVED | Check via `GET /api/alerts/:id` |
| Tidak ada crash saat GPS null | UI menampilkan "N/A" | Test dengan alert tanpa koordinat |
| Tidak ada crash saat field metadata null (battery, phone) | UI menampilkan "—" | Test dengan alert tanpa metadata |
| Tidak ada network request ke endpoint buggy | 0 request ke /timeline, /notes, /escalate, /radius, /stats | Browser Network tab |

### Validation Plan

1. **WebSocket dual:** Buka Network tab → filter WS → pastikan ada 2 koneksi (Socket.io dan native ws)
2. **Panic flow:** Kirim POST ke `/api/panic` via Postman → halaman Panic Alerts update otomatis
3. **Incident Kanban:** Buat incident via API → muncul di kolom "Dilaporkan" → update status via UI → pindah kolom
4. **Map pins:** Buat incident dengan `location.latitude/longitude` → pin muncul di peta
5. **Null safety:** Kirim alert tanpa `gps` field → halaman tidak crash, tampil "GPS tidak tersedia"
6. **Idempotency panic:** Kirim requestId yang sama 2x → response 200 kedua kali, tidak duplicate di UI

### Risk Mitigation

| Risiko | Pencegahan |
|--------|-----------|
| Developer memanggil endpoint buggy | Comment `// ❌ DO NOT USE — buggy` di incidents.api.js dan alerts.api.js |
| Native WebSocket gagal connect | `ws.onclose` auto-reconnect setiap 3 detik; console.warn jika gagal |
| GPS null crash | Wajib filter `.filter(i => i.location?.lat != null)` sebelum render pin |
| Field null crash (battery, phone) | Gunakan optional chaining + nullish coalescing: `alert.context?.battery ?? '—'` |
| Koordinat GPS vs SVG tidak akurat | Konfirmasi MAP_BOUNDS dengan backend/ops sebelum merge |
| Duplicate WS handlers | Mount listener 1x di hook, cleanup di return function |
| Stats dashboard endpoint bug | Hitung stats client-side dari list data, JANGAN call `/stats/dashboard` |

### Adjustment Triggers

- Jika backend fix field `notes` → aktifkan textarea di IncidentDetailPane
- Jika backend fix `escalate` → aktifkan tombol eskalasi
- Jika backend fix `timeline` endpoint → migrasi dari activities[] ke endpoint dedicated
- Jika backend unifikasi WS ke Socket.io → hapus `ws.js`, pindah semua listener ke `socket.js`
- Jika backend expose API untuk team member location → tambahkan guard pins ke Interactive Map

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
_Mockup reference: `Panic Alerts.html`, `Incident Response.html`, `Interactive Map.html`_
_Backend reference: `docs/deep-dive-insiden-dan-alert-panic.md`_
