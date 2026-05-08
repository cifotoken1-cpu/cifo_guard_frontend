# Respons Insiden & Alert Panic — Deep Dive Documentation

**Dibuat:** 2026-05-05
**Scope:** Dua fitur utama: `Respons Insiden` dan `Alert Panic`
**File Dianalisis:** 13 file inti
**Workflow Mode:** Exhaustive Deep-Dive
**Tujuan:** Referensi eksplisit untuk pengembangan frontend

---

## Overview

Dokumen ini mencakup dua fitur yang saling berkaitan erat dalam sistem keamanan CIFO:

1. **Respons Insiden** — Siklus hidup penuh pencatatan, tracking, eskalasi, dan penyelesaian insiden keamanan. Dikelola oleh Sequelize model `Incident` dengan REST API sendiri.
2. **Alert Panic** — Sistem panic button dari pengguna mobile, ditambah pipeline AI dari kamera VIGI yang menganalisis snapshot dan menghasilkan alert secara otomatis. Dikelola oleh Sequelize model `Alert` dengan dua jalur trigger: manual (HTTP) dan otomatis (VIGI + GPT-4o-mini).

**Integrasi utama:**
- JWT auth middleware di semua endpoint
- WebSocket (dua implementasi berbeda) untuk notifikasi real-time
- OpenRouter/GPT-4o-mini untuk analisis visual dari kamera VIGI
- MySQL/Sequelize sebagai penyimpanan utama

---

## 1. FITUR: RESPONS INSIDEN

### 1.1 Inventaris File

---

#### `controllers/IncidentController.js` (~693 baris)

**Tujuan:** Logika bisnis semua operasi insiden — create, read, update, escalate, notes, timeline, dan stats dashboard.

**Yang WAJIB diketahui kontributor:**
- Field `notes`, `escalatedAt`, `escalatedBy`, `escalationReason`, `resolution`, `createdBy`, `updatedBy` di-comment di model Sequelize (`models/Incident.js`), NAMUN controller masih memanggil field-field ini. Method `addIncidentNote()` dan `escalateIncident()` akan **gagal diam-diam** karena field tidak ada di schema Sequelize.
- `TeamMember` menggunakan raw MySQL query (bukan Sequelize), sehingga tidak bisa di-include dalam Sequelize query. Data reporter dan assignee diambil secara terpisah via `TeamMember.getById()`.
- Window deteksi duplikat hanya **1 detik** (ada komentar "for testing") — perlu diubah ke nilai produksi.
- Auto-assign hanya untuk insiden `CRITICAL`, mencari supervisor/coordinator yang paling lama tidak mendapat tugas.

**Exports:**
- `IncidentController.checkDuplicateIncident(incidentData)` — Cek duplikat dalam window 1 detik berdasarkan type, lokasi (radius 100m via Haversine), dan deskripsi
- `IncidentController.createIncident(incidentData)` — Buat insiden baru, log SecurityActivity, auto-assign jika CRITICAL
- `IncidentController.getIncidents(filters)` — List insiden dengan filter: status, priority, type, assignedTo, reportedBy, dateRange, limit, offset
- `IncidentController.getIncidentById(id)` — Ambil insiden + activities + reporter + assignee
- `IncidentController.updateIncident(id, updateData)` — Update insiden, log perubahan status/priority/assignment
- `IncidentController.escalateIncident(id, escalationData)` — Eskalasi insiden (BUGGY: field escalation di-comment di model)
- `IncidentController.getIncidentTimeline(id)` — Ambil timeline activities untuk insiden
- `IncidentController.addIncidentNote(id, noteData)` — Tambah catatan ke insiden (BUGGY: field `notes` di-comment)
- `IncidentController.getDashboardStats(period)` — Statistik per period: today/week/month/year

**Dependencies:**
- `models/Incident` — Sequelize model
- `models/SecurityActivity` — Activity log (raw MySQL + Sequelize hybrid)
- `models/TeamMember` — Raw MySQL queries
- `sequelize.Op` — Operator untuk query

**Digunakan oleh:** `api/incident-routes.js`

---

#### `api/incident-routes.js` (~677 baris)

**Tujuan:** Router Express yang mendefinisikan semua endpoint REST untuk manajemen insiden. Semua route memerlukan JWT via `verifyToken`.

**Yang WAJIB diketahui kontributor:**
- Route `GET /stats/dashboard` didefinisikan SETELAH `GET /:id` dalam file, tetapi Express akan mencocokkan `/stats/dashboard` ke `/:id` terlebih dahulu jika urutan tidak tepat. **Perhatikan urutan route** saat menambah route baru.
- Dua format request body diterima: legacy (location sebagai string + coordinates terpisah) dan baru (location sebagai objek). Normalisasi ada di route, bukan controller.
- `PUT /:id` dan `PATCH /:id` memiliki kode yang identik — tidak ada perbedaan fungsional.
- WebSocket broadcast via `req.app.locals.wss` dan `WebSocketService` — pastikan wss diinisialisasi di `server.js`.
- Response format berbeda antara legacy request (`isLegacyRequest=true`) dan standard.

**Endpoint List:**

