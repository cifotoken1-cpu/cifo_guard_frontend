# Mockup HTML Archive

Folder ini berisi static HTML mockup yang dipindahkan dari root repo (audit issue #11).

## Konvensi

```
docs/mockups/
├── legacy/   ← React app sudah implement; mockup hanya referensi historis
└── active/   ← Belum ada React equivalent; mockup masih jadi referensi desain
```

## Audit (2026-05-08)

### 🔴 Legacy (sudah ada di React app)

| File | React Equivalent | Catatan |
|---|---|---|
| [`legacy/Incident Response.html`](./legacy/Incident%20Response.html) | `src/features/incident-response/` | Full coverage |
| [`legacy/Interactive Map.html`](./legacy/Interactive%20Map.html) | `src/features/interactive-map/` | Full coverage |
| [`legacy/Panic Alerts.html`](./legacy/Panic%20Alerts.html) | `src/features/panic-monitor/` | Full coverage |
| [`legacy/Team Management.html`](./legacy/Team%20Management.html) | `src/features/users/` (sebagian) | ⚠️ Coverage partial — UI users/team management masih bisa direferensikan kalau ada feature gap |

**Status:** Tidak dipakai di runtime. Disimpan untuk:
- Referensi visual desain awal
- Audit perubahan UX dari prototype ke implementasi
- Bisa dihapus aman kapan saja sesuai keputusan PO

### 🟢 Active (belum ada React equivalent)

| File | Status | Catatan |
|---|---|---|
| [`active/Visitor Registration.html`](./active/Visitor%20Registration.html) | Referensi desain | Belum ada `src/features/visitor/` di React app. Backend punya `routes/visitor.js` + OCR Tesseract, tapi UI React belum dibuat. |

**Status:** **Jangan hapus** — masih jadi blueprint untuk fitur visitor registration di React.

## Perpindahan Sebelumnya

File ini sebelumnya berada di repo root:
- `/Incident Response.html`
- `/Interactive Map.html`
- `/Panic Alerts.html`
- `/Team Management.html`
- `/Visitor Registration.html`

Pindah ke folder ini per [issue #11](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/11) untuk:
1. Mengurangi clutter di root
2. Memberi konteks status (legacy vs active)
3. Memudahkan audit "apa yang sudah/belum di-implement"

## Cara Pakai

**Lihat mockup di browser:**
```bash
# Dari root repo:
open "docs/mockups/legacy/Incident Response.html"   # macOS
xdg-open "docs/mockups/legacy/Incident Response.html"  # Linux
```

**Update kategori (kalau ada perubahan status):**
1. Pindahkan file antara `legacy/` ↔ `active/` via `git mv`
2. Update tabel di file ini
3. Update [`docs/INTEGRATION_STATUS.md`](../INTEGRATION_STATUS.md) row #7 jika perlu

## Referensi

- [Issue #11](https://github.com/cifotoken1-cpu/cifo_guard_frontend/issues/11)
- [`docs/INTEGRATION_STATUS.md`](../INTEGRATION_STATUS.md) row #7
