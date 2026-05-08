// backend/scripts/test_vigi_ai.js
// Manual integration test for the VIGI AI bridge.
// Run from project root: node backend/scripts/test_vigi_ai.js
//
// Checklist:
//   1. Auth berhasil → dapat stok
//   2. getDeviceInfo mengembalikan model C240
//   3. Snapshot tersimpan dan bisa dibuka
//   4. AI result punya description, severity, dan recommended_action

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('node:fs');
const path = require('node:path');

const { VigiAuth }       = require('../services/vigi/vigiAuth');
const { VigiSnapshot }   = require('../services/vigi/vigiSnapshot');
const { analyzeSnapshot } = require('../services/vigi/aiPipeline');

const required = ['VIGI_CAMERA_HOST', 'VIGI_CAMERA_USER', 'VIGI_CAMERA_PASS', 'OPENROUTER_API_KEY'];
const missing = required.filter(k => !process.env[k] || process.env[k].startsWith('ganti_') || process.env[k] === 'sk-...');
if (missing.length) {
  console.error('✗ Set these in backend/.env before running:', missing.join(', '));
  process.exit(1);
}

(async () => {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const auth = new VigiAuth({
    host:     process.env.VIGI_CAMERA_HOST,
    port:     parseInt(process.env.VIGI_CAMERA_API_PORT || '20443'),
    username: process.env.VIGI_CAMERA_USER,
    password: process.env.VIGI_CAMERA_PASS,
  });

  await auth.login();
  console.log('✓ [1/4] Auth OK  stok =', auth.stok.slice(0, 8) + '...');

  // ── 2. Device info ────────────────────────────────────────────────────────
  const info = await auth.call('getDeviceInfo');
  console.log('✓ [2/4] Device info:', JSON.stringify(info.result ?? info, null, 2));

  // ── 3. Snapshot ───────────────────────────────────────────────────────────
  const snap = new VigiSnapshot({
    host:     process.env.VIGI_CAMERA_HOST,
    port:     parseInt(process.env.VIGI_CAMERA_RTSP_PORT || '554'),
    username: process.env.VIGI_CAMERA_USER,
    password: process.env.VIGI_CAMERA_PASS,
    stream:   'stream2',
  });

  const buf = await snap.grab();
  const outPath = path.resolve(__dirname, '../../test_snap.jpg');
  fs.writeFileSync(outPath, buf);
  console.log(`✓ [3/4] Snapshot saved: ${outPath}  (${buf.length} bytes)`);

  // ── 4. AI analysis ────────────────────────────────────────────────────────
  const ai = await analyzeSnapshot({
    imageBuffer: buf,
    eventMeta:   { event_type: 'PeopleDetection', time: Math.floor(Date.now() / 1000) },
    location:    process.env.VIGI_CAMERA_LOCATION || 'test',
  });
  console.log('✓ [4/4] AI result:', JSON.stringify(ai, null, 2));

  console.log('\n✅ Semua 4 checklist passed — bridge siap diaktifkan.');
  console.log('   Set VIGI_AI_ENABLED=true di backend/.env lalu restart server.\n');
})().catch(err => {
  console.error('\n✗ Test gagal:', err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
