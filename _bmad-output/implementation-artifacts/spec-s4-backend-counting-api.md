---
title: 'Backend Counting API'
type: 'feature'
created: '2026-06-17'
status: 'done'
baseline_commit: 'b6f11d5'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CCTV AI Count perlu backend API untuk menerima crossing event dari Python vision worker dan menyajikan data live count per kamera ke frontend. Belum ada endpoint counting di backend saat ini.

**Approach:** Tambah Sequelize model `CrossingEvent`, migration untuk tabel `crossing_events`, controller `CountingController`, dan routes `/counting/*`. Python worker POST event masuk/keluar, frontend GET live count + summary. WebSocket broadcast setiap ada event baru.

## Boundaries & Constraints

**Always:**
- Gunakan pattern yang sama dengan codebase existing (Sequelize model, Controller class, route file, mount di router.js)
- Auth via `verifyToken` pada semua endpoint
- `camera_id` FK ke tabel `cameras` (string ID, bukan UUID)
- Timestamp dari worker (bukan server time) — worker kirim `crossed_at`
- WebSocket broadcast via existing `WebSocketService`

**Ask First:**
- Perlu rate limiting untuk POST event?
- Perlu batch POST (multiple events sekaligus)?

**Never:**
- Jangan ubah schema tabel `cameras` yang sudah ada
- Jangan ubah existing routes/controllers
- Jangan tambah dependency baru ke package.json

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Worker POST crossing | `{camera_id, direction: "in", crossed_at}` | 201 + event saved + WS broadcast | 400 if missing fields, 404 if camera not found |
| GET count per kamera | `GET /counting/cameras/:id/count` | `{camera_id, in: N, out: M, inside: N-M}` | 404 if camera not found |
| GET summary semua | `GET /counting/summary` | Array of count per camera | Empty array if no data |
| GET count dengan date filter | `?date=2026-06-17` | Count hanya untuk hari itu | Default hari ini |
| Daily reset | Midnight / new date param | Count mulai dari 0 | N/A |
| Invalid direction | `direction: "left"` | 400 Bad Request | Error message |

</frozen-after-approval>

## Code Map

- `backend/models/CrossingEvent.js` -- NEW: Sequelize model for crossing_events table
- `backend/migrations/20260617-create-crossing-events.js` -- NEW: migration create table
- `backend/controllers/CountingController.js` -- NEW: controller with createEvent, getCount, getSummary
- `backend/routes/counting-routes.js` -- NEW: Express router for /counting/*
- `backend/api/router.js:1257` -- Mount counting routes
- `backend/services/WebSocketService.js` -- Add broadcast method for counting events

## Tasks & Acceptance

**Execution:**
- [x] `backend/models/CrossingEvent.js` -- Sequelize model: id (UUID PK), camera_id (STRING FK), direction (ENUM 'in'/'out'), crossed_at (DATE), metadata (JSON) -- Core data model
- [x] `backend/migrations/20260617-create-crossing-events.js` -- Create crossing_events table with indexes on camera_id, direction, crossed_at -- DB schema
- [x] `backend/controllers/CountingController.js` -- createEvent (POST), getCameraCount (GET per camera), getSummary (GET all cameras) -- Business logic
- [x] `backend/routes/counting-routes.js` -- POST /event, GET /cameras/:id/count, GET /summary, all behind verifyToken -- Route definitions
- [x] `backend/api/router.js` -- Add `router.use('/counting', countingRoutes)` -- Mount routes
- [x] `backend/services/WebSocketService.js` -- Add broadcastCountingEvent method, emit to MONITORING room -- Realtime updates

**Acceptance Criteria:**
- Given worker POST valid crossing event, when endpoint hit, then event saved + 201 returned + WS broadcast sent
- Given frontend GET /counting/cameras/:id/count, when camera exists, then return {in, out, inside} counts
- Given frontend GET /counting/summary, when data exists, then return array of all camera counts
- Given invalid camera_id or direction, when POST/GET, then appropriate 400/404 error
- Given date filter param, when GET count, then only return counts for that date

## Suggested Review Order

1. [backend/models/CrossingEvent.js](backend/models/CrossingEvent.js) — Sequelize model (start here)
2. [backend/migrations/20260617-create-crossing-events.js](backend/migrations/20260617-create-crossing-events.js) — DB migration + indexes
3. [backend/controllers/CountingController.js](backend/controllers/CountingController.js) — Business logic (createEvent, getCameraCount, getSummary)
4. [backend/routes/counting-routes.js](backend/routes/counting-routes.js) — Route definitions + auth
5. [backend/api/router.js](backend/api/router.js) — Mount point
6. [backend/api/server.js](backend/api/server.js) — wsService registration
7. [backend/services/WebSocketService.js](backend/services/WebSocketService.js) — broadcastCountingEvent method
8. [backend/models/index.js](backend/models/index.js) — Model registration
