// backend/services/vigi/vigiSnapshot.js
// Grabs a single JPEG frame from the camera's RTSP stream using ffmpeg.
// Requires `ffmpeg` to be installed on the host (apt install ffmpeg /
// brew install ffmpeg / choco install ffmpeg).

const { spawn } = require('node:child_process');

class VigiSnapshot {
  /**
   * @param {object} cfg
   * @param {string} cfg.host       camera IP/hostname
   * @param {number} [cfg.port=554] RTSP port
   * @param {string} [cfg.username='admin']
   * @param {string} cfg.password
   * @param {'stream1'|'stream2'} [cfg.stream='stream1']
   *   stream1 = main/HD, stream2 = sub/VGA. Use stream2 for AI to save bandwidth.
   */
  constructor({ host, port = 554, username = 'admin', password, stream = 'stream2' }) {
    if (!host) throw new Error('VigiSnapshot: host is required');
    if (!password) throw new Error('VigiSnapshot: password is required');

    const u = encodeURIComponent(username);
    const p = encodeURIComponent(password);
    this.rtspUrl = `rtsp://${u}:${p}@${host}:${port}/${stream}`;
  }

  grab({ timeoutMs = 10000, quality = 5 } = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '-rtsp_transport', 'tcp',
        '-i', this.rtspUrl,
        '-frames:v', '1',
        '-q:v', String(quality),
        '-f', 'image2',
        '-loglevel', 'error',
        'pipe:1',
      ];

      const ff = spawn('ffmpeg', args);
      const chunks = [];
      let stderr = '';

      ff.stdout.on('data', (c) => chunks.push(c));
      ff.stderr.on('data', (c) => { stderr += c.toString(); });

      const timer = setTimeout(() => {
        try { ff.kill('SIGKILL'); } catch (_) {}
        reject(new Error(`VigiSnapshot: ffmpeg timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      ff.on('error', (err) => {
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          return reject(new Error('VigiSnapshot: ffmpeg binary not found in PATH'));
        }
        reject(err);
      });

      ff.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          return reject(new Error(`VigiSnapshot: ffmpeg exit ${code}: ${stderr.trim()}`));
        }
        const buf = Buffer.concat(chunks);
        if (!buf.length) return reject(new Error('VigiSnapshot: empty frame'));
        resolve(buf);
      });
    });
  }

  // Persistent ffmpeg that decodes RTSP continuously and emits JPEG frames at
  // `fps`. Keeps only the latest frame in memory. One connection (no overlapping
  // cold grabs) → frames stay ~0.5s fresh and RTSP sessions stay low.
  startWarmStream({ fps = 2, quality = 5 } = {}) {
    if (this._warmProc) return;
    this._warmStop = false;
    this._warmFrame = null;

    const spawnProc = () => {
      const ff = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp', '-i', this.rtspUrl,
        '-vf', `fps=${fps}`, '-q:v', String(quality),
        '-f', 'image2pipe', '-vcodec', 'mjpeg', '-loglevel', 'error', 'pipe:1',
      ]);
      this._warmProc = ff;

      let buf = Buffer.alloc(0);
      const SOI = Buffer.from([0xff, 0xd8]);
      const EOI = Buffer.from([0xff, 0xd9]);
      ff.stdout.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        // Extract every complete JPEG (FFD8…FFD9); keep the last one.
        let start = buf.indexOf(SOI);
        let end = start === -1 ? -1 : buf.indexOf(EOI, start + 2);
        while (start !== -1 && end !== -1) {
          this._warmFrame = { buffer: buf.subarray(start, end + 2), ts: Date.now() };
          buf = buf.subarray(end + 2);
          start = buf.indexOf(SOI);
          end = start === -1 ? -1 : buf.indexOf(EOI, start + 2);
        }
        if (buf.length > 5_000_000) buf = Buffer.alloc(0); // safety
      });
      ff.stderr.on('data', () => {});
      ff.on('error', () => {});
      ff.on('close', () => {
        this._warmProc = null;
        if (!this._warmStop) setTimeout(spawnProc, 2000); // auto-restart on drop
      });
    };
    spawnProc();
  }

  stopWarmStream() {
    this._warmStop = true;
    if (this._warmProc) {
      try { this._warmProc.kill('SIGKILL'); } catch (_) {}
      this._warmProc = null;
    }
    this._warmFrame = null;
  }

  getWarmFrame(maxAgeMs = 3000) {
    if (this._warmFrame && (Date.now() - this._warmFrame.ts) < maxAgeMs) {
      return this._warmFrame.buffer;
    }
    return null;
  }

  getWarmFrameAge() {
    return this._warmFrame ? Date.now() - this._warmFrame.ts : null;
  }

  // Latest frame with its timestamp — for burst collection (dedupe by ts).
  getWarmFrameRaw() {
    return this._warmFrame || null; // { buffer, ts } | null
  }

  static cropBuffer(jpegBuffer, cropFilter, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-f', 'image2pipe', '-i', 'pipe:0',
        '-vf', `crop=${cropFilter}`,
        '-q:v', '5',
        '-f', 'image2', '-loglevel', 'error',
        'pipe:1',
      ]);

      const chunks = [];
      let stderr = '';

      ff.stdout.on('data', (c) => chunks.push(c));
      ff.stderr.on('data', (c) => { stderr += c.toString(); });

      const timer = setTimeout(() => {
        try { ff.kill('SIGKILL'); } catch (_) {}
        reject(new Error('VigiSnapshot.cropBuffer: timeout'));
      }, timeoutMs);

      ff.on('error', (err) => { clearTimeout(timer); reject(err); });
      ff.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`cropBuffer ffmpeg exit ${code}: ${stderr.trim()}`));
        const buf = Buffer.concat(chunks);
        if (!buf.length) return reject(new Error('cropBuffer: empty output'));
        resolve(buf);
      });

      ff.stdin.write(jpegBuffer);
      ff.stdin.end();
    });
  }
}

module.exports = { VigiSnapshot };
