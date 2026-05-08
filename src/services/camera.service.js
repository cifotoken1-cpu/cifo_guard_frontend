/**
 * Camera Service — Normalization & adapter layer
 * 
 * Handles:
 * - Field normalization (camelCase vs snake_case)
 * - Status format conversion (uppercase vs lowercase)
 * - Vigi-First ordering (C240-01 always first)
 * - Fallback values for missing fields
 */

export const STATUS_MAP = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  MAINTENANCE: 'degraded',
  ERROR: 'error',
};

/**
 * Normalize single camera object from either system (in-memory or database)
 * @param {Object} c - raw camera object
 * @param {number} index - array position (for default naming)
 * @returns {Object} normalized camera
 */
export function normalizeCamera(c, index = 0) {
  if (!c) return null;

  return {
    // Identity
    id: c.id ?? index,
    name: c.label || c.name || `Camera ${index + 1}`,

    // Display
    res: c.resolution || '1080p',
    bg: ['cam-bg-1', 'cam-bg-2', 'cam-bg-3'][index % 3],

    // Streaming
    streamUrl: c.stream_url || c.streamUrl || null,

    // Status — normalize to lowercase
    status: normalizeStatus(c.status),

    // Health metrics
    lastHeartbeat: c.last_heartbeat || c.lastHeartbeat || null,
    healthScore: c.health_score ?? c.healthScore ?? 0,
    responseTime: c.response_time ?? c.responseTime ?? 0,

    // Detection
    motion: c.motion || false,
    detect: c.detection || null,

    // Location
    area: c.area || c.location || null,
    lat: parseFloat(c.lat) || null,
    lng: parseFloat(c.lng) || null,
  };
}

/**
 * Normalize status from either format to lowercase standard
 * @param {string} status - raw status value
 * @returns {string} normalized status
 */
function normalizeStatus(status) {
  if (!status) return 'offline';
  
  const mapped = STATUS_MAP[status.toUpperCase()];
  if (mapped) return mapped;
  
  return status.toLowerCase();
}

/**
 * Normalize camera list, with Vigi-First ordering
 * @param {Object} data - response from camerasApi.list()
 * @returns {Array|null} normalized camera array, or null if invalid
 */
export function normalizeCameraList(data) {
  if (!data?.cameras || !Array.isArray(data.cameras)) {
    return null;
  }

  const list = data.cameras.map(normalizeCamera);

  // Vigi-First: C240-01 always at index 0 if it exists
  const vigiIdx = list.findIndex(c => c?.id === 'C240-01');
  if (vigiIdx > 0) {
    const vigi = list.splice(vigiIdx, 1)[0];
    list.unshift(vigi);
  }

  return list;
}

/**
 * Build POST body for camera creation, using dual-field workaround for Bug #2
 * @param {Object} formData - form field values
 * @returns {Object} body ready for POST /api/api/cameras
 */
export function buildCameraPostBody(formData) {
  return {
    // Required for controller validation layer
    name: formData.label || formData.name,
    ip_address: formData.ip_address || '0.0.0.0',
    location: formData.area || formData.location || '',

    // Used by model/service
    id: formData.id || undefined,
    label: formData.label || formData.name,
    area: formData.area || formData.location || '',
    lat: formData.lat || 0,
    lng: formData.lng || 0,
    stream_url: formData.streamUrl || '',
    status: formData.status || 'OFFLINE',
    resolution: formData.res || '1080p',
  };
}
