<!--
  CIFO Guard Frontend — Pull Request Template
  Hapus section yang tidak relevan dengan PR Anda.
-->

## Ringkasan
<!-- 1-3 kalimat: apa yang berubah dan kenapa -->

## Tipe Perubahan
- [ ] 🐛 Bug fix
- [ ] ✨ Fitur baru
- [ ] ♻️ Refactor (tidak ada perubahan behavior)
- [ ] 🎨 Style / UI
- [ ] 📝 Dokumentasi
- [ ] 🔧 Build / CI / tooling
- [ ] 🧪 Test

## Status Integrasi (WAJIB cek salah satu)

> Lihat [`docs/INTEGRATION_STATUS.md`](../docs/INTEGRATION_STATUS.md) untuk klasifikasi 4 kategori.

- [ ] ✅ PR ini **TIDAK menyentuh data flow** (pure UI / styling / docs / test) → skip section di bawah
- [ ] ✅ PR ini menyentuh data flow, dan saya sudah:
  - [ ] Tandai semua dummy/placeholder baru dengan `// @stub: <kategori> — <alasan>` (lihat referensi di bawah)
  - [ ] Update `docs/INTEGRATION_STATUS.md` (tambah/ubah/hapus row sesuai perubahan)
  - [ ] Update issue terkait di GitHub (kalau ada): tutup issue legacy/blocked yang sudah resolved, atau update status di body issue

### Kategori Marker

| Kategori | Kapan Dipakai | Contoh |
|---|---|---|
| `real` | Sudah penuh terhubung backend | Tidak perlu marker |
| `hybrid` | Real API + fallback sengaja (UX, error recovery) | `// @stub: hybrid — fallback GPS saat geolocation gagal` |
| `backend-blocked` | Endpoint backend belum ada | `// @stub: backend-blocked — /api/sensors belum ada (lihat #8)` |
| `legacy` | Dummy lama yang harus dihapus | `// @stub: legacy — 18 kamera hardcoded (lihat #10)` |

## Checklist Reviewer

- [ ] Code review fokus: apakah PR ini memperkenalkan dummy data baru?
- [ ] Kalau ya: ada marker `// @stub:` dengan format konsisten?
- [ ] Kalau ya: `INTEGRATION_STATUS.md` sudah di-update?
- [ ] `npm run lint` lulus
- [ ] (Kalau ada perubahan visual) screenshot / video di-attach

## Issue Terkait
<!-- Pakai format "Closes #N" atau "Refs #N" -->

Closes #
Refs #

## Catatan Tambahan
<!-- Risiko, edge case, manual test plan, dll -->