| Method | Path | Auth | Role | Deskripsi |
|--------|------|------|------|-----------|
| POST | `/api/incidents` | JWT | Any | Buat insiden baru |
| GET | `/api/incidents` | JWT | Any | List insiden (filter + pagination) |
| GET | `/api/incidents/:id` | JWT | Any | Detail insiden |
| PUT | `/api/incidents/:id` | JWT | Any | Update insiden (full) |
| PATCH | `/api/incidents/:id` | JWT | Any | Update insiden (partial) |
| POST | `/api/incidents/:id/escalate` | JWT | SUPERVISOR, COORDINATOR | Eskalasi insiden |
| GET | `/api/incidents/:id/timeline` | JWT | Any | Timeline aktivitas |
| POST | `/api/incidents/:id/notes` | JWT | Any | Tambah catatan |
| GET | `/api/incidents/:id/activities` | JWT | Any | List activities |
| POST | `/api/incidents/:id/activities` | JWT | Any | Tambah activity |
| GET | `/api/incidents/stats/dashboard` | JWT | Any | Stats dashboard |

**Request Body — POST /api/incidents:**
```json
{
  "type": "SECURITY_BREACH | FIRE | MEDICAL_EMERGENCY | THEFT | VANDALISM | SUSPICIOUS_ACTIVITY | EQUIPMENT_FAILURE | POWER_OUTAGE | FLOOD | EARTHQUAKE | PANIC_ALERT | UNAUTHORIZED_ACCESS | OTHER | SECURITY | MAINTENANCE | EMERGENCY | TECHNICAL",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "description": "string (wajib)",
  "title": "string (opsional, auto-generated jika tidak ada)",
  "reportedBy": "userId (opsional)",
  "metadata": {},
  "location": {
    "name": "string",
    "latitude": "number",
    "longitude": "number"
  }
}
```

**Response — POST 201:**
```json
{
  "success": true,
  "data": {
    "incidentId": "INC_1234567890_abc123def",
    "activityId": null,
    "status": "OPEN"
  },
  "message": "Incident created successfully"
}
```

**Response — GET /api/incidents/:id:**
```json
{
  "success": true,
  "data": {
    "id": "INC_...",
    "incidentNumber": "INC-2026-123456",
    "type": "SECURITY_BREACH",
    "priority": "HIGH",
    "status": "OPEN",
    "title": "...",
    "description": "...",
    "location": { "name": "...", "latitude": -6.2, "longitude": 106.8 },
    "reportedBy": "userId",
    "assignedTo": "userId | null",
    "activities": [],
    "reporter": { "id": "...", "name": "..." },
    "assignedMember": null
  }
}
```

**WebSocket events yang di-emit:**
- `incident_created` → room `control_center`
- `high_priority_incident` → broadcast ke role `SUPERVISOR` (jika HIGH/CRITICAL)
- `incident_updated` → room `control_center`
- `incident_assigned` → langsung ke user yang di-assign
- `incident_escalated` → room `control_center`
- `incident_escalated_to_you` → langsung ke target escalation

---

#### `models/Incident.js` (~378 baris)

**Tujuan:** Sequelize model untuk tabel `incidents`. Mendefinisikan schema, validasi, hooks, dan class/instance methods.

**Yang WAJIB diketahui kontributor:**
- **Field yang DI-COMMENT (tidak ada di DB Sequelize tapi mungkin ada di tabel MySQL):** `escalatedAt`, `escalatedBy`, `escalationReason`, `resolution`, `notes`, `estimatedResolutionTime`, `actualResolutionTime`, `impactLevel`, `affectedAreas`, `relatedIncidents`, `externalReferenceId`, `isPublic`, `createdBy`, `updatedBy`. Aktifkan field ini BERSAMAAN dengan memastikan migrasi kolom di database.
- **ENUM mismatch:** Model mendefinisikan `type` ENUM dengan nilai seperti `SECURITY_BREACH`, `MEDICAL_EMERGENCY`, namun migration SQL menggunakan nilai berbeda (`SECURITY`, `MEDICAL`). Saat ini route normalisasi nilai ke uppercase, jadi jika nilai tidak cocok ENUM Sequelize, insert akan gagal.
- Hook `beforeUpdate` otomatis set `resolvedAt`, `closedAt`, dan `assignedAt` berdasarkan perubahan status.
- `Incident.getIncidentsByLocation()` menggunakan raw SQL Haversine dengan `JSON_EXTRACT` — hanya tersedia di MySQL 5.7+.
- Asosiasi ke TeamMember dan SecurityActivity DISABLED di `associate()` — data diambil terpisah.

**Field aktif (tidak di-comment):**

| Field | Type | Keterangan |
|-------|------|-----------|
| `id` | STRING | Format: `INC_<timestamp>_<random>` |
| `incidentNumber` | STRING(50) UNIQUE | Format: `INC-<year>-<timestamp6>` |
| `type` | ENUM | Lihat daftar di atas |
| `priority` | ENUM | LOW/MEDIUM/HIGH/CRITICAL |
| `status` | ENUM | OPEN/IN_PROGRESS/RESOLVED/CLOSED/CANCELLED |
| `title` | STRING(255) | |
| `description` | TEXT | Wajib |
| `location` | JSON | `{name, latitude, longitude}` — divalidasi di model |
| `reportedBy` | STRING | FK ke TeamMembers |
| `assignedTo` | STRING | FK ke TeamMembers |
| `assignedAt` | DATE | Auto-set saat assignedTo berubah |
| `resolvedAt` | DATE | Auto-set saat status=RESOLVED |
| `closedAt` | DATE | Auto-set saat status=CLOSED |
| `occurredAt` | DATE | Default NOW |
| `attachments` | JSON | Array file references |
| `metadata` | JSON | Data tambahan |
| `tags` | JSON | Array string |

