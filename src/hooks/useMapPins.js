import { useIncidents } from './useIncidents';
import { usePanicAlerts } from './usePanicAlerts';
import { useCameras } from './useCamerasStream';
import { normalizeCameraList } from '../services/camera.service';

const SVG_PAD = 60;
const SVG_W = 1080;
const SVG_H = 580;

function priorityColor(priority) {
  if (priority === 'CRITICAL' || priority === 'HIGH') return 'var(--red)';
  if (priority === 'MEDIUM') return 'var(--amber)';
  return 'var(--cyan)';
}

function computeBounds(coords) {
  if (coords.length === 0) return null;
  let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;
  for (const { lat, lng } of coords) {
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
    if (lng < lngMin) lngMin = lng;
    if (lng > lngMax) lngMax = lng;
  }
  const latPad = Math.max((latMax - latMin) * 0.15, 0.002);
  const lngPad = Math.max((lngMax - lngMin) * 0.15, 0.003);
  return { latMin: latMin - latPad, latMax: latMax + latPad, lngMin: lngMin - lngPad, lngMax: lngMax + lngPad };
}

export function useMapPins() {
  const { data: incidentsData } = useIncidents({ limit: 100 });
  const { data: panicData } = usePanicAlerts({ limit: 50 });
  const { data: camerasRaw } = useCameras();

  const incidents = Array.isArray(incidentsData?.data)
    ? incidentsData.data
    : Array.isArray(incidentsData?.incidents)
    ? incidentsData.incidents
    : Array.isArray(incidentsData)
    ? incidentsData
    : [];

  const panicAlerts = Array.isArray(panicData?.alerts) ? panicData.alerts : [];
  const cameras = normalizeCameraList(camerasRaw) ?? [];

  // Collect all valid GPS coordinates to auto-compute bounds
  const allCoords = [];

  const incidentCoords = incidents
    .filter((i) => i.location?.latitude != null && i.location?.longitude != null)
    .map((i) => ({ lat: i.location.latitude, lng: i.location.longitude, ref: i }));
  incidentCoords.forEach((c) => allCoords.push({ lat: c.lat, lng: c.lng }));

  const panicWithGps = panicAlerts
    .map((a) => {
      const raw = a.metadata?.originalRequest?.gps;
      const gps =
        (a.location?.lat != null ? { latitude: a.location.lat, longitude: a.location.lng } : null) ||
        (a.coordinatesLat != null ? { latitude: a.coordinatesLat, longitude: a.coordinatesLng } : null) ||
        (raw?.latitude != null ? raw : null) ||
        (raw?.lat != null ? { latitude: raw.lat, longitude: raw.lng } : null);
      return gps ? { ...a, _gps: gps } : null;
    })
    .filter(Boolean);
  panicWithGps.forEach((a) => allCoords.push({ lat: a._gps.latitude, lng: a._gps.longitude }));

  const cameraCoords = cameras.filter((c) => c.lat != null && c.lng != null);
  cameraCoords.forEach((c) => allCoords.push({ lat: c.lat, lng: c.lng }));

  const bounds = computeBounds(allCoords);

  const latToY = (lat) => {
    if (!bounds) return SVG_H / 2 + SVG_PAD;
    return SVG_PAD + ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * SVG_H;
  };
  const lngToX = (lng) => {
    if (!bounds) return SVG_W / 2 + SVG_PAD;
    return SVG_PAD + ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * SVG_W;
  };

  const incidentPins = incidentCoords.map((c) => ({
    id: c.ref.id,
    type: 'incident',
    name: c.ref.title,
    sub: c.ref.incidentNumber,
    x: lngToX(c.lng),
    y: latToY(c.lat),
    color: priorityColor(c.ref.priority),
    data: c.ref,
  }));

  const panicPins = panicWithGps.map((a) => ({
    id: a.id,
    type: 'panic',
    name: a.title || a.alertId || 'Panic Alert',
    sub: a.alertId,
    x: lngToX(a._gps.longitude),
    y: latToY(a._gps.latitude),
    color: 'var(--red)',
    data: a,
  }));

  const cameraPins = cameraCoords.map((c) => ({
    id: c.id,
    type: 'cctv',
    name: c.name,
    sub: `${c.res} · ${c.status}`,
    x: lngToX(c.lng),
    y: latToY(c.lat),
    color: 'var(--cyan)',
    data: c,
  }));

  return { incidentPins, panicPins, cameraPins };
}
