/**
 * Geolocation utilities untuk validasi koordinat dan perhitungan jarak
 */

/**
 * Validate GPS coordinates
 */
function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, error: 'Coordinates must be numbers' };
  }
  
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Coordinates cannot be NaN' };
  }
  
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  
  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }
  
  return { valid: true };
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Check if coordinates are within a bounding box
 */
function isWithinBounds(lat, lng, bounds) {
  const { north, south, east, west } = bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/**
 * Generate random coordinates within a radius (for testing)
 */
function generateRandomCoordinates(centerLat, centerLng, radiusMeters) {
  const radiusInDegrees = radiusMeters / 111000; // Approximate conversion
  
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  
  const newLat = centerLat + y;
  const newLng = centerLng + x / Math.cos(toRadians(centerLat));
  
  return { lat: newLat, lng: newLng };
}

module.exports = {
  validateCoordinates,
  calculateDistance,
  toRadians,
  toDegrees,
  isWithinBounds,
  generateRandomCoordinates
};