**Instance methods:**
- `addNote(noteData)` — BUGGY: `notes` field di-comment
- `addAttachment(attachmentData)` — OK
- `addTag(tag)` / `removeTag(tag)` — OK
- `isOverdue()` — BUGGY: `estimatedResolutionTime` di-comment
- `getDurationMinutes()` — Hitung durasi insiden dalam menit

**Static methods:**
- `Incident.getActiveIncidents()` — Status OPEN atau IN_PROGRESS
- `Incident.getCriticalIncidents()` — Priority CRITICAL + aktif
- `Incident.getOverdueIncidents()` — BUGGY: `estimatedResolutionTime` di-comment
- `Incident.getIncidentsByLocation(lat, lng, radiusKm)` — Haversine query

---

#### `migrations/009_create_incident_tables.sql` (~169 baris)

**Tujuan:** DDL untuk tabel `incidents` dan `incident_updates`, plus sample data.

**Yang WAJIB diketahui kontributor:**
- Tabel `incident_updates` ada di SQL tetapi **tidak ada Sequelize model**-nya. Jika ingin menggunakan tabel ini, perlu dibuat model.
- Status di SQL mencakup `ESCALATED` dan `INVESTIGATING` yang tidak ada di Sequelize model ENUM.
- Field `severity` ada di SQL tapi tidak ada di Sequelize model (model hanya ada `priority`).
- Field `coordinates_lat` dan `coordinates_lng` ada di SQL tapi tidak di model — query spatial langsung ke DB akan bekerja tetapi Sequelize tidak akan mengenali field ini.
- SQL menggunakan `CHAR(36)` untuk UUID (kompatibel dengan MySQL UUID() function) tapi model menggunakan `DataTypes.STRING` untuk `id`.

---

### 1.2 Dependency Graph — Respons Insiden

```
api/incident-routes.js (Entry Point)
  ├── controllers/IncidentController.js
  │     ├── models/Incident.js
  │     │     └── config/database.js (Sequelize instance)
  │     ├── models/SecurityActivity.js (raw MySQL + Sequelize hybrid)
  │     └── models/TeamMember.js (raw MySQL)
  ├── middleware/auth-config.js (verifyToken, requireRole)
  ├── middleware/metrics.js (trackRequest)
  ├── controllers/ActivityController.js (lazy require)
  └── services/WebSocketService.js (lazy require — Socket.io)
```

**Entry point:** `api/incident-routes.js`
**Leaf nodes:** `config/database.js`, `middleware/auth-config.js`

---

### 1.3 Alur Data — Respons Insiden

```
Frontend
  │
  ▼
POST /api/incidents
  │
  ├── verifyToken (JWT middleware)
  ├── Normalisasi location (string/object/coordinates)
  ├── Validasi: type, priority, description, location
  ├── checkDuplicateIncident() → cek DB dalam 1 detik
  │
  ├── IncidentController.createIncident()
  │     ├── Incident.create() → INSERT ke tabel incidents
  │     ├── SecurityActivity.create() → Log INCIDENT_CREATED
  │     └── autoAssignCriticalIncident() → jika CRITICAL
  │           └── TeamMember.findAll(SUPERVISOR/COORDINATOR ON_DUTY)
  │
  └── WebSocketService.broadcastToRoom('control_center', 'incident_created')
        └── Socket.io emit ke semua client di room 'control_center'
```

---

### 1.4 Bug Kritis yang Perlu Diperbaiki (Sebelum Frontend Menggunakan Fitur Ini)

| # | Lokasi | Masalah | Dampak | Solusi |
|---|--------|---------|--------|--------|
| 1 | `models/Incident.js:109-205` | Field `notes`, `escalatedAt`, dll. di-comment | `addIncidentNote()` dan `escalateIncident()` gagal diam-diam | Aktifkan field atau jalankan migration kolom |
| 2 | `models/Incident.js:22-28` | ENUM type tidak cocok dengan migration SQL | Insert gagal untuk beberapa tipe insiden | Samakan ENUM antara model dan DB |
| 3 | `controllers/IncidentController.js:432` | `SecurityActivity.create()` di `escalateIncident()` menggunakan field `description`, `userId`, `performedBy` yang mungkin tidak ada di model SecurityActivity | Activity log eskalasi mungkin gagal | Periksa SecurityActivity model |
| 4 | `controllers/IncidentController.js:425-448` | `getIncidentTimeline()` menggunakan Sequelize include untuk TeamMember tapi asosiasi disabled | Timeline akan error | Ubah ke raw query atau hapus include |
| 5 | `api/incident-routes.js:656-674` | Route `/stats/dashboard` bisa ter-match oleh `/:id` jika posisi salah | Stats endpoint tidak bisa diakses | Pastikan route stats SEBELUM route `/:id` |

---

## 2. FITUR: ALERT PANIC

### 2.1 Inventaris File

---

#### `controllers/AlertController.js` — method `createPanicAlert()` (baris 974–1102)

**Tujuan:** Handler HTTP untuk panic button dari pengguna. Membuat Alert dengan konfigurasi emergency penuh.

**Yang WAJIB diketahui kontributor:**
- **Idempotency via `requestId`:** Jika requestId yang sama dikirim dua kali, response 200 (bukan 201) dengan alert yang sudah ada. Frontend HARUS generate requestId unik per press tombol panic.
- Alert dibuat dengan `targetRoles: ['SECURITY', 'ADMIN']` dan `channels: ['app', 'push']` — artinya `createAlertRecipients()` akan query TeamMember berdasarkan role ini.
- Broadcast via `broadcastAlert(alert)` yang memanggil **legacy** `websocket-service.js` (ws library), bukan Socket.io WebSocketService. Semua client yang terkoneksi (tanpa filtering role/room) akan menerima notifikasi.
- GPS bersifat opsional — alert tetap dibuat tanpa koordinat.

