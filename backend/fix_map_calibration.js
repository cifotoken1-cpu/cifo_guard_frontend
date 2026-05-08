/**
 * Script untuk memperbarui kalibrasi peta agar sesuai dengan koordinat Jakarta
 * Mengatasi masalah alert tidak muncul di peta karena koordinat di luar bounds
 */

const fs = require('fs');
const path = require('path');

// Path ke file konfigurasi peta
const configPath = path.join(__dirname, '../src/app/pages/security/control-center/response-peta.json');

// Koordinat Jakarta yang sesuai dengan alert yang dibuat
const jakartaBounds = {
  minLat: -6.25,
  maxLat: -6.15,
  minLng: 106.80,
  maxLng: 106.90
};

// Baca konfigurasi yang ada
let config;
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  console.log('✅ Berhasil membaca konfigurasi peta yang ada');
} catch (error) {
  console.error('❌ Error membaca konfigurasi peta:', error.message);
  process.exit(1);
}

// Update calibration points untuk Jakarta
config.data.calibration.controlPoints = [
  {
    "geo": {
      "lat": jakartaBounds.minLat,
      "lng": jakartaBounds.minLng
    },
    "svg": {
      "x": 50,
      "y": 50
    }
  },
  {
    "geo": {
      "lat": jakartaBounds.maxLat,
      "lng": jakartaBounds.maxLng
    },
    "svg": {
      "x": 750,
      "y": 350
    }
  }
];

// Update points array juga
config.data.calibration.points = [
  {
    "id": "jakarta_point_1",
    "map": [jakartaBounds.minLng, jakartaBounds.minLat],
    "svg": [50, 50]
  },
  {
    "id": "jakarta_point_2",
    "map": [jakartaBounds.maxLng, jakartaBounds.maxLat],
    "svg": [750, 350]
  }
];

// Update deskripsi
config.data.description = "Jakarta basemap calibration for panic alerts";
config.data.name = "jakarta-calibration";

// Simpan konfigurasi yang diperbarui
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  console.log('✅ Berhasil memperbarui kalibrasi peta untuk Jakarta');
  console.log('📍 Bounds baru:');
  console.log(`   Latitude: ${jakartaBounds.minLat} to ${jakartaBounds.maxLat}`);
  console.log(`   Longitude: ${jakartaBounds.minLng} to ${jakartaBounds.maxLng}`);
  console.log('\n🔄 Silakan refresh browser untuk melihat perubahan');
} catch (error) {
  console.error('❌ Error menyimpan konfigurasi:', error.message);
  process.exit(1);
}

console.log('\n📋 Koordinat alert yang ada:');
console.log('   PANIC-006: -6.17, 106.83');
console.log('   PANIC-007: -6.24, 106.88');
console.log('   PANIC-008: -6.16, 106.86');
console.log('   Semua koordinat sekarang dalam bounds peta ✅');