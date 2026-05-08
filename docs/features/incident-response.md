# Fitur: Incident Response

**Path:** `src/features/incident-response/`

Kanban board untuk respons insiden dengan stats, detail pane, dan timeline aktivitas.

---

## Tujuan

Memberi operator alur kerja Kanban untuk mengelola lifecycle insiden — dari OPEN → IN_PROGRESS → RESOLVED — dengan visibilitas penuh terhadap detail dan timeline aktivitas.

---

## Komponen

### `IncidentResponseView.jsx`

Root container. Layout 3 area: stats di atas, kanban di tengah-kiri, detail pane di kanan. State `selectedIncident`.

### `IncidentStats.jsx`

KPI card row:

- Insiden hari ini
- Kritis aktif
- Dalam proses
- Selesai 24 jam
- Average resolution time

### `IncidentKanban.jsx`

3 kolom kanban dengan struktur drag-drop-ready:

| Kolom | Filter status |
|---|---|
| Dilaporkan | `OPEN` |
| Dalam Proses | `IN_PROGRESS` |
| Selesai | `RESOLVED`, `CLOSED` |

Tiap item adalah `IncidentCard`.

### `IncidentCard.jsx`

Compact card: ID, title, location, priority badge. Highlight saat `selected`. Click → `onClick(incident)`.

### `IncidentDetailPane.jsx`

Panel detail untuk insiden terpilih:

- Header: ID, title, badges (status, priority, type)
- Grid field: lokasi, pelapor, petugas (assignee), dibuat
- Deskripsi panjang
- `IncidentTimeline` di bawah
- Tombol **Tandai Selesai** → `useUpdateIncidentStatus()` ke `RESOLVED`

### `IncidentTimeline.jsx`

Timeline aktivitas dengan colored dot per `activityType`:

| `activityType` | Warna |
|---|---|
| `INCIDENT_CREATED` | Merah |
| `STATUS_CHANGED` | Amber |
| `INCIDENT_ASSIGNED` | Cyan |
| (lainnya) | Default |

Setiap entry: timestamp + deskripsi.

---

## API & Hook

| Hook / API | Endpoint | Konsumer |
|---|---|---|
| `useIncidents({ limit: 200 })` | `GET /api/incidents` (+ WS) | `IncidentResponseView`, `IncidentKanban` |
| `useIncidentDetail(id)` | `GET /api/incidents/:id` | `IncidentDetailPane`, `IncidentTimeline` |
| `useUpdateIncidentStatus()` | `PUT /api/incidents/:id` | `IncidentDetailPane` |

Sumber: `src/api/incidents.api.js`, `src/hooks/useIncidents.js`.

---

## State / Store

- Component state `selectedIncident` di root view.
- Tidak menggunakan store global.

---

## Props

| Komponen | Props |
|---|---|
| `IncidentCard` | `incident: Incident`, `selected: boolean`, `onClick: (incident) => void` |
| `IncidentDetailPane` | `incident: Incident` |
| `IncidentTimeline` | `activities: Activity[]` |
| `IncidentKanban` | `incidents: Incident[]`, `selectedId: string`, `onSelect: (incident) => void` |
| `IncidentStats` | `incidents: Incident[]` |

---

## Catatan Integrasi

- **Response shape variasi:** `useIncidents` menormalisasi `data.incidents | data.data | array` — tahan terhadap perubahan kecil di backend.
- **WS sync:** `useIncidents` listen `incident_created`, `incident_updated`, `incident_assigned` (Socket.io). Setiap event invalidate `['incidents']` dan `['incidents', 'detail', id]`.
- **Update status mutation** invalidate dua query keys agar list & detail keduanya konsisten.
- **Bug backend yang harus diperhatikan** (lihat [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §1.4):
  - Endpoint `/notes` & `/escalate` belum berfungsi (field di-comment di model)
  - Endpoint `/timeline` bisa error karena Sequelize include ke raw model
  - Frontend saat ini tidak memakai endpoint-endpoint tersebut secara langsung — ekspos timeline lewat field `activities` di response detail saja.
- **Activity type dot color** define di `incident-response.module.css` via `--dot-*` CSS variables — tambah type baru perlu register di `TYPE_DOT` map dan CSS.

---

## Lihat Juga

- [`docs/deep-dive-insiden-dan-alert-panic.md`](../deep-dive-insiden-dan-alert-panic.md) §1 — Detail backend Incident & ENUM yang valid