**createPanicAlert() — Input:**
```json
{
  "requestId": "string UNIK (wajib) — digunakan sebagai alertId dan idempotency key",
  "userId": "string (wajib) — ID pengguna yang menekan panic",
  "type": "EMERGENCY (default)",
  "gps": {
    "lat": -6.2088,
    "lng": 106.8456,
    "accuracy": 10
  },
  "metadata": {},
  "accuracy": "number (opsional, override gps.accuracy)",
  "timestamp": "ISO string (opsional)"
}
```

**createPanicAlert() — Response 201:**
```json
{
  "success": true,
  "message": "Panic alert created successfully",
  "data": {
    "id": "UUID (primary key)",
    "alertId": "requestId yang diberikan",
    "requestId": "requestId",
    "status": "ACTIVE",
    "timestamp": "ISO datetime"
  }
}
```

**createPanicAlert() — Response 200 (duplikat):**
```json
{
  "success": true,
  "message": "Panic alert already exists",
  "data": { /* full Alert object */ }
}
```

---

#### `controllers/AlertController.js` — Methods lainnya

**Endpoint CRUD lengkap untuk alerts:**

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/alerts` | `createAlert()` — Alert umum dengan banyak opsi |
| GET | `/api/alerts` | `getAlerts()` — List dengan filter + pagination |
| GET | `/api/alerts/:id` | `getAlertById()` — Detail alert dengan incident + recipients |
| PUT | `/api/alerts/:id` | `updateAlert()` — Update alert |
| DELETE | `/api/alerts/:id` | `deleteAlert()` — Soft delete |
| POST | `/api/alerts/:id/acknowledge` | `acknowledgeAlert()` — Acknowledge |
| POST | `/api/alerts/:id/resolve` | `resolveAlert()` — Resolve |
| GET | `/api/alerts/stats` | `getAlertStats()` — Statistik |
| GET | `/api/alerts/radius` | `getAlertsInRadius()` — BUGGY: PostGIS syntax di MySQL |
| POST | `/api/alerts/cleanup` | `cleanupExpired()` — Hapus yang expired |

**Bug kritis di `getAlertsInRadius()`:** Menggunakan `ST_DWithin` dan `::geography` yang merupakan sintaks **PostGIS/PostgreSQL**, tidak kompatibel dengan MySQL. Akan error jika dipanggil.

**Bug di stats query:** `::float` adalah cast syntax PostgreSQL, tidak bisa di MySQL.

**Bug di search:** `Op.iLike` adalah case-insensitive LIKE milik PostgreSQL, tidak ada di MySQL. Gunakan `Op.like` untuk MySQL.

---

#### `models/Alert.js` (~542 baris)

**Tujuan:** Sequelize model untuk tabel `alerts`. Schema lengkap dengan targeting, delivery tracking, lifecycle management.

**Yang WAJIB diketahui kontributor:**
- `alertId` (bukan `id`) adalah identifier bisnis. Format auto-generated: `YYYYMMDD-NNNN`. Untuk panic alert, `alertId` diisi dengan `requestId` dari frontend.
- `id` adalah UUID internal (primary key Sequelize).
- `sourceId` digunakan untuk idempotency — panic alert mengisi ini dengan `requestId`.
- Hook `beforeCreate` otomatis generate `alertId` jika tidak diset, dan sync `coordinatesLat/Lng` dari `location.lat/lng`.
- Soft delete dikelola manual via `deletedAt/deletedBy` (bukan Sequelize paranoid).
- `canBeAcknowledged()`: hanya jika status `ACTIVE` dan belum expired.
- `canBeResolved()`: hanya jika status `ACTIVE` atau `ACKNOWLEDGED` dan belum expired.
- Target typing: `targetRoles`, `targetTeams`, `targetUsers`, `targetZones`, `targetBuildings`, `geofenceIds` — semua JSONB array.

**Status lifecycle:**
```
DRAFT → ACTIVE → ACKNOWLEDGED → RESOLVED
                              ↘ EXPIRED (otomatis via cleanupExpired)
              ↘ CANCELLED
