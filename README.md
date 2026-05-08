# CIFO Frontend

Frontend untuk **CIFO Security System** — Security Control Center dashboard.
Dibangun di atas mockup **NEXUS GUARD** dengan tema cyberpunk dark + accent cyan.

> **Stack:** React 18 + Vite · TanStack Query · Zustand · Socket.io · Axios · HLS.js · React Router 6

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Pastikan backend CIFO jalan di port 3001
# (lihat backend/README.md atau jalankan: cd ../backend && npm run dev)

# 3. (Optional) buat .env.local — biasanya tidak perlu, Vite proxy menangani semua
cp .env.local.example .env.local

# 4. Jalankan dev server
npm run dev
```

Buka <http://localhost:5173>. Vite akan auto-proxy semua request `/api/*`, `/health`, dan `/socket.io` ke backend di `http://localhost:3001` — tidak ada masalah CORS.

---

## Scripts

| Command | Fungsi |
|---|---|
| `npm run dev` | Dev server di port 5173 (auto-reload) |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Preview hasil build di port 4173 |
| `npm run lint` | ESLint check |

---

## Struktur Folder

```
src/
├── main.jsx              # Vite entry
├── App.jsx               # Root: providers + router + socket lifecycle
├── config.js             # API_URL, WS_URL, refetch intervals, panic types
├── icons.jsx             # Semua SVG icon (object I)
│
├── styles/
│   ├── theme.css         # CSS variables (colors, fonts, layout)
│   ├── animations.css    # @keyframes (scanline, blink, pulse, dll)
│   └── globals.css       # reset, body grid, scrollbar
│
├── api/
│   ├── client.js         # Axios + JWT interceptor + error normalizer
│   ├── socket.js         # Socket.io singleton + room subscriptions
│   ├── alerts.api.js     # POST /panic, GET /alerts, /stats, resolve, dll
│   ├── cameras.api.js    # GET /cameras (legacy endpoint, see "Known Issues")
│   ├── activities.api.js # GET /activities/recent, /stats
│   └── system.api.js     # GET /health, /api/metrics
│
├── store/                # Zustand stores
│   ├── auth.store.js     # token, user, role (persisted ke localStorage)
│   ├── system.store.js   # armed, mode, activeNav (persisted)
│   └── ui.store.js       # modal, toasts (ephemeral)
│
├── hooks/
│   ├── useClock.js
│   ├── useAlertsStream.js     # Query + WS bridge → useActiveAlerts, useAlertStats
│   ├── useCamerasStream.js    # Query + WS bridge → useCameras
│   ├── useActivitiesStream.js # Query + WS bridge → useRecentActivities
│   └── useSystemHealth.js     # useHealth, useMetrics
│
├── utils/
│   ├── format.js         # pad, formatDate, formatTime, relativeTime, formatUptime
│   └── geo.js            # getGPS() promise wrapper + FALLBACK_GPS
│
├── components/ui/
│   └── Modal.jsx         # Reusable modal dengan backdrop + Esc to close
│
└── features/
    ├── dashboard/        # 3-column layout: TopBar, Sidebar, CenterPanel, RightPanel
    ├── cameras/          # CameraCard (HLS support), CamerasModal
    ├── alerts/           # AlertsModal, ToastStack (real-time push)
    └── panic/            # PanicConfirmModal (type picker + GPS + POST /panic)
```

---

## Mapping Backend → Frontend

| Backend Endpoint / Event | Frontend Konsumer |
|---|---|
| `POST /api/panic` | `PanicConfirmModal` → `alertsApi.triggerPanic()` |
| `GET /api/alerts?status=ACTIVE` | `useActiveAlerts()` → `AlertsModal`, `CenterPanel` |
| `GET /api/alerts/stats` | `useAlertStats()` → `TopBar`, `Sidebar` badge |
| `PATCH /api/alerts/:id/resolve` | `AlertsModal` resolve buttons |
| `GET /api/cameras` (legacy) | `useCameras()` → `RightPanel`, `CamerasModal`, `TopBar` |
| `GET /api/activities/recent` | `useRecentActivities()` → `RightPanel` log, `CenterPanel` sensors |
| `GET /api/metrics` | `useMetrics()` → `Sidebar` health bars |
| `GET /health` | `useHealth()` → `TopBar` uptime/version |
| WS `alert_created` | Invalidate alerts query + show toast |
| WS `alert_updated` | Invalidate alerts query |
| WS `camera_status_changed` | Invalidate cameras query |

---

## Real-time Architecture

```
Backend (Socket.io)
        │
        ▼
api/socket.js  ── singleton ──┐
                              ├── joins rooms: alerts_room, cameras_room, team_room, system_room
                              │
useAlertsStream() ───────────▶│ on 'alert_created' / 'alert_updated' → invalidate ['alerts']
useCamerasStream() ──────────▶│ on 'camera_status_changed' → invalidate ['cameras']
useActivitiesStream() ───────▶│ on 'alert_*' → invalidate ['activities']
ToastStack ───────────────────▶ on 'alert_created' → push toast
```

TanStack Query handles caching + revalidation. WS events trigger `invalidateQueries()` — Query refetches only if data is stale or component is mounted.

---

## Known Issues di Backend (yang harus diperbaiki nanti)

Berdasarkan dokumentasi backend (`docs/api-contracts-backend.md` dan `docs/index.md`):

### 🔴 1. Bug routing double prefix `/api/api/cameras`
**File:** `backend/api/router.js`
**Sekarang:** Controller routes pakai `router.use('/api/cameras', ...)` di dalam router yang sudah dimount di `/api`, hasilnya path efektif `/api/api/cameras`.
**Fix:** Ubah jadi `router.use('/cameras', ...)` (tanpa prefix `/api/`).
**Frontend impact:** `cameras.api.js` saat ini pakai endpoint LEGACY `/api/cameras` (hardcoded data 18 kamera). Setelah backend di-fix, uncomment fungsi `detail()`, `stats()`, `dashboard()` di `cameras.api.js`.

### 🟡 2. Endpoint Arm/Disarm sistem belum ada
**Frontend impact:** `setArmed()` di `system.store.js` saat ini hanya simpan ke localStorage. Setelah backend tambah `POST /api/system/arm` dan `POST /api/system/disarm`, sambungkan di komponen `CenterPanel` System Control buttons.

### 🟡 3. Mode selector (Home/Night/Silent) belum ada di backend
**Frontend impact:** Sama dengan #2 — saat ini hanya local state. Bisa pakai `feature_flags` table dengan key `system.mode` sebagai workaround.

### 🟢 4. Sensor dedicated endpoint belum ada
**Frontend impact:** `CenterPanel` saat ini menderivasi sensors dari `GET /activities/recent` dengan filter type. Tidak optimal — usulkan backend tambah `GET /api/sensors` dengan tipe door/motion.

---

## Authentication

Saat ini frontend **belum punya halaman login**. Token di-set manual untuk testing:

```js
// di console browser:
localStorage.setItem('cifo-auth', JSON.stringify({
  state: {
    token: 'YOUR_JWT_TOKEN',
    user: { id: 'guard-001', name: 'Guard 1' },
    role: 'GUARD'
  }
}));
location.reload();
```

Generate token testing dari backend: `node scripts/generate-token.js` (di repo backend).

Endpoint yang **memerlukan JWT** (lihat `docs/api-contracts-backend.md`):
- `POST /api/alerts/:id/activities`
- `GET /api/activities/export/csv`
- `POST /api/system/:id/activities`

---

## Camera Live Stream (HLS)

`CameraCard` mendukung HLS playback via `hls.js`:

- Jika `cam.streamUrl` (dari backend `cameras.stream_url` field) diisi `.m3u8`, akan auto-play.
- Fallback Safari pakai native HLS.
- Kalau tidak ada stream, tampilkan animated background placeholder (cyberpunk style).

Pastikan backend mengizinkan CORS ke domain HLS server, atau proxy stream lewat backend untuk menghindari masalah cross-origin.

---

## Deploy ke Production

```bash
npm run build
# Output: dist/

# Deploy dist/ ke nginx/Caddy/Vercel/Netlify
# Set env var:
#   VITE_API_URL=https://api.cifo.example.com/api
#   VITE_WS_URL=https://api.cifo.example.com
#   VITE_HEALTH_URL=https://api.cifo.example.com/health
```

Pastikan reverse proxy meneruskan WebSocket upgrade header untuk Socket.io.

---

## Roadmap

Iterasi berikut yang masuk akal setelah MVP ini stabil:

1. **Halaman Login** + JWT refresh flow
2. **Team Management** page (live location di peta)
3. **Visitor Registration** dengan upload foto KTP (Multer + OCR Tesseract)
4. **Incident & Geofence** management
5. **Map view** dengan basemap SVG kustom + pin overlay
6. **Audio cue** untuk incoming panic alerts
7. **PWA** untuk mobile guard app (install ke home screen)

---

## Troubleshooting

**Error: "Network error" di semua request**
→ Backend tidak jalan, atau port-nya bukan 3001. Cek di terminal backend: `npm run dev`. Atau ubah `vite.config.js` proxy target.

**Camera grid kosong**
→ Backend `GET /api/cameras` return `{ cameras: [], total: 0 }`. Itu wajar kalau database kosong. Frontend akan fallback ke mockup placeholder.

**Socket.io tidak konek (lihat console: `[socket] connect_error`)**
→ Pastikan backend `CORS_ORIGIN` mencakup `http://localhost:5173` atau gunakan `*` di dev. Cek `services/WebSocketService.js` di backend.

**Panic POST gagal dengan 400 "validation failed"**
→ Cek payload di Network tab. `requestId` harus 8-128 char alphanumeric/-/\_. `gps.latitude` harus dalam ±90, `longitude` ±180. UUID v4 kompatibel.

**Activity log kosong walaupun WS event masuk**
→ Backend `GET /api/activities/recent` mungkin belum return data dari WS event yang masuk (race condition). TanStack Query akan refetch otomatis tiap 10s.

---

## Lisensi

MIT — sesuai dengan proyek CIFO Security System backend.
