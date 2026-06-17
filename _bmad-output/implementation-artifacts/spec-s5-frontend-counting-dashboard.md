---
title: 'Frontend Counting Dashboard'
type: 'feature'
created: '2026-06-17'
status: 'done'
baseline_commit: '324e8a7'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Backend counting API (S4) sudah tersedia tapi belum ada UI untuk menampilkan data visitor counting ke operator.

**Approach:** Tambah halaman Counting Dashboard di sidebar. Tampilkan total masuk/keluar/di dalam + tabel per kamera. Data auto-refresh 15 detik + WebSocket realtime update. Date picker untuk lihat data historis.

## Boundaries & Constraints

**Always:**
- Gunakan pattern existing: TanStack Query hook + api module + CSS modules
- Realtime via onSocket('counting_event') invalidate query
- Polling 15 detik sebagai fallback

**Never:**
- Jangan ubah endpoint backend
- Jangan ubah komponen/halaman existing

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/api/counting.api.js` -- API module: getSummary, getCameraCount, postEvent
- [x] `src/hooks/useGateCount.js` -- useCountingSummary + useCameraCount hooks with WS invalidation
- [x] `src/features/counting/CountingDashboardView.jsx` -- Dashboard: totals + camera table + date picker
- [x] `src/features/counting/CountingDashboardView.module.css` -- Styles matching existing design system
- [x] `src/icons.jsx` -- Add counting icon (person + plus)
- [x] `src/features/dashboard/Sidebar.jsx` -- Add counting nav item
- [x] `src/features/dashboard/CenterPanel.jsx` -- Wire counting view

## Suggested Review Order

1. [src/api/counting.api.js](src/api/counting.api.js) — API module
2. [src/hooks/useGateCount.js](src/hooks/useGateCount.js) — Query hooks
3. [src/features/counting/CountingDashboardView.jsx](src/features/counting/CountingDashboardView.jsx) — Main view
4. [src/features/counting/CountingDashboardView.module.css](src/features/counting/CountingDashboardView.module.css) — Styles
5. [src/icons.jsx](src/icons.jsx) — counting icon
6. [src/features/dashboard/Sidebar.jsx](src/features/dashboard/Sidebar.jsx) — Nav item
7. [src/features/dashboard/CenterPanel.jsx](src/features/dashboard/CenterPanel.jsx) — View routing
