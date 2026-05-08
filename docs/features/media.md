# Fitur: Media

**Path:** `src/features/media/`

Galeri kamera fullscreen-friendly — reuse `CameraCard` dari fitur cameras.

---

## Tujuan

Mode tampilan khusus "media wall" untuk dinding monitor kontrol — semua kamera ditampilkan tanpa ornamen UI lain (tidak ada modal, tidak ada control bar tebal).

---

## Komponen

### `MediaView.jsx`

Container tunggal:

- Header section: "Live Cameras (N)" — N = jumlah kamera dari `useCameras()`.
- Grid `CameraCard` (reuse dari `src/features/cameras/`).
- Empty state jika `cameras.length === 0`.

Layout grid auto-wrap; fitur ini di-mount lewat `CenterPanel` saat `activeNav === 'media'`.

---

## API & Hook

| Hook | Sumber | Catatan |
|---|---|---|
| `useCameras()` | `src/hooks/useCamerasStream.js` | Reuse — sama dengan fitur cameras |
| `useClock()` | `src/hooks/useClock.js` | Real-time HUD timer di card |

---

## State / Store

Tidak ada — view stateless.

---

## Props

`MediaView` tidak menerima props. `CameraCard` di-render dengan:

```jsx
<CameraCard cam={cam} time={now} bgIndex={i} fullscreen={true} />
```

---

## Catatan Integrasi

- **Reuse-only feature** — semua logic (HLS, heartbeat, animated bg) ada di `CameraCard`. Lihat [Cameras](./cameras.md) untuk detail.
- **`fullscreen={true}` prop** men-skip control buttons di overlay HUD (mute, fullscreen toggle) supaya cocok untuk display monitor.
- **Performance:** semua kamera di-mount sekaligus → setiap kamera punya HLS instance. Untuk N > 12, pertimbangkan lazy mount atau virtual grid.
