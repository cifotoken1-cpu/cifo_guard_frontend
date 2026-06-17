# Deferred Work — CCTV AI Count Pivot

Source: `_bmad-output/problem-solution-2026-06-17.md`
Date: 2026-06-17

## Deferred from S1 Review

### Optimize: Skip hook fetches for hidden nav items
- `Sidebar.jsx` still calls `usePanicAlerts()` and `useIncidents()` even though those nav items are hidden
- Wasted API calls — wrap in conditional based on `PRODUCT.hiddenNavIds`
- **Priority:** Low — no user impact, just unnecessary network

---

## Deferred Specs

### S2 — Site Survey & RTSP Validation
- Test kamera VIGI C240: sudut, cahaya, lebar pintu
- Test RTSP stream: latency, resolusi, stability
- Test Open API `subscribeMsg` (CrossLineDetection)
- Estimate peak traffic → hardware sizing
- Validasi "momen pasti 0" untuk daily reset
- Python dev decision: hire/outsource/train
- **Dependency:** None
- **Priority:** High — gate untuk S3+

### S3 — Python Vision Worker
- Setup Python project: YOLO nano + ByteTrack + RTSP reader
- Virtual line crossing logic (detect arah masuk/keluar)
- Worker → DB insert (crossing_events)
- Docker deployment + health check + crash recovery
- **Dependency:** S2 selesai
- **Priority:** High

### S4 — Backend Counting API
- DB migration `crossing_events` table
- `POST /cameras/:id/entry` & `POST /cameras/:id/exit`
- `GET /cameras/:id/visits` + `GET /cameras/:id/count`
- `GET /counting/summary` (semua kamera)
- Auth middleware (`verifyToken`)
- **Dependency:** S3 (worker tulis data)
- **Priority:** High

### S5 — Frontend Counting Dashboard
- Hook `useGateCount` — fetch + poll 15s
- Dashboard `/counting` — tabel live count + avg duration
- CameraCard badge "Inside: N"
- Worker monitoring widget
- Duration formatter utility
- **Dependency:** S4 (API ready)
- **Priority:** High

### S6 — Re-ID + Duration Per Individu (Fase 2)
- RTSP frame capture saat crossing
- Re-ID hybrid matching (embedding + temporal + height + color)
- DB table `person_visits`
- Confidence scoring + verification queue UI
- Field accuracy test
- **Dependency:** S3+S4+S5 selesai
- **Priority:** Medium

### S7 — Laporan Cerdas (Fase 3, Opsional)
- Ringkasan harian bahasa natural (OpenRouter)
- Chat interface query counting data
- Export CSV/PDF
- **Dependency:** S4 selesai
- **Priority:** Low
