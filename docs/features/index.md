# Dokumentasi Fitur — CIFO Guard Frontend

Dokumentasi per-fitur untuk modul di `src/features/`. Setiap dokumen menjelaskan:

- **Tujuan** fitur
- **Komponen** utama dan tanggung jawabnya
- **API & Hook** yang digunakan (`src/api/*`, `src/hooks/*`)
- **State / Store** (zustand: `auth.store`, `system.store`, `ui.store`)
- **Props** komponen utama
- **Catatan integrasi** (WebSocket, modal flow, side effect)

---

## Index Fitur

| Fitur | Path | Ringkasan |
|---|---|---|
| [Auth](./auth.md) | `src/features/auth` | Login page + ganti password modal |
| [Dashboard](./dashboard.md) | `src/features/dashboard` | Layout utama (TopBar, Sidebar, CenterPanel, RightPanel) |
| [Alerts](./alerts.md) | `src/features/alerts` | Modal alert aktif + toast stack real-time |
| [Panic](./panic.md) | `src/features/panic` | Modal konfirmasi & trigger panic alert |
| [Panic Monitor](./panic-monitor.md) | `src/features/panic-monitor` | Monitor panic alert + responder broadcast |
| [Cameras](./cameras.md) | `src/features/cameras` | Galeri kamera, HLS playback, CRUD form |
| [Incident Response](./incident-response.md) | `src/features/incident-response` | Kanban incident + detail pane + timeline |
| [Interactive Map](./interactive-map.md) | `src/features/interactive-map` | Peta SVG dengan pin incident/panic/cctv |
| [Media](./media.md) | `src/features/media` | Galeri kamera fullscreen |
| [Users](./users.md) | `src/features/users` | User management (CRUD, unlock, role change) |

---

## Konvensi Umum

### State Global (Zustand)

| Store | Path | Fungsi |
|---|---|---|
| `useAuthStore` | `src/store/auth.store.js` | `token`, `user`, `role`, `login()`, `logout()` (persisted) |
| `useSystemStore` | `src/store/system.store.js` | `armed`, `mode`, `activeNav`, `sidebarCollapsed` (persisted) |
| `useUIStore` | `src/store/ui.store.js` | `modal`, `toasts`, `sectionVisibility`, `openModal()`, `closeModal()`, `addToast()` (ephemeral) |

### Pola React Query

- **Query keys** konsisten: `['alerts']`, `['cameras']`, `['incidents']`, `['users']`, `['panic-alerts']`.
- **WebSocket → invalidateQueries** — hook `useXxxStream` subscribe via `onSocket()` (`src/api/socket.js`) dan invalidate query agar refetch otomatis.
- **Mutation → invalidateQueries** — semua mutation (resolve, update, create, delete) panggil `qc.invalidateQueries(...)` di `onSuccess`.

### WebSocket Events (Frontend → Backend)

| Event | Konsumer Hook | Aksi |
|---|---|---|
| `alert_created` | `useActiveAlerts`, `ToastStack` | invalidate `['alerts']` + show toast |
| `alert_updated` | `useActiveAlerts` | invalidate `['alerts']` |
| `camera_status_changed` | `useCameras` | invalidate `['cameras']` |
| `incident_created` | `useIncidents` | invalidate `['incidents']` |
| `incident_updated` | `useIncidents`, `useIncidentDetail` | invalidate `['incidents']` + detail |
| `incident_assigned` | `useIncidents` | invalidate `['incidents']` |
| `ALERT_CREATED` (legacy) | `usePanicAlerts` | invalidate `['panic-alerts']` |
| `ALERT_UPDATED` (legacy) | `usePanicAlerts` | invalidate `['panic-alerts']` |

> **Catatan:** Backend menjalankan dua WebSocket server (Socket.io & ws legacy). Lihat [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §3.1.

---

## Lihat Juga

- [`README.md`](../../README.md) — Quick start, struktur folder, mapping endpoint
- [`AUTH_API.md`](../../AUTH_API.md) — Spesifikasi endpoint auth & user management
- [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) — Deep dive backend untuk Incident & Panic
