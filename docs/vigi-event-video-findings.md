# VIGI Event-Video Capture — Hasil Investigasi & Keputusan

**Tanggal:** 22 Juni 2026
**Konteks:** Evaluasi teknis brief "Event Video Capture" (ganti RTSP grab dengan download video event dari SD card kamera VIGI C240)
**Keputusan:** **Tidak dilanjutkan.** Tetap pakai RTSP warm-buffer yang sudah berjalan.

---

## Ringkasan eksekutif

Brief mengusulkan mengambil frame dari **video event tersimpan di SD card** via "Stream API" kamera, dengan asumsi RTSP punya delay ~1 menit. Setelah investigasi mendalam:

1. **Premis delay tidak akurat.** Delay ~1 menit adalah bug lama di `frame_grabber.py` (buffer RTSP menumpuk), **bukan** sifat RTSP. Backend sudah memakai **warm-buffer RTSP** yang menghasilkan snapshot **instan** (~0 ms). Delay yang terlihat di produksi (3–5 detik) berasal dari **OpenRouter** (analisis AI), yang tidak disentuh brief sama sekali.

2. **Protokol di brief tidak sesuai kenyataan.** Brief mendeskripsikan download via `MULTITRANS` di port 554 dengan HTTP Digest standar. Kenyataannya berbeda total (lihat detail teknis).

3. **Jalur event-video buntu di lapisan enkripsi proprietary** yang butuh effort sangat besar dengan hasil rapuh.

---

## Apa yang berhasil dikonfirmasi

- ✅ Kamera **merekam video event** ke SD card (~20 dtk, ~8.6 MB per event).
- ✅ **`getMediaList`** (Control API, port 20443) berfungsi — mengembalikan `file_id`, `start_time`, `end_time`. (Wajib pakai filter `event_type`; response di key `result`.)
- ✅ **Auth port 8800/8443 (Streamd) berhasil dipecahkan** — bukan digest standar, tapi MD5 digest dengan `securityEncode(password)` (fixed-key TP-Link). Detail tersimpan untuk referensi.

## Di mana buntunya

Setelah auth tembus (HTTP 200), **media tidak mengalir**. Tiga lapisan proprietary menghalangi:

| Lapisan | Kendala |
|---|---|
| **Enkripsi media** | Stream pakai AES (header `X-Key-Exchange`: AES-256-CBC, HKDF, nonce+salt). Butuh implementasi key-exchange + dekripsi. |
| **Sesi stream** | Butuh `client_id`/`token` dari sesi kontrol `/ipc?token=` (bukan angka asal). |
| **VMS relay** | Aplikasi VIGI VMS memutar video lewat relay port 8190 + **plugin native (WinPcap)** yang mendekripsi stream. Tidak terdokumentasi. |

Mereplikasi semua ini = reverse-engineer stack streaming terenkripsi TP-Link. Effort sangat besar, dan hasilnya **rapuh**: bergantung VMS berjalan, protokol tak terdokumentasi, rusak tiap update firmware/VMS.

---

## Keputusan & solusi produksi

**Tetap memakai RTSP warm-buffer** (sudah berjalan, vendor-supported):
- `backend/services/vigi/vigiSnapshot.js` — grab 1 frame via ffmpeg dari RTSP.
- Warm buffer me-refresh frame tiap ~1.5 dtk → event memakai frame terbaru **secara instan**.
- Crop ke area pintu, lalu kirim ke face worker + AI alert.

Sistem ini **sudah memenuhi kebutuhan asli**: durasi per orang, counting in/out, entry/exit, dan appearance matching — semua terkonfirmasi berfungsi.

## Rekomendasi lanjutan (opsional, low-risk)

- **Burst-grab saat event** (perlu pengujian terpisah karena berinteraksi dengan logika auto-direction exit): grab 2–3 frame RTSP saat event, pilih wajah terbaik. Memberi sebagian besar manfaat "frame tepat momen" tanpa protokol baru.
- Fokus optimasi sebaiknya ke **latency OpenRouter** (model lebih kecil / cache), bukan snapshot.

## Jika event-video tetap ingin dikejar di masa depan

Titik lanjut ada di `VIGI VMS/.../server/mediaServer/vms-media-core` (jar) dan `VIGI VMS PC Client/*StreamConnection*.exe` (logika key-exchange + AES). Recikan auth port 8800 sudah didokumentasikan di memory proyek (`reference_vigi_8800_streamd_auth`).
