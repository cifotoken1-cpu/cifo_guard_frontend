---
title: 'Rebrand CIFO Guard → CCTV AI Count'
type: 'feature'
created: '2026-06-17'
status: 'done'
baseline_commit: 'c04c331'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aplikasi saat ini branded sebagai "CIFO Guard" all-in-one security dashboard. BO memutuskan pivot ke produk fokus "CCTV AI Count" (visitor counting). Menu non-CCTV (Panic, Incident, Users) masih tampil dan membingungkan scope produk baru.

**Approach:** Buat product config yang mengontrol branding (nama, subtitle, icon) dan daftar menu sidebar. Ganti semua teks "CIFO Guard" ke "CCTV AI Count". Hide menu/route non-CCTV (Panic, Incident, Users) via config — kode tidak dihapus, hanya disembunyikan supaya bisa di-enable kembali.

## Boundaries & Constraints

**Always:**
- Menu yang tetap tampil: Security (dashboard utama), Media (kamera), Map (peta)
- Kode fitur non-CCTV (Panic, Incident, Users) tetap ada — hanya hidden dari nav dan route
- Store persist keys (`cifo-auth`, `cifo-system`, `cifo-ui-store`) JANGAN diubah — akan reset state user yang sudah login
- Semua perubahan branding bersumber dari 1 file config (`src/config/product.js`)

**Ask First:**
- Nama produk final selain "CCTV AI Count"
- Perubahan warna tema / CSS variables
- Perubahan favicon

**Never:**
- Jangan hapus kode fitur Panic/Incident/Users — hanya hide
- Jangan ubah store persist key names
- Jangan ubah backend / API endpoints
- Jangan ubah logic bisnis apapun

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh load | User buka app | Title "CCTV AI Count", sidebar 3 menu (Security, Media, Peta) | N/A |
| Login page | User belum login | Brand "CCTV AI Count", subtitle "Visitor Counting System", footer updated | N/A |
| Direct URL ke /panic | User ketik URL langsung | Redirect ke /security (default route) | N/A |
| Existing session | User sudah login sebelumnya | Session tetap valid, tidak perlu re-login | N/A |

</frozen-after-approval>

## Code Map

- `src/config/product.js` -- NEW: product config (name, title, subtitle, icon, sidebar menu list, hidden routes)
- `src/features/dashboard/Sidebar.jsx:51-58` -- Nav items array, filter by product config
- `src/features/dashboard/TopBar.jsx:25-31` -- Brand text "CIFO GUARD" → baca dari config
- `src/features/auth/LoginPage.jsx:48-54,96` -- Brand name, subtitle, footer text
- `src/features/dashboard/CenterPanel.jsx:36-65` -- View switch by activeNav, guard hidden views
- `src/App.jsx:44-79` -- Route definitions, redirect hidden routes
- `index.html:8` -- `<title>` tag

## Tasks & Acceptance

**Execution:**
- [x] `src/config/product.js` -- Buat file baru: export `PRODUCT` object dengan `name`, `title`, `subtitle`, `icon`, `hiddenNavIds[]`, `footer` -- Single source of truth branding
- [x] `src/features/dashboard/Sidebar.jsx` -- Filter `navItems` array by `PRODUCT.hiddenNavIds` sehingga Panic/Incident/Users tidak tampil -- Hide menu non-CCTV
- [x] `src/features/dashboard/TopBar.jsx` -- Ganti hardcoded "CIFO GUARD" dengan `PRODUCT.title` dan icon dengan `PRODUCT.icon` -- Branding dari config
- [x] `src/features/auth/LoginPage.jsx` -- Ganti "CIFO GUARD" → `PRODUCT.name`, "Security Command Center" → `PRODUCT.subtitle`, footer → `PRODUCT.footer` -- Login page branding
- [x] `src/features/dashboard/CenterPanel.jsx` -- Tambah guard: jika `activeNav` ada di `PRODUCT.hiddenNavIds`, skip view render, fallback ke default dashboard -- Prevent render hidden views
- [x] `src/App.jsx` -- Tidak perlu perubahan: navigasi via activeNav state bukan URL routes, catch-all sudah redirect ke /security -- Verified no changes needed
- [x] `index.html` -- Ganti `<title>` ke "CCTV AI Count — Visitor Counting" -- Browser tab title

**Acceptance Criteria:**
- Given app loaded, when user lihat sidebar, then hanya ada 3 menu: Security, Media, Peta
- Given app loaded, when user lihat TopBar, then tampil "CCTV AI COUNT" bukan "CIFO GUARD"
- Given user di login page, when halaman render, then brand "CCTV AI Count" + subtitle "Visitor Counting System"
- Given user ketik URL `/panic` langsung, when route resolve, then redirect ke `/security`
- Given user sudah punya session, when app reload, then session tetap valid (store keys tidak berubah)
- Given developer grep "CIFO GUARD" di rendered UI, when search, then 0 hasil visible di semua halaman

## Verification

**Commands:**
- `npx vite build` -- expected: build sukses tanpa error

**Manual checks:**
- Buka app → sidebar hanya 3 menu (Security, Media, Peta)
- TopBar tampil "CCTV AI COUNT"
- Login page tampil "CCTV AI Count" + "Visitor Counting System"
- URL `/panic`, `/incidents`, `/users` → redirect ke `/security`
- Browser tab: "CCTV AI Count — Visitor Counting"
- Grep visible text: 0 occurrence "CIFO GUARD" di UI

## Suggested Review Order

1. [src/config/product.js](src/config/product.js) — NEW: single source of truth (start here)
2. [src/features/dashboard/Sidebar.jsx](src/features/dashboard/Sidebar.jsx) — nav filtering by `hiddenNavIds`
3. [src/features/dashboard/TopBar.jsx](src/features/dashboard/TopBar.jsx) — brand title + icon
4. [src/features/auth/LoginPage.jsx](src/features/auth/LoginPage.jsx) — login page branding
5. [src/features/dashboard/CenterPanel.jsx](src/features/dashboard/CenterPanel.jsx) — hidden nav guard + useEffect reset
6. [index.html](index.html) — browser tab title