```

**Field penting untuk frontend:**

| Field | Type | Keterangan |
|-------|------|-----------|
| `alertId` | STRING UNIQUE | Identifier bisnis, gunakan ini untuk display |
| `title` | STRING | Judul alert |
| `message` | TEXT | Pesan alert |
| `type` | ENUM | SECURITY/EMERGENCY/MAINTENANCE/WEATHER/TRAFFIC/SYSTEM/CUSTOM |
| `category` | STRING | Contoh: 'PANIC_BUTTON' untuk panic alert |
| `severity` | ENUM | LOW/MEDIUM/HIGH/CRITICAL |
| `priority` | ENUM | LOW/MEDIUM/HIGH/URGENT |
| `status` | ENUM | DRAFT/ACTIVE/ACKNOWLEDGED/RESOLVED/EXPIRED/CANCELLED |
| `isEmergency` | BOOLEAN | `true` untuk panic alert |
| `isBroadcast` | BOOLEAN | `true` untuk panic alert |
| `location` | JSON | `{lat, lng, address, zone, building, floor, room}` |
| `source` | STRING | 'panic_button', 'camera', 'manual', dll. |
| `sourceId` | STRING | requestId untuk panic, cameraId untuk VIGI |
| `context` | JSONB | Data konteks tambahan (termasuk AI metadata untuk VIGI) |
| `mediaUrls` | JSONB | Array URL gambar/video (snapshot path untuk VIGI alert) |
| `channels` | JSONB | Array channel: ['app', 'push', 'email', 'sms', 'webhook'] |
| `totalRecipients` | INTEGER | Auto-updated oleh AlertRecipient hooks |
| `deliveredCount` | INTEGER | Auto-updated |
| `acknowledgedCount` | INTEGER | Auto-updated |

---

#### `models/AlertRecipient.js` (~410 baris)

**Tujuan:** Tracking pengiriman alert per recipient per channel.

**Yang WAJIB diketahui kontributor:**
- Setiap kombinasi (recipient × channel) menghasilkan 1 record AlertRecipient.
- Hook `afterCreate/afterUpdate/afterDestroy` otomatis update counter di tabel `alerts` (totalRecipients, deliveredCount, dll.).
- `responseTime` disimpan dalam **milidetik** (walaupun komentar field bilang "seconds" — ini adalah bug dokumentasi).
- Max retry: 3 kali (`canRetry()` false setelah 3 attempt).
- Hook `beforeUpdate` otomatis set timing fields (sentAt, deliveredAt, acknowledgedAt, failedAt) berdasarkan perubahan status.

**Lifecycle deliveryStatus:**
```
PENDING → SENT → DELIVERED → ACKNOWLEDGED
       ↘ FAILED (max 3 retry)
       ↘ BOUNCED
       ↘ IGNORED
```

---

#### `services/WebSocketService.js` (~494 baris) — Socket.io (BARU)

**Tujuan:** WebSocket service berbasis Socket.io dengan room management. Digunakan oleh IncidentController.

**Yang WAJIB diketahui kontributor:**
- **Tidak ada validasi token JWT** saat autentikasi WebSocket. `handleAuthentication()` menerima data user apapun yang dikirim client.
- Room mapping: `admin` role → admin_room + monitoring_room + alerts_room; `security` role → security_room + alerts_room; lainnya → monitoring_room.
- Periodic updates: system stats setiap 30 detik ke monitoring_room; heartbeat setiap 60 detik ke semua.
- `broadcastToUser(userId, event, data)` — TIDAK ADA di implementasi! Method ini dipanggil di incident-routes.js tapi tidak ada di WebSocketService. Ini adalah **bug** — user-specific notification tidak berfungsi.

**Public methods:**
- `initialize(server)` — Inisialisasi Socket.io pada HTTP server
- `broadcastToRoom(roomName, event, data)` — Broadcast ke room tertentu
- `broadcastToAll(event, data)` — Broadcast ke semua client
- `broadcast(event, data)` — Alias broadcastToAll
- `sendNotificationToRole(role, event, data)` — Iterasi connectedClients, emit ke role tertentu
- `sendEmergencyAlert(alertData)` — Broadcast emergency ke semua + log activity

**Rooms yang tersedia:**
- `admin_room` — Admin users
- `security_room` — Security officers
- `monitoring_room` — Semua authenticated users
- `alerts_room` — Admin + Security

---

#### `services/websocket-service.js` (~156 baris) — ws library (LEGACY)

**Tujuan:** WebSocket service sederhana berbasis `ws` library. Digunakan oleh AlertController untuk broadcast alert.

**Yang WAJIB diketahui kontributor:**
- **Tidak ada room/role filtering** — semua client menerima semua broadcast.
- Digunakan khusus oleh AlertController: `broadcastAlert()` dan `broadcastAlertUpdate()`.
- Message format: `{ type: 'ALERT_CREATED' | 'ALERT_UPDATED', data: alert, timestamp }`.
- Ini adalah **implementasi terpisah** dari WebSocketService.js. Frontend harus connect ke KEDUANYA atau ada unifikasi.

**Events yang di-emit ke semua client:**
- `ALERT_CREATED` — saat alert baru dibuat (termasuk panic alert)
- `ALERT_UPDATED` — saat alert diupdate

---

#### `services/vigi/aiPipeline.js` (~144 baris)

**Tujuan:** Analisis snapshot kamera VIGI menggunakan GPT-4o-mini via OpenRouter. Mengembalikan structured JSON.

**Yang WAJIB diketahui kontributor:**
- Menggunakan **OpenRouter** (bukan OpenAI langsung) dengan model default `gpt-4o-mini`. Set `OPENROUTER_API_KEY` di .env.
- Detail `low` untuk image digunakan (~85 token per gambar) — cukup untuk analisis postur dan situasi umum.
- Semua deskripsi dalam **Bahasa Indonesia**.
- Severity rubric: `info` → aktivitas normal; `warning` → mencurigakan tapi tidak darurat; `critical` → ancaman nyata.
- `recommended_action` auto-fallback jika field tidak ada di response: `trigger_panic` jika critical, `notify_security` jika warning, `log` jika info.

**Output schema:**
```typescript
{
  description: string,           // 1-2 kalimat Bahasa Indonesia
  person_count: number,
  vehicle_count: number,
  is_false_positive: boolean,
  severity: "info" | "warning" | "critical",
  severity_reason: string,       // Bahasa Indonesia
  tags: string[],                // 3-6 keyword Inggris
  recommended_action: "none" | "log" | "notify_security" | "trigger_panic",
  _meta: {
    model: string,
    tokens: number,
    latency_ms: number
  }
}
```

---

#### `services/vigi/alertEnricher.js` (~138 baris)

**Tujuan:** Menyimpan hasil analisis AI ke database — Alert record + snapshot file + panic_alerts (jika critical).

**Yang WAJIB diketahui kontributor:**
- Snapshot disimpan ke `uploads/snapshots/<cameraId>_<timestamp>_<now>.jpg` (path relatif dari `process.cwd()`).
- AI metadata disimpan di dua tempat: field `context.vigi` (JSON) di tabel alerts, DAN kolom `ai_*` individual (jika migrasi `20260428_120000_add_ai_columns_to_alerts.sql` sudah dijalankan).
- Jika AI columns belum ada (migration belum run), raw SQL UPDATE di-catch dan diabaikan (tidak crash).
- Auto-escalate ke `panic_alerts` tabel jika `severity=critical` ATAU `recommended_action=trigger_panic`. Tabel `panic_alerts` adalah tabel **terpisah** dari `alerts`, tidak ada Sequelize model.
- Mapping severity AI → Alert model: `info→LOW`, `warning→HIGH`, `critical→CRITICAL`.

**Flow persistensi:**
```
analyzeSnapshot() result
  ├── Save JPEG → uploads/snapshots/
  ├── Alert.create() → tabel alerts (core record)
  ├── sequelize.query UPDATE → kolom ai_* (jika migration sudah run)
  └── jika critical/trigger_panic → INSERT ke panic_alerts (raw SQL)
