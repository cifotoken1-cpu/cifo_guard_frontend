# Fitur: Interactive Map

**Path:** `src/features/interactive-map/`

Peta SVG dengan pin overlay untuk insiden, panic alert, dan kamera — plus layer toggle dan info pane.

---

## Tujuan

Memberi tampilan spasial terkonsolidasi: insiden mana di mana, panic aktif di titik mana, kamera mana yang offline — semua di satu basemap SVG kustom.

---

## Komponen

### `InteractiveMapView.jsx`

Root view. State:

- `layers: { incidents, panic, cctv, houses, roads }` — boolean toggle.
- `selectedPin` — pin yang di-click.

Compose `MapLayerControl` (atas), `MapCanvas` (tengah), `MapInfoPane` (kanan).

### `MapLayerControl.jsx`

Toggle button untuk 5 layer dengan badge count:

- `incidents` — pin insiden
- `panic` — pin panic alert
- `cctv` — pin kamera
- `houses` — basemap blok bangunan A–E
- `roads` — basemap jalan

### `MapCanvas.jsx`

SVG canvas viewport `1200×700`.

- Render basemap: HOUSES (grid blok A–E) + ROADS (grid jalan).
- Render pins yang aktif (filter berdasarkan `layers`).
- Legend basemap di pojok.
- Click pin → `onPinClick(pin)`.

### `MapPin.jsx`

`<g>` SVG yang berisi:

- Pulse ring (untuk type incident/panic dengan severity tinggi)
- Circle body (lebih besar + white stroke saat `selected`)
- Icon SVG sesuai type: `warning` (incident), `panic`, `cctv`

### `MapInfoPane.jsx`

Right panel detail pin terpilih. 3 template by `type`:

| Type | Field |
|---|---|
| `incident` | status, priority, GPS |
| `panic` | alertId, status, waktu, GPS |
| `cctv` | name, status, resolution, GPS |

---

## API & Hook

### `useMapPins()` — composite hook

Sumber: `src/hooks/useMapPins.js`. Return:

```ts
{
  incidentPins: Pin[],
  panicPins: Pin[],
  cameraPins: Pin[]
}
```

Internal:

- `useIncidents()` — semua insiden
- `usePanicAlerts()` — semua panic
- `useCameras()` — semua kamera
- Normalize GPS ke koordinat SVG via `latToY()` / `lngToX()`.

**Bounding box** (hardcoded di hook):

- Latitude: `-6.245` (top) → `-6.225` (bottom)
- Longitude: `106.835` (left) → `106.860` (right)

---

## State / Store

- Component state `layers` & `selectedPin` di `InteractiveMapView`.
- Tidak menggunakan store global.

---

## Props

| Komponen | Props |
|---|---|
| `MapCanvas` | `pins: Pin[]`, `layers: LayerToggle`, `selectedPinId: string`, `onPinClick: (pin) => void` |
| `MapPin` | `pin: Pin`, `selected: boolean`, `onClick: (pin) => void` |
| `MapLayerControl` | `layers: LayerToggle`, `onToggle: (layerName) => void`, `counts: { [layer]: number }` |
| `MapInfoPane` | `pin: Pin \| null` |

---

## Catatan Integrasi

- **Color priority pin:**
  - `severity` CRITICAL/HIGH → merah
  - MEDIUM → amber
  - default / cctv → cyan
- **GPS di luar bounding box** akan di-clamp ke edge canvas — pin tetap kelihatan tapi tidak akurat. Kalau area dipindah, update bounds di `useMapPins.js`.
- **Real-time sync** mengikuti hook upstream (`useIncidents`, `usePanicAlerts`, `useCameras`) — tidak perlu listener WS terpisah di view ini.
- **Performance:** kalau pin > 200 di satu render, pertimbangkan virtualisasi atau cluster — saat ini render naive semua.
- **Basemap** adalah SVG inline di `MapCanvas` (bukan asset) — kalau perlu basemap real (raster tile), pertimbangkan integrasi Leaflet/MapLibre di iterasi berikutnya.
