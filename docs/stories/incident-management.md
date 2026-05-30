# Story Card: Incident Management

**Feature:** Incident Management (Case Tracking & Response)
**Status:** Implemented (~80%), auto-link ke Panic baru ditambahkan
**Sprint:** v1.0.0
**Last Updated:** 2026-05-30

---

## User Story

**Sebagai** supervisor/guard CIFO Guard dashboard,
**Saya ingin** mencatat, melacak, dan menutup insiden keamanan secara formal,
**Sehingga** setiap kejadian terdokumentasi dengan baik dan bisa di-assign ke officer yang bertanggung jawab.

### Perbedaan Incident vs Alert

| | Alert (Panic) | Incident |
|---|---|---|
| **Trigger** | Otomatis dari panic button | Manual oleh guard/supervisor, atau auto dari panic |
| **Tujuan** | Broadcast notifikasi ke semua guard | Formal case — investigasi, penugasan, closure |
| **Audience** | Semua guard on-duty (broadcast) | Satu officer (assigned) |
| **Lifecycle** | ACTIVE → ACKNOWLEDGED → RESOLVED | OPEN → IN_PROGRESS → RESOLVED → CLOSED |

### Scope

**IN SCOPE:**
- Buat incident manual oleh guard/supervisor
- Auto-create incident dari panic alert (BARU — v1.0.0)
- List & filter incident (status, priority, type)
- Detail incident + timeline/history
- Update status (OPEN → IN_PROGRESS → RESOLVED → CLOSED)
- Assign officer ke incident
- Eskalasi ke supervisor (role-gated)
- Tambah catatan (notes) ke incident
- Dashboard stats (count per status/priority)
- Kanban view di frontend (3 kolom: Dilaporkan, Dalam Proses, Selesai)

**OUT OF SCOPE (v1.0.0):**
- Upload attachment/bukti foto — endpoint ada, belum diimplementasi frontend
- Eskalasi antar-incident (relatedIncidents) — schema ada, belum diimplementasi
- Notifikasi real-time ke officer yang di-assign — WebSocket broadcast ada, belum tested
- Form create incident dari frontend — hanya via API atau auto dari panic

---

## Acceptance Criteria

### AC-1: Auth Required

```
GIVEN user belum login
WHEN mengakses endpoint /api/incidents
THEN response 401 Unauthorized
```

### AC-2: Buat Incident Manual (via API)

```
GIVEN user sudah login (guard/supervisor)
WHEN POST /api/incidents dengan type, priority, description, location (lat/lng)
THEN response 201 dengan incidentId
AND status = OPEN
AND incident muncul di GET /api/incidents
```

### AC-3: Validasi Field Wajib

```
GIVEN user login
WHEN POST /api/incidents tanpa field wajib (type/priority/description)
THEN response 400 VALIDATION_ERROR

WHEN POST /api/incidents tanpa koordinat lokasi (latitude/longitude)
THEN response 400 VALIDATION_ERROR — "Location must include valid lat/lng"
```

### AC-4: Auto-Create dari Panic Alert

```
GIVEN panic button dipencet (POST /api/panic berhasil)
WHEN backend memproses panic alert
THEN satu Incident otomatis dibuat dengan:
  - type = PANIC_ALERT
  - priority = CRITICAL
  - status = OPEN
  - metadata.autoCreated = true
  - metadata.sourceAlertId = Alert.id
AND Alert.incidentId diisi dengan Incident.id yang baru dibuat

GIVEN auto-create incident gagal (contoh: FK error)
WHEN panic diproses
THEN panic Alert tetap berhasil dibuat (non-fatal)
AND response POST /panic tetap 201
AND incidentId = null di response
```

### AC-5: List & Filter

```
GIVEN user login
WHEN GET /api/incidents
THEN response berisi array incidents + total

WHEN GET /api/incidents?status=OPEN
THEN semua incident dalam response berstatus OPEN

WHEN GET /api/incidents?priority=CRITICAL
THEN semua incident dalam response priority CRITICAL
```

### AC-6: Detail Incident

```
GIVEN incident dengan ID valid
WHEN GET /api/incidents/:id
THEN response berisi data lengkap: id, incidentNumber, type, priority, status, location, reportedBy, createdAt

GIVEN ID tidak ada
WHEN GET /api/incidents/:id
THEN response 404
```

### AC-7: Update Status

