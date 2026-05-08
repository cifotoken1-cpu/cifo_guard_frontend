# Fitur: Dashboard

**Path:** `src/features/dashboard/`

Layout root Security Control Center: TopBar atas, Sidebar kiri, CenterPanel tengah, RightPanel kanan, plus semua modal & toast.

---

## Tujuan

Menyajikan kerangka tampilan utama dashboard dan men-route konten tengah berdasarkan `activeNav` di `useSystemStore`.

---

## Komponen

### `DashboardPage.jsx`

Container root yang me-render:

- `TopBar`, `Sidebar`, `CenterPanel`, `RightPanel`
- Modal aktif dari `useUIStore.modal` → `AlertsModal`, `CamerasModal`, `PanicConfirmModal`, `ChangePasswordModal`
- `ToastStack` (notifikasi real-time alert)

### `TopBar.jsx`

Header global. Menampilkan:

- Brand (NEXUS GUARD)
- Stats row: System ARMED/DISARMED, jumlah alert aktif, kamera online, sensor, status backup
- Uptime & versi backend dari `useHealth()`

### `Sidebar.jsx`

Navigasi utama (collapsible). Berisi:

- Real-time clock (`useClock()`)
- Badge status armed
- Nav items: `security`, `media`, `panic`, `incidents`, `map`, `users`
- Health bars (CPU, memory, storage, temperature) dari `useMetrics()`
- User info block + tombol logout & ganti password

### `SidebarPanelsControl.jsx`

Checklist toggle visibility 6 panel home: `overview`, `systemControl`, `securityMode`, `sensorStatus`, `liveCameras`, `activityLogPanel`. Persisted via `useUIStore.sectionVisibility`.

### `CenterPanel.jsx`

Router konten tengah. Switch berdasarkan `activeNav`:

| `activeNav` | Render |
|---|---|
| `security` (default) | Home view: metrics, arm button, mode selector, sensor list, live cameras, activity log |
| `panic` | `<PanicMonitorView />` |
| `incidents` | `<IncidentResponseView />` |
| `map` | `<InteractiveMapView />` |
| `media` | `<MediaView />` |
| `users` | `<UsersPage />` |

Home view menderivasi sensor status dari `useRecentActivities()` (filter type `door`/`motion` dari deskripsi).

### `RightPanel.jsx`

Sidebar kanan. Berisi:

- Live cameras grid (max 3 kamera teratas)
- Activity log feed
- Auto-adapt layout saat fullscreen

---

## API & Hook

| Hook | Sumber | Dipakai oleh |
|---|---|---|
| `useActiveAlerts()` | `src/hooks/useAlertsStream.js` | TopBar, Sidebar |
| `useAlertStats()` | `src/hooks/useAlertsStream.js` | TopBar badge |
| `useCameras()` | `src/hooks/useCamerasStream.js` | TopBar, RightPanel, CenterPanel home |
| `useMetrics()` | `src/hooks/useSystemHealth.js` | Sidebar health bars |
| `useHealth()` | `src/hooks/useSystemHealth.js` | TopBar uptime/version |
| `useRecentActivities(limit)` | `src/hooks/useActivitiesStream.js` | RightPanel log + CenterPanel sensors |
| `useClock()` | `src/hooks/useClock.js` | Sidebar, CameraCard |
| `usePanicAlerts({ status: 'ACTIVE', limit: 1 })` | `src/hooks/usePanicAlerts.js` | CenterPanel home |
| `useIncidents({ status: 'OPEN', limit: 1 })` | `src/hooks/useIncidents.js` | CenterPanel home |

---

## State / Store

- **`useSystemStore`** — `armed`, `mode`, `activeNav`, `setActiveNav`, `sidebarCollapsed`, `setSidebarCollapsed`
- **`useUIStore`** — `modal`, `openModal`, `closeModal`, `sectionVisibility`, `toggleSection`
- **`useAuthStore`** — `user`, `role`, `logout`

---

## Props

Komponen di folder dashboard tidak menerima props dari luar — semua data datang dari hook & store.

---

## Catatan Integrasi

- **Modal lifecycle** terikat ke `useUIStore.modal`. `DashboardPage` adalah satu-satunya tempat semua modal di-mount; komponen lain hanya panggil `openModal('cameras' | 'alerts' | 'panic-confirm' | ...)`.
- **Panic button** di Sidebar/CenterPanel buka `PanicConfirmModal` dulu — tidak langsung trigger panic.
- **Sensor status** di CenterPanel home tidak punya endpoint dedicated — diderivasi dari `activities/recent` (lihat [Known Issue #4 di README](../../README.md#known-issues-di-backend-yang-harus-diperbaiki-nanti)).
- **Arm/Disarm & Mode** saat ini hanya local state karena backend belum punya endpoint (Known Issue #2 & #3).
