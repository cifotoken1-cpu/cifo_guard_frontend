// backend/services/vigi/index.js
// Orchestrator: wires VigiAuth + VigiEventListener + VigiSnapshot + AI pipeline
// into a single background bridge that runs alongside your Express app.

const path = require('node:path');
const { VigiAuth } = require('./vigiAuth');
const { VigiEventListener } = require('./vigiEventListener');
const { VigiSnapshot } = require('./vigiSnapshot');
const { VigiHLSTranscoder } = require('./vigiHLS');
const { analyzeSnapshot } = require('./aiPipeline');
const { persistEnrichedAlert } = require('./alertEnricher');

// Event types we care about. Add/remove based on what's enabled in the camera.
// NOTE: each event also needs `msg_push_enabled` to be ON in the corresponding
// detection config on the camera (see VIGI OpenAPI doc § 4.8.x).
const DEFAULT_EVENTS = [
  'PeopleDetection',
  'VehicleDetection',
  'MotionDetection',
  'InvasionDetection',
  'LoiterDetection',
  'CrossLineDetection',
  'AreaEntryDetection',
  'TamperDetection',
];

async function startVigiAIBridge(overrides = {}) {
  const cfg = {
    host: overrides.host || process.env.VIGI_CAMERA_HOST,
    apiPort: parseInt(overrides.apiPort || process.env.VIGI_CAMERA_API_PORT || '20443', 10),
    rtspPort: parseInt(overrides.rtspPort || process.env.VIGI_CAMERA_RTSP_PORT || '554', 10),
    username: overrides.username || process.env.VIGI_CAMERA_USER || 'admin',
    password: overrides.password || process.env.VIGI_CAMERA_PASS,
    cameraId: overrides.cameraId || process.env.VIGI_CAMERA_ID || 'C240-01',
    location: overrides.location || process.env.VIGI_CAMERA_LOCATION || 'Unknown location',
    msgPushIntervalSec: parseInt(overrides.msgPushIntervalSec || process.env.VIGI_MSG_PUSH_INTERVAL || '30', 10),
    events: overrides.events || DEFAULT_EVENTS,
  };

  if (!cfg.host) throw new Error('VIGI_CAMERA_HOST not configured');
  if (!cfg.password) throw new Error('VIGI_CAMERA_PASS not configured');

  const log = (level, msg, extra) => {
    const tag = '[vigi-ai]';
    if (extra) console[level](`${tag} ${msg}`, extra);
    else console[level](`${tag} ${msg}`);
  };

  const auth = new VigiAuth({
    host: cfg.host,
    port: cfg.apiPort,
    username: cfg.username,
    password: cfg.password,
  });

  const snapshot = new VigiSnapshot({
    host: cfg.host,
    port: cfg.rtspPort,
    username: cfg.username,
    password: cfg.password,
    stream: 'stream2', // sub-stream is enough for AI vision and saves bandwidth
  });

  // Start HLS transcoder — stream1 (HD) for display, stream2 is used by AI above
  const hlsTranscoder = new VigiHLSTranscoder({
    host: cfg.host,
    port: cfg.rtspPort,
    username: cfg.username,
    password: cfg.password,
    cameraId: cfg.cameraId,
    outputDir: path.join(__dirname, '../../uploads/hls'),
  });
  const hlsUrl = hlsTranscoder.start();

  // Update stream_url in DB so the frontend picks up the HLS URL automatically
  try {
    const Camera = require('../../models/Camera');
    const existing = await Camera.getById(cfg.cameraId);
    if (existing) {
      await Camera.update(cfg.cameraId, {
        label: existing.label,
        area: existing.area,
        lat: existing.lat,
        lng: existing.lng,
        stream_url: hlsUrl,
      });
      log('info', `stream_url updated to ${hlsUrl}`);
    } else {
      log('warn', `camera ${cfg.cameraId} not in DB yet — register it with stream_url: "${hlsUrl}"`);
    }
  } catch (e) {
    log('warn', `could not update stream_url in DB: ${e.message}`);
  }

  await auth.login();
  log('info', `authenticated to camera ${cfg.host}`);

  // Debounce same-type events on the camera side. e.g. interval=30 means we
  // only get one PeopleDetection event per 30s even if a person stays in frame.
  try {
    await auth.call('setMsgpushInterval', { event_interval: cfg.msgPushIntervalSec });
    log('info', `set msg_push_interval = ${cfg.msgPushIntervalSec}s`);
  } catch (e) {
    log('warn', `could not set msg_push_interval: ${e.message}`);
  }

  const listener = new VigiEventListener(auth, {
    events: cfg.events,
    heartbeat: 15,
  });

  // Single-flight queue: we never run two AI calls concurrently for the same
  // camera. If events arrive faster than we can process, they queue up.
  // Drop policy: if backlog exceeds 10, drop the oldest to keep latency bounded.
  const queue = [];
  let processing = false;
  const MAX_QUEUE = 10;

  const processNext = async () => {
    if (processing || queue.length === 0) return;
    processing = true;
    const event = queue.shift();
    const startedAt = Date.now();

    try {
      log('info', `processing ${event.event_type} @ ${event.time}`);

      const buffer = await snapshot.grab({ timeoutMs: 8000 });
      log('info', `snapshot captured (${buffer.length} bytes)`);

      const aiResult = await analyzeSnapshot({
        imageBuffer: buffer,
        eventMeta: event,
        location: cfg.location,
      });

      const { alertId, panicAlertId } = await persistEnrichedAlert({
        eventMeta: event,
        snapshotBuffer: buffer,
        aiResult,
        cameraId: cfg.cameraId,
        cameraLocation: cfg.location,
      });

      log(
        'info',
        `alert#${alertId} severity=${aiResult.severity} action=${aiResult.recommended_action}` +
          (panicAlertId ? ` panic#${panicAlertId} ESCALATED` : '') +
          ` (${Date.now() - startedAt}ms total, ${aiResult._meta?.tokens || 0} tokens)`
      );
    } catch (err) {
      log('error', `processing failed: ${err.message}`);
    } finally {
      processing = false;
      // Drain the queue — process the next one if any.
      if (queue.length) setImmediate(processNext);
    }
  };

  listener.on('event', (event) => {
    if (queue.length >= MAX_QUEUE) {
      log('warn', `queue full (${MAX_QUEUE}), dropping oldest event`);
      queue.shift();
    }
    queue.push(event);
    processNext();
  });

  listener.on('connected', () => log('info', 'event stream connected'));
  listener.on('subscribed', () => log('info', `subscribed to ${cfg.events.join(', ')}`));
  listener.on('subscribeFailed', (p) => log('error', 'subscribe failed', p));
  listener.on('error', (err) => log('error', `listener error: ${err.message}`));
  listener.on('heartbeat', () => { /* silent */ });

  await listener.start();
  log('info', 'bridge started');

  return {
    auth,
    listener,
    snapshot,
    hlsTranscoder,
    hlsUrl,
    cfg,
    stop: async () => {
      log('info', 'stopping bridge...');
      hlsTranscoder.stop();
      await listener.stop();
    },
  };
}

module.exports = { startVigiAIBridge };
