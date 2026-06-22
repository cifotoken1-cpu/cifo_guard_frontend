// backend/services/vigi/vigiCrosslineCounting.js
// Camera-native crossline counting: subscribes to CrossLineDetection events
// from the VIGI camera chip and inserts CrossingEvent records directly.
// Zero CPU inference — all detection happens on the camera.

const { VigiAuth } = require('./vigiAuth');
const { VigiEventListener } = require('./vigiEventListener');
const CrossingEvent = require('../../models/CrossingEvent');

async function startCrosslineCounting(overrides = {}) {
  const cfg = {
    host: process.env.VIGI_CAMERA_HOST,
    apiPort: parseInt(process.env.VIGI_CAMERA_API_PORT || '20443', 10),
    username: process.env.VIGI_CAMERA_USER || 'admin',
    password: process.env.VIGI_CAMERA_PASS,
    cameraId: process.env.VIGI_CAMERA_ID || 'C240-01',
    sensitivity: parseInt(process.env.VIGI_CROSSLINE_SENSITIVITY || '50', 10),
    startX: process.env.VIGI_CROSSLINE_START_X || '2000',
    startY: process.env.VIGI_CROSSLINE_START_Y || '5000',
    endX: process.env.VIGI_CROSSLINE_END_X || '8000',
    endY: process.env.VIGI_CROSSLINE_END_Y || '5000',
    inDir: process.env.VIGI_CROSSLINE_IN_DIR || 'AtoB',
  };

  if (!cfg.host) throw new Error('VIGI_CAMERA_HOST not configured');
  if (!cfg.password) throw new Error('VIGI_CAMERA_PASS not configured');

  const wsService = overrides.wsService || null;

  const log = (level, msg) => console[level](`[crossline] ${msg}`);

  const auth = new VigiAuth({
    host: cfg.host,
    port: cfg.apiPort,
    username: cfg.username,
    password: cfg.password,
  });

  await auth.login();
  log('info', `authenticated to ${cfg.host}`);

  // Enable Region Entering + Exiting detection with push on camera
  for (const feat of ['RegionEntering', 'RegionExiting']) {
    try {
      await auth.call(`set${feat}DetectionSwitch`, {
        [`${feat.charAt(0).toLowerCase()}${feat.slice(1)}_detection`]: { enabled: 'on', msg_push_enabled: 'on' },
      });
      log('info', `${feat} detection enabled on camera`);
    } catch (e) {
      log('warn', `set${feat}DetectionSwitch failed (${e.message}) — enable manually from camera web UI`);
    }
  }

  const listener = new VigiEventListener(auth, {
    events: ['RegionEnteringDetection', 'RegionExitingDetection'],
    heartbeat: 15,
  });

  listener.on('connected', () => log('info', 'event stream connected'));
  listener.on('subscribed', () => log('info', 'subscribed to RegionEntering/ExitingDetection'));
  listener.on('error', (err) => log('error', `listener error: ${err.message}`));
  listener.on('heartbeat', () => { /* silent */ });

  listener.on('event', async (event) => {
    const evType = event.event_type || '';
    let direction;
    if (evType.includes('RegionEnteringDetection')) direction = 'in';
    else if (evType.includes('RegionExitingDetection')) direction = 'out';
    else return;

    const crossedAt = event.time ? new Date(event.time * 1000) : new Date();

    try {
      await CrossingEvent.create({
        cameraId: cfg.cameraId,
        direction,
        crossedAt,
        metadata: { source: 'camera_api', raw_event: event },
      });

      if (wsService && typeof wsService.broadcastCountingEvent === 'function') {
        wsService.broadcastCountingEvent({
          camera_id: cfg.cameraId,
          direction,
          crossed_at: crossedAt,
        });
      }

      log('info', `crossing: ${direction} @ ${crossedAt.toISOString()}`);
    } catch (err) {
      log('error', `failed to insert crossing: ${err.message}`);
    }
  });

  await listener.start();
  log('info', 'crossline counting started');

  return {
    auth,
    listener,
    cfg,
    stop: async () => {
      log('info', 'stopping...');
      await listener.stop();
    },
  };
}

module.exports = { startCrosslineCounting };