```

---

### 2.2 Pipeline Panic Alert — Dua Jalur Trigger

#### Jalur 1: Manual (Pengguna Mobile → HTTP)

```
Mobile App
  │
  ├── Generate requestId unik (UUID atau timestamp)
  ├── Dapatkan GPS coordinates (lat, lng)
  │
  ▼
POST /api/panic (atau /api/alerts/panic — perlu dicek router.js)
  Body: { requestId, userId, type, gps: {lat, lng, accuracy} }
  │
  ├── AlertController.createPanicAlert()
  │     ├── Validasi requestId + userId
  │     ├── Validasi GPS (opsional)
  │     ├── Idempotency check → Alert.findOne({ sourceId: requestId })
  │     ├── Alert.create() → type=EMERGENCY, category=PANIC_BUTTON,
  │     │   severity=CRITICAL, priority=URGENT, isEmergency=true, isBroadcast=true
  │     ├── createAlertRecipients(targetRoles: ['SECURITY', 'ADMIN'])
  │     ├── logActivity(PANIC_ALERT_CREATED)
  │     └── broadcastAlert(alert) → websocket-service.js → semua WS client
  │
  Response 201: { id, alertId, requestId, status: 'ACTIVE' }
```

#### Jalur 2: Otomatis (Kamera VIGI → AI Pipeline)

```
Kamera VIGI (RTSP/Event)
  │
  ▼
vigiEventListener.js → event: PeopleDetection, VehicleDetection, dll.
  │
  ▼
vigiSnapshot.js → ambil JPEG dari RTSP stream
  │
  ▼
aiPipeline.analyzeSnapshot({ imageBuffer, eventMeta, location })
  │  (GPT-4o-mini via OpenRouter, ~500ms-2s)
  │
  ├── result.severity = 'critical' atau recommended_action = 'trigger_panic'
  │   │
  │   ▼
  │   alertEnricher.persistEnrichedAlert()
  │         ├── Save JPEG → uploads/snapshots/
  │         ├── Alert.create() → type=SECURITY, source=camera, isEmergency=true
  │         ├── UPDATE alerts SET ai_* ...  (jika migration run)
  │         └── INSERT panic_alerts (source='ai_auto_escalation')
  │
  └── result.severity = 'warning'
      │
      ▼
      alertEnricher.persistEnrichedAlert()
            ├── Alert.create() → type=SECURITY, severity=HIGH
            └── (TIDAK ada panic_alerts entry)
```

---

### 2.3 Tabel Database: `panic_alerts` (Terpisah dari `alerts`)

**Tabel ini hanya diisi oleh AI pipeline (alertEnricher.js), bukan oleh panic button manual.**

```sql
CREATE TABLE panic_alerts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source          VARCHAR(64),       -- 'ai_auto_escalation'
  source_alert_id CHAR(36),          -- FK ke alerts.id
  camera_id       VARCHAR(64),
  message         TEXT,              -- AI description
  severity        VARCHAR(16),       -- 'critical'
  reason          TEXT,              -- AI severity_reason
  triggered_at    TIMESTAMP NULL,
  status          VARCHAR(16),       -- 'open'
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);
```

**Tidak ada API endpoint atau Sequelize model untuk tabel ini.** Frontend tidak bisa query panic_alerts secara langsung saat ini.

---

### 2.4 AI Columns di Tabel `alerts` (Setelah Migration)

Setelah menjalankan `migrations/20260428_120000_add_ai_columns_to_alerts.sql`:

| Kolom | Type | Keterangan |
|-------|------|-----------|
| `camera_id` | VARCHAR(64) | ID kamera VIGI |
| `camera_location` | VARCHAR(255) | Lokasi kamera |
| `event_type` | VARCHAR(64) | PeopleDetection, VehicleDetection, dll. |
| `event_time` | TIMESTAMP | Waktu event kamera |
| `ai_description` | TEXT | Deskripsi analisis AI (Bahasa Indonesia) |
| `ai_person_count` | INT | Jumlah orang terdeteksi |
| `ai_vehicle_count` | INT | Jumlah kendaraan terdeteksi |
| `ai_severity` | VARCHAR(16) | info/warning/critical |
| `ai_severity_reason` | TEXT | Alasan severity (Bahasa Indonesia) |
| `ai_tags` | JSON | Array keyword |
| `ai_is_false_positive` | TINYINT | 1 jika false positive |
| `ai_recommended_action` | VARCHAR(32) | none/log/notify_security/trigger_panic |
| `ai_snapshot_path` | VARCHAR(255) | Path relatif snapshot: `/uploads/snapshots/...` |
| `ai_processed_at` | TIMESTAMP | Waktu AI selesai proses |
| `ai_model` | VARCHAR(64) | Model yang digunakan |
| `ai_tokens_used` | INT | Token yang dikonsumsi |
| `ai_latency_ms` | INT | Latency AI dalam ms |

---

### 2.5 Dependency Graph — Alert Panic

```
AlertController.js (Entry Point)
  ├── models/Alert.js
  │     └── config/database.js
  ├── models/AlertRecipient.js
  │     └── models/Alert.js (circular via require — perlu hati-hati)
  ├── models/TeamMember.js (untuk createAlertRecipients)
  ├── models/Incident.js (untuk getAlerts include)
  ├── services/websocket-service.js (legacy ws — broadcastAlert)
  ├── services/activity-service.js (logActivity)
  └── utils/geo-utils.js (validateCoordinates, calculateDistance)
      utils/validation-utils.js (sanitizeInput, validateUUID)

