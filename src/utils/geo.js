/**
 * Get current GPS coordinates. Returns the shape backend expects:
 * { latitude, longitude, accuracy }
 */
export function getGPS(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported in this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(new Error(err.message || 'Failed to get GPS')),
      {
        enableHighAccuracy: true,
        timeout: 8_000,
        maximumAge: 30_000,
        ...options,
      }
    );
  });
}

// @stub: hybrid — fallback default saat browser geolocation gagal/denied (panic flow tetap jalan). Lihat #3, INTEGRATION_STATUS.md #5.
/** Fallback when GPS is unavailable — returns center of Indonesia */
export const FALLBACK_GPS = {
  latitude: -2.5489,
  longitude: 118.0149,
  accuracy: 999_999,
};
