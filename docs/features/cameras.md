# Fitur: Cameras

**Path:** `src/features/cameras/`

Galeri kamera, HLS playback, dan form CRUD kamera.

---

## Tujuan

Menampilkan live feed dari semua kamera (HLS atau placeholder animasi) dan menyediakan UI manajemen kamera (add/edit/delete) dengan cyberpunk HUD overlay.

---

## Komponen

### `CameraCard.jsx`

Kartu satu kamera dengan video player + HUD overlay.

- HLS playback via `hls.js`. Fallback Safari pakai native HLS (`canPlayType('application/vnd.apple.mpegurl')`).
- Jika `cam.streamUrl` tidak ada / bukan `.m3u8` → tampilkan animated background placeholder (variant `bgIndex`).
- Overlay: live indicator (pulse merah), nama kamera, resolusi, jam, motion alert, control buttons (mute, fullscreen).

### `CameraForm.jsx`

Form untuk create / edit / delete kamera.

- Mode `create` jika `camera` prop kosong, `edit` jika ada.
- Field: name, location, latitude, longitude, resolution (dropdown), `streamUrl`, status.
- **Dual-field workaround**: backend menerima beberapa nama field redundant — `buildCameraPostBody` di `cameras.api.js` mengirim varian sehingga schema berbeda tetap kompatibel.
- Submit → `camerasApi.db.create()` / `db.update()`. Delete → `db.delete()` dengan confirm.
- `onSuccess` invalidate `['cameras']` lalu `onClose()`.

### `CamerasModal.jsx`

Modal galeri semua kamera.

- Grid `CameraCard` (3 kolom default).
- Footer status: "N online / M total".
- Per-card menu: edit (open `CameraForm` dengan camera prop), delete.
- Tombol **Add Camera** → buka `CameraForm` mode create.
- Toggle fullscreen.

---

## API & Hook

| API / Hook | Endpoint | Catatan |
|---|---|---|
| `useCameras()` | `GET /api/cameras` (legacy) + WS | List kamera + heartbeat polling 30s |
| `camerasApi.db.list(params)` | `GET /api/api/cameras` | Database system (saat ini terblok bug double prefix) |
| `camerasApi.db.create(body)` | `POST /api/api/cameras` | Pakai `buildCameraPostBody` |
| `camerasApi.db.update(id, body)` | `PUT /api/api/cameras/:id` | |
| `camerasApi.db.patchStatus(id, status)` | `PATCH /api/api/cameras/:id/status` | |
| `camerasApi.db.delete(id)` | `DELETE /api/api/cameras/:id` | |
| `camerasApi.heartbeat(id, body)` | `POST /api/cameras/:id/heartbeat` | Auto setiap 30s dari hook |

Sumber: `src/api/cameras.api.js`, `src/hooks/useCamerasStream.js`.

---

## State / Store

- **`useUIStore`** — `openModal('cameras')`, `closeModal()`.
- Component state lokal: `selectedCamera`, `showForm`, `fullscreen`, `bgIndex`.

---

## Props

| Komponen | Props |
|---|---|
| `CameraCard` | `cam: Camera`, `time: Date`, `bgIndex: number`, `fullscreen?: boolean` |
| `CameraForm` | `camera?: Camera` (edit mode jika ada), `onClose: () => void` |
| `CamerasModal` | — (controlled by UI store) |

---

## Catatan Integrasi

- **Endpoint legacy vs DB:** Saat ini `useCameras()` masih pakai endpoint legacy `/api/cameras` yang berisi 18 kamera hardcoded + Vigi AI injection. Setelah backend memperbaiki bug double-prefix `/api/api/cameras` (Known Issue #1 di README), pindahkan ke `db.list()`.
- **HLS support deteksi runtime:** Selalu cek `Hls.isSupported()` sebelum `new Hls()`. Untuk Safari pakai jalur native; untuk browser tanpa MSE, fallback ke placeholder.
- **CORS HLS:** Jika stream server berbeda domain, backend harus proxy atau set CORS — kalau tidak, browser akan reject manifest.
- **WS event `camera_status_changed`** invalidate `['cameras']` agar status online/offline up-to-date.
- **Heartbeat** mengirim ping 30s; backend pakai ini untuk mark camera online/offline.
