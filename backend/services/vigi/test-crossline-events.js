#!/usr/bin/env node
// Manual test: connect to VIGI camera, enable crossline, subscribe, log raw events.
// Usage: node backend/services/vigi/test-crossline-events.js
// Walk past the camera crossing the line in both directions, observe output.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { VigiAuth } = require('./vigiAuth');
const { VigiEventListener } = require('./vigiEventListener');

const HOST = process.env.VIGI_CAMERA_HOST;
const PORT = parseInt(process.env.VIGI_CAMERA_API_PORT || '20443', 10);
const PASS = process.env.VIGI_CAMERA_PASS;
const USER = process.env.VIGI_CAMERA_USER || 'admin';
const DURATION_SEC = parseInt(process.argv[2] || '60', 10);

async function main() {
  if (!HOST || !PASS) {
    console.error('Set VIGI_CAMERA_HOST and VIGI_CAMERA_PASS in backend/.env');
    process.exit(1);
  }

  const auth = new VigiAuth({ host: HOST, port: PORT, username: USER, password: PASS });
  await auth.login();
  console.log('[test] authenticated');

  // Enable crossline detection + push (flat params, not nested)
  try {
    const sw = await auth.call('setCrosslineDetectionSwitch', {
      enabled: 'on',
      msg_push_enabled: 'on',
    });
    console.log('[test] setCrosslineDetectionSwitch:', JSON.stringify(sw));
  } catch (e) {
    console.warn('[test] setCrosslineDetectionSwitch failed:', e.message);
  }

  // Configure 2 lines: line 1 = AtoB (in), line 2 = BtoA (out)
  try {
    const region = await auth.call('setCrosslineDetectionRegion', {
      set_region_info: [
        {
          id: 1,
          points_num: 2,
          direction: 'AtoB',
          points_x: [2000, 8000, 0, 0, 0],
          points_y: [5000, 5000, 0, 0, 0],
          sensitivity: 50,
          people_enhance: 'on',
          vehicle_enhance: 'off',
          enhance_validity: 'medium',
        },
        {
          id: 2,
          points_num: 2,
          direction: 'BtoA',
          points_x: [2000, 8000, 0, 0, 0],
          points_y: [5000, 5000, 0, 0, 0],
          sensitivity: 50,
          people_enhance: 'on',
          vehicle_enhance: 'off',
          enhance_validity: 'medium',
        },
      ],
    });
    console.log('[test] setCrosslineDetectionRegion:', JSON.stringify(region));
  } catch (e) {
    console.warn('[test] setCrosslineDetectionRegion failed:', e.message);
  }

  // Check enhancement capability
  try {
    const cap = await auth.call('getEventEnhanceCapability');
    console.log('[test] getEventEnhanceCapability:', JSON.stringify(cap));
  } catch (e) {
    console.warn('[test] getEventEnhanceCapability failed:', e.message);
  }

  const EVENTS = ['CrossLineDetection', 'RegionEnteringDetection', 'RegionExitingDetection'];
  console.log(`\n[test] Subscribing to ${EVENTS.join(', ')} for ${DURATION_SEC}s...`);
  console.log('[test] Walk past the camera entering/exiting the region.\n');

  const listener = new VigiEventListener(auth, {
    events: EVENTS,
    heartbeat: 15,
  });

  let eventCount = 0;

  listener.on('connected', () => console.log('[test] stream connected'));
  listener.on('subscribed', () => console.log('[test] subscribed'));
  listener.on('heartbeat', () => process.stdout.write('.'));
  listener.on('error', (err) => console.error('[test] error:', err.message));

  listener.on('event', (event) => {
    eventCount++;
    console.log(`\n[EVENT #${eventCount}] RAW PAYLOAD:`);
    console.log(JSON.stringify(event, null, 2));
    console.log('  → has direction?', 'direction' in event ? `YES: ${event.direction}` : 'NO');
    console.log('  → has line_id?', 'line_id' in event || 'id' in event ? `YES: ${event.line_id || event.id}` : 'NO');
  });

  await listener.start();

  setTimeout(async () => {
    await listener.stop();
    console.log(`\n\n[test] Done. ${eventCount} event(s) received in ${DURATION_SEC}s.`);
    if (eventCount === 0) {
      console.log('[test] No events — check camera placement, crossline config, and walk past the line.');
    }
    process.exit(0);
  }, DURATION_SEC * 1000);
}

main().catch((err) => {
  console.error('[test] fatal:', err);
  process.exit(1);
});