services/vigi/index.js (VIGI Orchestrator)
  ├── services/vigi/vigiEventListener.js
  ├── services/vigi/vigiSnapshot.js
  ├── services/vigi/aiPipeline.js
  │     └── openai (via OpenRouter)
  └── services/vigi/alertEnricher.js
        ├── models/Alert.js
        └── config/database.js (raw query untuk ai_* + panic_alerts)
```

---

## 3. PANDUAN INTEGRASI FRONTEND

### 3.1 Setup WebSocket Connection

**PENTING:** Ada dua WebSocket server yang berjalan bersamaan:

| | WebSocket Service (Socket.io) | websocket-service (ws legacy) |
|-|-------------------------------|-------------------------------|
| Library | socket.io-client | WebSocket native / ws |
| Port | Sama dengan HTTP server | Sama dengan HTTP server |
| Path | `/socket.io` | `/` (default) |
| Filtering | Room-based + role-based | Broadcast semua |
| Digunakan untuk | Incident events | Alert events |

**Untuk event incident:**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  socket.emit('authenticate', {
    user: { id: userId, name: userName },
    token: jwtToken,
    role: userRole // 'admin' | 'security' | lainnya
  });
});

// Events incident
socket.on('incident_created', (data) => { /* data.incident */ });
socket.on('incident_updated', (data) => { /* data.incident, data.changes */ });
socket.on('incident_escalated', (data) => { /* data.incident, data.escalation */ });
socket.on('incident_escalated_to_you', (data) => { /* data.incident, data.reason */ });
socket.on('incident_assigned', (data) => { /* data.incident */ });
socket.on('high_priority_incident', (data) => { /* data.incident */ });
```

**Untuk event alert/panic:**
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'ALERT_CREATED') {
    // msg.data = full Alert object
    if (msg.data.category === 'PANIC_BUTTON') {
      // Ini adalah panic alert dari pengguna
    }
    if (msg.data.source === 'camera') {
      // Ini adalah alert dari kamera VIGI
    }
  }
  
  if (msg.type === 'ALERT_UPDATED') {
    // msg.data = updated Alert object
  }
};
```

### 3.2 Membuat Panic Alert dari Mobile

```javascript
// Generate requestId unik SEBELUM request (simpan untuk retry)
const requestId = crypto.randomUUID(); // atau timestamp-based

const response = await fetch('/api/panic', {  // cek URL exact di router.js
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    requestId,          // WAJIB — unik per press tombol
    userId: currentUser.id,  // WAJIB
    type: 'EMERGENCY',  // opsional, default EMERGENCY
    gps: {
      lat: location.latitude,
      lng: location.longitude,
      accuracy: location.accuracy
    }
  })
});

// Response 201: berhasil dibuat
// Response 200: sudah ada (duplikat requestId) — tetap anggap sukses
// Response 400: requestId atau userId kosong, atau GPS invalid
```

### 3.3 Membuat Incident dari Frontend

```javascript
const response = await fetch('/api/incidents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'SUSPICIOUS_ACTIVITY',  // Wajib — lihat daftar valid type
    priority: 'HIGH',              // Wajib: LOW|MEDIUM|HIGH|CRITICAL
    description: 'Deskripsi insiden', // Wajib
    title: 'Judul opsional',          // Opsional
    location: {
      name: 'Nama lokasi',
      latitude: -6.2088,   // Wajib (number)
      longitude: 106.8456  // Wajib (number)
    },
    reportedBy: currentUser.id,   // Opsional
    metadata: {}                   // Opsional
  })
});
```

### 3.4 Update Status Incident

```javascript
await fetch(`/api/incidents/${incidentId}`, {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'IN_PROGRESS',  // OPEN|IN_PROGRESS|RESOLVED|CLOSED|CANCELLED
    // opsional:
    priority: 'CRITICAL',
    assignedTo: 'teamMemberId',
    notes: 'Catatan update'
  })
});
```

### 3.5 Mendapatkan List Alert dengan Filter

```javascript
const params = new URLSearchParams({
  type: 'EMERGENCY',        // opsional
  severity: 'CRITICAL',    // opsional
  status: 'ACTIVE',        // opsional, bisa comma-separated: 'ACTIVE,ACKNOWLEDGED'
  isEmergency: 'true',     // opsional
  page: 1,
  limit: 20,
  sortBy: 'created_at',
  sortOrder: 'DESC'
});

