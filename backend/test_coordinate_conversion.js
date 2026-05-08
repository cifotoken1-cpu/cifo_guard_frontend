/**
 * Script untuk menguji konversi koordinat GPS ke pixel
 * Memverifikasi bahwa alert dengan koordinat Jakarta dapat ditampilkan di peta
 */

const fs = require('fs');
const path = require('path');

// Baca konfigurasi kalibrasi peta
const configPath = path.join(__dirname, '../src/app/pages/security/control-center/response-peta.json');
let config;
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  console.log('✅ Berhasil membaca konfigurasi kalibrasi peta');
} catch (error) {
  console.error('❌ Error membaca konfigurasi:', error.message);
  process.exit(1);
}

// Fungsi konversi GPS ke pixel (sama seperti di mapUtils.js)
function gpsToPixel(lat, lng, calibration, mapDimensions = { width: 800, height: 400 }) {
  if (!calibration || !calibration.controlPoints || calibration.controlPoints.length < 2) {
    console.warn('No calibration data available, using fallback conversion');
    return {
      x: (lng + 180) * mapDimensions.width / 360,
      y: (90 - lat) * mapDimensions.height / 180
    };
  }

  // Use first two calibration points for linear transformation
  const point1 = calibration.controlPoints[0];
  const point2 = calibration.controlPoints[1];

  // Calculate scale factors
  const scaleX = (point2.svg.x - point1.svg.x) / (point2.geo.lng - point1.geo.lng);
  const scaleY = (point2.svg.y - point1.svg.y) / (point2.geo.lat - point1.geo.lat);

  // Calculate pixel coordinates
  const x = point1.svg.x + (lng - point1.geo.lng) * scaleX;
  const y = point1.svg.y + (lat - point1.geo.lat) * scaleY;

  return { x, y };
}

// Fungsi untuk memeriksa apakah koordinat dalam bounds
function isWithinMapBounds(gps, calibration, mapDimensions) {
  if (!calibration || !calibration.controlPoints || calibration.controlPoints.length < 2) {
    return true;
  }

  const lats = calibration.controlPoints.map(p => p.geo.lat);
  const lngs = calibration.controlPoints.map(p => p.geo.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const buffer = 0.01;
  return gps.lat >= (minLat - buffer) && gps.lat <= (maxLat + buffer) && 
         gps.lng >= (minLng - buffer) && gps.lng <= (maxLng + buffer);
}

// Test koordinat alert yang ada
const testAlerts = [
  { id: 'PANIC-006', lat: -6.17, lng: 106.83, title: 'Shopping Mall' },
  { id: 'PANIC-007', lat: -6.24, lng: 106.88, title: 'Office Complex' },
  { id: 'PANIC-008', lat: -6.16, lng: 106.86, title: 'Hospital' }
];

console.log('\n📍 Kalibrasi Peta:');
console.log('Control Points:', JSON.stringify(config.data.calibration.controlPoints, null, 2));

console.log('\n🧪 Testing Coordinate Conversion:');
console.log('=' .repeat(80));

testAlerts.forEach(alert => {
  const pixelCoords = gpsToPixel(alert.lat, alert.lng, config.data.calibration);
  const isWithinBounds = isWithinMapBounds({ lat: alert.lat, lng: alert.lng }, config.data.calibration);
  
  console.log(`\n${alert.id} - ${alert.title}`);
  console.log(`  GPS: (${alert.lat}, ${alert.lng})`);
  console.log(`  Pixel: (${pixelCoords.x.toFixed(2)}, ${pixelCoords.y.toFixed(2)})`);
  console.log(`  Within Bounds: ${isWithinBounds ? '✅ YES' : '❌ NO'}`);
  
  // Check if pixel coordinates are reasonable (within map dimensions)
  const mapDimensions = { width: 800, height: 400 };
  const pixelValid = pixelCoords.x >= 0 && pixelCoords.x <= mapDimensions.width && 
                     pixelCoords.y >= 0 && pixelCoords.y <= mapDimensions.height;
  console.log(`  Pixel Valid: ${pixelValid ? '✅ YES' : '❌ NO (outside map area)'}`);
});

console.log('\n' + '='.repeat(80));
console.log('📋 Summary:');
console.log('- Jika semua alert menunjukkan "Within Bounds: ✅ YES" dan "Pixel Valid: ✅ YES",');
console.log('  maka alert seharusnya muncul di peta setelah browser di-refresh.');
console.log('- Jika masih tidak muncul, periksa console browser untuk error JavaScript.');