```
GIVEN incident status OPEN
WHEN PATCH /api/incidents/:id dengan status = IN_PROGRESS
THEN response 200 dengan status = IN_PROGRESS

GIVEN status tidak valid (bukan OPEN/IN_PROGRESS/RESOLVED/CLOSED/CANCELLED)
WHEN PATCH /api/incidents/:id
THEN response 400 dengan validStatuses array
```

### AC-8: Assign Officer

```
GIVEN incident exists
WHEN PATCH /api/incidents/:id dengan assignedTo = "guard_001"
THEN response 200
AND incident.assignedTo = "guard_001"
```

### AC-9: Eskalasi (Role-Gated)

```
GIVEN user login sebagai SUPERVISOR atau COORDINATOR
WHEN POST /api/incidents/:id/escalate dengan reason
THEN response 200 eskalasi berhasil

GIVEN POST /api/incidents/:id/escalate tanpa reason
THEN response 400 "Escalation reason is required"
```

### AC-10: Notes

```
GIVEN incident exists
WHEN POST /api/incidents/:id/notes dengan note (non-empty)
THEN response 200 note berhasil ditambahkan

WHEN POST /api/incidents/:id/notes dengan note kosong
THEN response 400
```

### AC-11: Timeline & Activities

```
GIVEN incident ada aktivitas (create, status change, note)
WHEN GET /api/incidents/:id/timeline
THEN response berisi array timeline entries

WHEN GET /api/incidents/:id/activities
THEN response berisi log aktivitas
```

### AC-12: Resolve & Close

```
GIVEN incident IN_PROGRESS
WHEN PATCH /api/incidents/:id dengan status = RESOLVED
THEN response 200 dengan status = RESOLVED
AND resolvedAt atau updatedAt terisi

WHEN PATCH /api/incidents/:id dengan status = CLOSED
THEN response 200 dengan status = CLOSED
```

### AC-13: Dashboard Stats

```
GIVEN incidents ada di database
WHEN GET /api/incidents/stats/dashboard?period=today
THEN response 200 dengan data statistik incident hari ini
```

### AC-14: Kanban View (Frontend)

```
GIVEN incidents ada di database
WHEN user buka halaman /insiden
THEN incidents tampil dalam 3 kolom Kanban:
  - "Dilaporkan" (OPEN) — biru
  - "Dalam Proses" (IN_PROGRESS) — amber
  - "Selesai" (RESOLVED + CLOSED) — hijau

WHEN user klik incident card
THEN detail pane terbuka di sebelah kanan
AND menampilkan: incidentNumber, type, priority, status, lokasi, reporter, assignee, waktu
```

---

## Test Cases

### TC-1: Happy Path Manual

```
GIVEN supervisor login
WHEN POST /incidents dengan SECURITY_BREACH + HIGH + koordinat valid
THEN 201 + incidentId tersimpan
AND GET /incidents — incident muncul di list
AND GET /incidents/:id — detail lengkap ada
```

### TC-2: Auto-Create dari Panic

```
GIVEN guard trigger POST /panic dengan GPS valid
WHEN backend proses
THEN response 201 + incidentId ada di response data
AND GET /incidents/:id — type=PANIC_ALERT, priority=CRITICAL, status=OPEN
AND metadata.autoCreated = true
AND metadata.sourceAlertId match alertId panic
```

### TC-3: Validasi Field

```
GIVEN POST /incidents tanpa description
THEN 400 VALIDATION_ERROR

GIVEN POST /incidents tanpa lokasi lat/lng
THEN 400 "Location must include valid latitude and longitude"

GIVEN POST /incidents dengan type tidak valid
THEN 400 "Invalid incident type"
```

### TC-4: Lifecycle Status

```
GIVEN incident OPEN → PATCH status=IN_PROGRESS → 200 IN_PROGRESS
THEN PATCH status=RESOLVED → 200 RESOLVED, resolvedAt ada
THEN PATCH status=CLOSED → 200 CLOSED
```

### TC-5: 404 & Edge Cases

```
GIVEN GET /incidents/id-tidak-ada → 404
GIVEN PATCH /incidents/id-tidak-ada → 404
GIVEN POST /incidents tanpa auth → 401
GIVEN POST /incidents/:id/escalate tanpa reason → 400
```

### TC-6: Notes & Timeline

```
GIVEN incident exists
WHEN POST /incidents/:id/notes dengan note valid → 200
AND GET /incidents/:id/timeline → ada entry baru
AND GET /incidents/:id/activities → ada log
```

