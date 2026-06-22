// backend/services/vigi/index.js
// Orchestrator: wires VigiAuth + VigiEventListener + VigiSnapshot + AI pipeline
// into a single background bridge that runs alongside your Express app.

const { VigiAuth } = require('./vigiAuth');
const { VigiEventListener } = require('./vigiEventListener');
const { VigiSnapshot } = require('./vigiSnapshot');
const { analyzeSnapshot } = require('./aiPipeline');
const { persistEnrichedAlert } = require('./alertEnricher');

const FACE_WORKER_URL = process.env.FACE_WORKER_URL || 'http://localhost:5001';
// ROI crop for face worker — ffmpeg crop filter format
const FACE_WORKER_CROP = process.env.FACE_WORKER_CROP || '';
// Which events trigger face worker: "human", "region", "motion", or comma-separated
const FACE_TRIGGER = (process.env.FACE_TRIGGER || 'human').toLowerCase();
const FACE_TRIGGER_MAP = {
  human: ['PeopleDetection'],
  region: ['AreaEntryDetection', 'AreaExitDetection'],
  motion: ['MotionDetection'],
};
const FACE_TRIGGER_EVENTS = FACE_TRIGGER.split(',')
  .flatMap(t => FACE_TRIGGER_MAP[t.trim()] || [t.trim()]);

// Event types whose AI alert is skipped — laggy/stale events (e.g. motion-segment
// events arrive ~10s late, so a fresh snapshot shows "no person" → wasted tokens).
// Comma-separated. Substring match. Default: skip MotionDetection variants.
const ALERT_SKIP_EVENTS = (process.env.VIGI_ALERT_SKIP_EVENTS || 'MotionDetection')
  .split(',').map(s => s.trim()).filter(Boolean);
const isAlertSkipped = (type) => ALERT_SKIP_EVENTS.some(s => type.includes(s));

// Burst capture: how many frames + spacing. ~5 frames × 400ms = ~2s window to
// observe movement direction (face bbox growing = approach, shrinking = recede).
const FACE_BURST_COUNT = parseInt(process.env.FACE_BURST_COUNT || '5', 10);
const FACE_BURST_INTERVAL = parseInt(process.env.FACE_BURST_INTERVAL || '400', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Collect distinct warm frames over the burst window, cropped to the door ROI.
async function collectBurstFrames(snapshot) {
  const frames = [];
  let lastTs = -1;
  for (let i = 0; i < FACE_BURST_COUNT; i++) {
    const raw = snapshot.getWarmFrameRaw();
    if (raw && raw.ts !== lastTs) {
      lastTs = raw.ts;
      let f = raw.buffer;
      if (FACE_WORKER_CROP) {
        try { f = await VigiSnapshot.cropBuffer(raw.buffer, FACE_WORKER_CROP); } catch (_) {}
      }
      frames.push(f);
    }
    if (i < FACE_BURST_COUNT - 1) await sleep(FACE_BURST_INTERVAL);
  }
  return frames;
}

async function callFaceWorkerBurst(frames) {
  try {
    const axios = require('axios');
    const payload = { frames: frames.map((b) => b.toString('base64')) };
    const res = await axios.post(`${FACE_WORKER_URL}/recognize_burst`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

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
  'AreaExitDetection',
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
    // stream1 = main/HD (wajah lebih tajam utk InsightFace), stream2 = sub/VGA (ringan)
    stream: process.env.VIGI_SNAPSHOT_STREAM || 'stream2',
  });

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

  snapshot.startWarmStream({ fps: 2 });
  log('info', 'warm stream started (persistent ffmpeg, 2 fps)');

  const listener = new VigiEventListener(auth, {
    events: cfg.events,
    // Heartbeat = seberapa sering kamera kirim boundary. Event di-flush saat
    // boundary berikutnya, jadi heartbeat rendah = event sampai lebih cepat.
    heartbeat: parseInt(process.env.VIGI_EVENT_HEARTBEAT || '2', 10),
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
      log('info', `${event.event_type}`);

      const buffer = event._snapshotBuffer || await snapshot.grab({ timeoutMs: 8000 });

      // Crop for face worker + AI alert
      let faceBuffer = buffer;
      if (FACE_WORKER_CROP) {
        try {
          faceBuffer = await VigiSnapshot.cropBuffer(buffer, FACE_WORKER_CROP);
        } catch (e) {
          log('warn', `crop gagal: ${e.message}`);
        }
      }

      // Face recognition — burst capture (~2s) so the worker can pick the best
      // face frame AND infer direction (approach=entry, recede=exit). Async.
      const shouldCallFace = FACE_TRIGGER_EVENTS.includes(event.event_type);
      if (shouldCallFace) {
        collectBurstFrames(snapshot)
          .then((frames) => (frames.length ? callFaceWorkerBurst(frames) : null))
          .then((faceResult) => {
            if (faceResult) {
              const acts = faceResult.actions?.map((a) => `${a.person_uid}:${a.action}`).join(', ') || '-';
              log('info', `face(burst ${faceResult.frames}, ${faceResult.motion}): ${acts}`);
            }
          }).catch(() => {});
      }

      // AI alert — skip laggy/stale event types (saves tokens on "no person" frames)
      if (isAlertSkipped(event.event_type)) {
        log('info', `  alert di-skip (${event.event_type} laggy)`);
      } else if (process.env.VIGI_AI_ALERTS_ENABLED !== 'false') {
        const aiResult = await analyzeSnapshot({
          imageBuffer: faceBuffer,
          eventMeta: event,
          location: cfg.location,
        });

        const { alertId, panicAlertId } = await persistEnrichedAlert({
          eventMeta: event,
          snapshotBuffer: faceBuffer,
          aiResult,
          cameraId: cfg.cameraId,
          cameraLocation: cfg.location,
        });

        const desc = aiResult.ai_description || aiResult.description || '';
        const short = desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
        log('info',
          `${aiResult.severity}${panicAlertId ? ' PANIC!' : ''} — ${short} (${Date.now() - startedAt}ms)`
        );
      }
    } catch (err) {
      log('error', `processing failed: ${err.message}`);
    } finally {
      processing = false;
      // Drain the queue — process the next one if any.
      if (queue.length) setImmediate(processNext);
    }
  };

  listener.on('event', (event) => {
    // Delay measurement: camera-detect (event.time, unix sec) → received now
    const camT = parseInt(event.time, 10);
    const evDelay = camT ? (Date.now() / 1000 - camT).toFixed(1) : '?';
    log('info', `${event.event_type} diterima — delay kamera→backend: ${evDelay}s`);

    if (queue.length >= MAX_QUEUE) {
      log('warn', `queue full (${MAX_QUEUE}), dropping oldest event`);
      queue.shift();
    }
    // Use warm frame (instant) or fallback to fresh grab
    const warm = snapshot.getWarmFrame(3000);
    if (warm) {
      const age = snapshot.getWarmFrameAge();
      log('info', `  snapshot warm (umur frame ${(age / 1000).toFixed(1)}s)`);
      event._snapshotBuffer = warm;
      queue.push(event);
      processNext();
    } else {
      snapshot.grab({ timeoutMs: 8000 }).then((buffer) => {
        event._snapshotBuffer = buffer;
      }).catch((err) => {
        log('warn', `snapshot failed: ${err.message}`);
      }).finally(() => {
        queue.push(event);
        processNext();
      });
    }
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
    cfg,
    stop: async () => {
      log('info', 'stopping bridge...');
      snapshot.stopWarmStream();
      await listener.stop();
    },
  };
}

module.exports = { startVigiAIBridge };
