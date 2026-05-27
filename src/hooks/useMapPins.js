import { useIncidents } from './useIncidents';
import { usePanicAlerts } from './usePanicAlerts';
import { useCameras } from './useCamerasStream';
import { normalizeCameraList } from '../services/camera.service';

// Batas koordinat GPS perumahan — konfirmasi dengan tim backend/ops
const MAP_BOUNDS = {
  latMin: -6.245,
  latMax: -6.225,
  lngMin: 106.835,
  lngMax: 106.860,
};

// Normalisasi GPS ke SVG viewport 1200×700
function latToY(lat) {
  return 60 + ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * 580;
}

function lngToX(lng) {
  return 60 + ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * 1080;
}

function priorityColor(priority) {
  if (priority === 'CRITICAL' || priority === 'HIGH') return 'var(--red)';
  if (priority === 'MEDIUM') return 'var(--amber)';
  return 'var(--cyan)';
}

export function useMapPins() {
  // Fetch incidents with active statuses (simplified to avoid backend query parsing issues)
  const { data: incidentsData } = useIncidents({ limit: 100 });
  const { data: panicData } = usePanicAlerts({ limit: 50 });
  const { data: camerasRaw } = useCameras();

  // Normalize response data with fallbacks
  const incidents = Array.isArray(incidentsData?.data)
    ? incidentsData.data
    : Array.isArray(incidentsData?.incidents)
    ? incidentsData.incidents
    : Array.isArray(incidentsData)
    ? incidentsData
    : [];

  const panicAlerts = Array.isArray(panicData?.alerts) ? panicData.alerts : [];
  const cameras = normalizeCameraList(camerasRaw) ?? [];

  const incidentPins = incidents
    .filter((i) => i.location?.latitude != null && i.location?.longitude != null)
    .map((i) => ({
      id: i.id,
      type: 'incident',
      name: i.title,
      sub: i.incidentNumber,
      x: lngToX(i.location.longitude),
      y: latToY(i.location.latitude),
      color: priorityColor(i.priority),
      data: i,
    }));

  const panicPins = panicAlerts
    .map((a) => {
      const gps =
        (a.location?.lat != null ? { latitude: a.location.lat, longitude: a.location.lng } : null) ||
        (a.coordinatesLat != null ? { latitude: a.coordinatesLat, longitude: a.coordinatesLng } : null) ||
        (a.metadata?.originalRequest?.gps?.latitude != null ? a.metadata.originalRequest.gps : null);
      return gps ? { ...a, _gps: gps } : null;
    })
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      type: 'panic',
      name: a.title || a.alertId || 'Panic Alert',
      sub: a.alertId,
      x: lngToX(a._gps.longitude),
      y: latToY(a._gps.latitude),
      color: 'var(--red)',
      data: a,
    }));

  const cameraPins = cameras
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({
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