### TC-7: Kanban Frontend

```
GIVEN incidents OPEN + IN_PROGRESS + RESOLVED ada di DB
WHEN user buka /insiden
THEN setiap kolom menampilkan incident yang sesuai status
AND klik card → detail pane terbuka dengan data lengkap
```

---

## Definition of Done

### Functional ✅ / ❌

- [ ] AC-1: Auth required — 401 tanpa token
- [ ] AC-2: Create manual — 201 + incidentId
- [ ] AC-3: Validasi field wajib — 400 dengan pesan jelas
- [ ] AC-4: **Auto-create dari panic — incidentId ada di response POST /panic**
- [ ] AC-5: List & filter — array + filter status/priority bekerja
- [ ] AC-6: Detail + 404
- [ ] AC-7: Update status + validasi
- [ ] AC-8: Assign officer
- [ ] AC-9: Eskalasi + validasi reason
- [ ] AC-10: Notes + validasi kosong
- [ ] AC-11: Timeline + activities
- [ ] AC-12: Resolve → resolvedAt ada + Close
- [ ] AC-13: Dashboard stats
- [ ] AC-14: Kanban frontend 3 kolom

### Technical

- [ ] Auto-create incident non-fatal — panic tidak gagal meski incident gagal
- [ ] Alert.incidentId terisi setelah panic (verifikasi di GET /alerts/:id)
- [ ] Tidak ada console error saat halaman /insiden dibuka
- [ ] WebSocket broadcast `incident_created` diterima frontend (control_center room)

### Out of Scope (Eksplisit TIDAK dikerjakan di v1.0.0)

- ~~Upload attachment dari frontend~~
- ~~Notifikasi real-time ke officer assigned~~
- ~~Form create incident dari UI~~
- ~~Related incidents linking~~

---

## Technical Reference

### API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/incidents` | JWT | Buat incident manual |
| GET | `/api/incidents` | JWT | List + filter incidents |
| GET | `/api/incidents/:id` | JWT | Detail incident |
| PATCH | `/api/incidents/:id` | JWT | Update status/priority/assignee |
| PUT | `/api/incidents/:id` | JWT | Update (alias PATCH) |
| POST | `/api/incidents/:id/escalate` | JWT + SUPERVISOR | Eskalasi |
| GET | `/api/incidents/:id/timeline` | JWT | Timeline history |
| GET | `/api/incidents/:id/activities` | JWT | Activity log |
| POST | `/api/incidents/:id/notes` | JWT | Tambah catatan |
| GET | `/api/incidents/stats/dashboard` | JWT | Stats dashboard |

### Valid Values

**type:** `SECURITY_BREACH`, `FIRE`, `MEDICAL_EMERGENCY`, `THEFT`, `VANDALISM`, `SUSPICIOUS_ACTIVITY`, `EQUIPMENT_FAILURE`, `POWER_OUTAGE`, `FLOOD`, `EARTHQUAKE`, `PANIC_ALERT`, `UNAUTHORIZED_ACCESS`, `OTHER`

**priority:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**status:** `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`

### Files

| Area | File |
|------|------|
| API routes | `backend/api/incident-routes.js` |
| Controller | `backend/controllers/IncidentController.js` |
| Model | `backend/models/Incident.js` |
| DB schema | `backend/migrations/009_create_incident_tables.sql` |
| Frontend view | `src/features/incident-response/IncidentResponseView.jsx` |
| Frontend Kanban | `src/features/incident-response/IncidentKanban.jsx` |
| Frontend detail | `src/features/incident-response/IncidentDetailPane.jsx` |
| Auto-create logic | `backend/controllers/AlertController.js` (createPanicAlert) |

### Auto-Create Flow (Baru)

```
POST /api/panic
  └─ AlertController.createPanicAlert()
      ├─ Alert.create() → Alert ACTIVE
      ├─ broadcastAlert()
      ├─ Incident.create()  ← AUTO, type=PANIC_ALERT, priority=CRITICAL
      │    metadata.sourceAlertId = Alert.id
      │    metadata.autoCreated = true
      ├─ Alert.update({ incidentId: Incident.id })
      └─ response 201 { alertId, incidentId }
```

---

_Generated from codebase analysis 2026-05-30_
_Source: `backend/controllers/AlertController.js`, `backend/controllers/IncidentController.js`, `backend/api/incident-routes.js`, `src/features/incident-response/`_