const response = await fetch(`/api/alerts?${params}`, {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});
// response: { alerts: [], count: N, pagination: {...} }
```

---

## 4. MASALAH YANG PERLU DIPERHATIKAN FRONTEND DEVELOPER

### 4.1 Hal yang Belum Berfungsi (DO NOT USE)

| Fitur | Endpoint | Masalah |
|-------|---------|---------|
| Cari alert di radius | `GET /api/alerts/radius` | PostGIS syntax, crash di MySQL |
| Stats average delivery | `GET /api/alerts/stats` | `::float` syntax PostgreSQL |
| Search alert by text | `GET /api/alerts?search=...` | `Op.iLike` tidak ada di MySQL |
| Broadcast ke user spesifik | Internal | `broadcastToUser()` tidak exist di WebSocketService |
| Note insiden | `POST /api/incidents/:id/notes` | Field `notes` di-comment di model |
| Eskalasi insiden | `POST /api/incidents/:id/escalate` | Field escalation di-comment di model |
| Timeline insiden | `GET /api/incidents/:id/timeline` | Sequelize include ke raw MySQL model — akan error |
| Query panic_alerts | — | Tidak ada API endpoint atau model |

### 4.2 Dua WebSocket yang Berbeda

Frontend perlu connect ke dua WebSocket:
1. **Socket.io** → untuk event incident (incident_created, incident_updated, dll.)
2. **WebSocket native/ws** → untuk event alert (ALERT_CREATED, ALERT_UPDATED)

Ini adalah technical debt yang harus diselesaikan — idealnya unifikasi ke satu protokol.

### 4.3 WebSocket Token Tidak Divalidasi

`WebSocketService.handleAuthentication()` tidak memvalidasi JWT. Siapapun bisa mengklaim role apapun saat connect via Socket.io.

---

## 5. CONTRIBUTOR CHECKLIST

### Risiko & Gotcha

- **Alert.model.js vs websocket-service.js** — AlertController menggunakan ws legacy untuk broadcast; pastikan tidak pindah ke Socket.io tanpa update frontend
- **Incident ENUM mismatch** — Saat menambah tipe insiden baru, update di 3 tempat: model ENUM, route validation array, dan DB migration
- **panic_alerts vs alerts** — Dua tabel berbeda; VIGI critical alert masuk ke panic_alerts (raw SQL), panic button masuk ke alerts (Sequelize)
- **requestId idempotency** — Selalu generate requestId baru setiap kali pengguna menekan panic button; jangan reuse
- **GPS coordinates format** — Incident menggunakan `latitude/longitude`; Alert menggunakan `lat/lng`; jangan tertukar

### Langkah Verifikasi Sebelum Perubahan

1. Pastikan kolom DB cocok dengan model Sequelize: `DESCRIBE incidents;` dan `DESCRIBE alerts;`
2. Pastikan migrasi AI columns sudah dijalankan: `SHOW COLUMNS FROM alerts LIKE 'ai_%';`
3. Test WebSocket connection: Socket.io (port 3001/socket.io) dan ws (port 3001)
4. Cek ENV: `OPENROUTER_API_KEY`, `FRONTEND_URL` untuk CORS Socket.io
5. Test panic alert idempotency: kirim requestId yang sama dua kali, pastikan dapat response 200

### Test yang Disarankan Sebelum PR

- `api/__tests__/panic.test.js` — GPS validation, rate limiting, idempotency, success response
- `api/__tests__/incidents.test.js` — Incident CRUD
- `services/vigi/vigi.test.js` dan `vigi-unit.test.js` — AI pipeline
- Manual: tekan panic button → check alert muncul di WebSocket + tersimpan di DB
- Manual: buat incident → check WebSocket event di control_center room

---

## 6. DEPENDENCY GRAPH LENGKAP

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HTTP Request                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
  /api/incidents                              /api/panic (/api/alerts/panic)
  incident-routes.js                         AlertController.createPanicAlert()
          │                                           │
          ▼                                           ▼
  IncidentController.js                      Alert.create() [Sequelize]
  Incident.create() [Sequelize]              AlertRecipient.bulkCreate()
  SecurityActivity.create()                  logActivity()
          │                                           │
          ▼                                           ▼
  WebSocketService.js (Socket.io)            websocket-service.js (ws)
  → 'incident_created' ke control_center     → ALERT_CREATED ke semua client
          │                                           │
          ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Clients                             │
│  Socket.io client (incident events)  WS client (alert events)       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    VIGI Camera Pipeline                              │
│                                                                      │
│  vigiEventListener → vigiSnapshot → aiPipeline (GPT-4o-mini)        │
│                                           │                          │
│                              alertEnricher.persistEnrichedAlert()    │
│                                    ├── Alert.create() [Sequelize]    │
│                                    ├── UPDATE alerts SET ai_* [raw]  │
│                                    └── INSERT panic_alerts [raw]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. UPDATE INDEX

Dokumen ini tersedia di: `docs/deep-dive-insiden-dan-alert-panic.md`

---

_Dihasilkan oleh `document-project` workflow (deep-dive mode)_
_Dokumentasi Dasar: docs/index.md_
_Tanggal Analisis: 2026-05-05_
_Mode Analisis: Exhaustive_
