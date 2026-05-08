# Panduan Testing Camera API — CIFO Security

**Versi:** 1.1  
**Tanggal:** 2026-05-04  
**Audiens:** Frontend Developer  
**Dibuat oleh:** QA Lead

> **TL;DR untuk yang terburu-buru:** Gunakan `GET /api/cameras` untuk menampilkan daftar kamera di UI.
> Gunakan `POST /api/cameras/:id/heartbeat` untuk update status kamera. Streaming pakai `.m3u8`.
> Kalau status listener menunjukkan error setelah 60 detik tanpa heartbeat — itu **normal**, bukan bug.

---

## Daftar Isi

1. [Mulai Cepat — 3 Langkah Pertama](#1-mulai-cepat--3-langkah-pertama)
2. [Pilih Endpoint yang Tepat](#2-pilih-endpoint-yang-tepat)
3. [Referensi API — Sistem In-Memory (`/cameras`)](#3-referensi-api--sistem-in-memory)
4. [Referensi API — Sistem Database (`/api/cameras`)](#4-referensi-api--sistem-database)
5. [Panduan Streaming HLS](#5-panduan-streaming-hls)
6. [Panduan Heartbeat & Status Listener (RTO)](#6-panduan-heartbeat--status-listener)
7. [Real-time Updates via WebSocket](#7-real-time-updates-via-websocket)
8. [Smoke Test Checklist](#8-smoke-test-checklist)
9. [Known Issues & Troubleshooting](#9-known-issues--troubleshooting)
10. [Kamera Vigi AI](#10-kamera-vigi-ai)

---

## 1. Mulai Cepat — 3 Langkah Pertama

### Langkah 1 — Ambil daftar semua kamera

```bash
curl http://localhost:3001/api/cameras
```

Kalau berhasil, Anda akan melihat 18 kamera CCTV Bandung dengan status masing-masing:

```json
{
  "cameras": [
    {
      "id": "cam-1",
      "label": "CCTV Aceh - Wastukencana",
      "area": "Bandung",
      "lat": -6.9103254,
      "lng": 107.6089499,
      "streamUrl": "/video/HIKSVISION/acehwastukencana.m3u8",
      "status": "offline",
      "lastSeen": null,
      "responseTime": null,
      "healthScore": 0,
      "error": null,
      "lastHeartbeat": null
    }
  ],
  "total": 18,
  "online": 0,
  "offline": 18,
  "degraded": 0,
  "error": 0,
  "timestamp": 1746345600000
}
```

> **Mengapa semua kamera `offline`?**  
> Kamera baru dianggap `online` setelah menerima heartbeat. Jalankan Langkah 2 untuk mengubahnya.

---

### Langkah 2 — Kirim heartbeat untuk menghidupkan kamera

```bash
curl -X POST http://localhost:3001/api/cameras/cam-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "online",
    "responseTime": 150,
    "healthScore": 95,
    "streamAccessible": true
  }'
```

Response sukses:

```json
{
  "success": true,
  "cameraId": "cam-1",
  "status": "online",
  "timestamp": 1746345610000,
  "message": "Heartbeat received successfully"
}
```

---

### Langkah 3 — Verifikasi status berubah

```bash
curl http://localhost:3001/api/cameras
```

Sekarang `cam-1` akan berstatus `online` dan `online` count bertambah jadi 1.

> **Penting:** Status `online` hanya bertahan **60 detik**. Setelah itu kamera kembali ke `offline` jika tidak ada heartbeat baru. Ini adalah perilaku yang disengaja — lihat [Bagian 6](#6-panduan-heartbeat--status-listener) untuk penjelasan lengkap.

---

## 2. Pilih Endpoint yang Tepat

Ada **dua sistem camera** yang berjalan paralel di backend ini. Ini bukan bug — keduanya memiliki tujuan berbeda.

```
Pertanyaan: Saya mau tampilkan kamera di UI / dashboard?
└── Gunakan: GET /api/cameras  ✅

Pertanyaan: Saya mau kelola data kamera (tambah, edit, hapus)?
└── Gunakan: GET/POST/PUT/DELETE /api/api/cameras  ✅  (⚠️ double prefix — lihat KI-06)

Pertanyaan: Saya mau update status kamera dari health monitor?
├── Sistem in-memory: POST /api/cameras/:id/heartbeat  (status: lowercase)
└── Sistem database:  POST /api/api/cameras/:id/heartbeat  (status: UPPERCASE)
```

### Perbedaan Utama

| Aspek | Sistem In-Memory (`/cameras`) | Sistem Database (`/api/cameras`) |
|---|---|---|
| **Data sumber** | 18 kamera hardcoded di kode | MySQL database |
| **Tujuan** | Display & monitoring real-time | CRUD manajemen kamera |
| **Status format** | `online` `offline` `degraded` `error` | `ONLINE` `OFFLINE` `MAINTENANCE` `ERROR` |
| **Field stream** | `streamUrl` | `stream_url` |
| **Persistensi** | In-memory, hilang saat server restart | Persisten di database |
| **Dipakai untuk** | Frontend dashboard, tampilan peta | Admin panel, konfigurasi kamera |

> **Aturan praktis:** Untuk semua kebutuhan **tampilan** di frontend, selalu gunakan `/api/cameras`. Gunakan `/api/api/cameras` hanya jika Anda perlu mengubah data kamera (admin feature, dengan catatan bug aktif KI-06/KI-07).

---

## 3. Referensi API — Sistem In-Memory

### `GET /api/cameras` — Ambil semua kamera dengan status terkini

**Request:**
```bash
curl http://localhost:3001/api/cameras
```

**Response `200 OK`:**
```json
{
  "cameras": [
    {
      "id": "cam-1",
      "label": "CCTV Aceh - Wastukencana",
      "area": "Bandung",
      "lat": -6.9103254,
      "lng": 107.6089499,
      "streamUrl": "/video/HIKSVISION/acehwastukencana.m3u8",
      "status": "online",
      "lastSeen": 1746345610000,
      "responseTime": 150,
      "healthScore": 95,
      "error": null,
      "lastHeartbeat": "2026-05-04T10:00:10.000Z"
    }
  ],
  "total": 18,
  "online": 1,
  "offline": 17,
  "degraded": 0,
  "error": 0,
  "timestamp": 1746345620000
}
```

**Penjelasan field kamera:**

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string | ID unik kamera, format `cam-N` |
| `label` | string | Nama lokasi CCTV |
| `area` | string | Area kota |
| `lat` / `lng` | number | Koordinat GPS |
| `streamUrl` | string | URL stream HLS (`.m3u8`) |
| `status` | string | `online` / `offline` / `degraded` / `error` |
| `lastSeen` | number\|null | Unix timestamp terakhir heartbeat diterima |
| `responseTime` | number\|null | Response time terakhir dalam ms |
| `healthScore` | number | Skor kesehatan 0–100 |
| `error` | string\|null | Pesan error jika ada |
| `lastHeartbeat` | string\|null | ISO timestamp heartbeat terakhir |

---

### `POST /api/cameras/:id/heartbeat` — Update status kamera

**Request:**
```bash
curl -X POST http://localhost:3001/api/cameras/cam-2/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "online",
    "responseTime": 200,
    "healthScore": 88,
    "streamAccessible": true,
    "lastCheck": "2026-05-04T10:05:00.000Z"
  }'
```

**Body fields:**

| Field | Wajib | Tipe | Nilai Valid | Keterangan |
|---|---|---|---|---|
| `status` | **Ya** | string | `online` `offline` `degraded` `error` | Status saat ini |
| `responseTime` | Tidak | number | ms | Response time dalam milidetik |
| `healthScore` | Tidak | number | 0–100 | Skor kesehatan kamera |
| `streamAccessible` | Tidak | boolean | `true` / `false` | Apakah stream dapat diakses |
| `error` | Tidak | string | — | Pesan error jika ada |
| `lastCheck` | Tidak | string | ISO 8601 | Waktu pengecekan terakhir |

**Response `200 OK`:**
```json
{
  "success": true,
  "cameraId": "cam-2",
  "status": "online",
  "timestamp": 1746345900000,
  "message": "Heartbeat received successfully"
}
```

**Response `404 Not Found`** (ID tidak ada):
```json
{
  "error": "CAMERA_NOT_FOUND",
  "message": "Camera with ID 'cam-99' not found"
}
```

**Response `400 Bad Request`** (status tidak valid):
```json
{
  "error": "INVALID_STATUS",
  "message": "Status must be one of: online, offline, degraded, error"
}
```

---

## 4. Referensi API — Sistem Database

> Gunakan endpoint ini hanya untuk operasi admin/manajemen kamera. Semua response menggunakan format `{ success, data, pagination }`.

### `GET /api/api/cameras` — Daftar kamera dari database

> ⚠️ **Bug KI-06 aktif:** Endpoint ini saat ini mengembalikan error 500. Gunakan `/api/api/cameras/stats` sebagai workaround.

**Request:**
```bash
# Semua kamera
curl http://localhost:3001/api/api/cameras

# Dengan filter
curl "http://localhost:3001/api/api/cameras?status=ONLINE&area=Bandung&limit=10&offset=0"
```

**Query Parameters:**

| Parameter | Tipe | Keterangan |
|---|---|---|
| `status` | string | Filter: `ONLINE` `OFFLINE` `MAINTENANCE` `ERROR` |
| `area` | string | Filter berdasarkan area |
| `type` | string | Filter berdasarkan tipe kamera |
| `search` | string | Pencarian teks |
| `limit` | number | Default 50 |
| `offset` | number | Default 0 |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "pages": 1
  }
}
```

---

### `POST /api/api/cameras/:id/heartbeat` — Heartbeat sistem database

> **Perhatian:** Format berbeda dari sistem in-memory. Status menggunakan HURUF BESAR.

```bash
curl -X POST http://localhost:3001/api/api/cameras/cam-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ONLINE",
    "cpu_usage": 45.2,
    "memory_usage": 62.1,
    "disk_usage": 30.5,
    "temperature": 55.0,
    "error_message": null
  }'
```

**Status valid untuk sistem database:** `ONLINE` `OFFLINE` `MAINTENANCE` `ERROR`

---

### Endpoint CRUD Lainnya

| Method | Endpoint aktual | Fungsi |
|---|---|---|
| `GET` | `/api/api/cameras/:id` | Detail satu kamera |
| `POST` | `/api/api/cameras` | Tambah kamera baru ⚠️ KI-07 |
| `PUT` | `/api/api/cameras/:id` | Update data kamera |
| `PATCH` | `/api/api/cameras/:id/status` | Update status saja |
| `PATCH` | `/api/api/cameras/bulk-status` | Update status banyak kamera |
| `DELETE` | `/api/api/cameras/:id` | Hapus kamera |
| `GET` | `/api/api/cameras/:id/health-logs` | Riwayat health log |
| `GET` | `/api/api/cameras/stats` | Statistik ringkasan ✅ (workaround KI-06) |
| `GET` | `/api/api/cameras/dashboard` | Data dashboard |

---

## 5. Panduan Streaming HLS

### Apa itu HLS dan `.m3u8`?

HLS (HTTP Live Streaming) adalah protokol streaming video. File `.m3u8` adalah **playlist** yang berisi daftar segmen video. Browser tidak bisa memutarnya langsung dengan tag `<video>` biasa — butuh library khusus.

### Setup di Frontend

**Opsi 1 — HLS.js (direkomendasikan untuk browser)**
```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<video id="cameraFeed" controls></video>

<script>
  const streamUrl = "/video/HIKSVISION/acehwastukencana.m3u8";
  const video = document.getElementById("cameraFeed");

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());

    // Tangkap error streaming
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error("Stream error:", data.type, data.details);
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari sudah support native
    video.src = streamUrl;
  }
</script>
```

**Opsi 2 — Video.js dengan plugin HLS**
```html
<link href="https://vjs.zencdn.net/8/video-js.css" rel="stylesheet" />
<script src="https://vjs.zencdn.net/8/video.min.js"></script>

<video id="cam" class="video-js" controls>
  <source src="/video/DAHUA/DepanTo.m3u8" type="application/x-mpegURL" />
</video>
<script>
  const player = videojs("cam", { fluid: true });
</script>
```

### Format Stream URL

| Vendor | Contoh URL |
|---|---|
| Hikvision | `/video/HIKSVISION/acehwastukencana.m3u8` |
| Dahua | `/video/DAHUA/DepanTo.m3u8` |
| ATCS | `/atcs/Samsat/index.m3u8` |

### Verifikasi Streaming Berfungsi

```bash
# Cek apakah stream URL bisa diakses
curl -I http://localhost:3001/video/HIKSVISION/acehwastukencana.m3u8
# Harapan: HTTP/1.1 200 OK dengan Content-Type: application/vnd.apple.mpegurl
```

### Flowchart — Streaming Tidak Muncul

```
Streaming tidak muncul?
│
├─► Apakah streamUrl ada di response GET /api/cameras?
│   └── Tidak → Kamera belum terdaftar. Hubungi backend team.
│
├─► Apakah status kamera "online"?
│   └── Tidak → Kirim heartbeat dulu (POST /api/cameras/:id/heartbeat)
│              Kalau tetap offline → cek apakah 60 detik sudah lewat (lihat Bagian 6)
│
├─► Apakah URL stream bisa diakses langsung?
│   └── curl -I http://localhost:3001/[streamUrl]
│       ├── 404 → File stream tidak ada di server media
│       └── 200 → Lanjut ke langkah berikutnya
│
├─► Apakah Anda menggunakan HLS.js / Video.js?
│   └── Tidak → Browser tidak bisa putar .m3u8 native (kecuali Safari)
│              Tambahkan library HLS (lihat Setup di atas)
│
└─► Masih tidak muncul? Cek console browser untuk error HLS spesifik
    dan hubungi QA Lead dengan detail error tersebut.
```

---

## 6. Panduan Heartbeat & Status Listener

### Cara Kerja Heartbeat

Sistem ini menggunakan mekanisme **heartbeat** untuk menentukan apakah kamera online. Analoginya seperti detak jantung — selama ada sinyal, kamera dianggap hidup.

```
[Kamera / Health Monitor]                    [Backend]
         │                                        │
         │── POST /api/cameras/cam-1/heartbeat ───►│ ← Kamera "hidup"
         │                    (dalam 60 detik)    │
         │── POST /api/cameras/cam-1/heartbeat ───►│ ← Masih "hidup"
         │                                        │
         │   (60 detik berlalu tanpa heartbeat)   │
         │                                   [timeout] ← Status → "offline"
         │── POST /api/cameras/cam-1/heartbeat ───►│ ← Kamera "hidup" lagi
```

### Konstanta Penting

| Konstanta | Nilai | Keterangan |
|---|---|---|
| `HEARTBEAT_TIMEOUT` | **60.000 ms (60 detik)** | Waktu maksimal antara dua heartbeat. Lewat dari ini → status `offline` |

### Mengapa Status Listener Menampilkan Error? (RTO)

**Ini adalah perilaku yang disengaja, bukan bug.**

Ketika frontend mem-polling `GET /api/cameras` dan melihat status berubah ke `offline` dengan `error: "Heartbeat timeout"` — artinya kamera tidak mengirim heartbeat dalam 60 detik terakhir.

**Yang harus dilakukan frontend saat melihat ini:**

```javascript
// Contoh polling status kamera
const pollCameraStatus = async () => {
  const res = await fetch("/cameras");
  const data = await res.json();

  data.cameras.forEach(camera => {
    if (camera.status === "offline" && camera.error === "Heartbeat timeout") {
      // Ini NORMAL — kamera belum kirim heartbeat dalam 60 detik
      // Tampilkan indikator "Koneksi terputus" di UI
      showDisconnectedIndicator(camera.id);
    } else if (camera.status === "error") {
      // Ini error aktif — kamera melaporkan masalah
      showErrorIndicator(camera.id, camera.error);
    } else if (camera.status === "degraded") {
      // Kamera online tapi performa buruk (response time tinggi)
      showDegradedIndicator(camera.id);
    } else if (camera.status === "online") {
      showOnlineIndicator(camera.id);
    }
  });
};

// Poll setiap 30 detik (kurang dari timeout 60 detik)
setInterval(pollCameraStatus, 30000);
```

### Rekomendasi Interval Polling

| Skenario | Interval yang Disarankan |
|---|---|
| Dashboard monitoring aktif | Setiap 15–30 detik |
| Background check | Setiap 60 detik |
| **Jangan lebih dari** | 60 detik (kamera bisa sudah timeout) |

### Arti Setiap Status

| Status | Arti | Tampilkan di UI |
|---|---|---|
| `online` | Heartbeat diterima dalam 60 detik terakhir | Indikator hijau |
| `offline` + `error: null` | Belum pernah kirim heartbeat | Abu-abu / belum aktif |
| `offline` + `error: "Heartbeat timeout"` | Pernah online, tapi koneksi terputus | Kuning / peringatan |
| `degraded` | Online tapi response time tinggi | Oranye |
| `error` | Kamera melaporkan masalah aktif | Merah |

---

## 7. Real-time Updates via WebSocket

Jika Anda tidak ingin polling, gunakan WebSocket untuk update real-time.

### Koneksi

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  transports: ["websocket", "polling"]
});

// Bergabung ke room monitoring
socket.emit("join_room", "monitoring_room");

// Terima update status kamera
socket.on("camera_status_update", (data) => {
  console.log("Camera update:", data);
  updateCameraUI(data);
});

socket.on("connect", () => console.log("WebSocket terhubung"));
socket.on("disconnect", () => console.log("WebSocket terputus"));
```

### Room yang Tersedia

| Room | Dipakai untuk |
|---|---|
| `monitoring_room` | Update status kamera real-time |
| `alerts_room` | Notifikasi alert keamanan |
| `security_room` | Update tim keamanan |
| `admin_room` | Notifikasi admin |

### Event yang Tersedia

| Event | Arah | Keterangan |
|---|---|---|
| `join_room` | Client → Server | Bergabung ke room |
| `leave_room` | Client → Server | Keluar dari room |
| `camera_status_update` | Server → Client | Update status kamera |
| `authenticate` | Client → Server | Autentikasi socket |

---

## 8. Smoke Test Checklist

Jalankan checklist ini setiap kali akan mulai kerja dengan Camera API, atau sebelum setiap rilis.

### Pre-conditions

- [ ] Backend server sudah berjalan di `http://localhost:3001`
- [ ] Tidak ada error di console server saat startup

---

### TC-01: Ambil Daftar Kamera

```bash
curl -s http://localhost:3001/api/cameras | python -m json.tool
```

- [ ] Response code `200`
- [ ] Field `cameras` adalah array
- [ ] `total` bernilai `18`
- [ ] Setiap kamera punya field: `id`, `label`, `streamUrl`, `status`
- [ ] Format `id` adalah `cam-N` (misal: `cam-1`, `cam-18`)

---

### TC-02: Kirim Heartbeat Valid

```bash
curl -s -X POST http://localhost:3001/api/cameras/cam-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"online","responseTime":100,"healthScore":90,"streamAccessible":true}' \
  | python -m json.tool
```

- [ ] Response code `200`
- [ ] `success` bernilai `true`
- [ ] `cameraId` bernilai `"cam-1"`
- [ ] `status` bernilai `"online"`

---

### TC-03: Verifikasi Status Berubah Setelah Heartbeat

```bash
curl -s http://localhost:3001/api/cameras | python -m json.tool
```

- [ ] `cam-1` sekarang berstatus `"online"`
- [ ] `online` count bertambah 1
- [ ] `lastHeartbeat` tidak null untuk `cam-1`

---

### TC-04: Heartbeat dengan ID Tidak Valid

```bash
curl -s -X POST http://localhost:3001/api/cameras/cam-999/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"online"}' \
  | python -m json.tool
```

- [ ] Response code `404`
- [ ] `error` bernilai `"CAMERA_NOT_FOUND"`

---

### TC-05: Heartbeat dengan Status Tidak Valid

```bash
curl -s -X POST http://localhost:3001/api/cameras/cam-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"aktif"}' \
  | python -m json.tool
```

- [ ] Response code `400`
- [ ] `error` bernilai `"INVALID_STATUS"`

---

### TC-06: Heartbeat Timeout (RTO Simulation)

> Test ini membutuhkan **waktu tunggu 60 detik**.

```bash
# 1. Pastikan cam-2 online dulu
curl -X POST http://localhost:3001/api/cameras/cam-2/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"online","healthScore":100}'

# 2. Tunggu 65 detik
sleep 65

# 3. Cek status
curl -s http://localhost:3001/api/cameras | python -m json.tool
```

- [ ] `cam-2` kembali ke status `"offline"` setelah 60 detik
- [ ] `error` bernilai `"Heartbeat timeout"`
- [ ] Ini adalah perilaku yang **benar** (by design)

---

### TC-07: Heartbeat Status Degraded

```bash
curl -s -X POST http://localhost:3001/api/cameras/cam-3/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"degraded","responseTime":2500,"healthScore":40,"error":"High latency detected"}' \
  | python -m json.tool
```

- [ ] Response code `200`
- [ ] `success` bernilai `true`
- [ ] Cek `GET /api/cameras` → `cam-3` berstatus `"degraded"`

---

### TC-08: Akses Stream URL

```bash
# Ganti dengan URL aktual dari response GET /api/cameras
curl -I http://localhost:3001/video/HIKSVISION/acehwastukencana.m3u8
```

- [ ] Response code `200` (stream tersedia)
- [ ] Atau `404` jika file belum ada di media server (catat sebagai known issue)

---

### TC-09: API Database — Statistik

```bash
curl -s http://localhost:3001/api/api/cameras/stats | python -m json.tool
```

- [ ] Response code `200`
- [ ] `success` bernilai `true`
- [ ] Ada field: `total`, `online`, `offline`

---

### Ringkasan Hasil Smoke Test

| Kode | Nama Test | Status |
|---|---|---|
| TC-01 | Ambil Daftar Kamera | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-02 | Kirim Heartbeat Valid | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-03 | Verifikasi Status Berubah | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-04 | ID Tidak Valid | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-05 | Status Tidak Valid | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-06 | Heartbeat Timeout (RTO) | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-07 | Status Degraded | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-08 | Akses Stream URL | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-09 | API Database Stats | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-10 | Vigi AI — Registrasi ke Database | ⬜ Belum / ✅ Pass / ❌ Fail |
| TC-11 | Vigi AI — Snapshot Alert Tersimpan | ⬜ Belum / ✅ Pass / ❌ Fail |

---

## 9. Known Issues & Troubleshooting

### KI-01: Dua Sistem dengan Format Status Berbeda

**Masalah:** `/cameras` menggunakan status lowercase (`online`), `/api/cameras` menggunakan UPPERCASE (`ONLINE`).

**Workaround:** Selalu normalisasi status sebelum membandingkan:
```javascript
const normalizeStatus = (status) => status?.toLowerCase();

if (normalizeStatus(camera.status) === "online") {
  // Berlaku untuk keduanya
}
```

---

### KI-02: Streaming Tidak Muncul di Browser

**Penyebab paling umum:** Browser tidak support `.m3u8` native.

**Solusi:** Gunakan HLS.js atau Video.js (lihat [Bagian 5](#5-panduan-streaming-hls)).

**Cek cepat:**
```javascript
// Di console browser
const video = document.createElement("video");
console.log(video.canPlayType("application/vnd.apple.mpegurl"));
// "" = tidak support (perlu HLS.js)
// "maybe" atau "probably" = support native (Safari)
```

---

### KI-03: Status Listener Error Setelah 60 Detik (RTO)

**Masalah:** Frontend mendeteksi `status: "offline"` dengan `error: "Heartbeat timeout"` dan menganggapnya sebagai error sistem.

**Penjelasan:** Ini adalah **perilaku yang benar**. Backend sengaja menandai kamera sebagai offline jika tidak ada heartbeat dalam 60 detik.

**Solusi di Frontend:** Bedakan antara "timeout" dan "error aktif":
```javascript
if (camera.error === "Heartbeat timeout") {
  // Tampilkan "Koneksi terputus" — bukan error kritis
} else if (camera.status === "error") {
  // Tampilkan error aktif — perlu perhatian
}
```

---

### KI-04: Data Kamera di `/api/cameras` Tidak Sinkron dengan Database

**Masalah:** Kamera baru yang ditambahkan via `/api/api/cameras` tidak muncul di `GET /api/cameras`.

**Penjelasan:** Sistem in-memory (`/api/cameras`) menggunakan data hardcoded 18 kamera. Perubahan database tidak otomatis masuk ke sini.

**Solusi sementara:** Untuk testing kamera baru dari database, gunakan `GET /api/api/cameras`.

**Solusi jangka panjang:** Koordinasikan dengan backend untuk migrasi ke satu sistem.

---

### KI-05: Field CameraController Berbeda dari Model Database

**Masalah:** `POST /api/cameras` di controller memvalidasi field `name`, `ip_address`, `location`, tapi model database menggunakan `label`, `lat`, `lng`, `stream_url`.

**Solusi sementara:** Gunakan endpoint in-memory untuk testing display. Untuk membuat kamera baru via database, konfirmasi field yang tepat dengan backend developer.

---

### KI-06: `GET /api/api/cameras` → 500 "Camera.getCount is not a function"

**Masalah:** Request `GET /api/api/cameras` (sistem database) selalu gagal dengan error 500.

**Penyebab:** [controllers/CameraController.js:19](controllers/CameraController.js#L19) memanggil `Camera.getCount()` yang tidak ada di [models/Camera.js](models/Camera.js).

**Workaround sementara:** Gunakan `GET /api/api/cameras/stats` untuk melihat ringkasan kamera dari database.

**Fix yang diperlukan (backend):** Tambahkan method `getCount()` di [models/Camera.js](models/Camera.js):
```javascript
static async getCount(filters = {}) {
  const connection = await this.getConnection();
  try {
    let query = 'SELECT COUNT(*) as count FROM cameras';
    const params = [];
    const conditions = [];
    if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
    if (filters.area)  { conditions.push('area = ?');   params.push(filters.area);   }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    const [rows] = await connection.execute(query, params);
    return rows[0].count;
  } finally { await connection.end(); }
}
```

---

### KI-07: `POST /api/api/cameras` → 400 "Field 'name' is required"

**Masalah:** Membuat kamera baru via API selalu ditolak meskipun body sudah benar.

**Penyebab:** Mismatch antara controller dan model:

| Layer | Field yang dipakai |
|---|---|
| Controller validasi ([CameraController.js:79](controllers/CameraController.js#L79)) | `name`, `ip_address`, `location`, `area` |
| Model INSERT ([Camera.js:71](models/Camera.js#L71)) | `id`, `label`, `area`, `lat`, `lng`, `stream_url` |

**Workaround:** Kirim kedua set field sekaligus dalam satu request body:
```json
{
  "id": "C240-01",
  "name": "Vigi AI - Halaman Depan",
  "label": "Vigi AI - Halaman Depan",
  "ip_address": "192.168.0.60",
  "location": "Halaman depan",
  "area": "Bandung",
  "lat": -6.9103254,
  "lng": 107.6089499,
  "stream_url": "rtsp://admin:PASSWORD@192.168.0.60:554/stream1",
  "status": "offline"
}
```
`name/ip_address/location` → memuaskan validasi controller  
`id/label/lat/lng/stream_url` → digunakan oleh `Camera.create()` di model

**Fix yang diperlukan (backend):** Selaraskan field validasi di [CameraController.js:79](controllers/CameraController.js#L79) dengan field model:
```javascript
// Ganti ini:
const requiredFields = ['name', 'ip_address', 'location', 'area'];
// Menjadi:
const requiredFields = ['id', 'label', 'area'];
```

---

### KI-08: `GET /api/api/cameras/C240-01` → 404 "Camera not found"

**Masalah:** Kamera Vigi AI (C240-01) tidak ditemukan di database.

**Penyebab:** Akibat KI-07 — POST gagal karena validasi `name` required, sehingga C240-01 tidak pernah tersimpan.

**Solusi:** Gunakan body workaround dari KI-07 untuk mendaftarkan C240-01. Setelah berhasil, GET akan mengembalikan data kamera.

---

### Pesan Error Umum

| Error Code | HTTP | Endpoint | Penyebab | Solusi |
|---|---|---|---|---|
| `CAMERA_NOT_FOUND` | 404 | `POST /api/cameras/:id/heartbeat` | ID tidak ada di daftar 18 kamera | Gunakan format `cam-1` s/d `cam-18` |
| `MISSING_STATUS` | 400 | `POST /api/cameras/:id/heartbeat` | Field `status` tidak dikirim | Tambahkan `"status"` di body |
| `INVALID_STATUS` | 400 | `POST /api/cameras/:id/heartbeat` | Nilai status tidak valid | Gunakan: `online/offline/degraded/error` |
| `Camera.getCount is not a function` | 500 | `GET /api/api/cameras` | Bug KI-06 — method tidak ada | Gunakan `/api/api/cameras/stats` |
| `Field 'name' is required` | 400 | `POST /api/api/cameras` | Bug KI-07 — field mismatch | Gunakan workaround dual-field di KI-07 |
| `INTERNAL_ERROR` | 500 | semua | Error server tidak terduga | Cek log server |

---

---

## 10. Kamera Vigi AI

Sistem CIFO Security mengintegrasikan kamera **TP-Link VIGI** melalui bridge AI yang berjalan otomatis saat server start. Kamera ini berbeda dari 18 kamera CCTV lainnya karena menggunakan protokol RTSP dan dilengkapi deteksi AI real-time.

### Konfigurasi Aktif

Kamera Vigi AI dikonfigurasi via variabel environment. Nilai aktif saat ini:

| Variabel Env | Nilai | Keterangan |
|---|---|---|
| `VIGI_CAMERA_HOST` | `192.168.0.60` | IP kamera di jaringan lokal |
| `VIGI_CAMERA_ID` | `C240-01` | **ID yang digunakan di database dan alerts** |
| `VIGI_CAMERA_LOCATION` | `Halaman depan` | Label lokasi untuk alert |
| `VIGI_CAMERA_API_PORT` | `20443` | Port HTTPS OpenAPI kamera |
| `VIGI_CAMERA_RTSP_PORT` | `554` | Port RTSP untuk stream video |
| `VIGI_MSG_PUSH_INTERVAL` | `30` detik | Debounce — satu event per 30 detik per tipe |

> **Penting:** `VIGI_CAMERA_ID` harus **sama persis** dengan `id` kamera di database. Semua alert AI menggunakan ID ini sebagai `camera_id`. Jika tidak cocok, alert tersimpan tapi tidak bisa di-link ke data kamera.

---

### Event yang Dideteksi Otomatis

Bridge Vigi AI aktif mendengarkan 8 tipe event berikut:

| Event | Keterangan |
|---|---|
| `PeopleDetection` | Terdeteksi orang di frame |
| `VehicleDetection` | Terdeteksi kendaraan |
| `MotionDetection` | Gerakan umum terdeteksi |
| `InvasionDetection` | Penyusupan ke area terlarang |
| `LoiterDetection` | Orang berdiam terlalu lama |
| `CrossLineDetection` | Melewati garis virtual |
| `AreaEntryDetection` | Masuk ke area yang dibatasi |
| `TamperDetection` | Kamera dirusak / ditutupi |

Setiap event memicu: capture snapshot (JPEG via RTSP) → analisis AI → simpan ke tabel `alerts`.

---

### Cara Mendaftarkan ke Database

> **Jalankan ini sekali** sebelum pertama kali testing. Tanpa ini, alert dari Vigi AI tidak bisa di-link ke data kamera.

**Cara A — Via API:**

> ⚠️ **Bug aktif KI-07:** URL menggunakan double prefix `/api/api/cameras` dan butuh dual-field body (lihat [KI-07](#ki-07-post-apiapicameras--400-field-name-is-required)).

```bash
curl -X POST http://localhost:3001/api/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "id": "C240-01",
    "name": "Vigi AI - Halaman Depan",
    "label": "Vigi AI - Halaman Depan",
    "ip_address": "192.168.0.60",
    "location": "Halaman depan",
    "area": "Bandung",
    "lat": -6.9103254,
    "lng": 107.6089499,
    "stream_url": "rtsp://admin:PASSWORD@192.168.0.60:554/stream1",
    "status": "offline"
  }'
```

> Ganti `PASSWORD` dengan nilai `VIGI_CAMERA_PASS` dari file `.env`.

**Cara B — Direct SQL:**

```sql
INSERT IGNORE INTO cameras (id, label, area, lat, lng, stream_url, status)
VALUES (
  'C240-01',
  'Vigi AI - Halaman Depan',
  'Bandung',
  -6.9103254,
  107.6089499,
  'rtsp://admin:PASSWORD@192.168.0.60:554/stream1',
  'offline'
);
```

**Verifikasi berhasil:**

```bash
curl -s http://localhost:3001/api/api/cameras/C240-01 | python -m json.tool
# Harapan: { "success": true, "data": { "id": "C240-01", ... } }
```

---

### Streaming RTSP vs HLS — Perbedaan Penting

Kamera Vigi menggunakan RTSP, **bukan** HLS `.m3u8` seperti kamera CCTV lainnya. Browser tidak bisa memutarnya secara langsung.

```
Kamera CCTV biasa:   stream_url = /video/HIKSVISION/xxx.m3u8   ← HLS, langsung pakai HLS.js
Kamera Vigi AI:      stream_url = rtsp://192.168.0.60:554/...  ← RTSP, butuh penanganan khusus
```

**Pilihan untuk menampilkan stream Vigi di frontend:**

| Opsi | Cara | Cocok untuk |
|---|---|---|
| **A — HLS Proxy** | ffmpeg/nginx mengkonversi RTSP → `.m3u8` | Live streaming di dashboard |
| **B — Snapshot terakhir** | Tampilkan JPEG dari alert Vigi AI terbaru | Thumbnail / preview kamera |
| **C — WebRTC Bridge** | RTSPtoWEB atau go2rtc | Low-latency real-time view |

**Opsi B (snapshot) sudah tersedia sekarang** tanpa setup tambahan — lihat bagian di bawah.

---

### Mengakses Snapshot dari Alert Vigi AI

Setiap kali Vigi AI mendeteksi event, snapshot JPEG disimpan otomatis. Frontend bisa mengaksesnya langsung.

**Ambil alert Vigi AI terbaru:**

```bash
curl -s "http://localhost:3001/api/alerts?source=camera&sourceId=C240-01&limit=5" \
  | python -m json.tool
```

**Struktur response alert:**

```json
{
  "id": 42,
  "alertId": "VIGI-C240-01-1746345600-1746345600123",
  "title": "PeopleDetection — Halaman depan",
  "severity": "HIGH",
  "status": "ACTIVE",
  "mediaUrls": ["/uploads/snapshots/C240-01_1746345600_1746345600123.jpg"],
  "context": {
    "vigi": {
      "event_type": "PeopleDetection",
      "ai_severity": "warning",
      "ai_person_count": 2,
      "ai_recommended_action": "monitor",
      "ai_is_false_positive": false,
      "ai_snapshot_path": "/uploads/snapshots/C240-01_1746345600_1746345600123.jpg"
    }
  }
}
```

**Tampilkan snapshot di frontend:**

```javascript
// Ambil alert Vigi AI terbaru untuk kamera C240-01
const res = await fetch("/api/alerts?source=camera&sourceId=C240-01&limit=1");
const { data } = await res.json();

if (data.length > 0) {
  const latestAlert = data[0];
  const snapshotUrl = latestAlert.mediaUrls?.[0];

  if (snapshotUrl) {
    document.getElementById("vigiPreview").src = `http://localhost:3001${snapshotUrl}`;
  }
}
```

```html
<!-- Placeholder thumbnail Vigi AI -->
<img id="vigiPreview" alt="Vigi AI - Halaman Depan" width="320" height="180" />
```

---

### Smoke Test Vigi AI

#### TC-10: Vigi AI — Registrasi ke Database

```bash
# Cek apakah C240-01 sudah ada
curl -s http://localhost:3001/api/api/cameras/C240-01 | python -m json.tool
```

- [ ] Response code `200` dengan `"id": "C240-01"` → sudah terdaftar ✅
- [ ] Response code `404` → belum terdaftar, jalankan INSERT dari bagian di atas

---

#### TC-11: Vigi AI — Snapshot Alert Tersimpan

```bash
# Tunggu event dari kamera (atau lewati di depan kamera untuk trigger PeopleDetection)
# Kemudian cek alert terbaru
curl -s "http://localhost:3001/api/alerts?source=camera&limit=3" | python -m json.tool
```

- [ ] Ada alert dengan `source: "camera"` dan `sourceId: "C240-01"`
- [ ] Field `mediaUrls` berisi path ke file `.jpg`
- [ ] File snapshot bisa diakses: `curl -I http://localhost:3001/uploads/snapshots/[filename].jpg`
- [ ] Response `200` untuk file snapshot

---

### Alur Lengkap Vigi AI

```
[Kamera 192.168.0.60]
      │ Deteksi event (PeopleDetection, dll)
      │
      ▼
[vigiEventListener.js]
      │ Terima notifikasi event
      │
      ▼
[vigiSnapshot.js]
      │ Grab frame JPEG via RTSP (stream2/sub-stream)
      │ ffmpeg → pipe:1 → Buffer
      │
      ▼
[aiPipeline.js]
      │ Kirim gambar ke OpenRouter / GPT-4o-mini
      │ Output: severity, description, tags, person_count, dll
      │
      ▼
[alertEnricher.js]
      │ Simpan JPEG ke uploads/snapshots/C240-01_[ts].jpg
      │ INSERT ke tabel alerts (+ context.vigi JSON)
      │ Jika severity=critical → INSERT ke panic_alerts (auto-eskalasi)
      │
      ▼
[Frontend]
      GET /api/alerts → tampilkan alert + snapshot
```

---

## Kontak

Pertanyaan tentang Camera API? Hubungi **Amet (QA Lead)**.

---

*Dokumentasi ini dibuat berdasarkan analisis kode `api/router.js`, `controllers/CameraController.js`, `models/Camera.js`, `models/CameraHealthLog.js`, `api/__tests__/camera.test.js`, dan `services/vigi/` — versi 2026-05-04.*
