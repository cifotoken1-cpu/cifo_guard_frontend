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

  /**
   * Grab one JPEG frame. Returns a Buffer.
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs=10000]
   * @param {number} [opts.quality=5] ffmpeg -q:v (2 best, 31 worst)
   */
  grab({ timeoutMs = 10000, quality = 5 } = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '-rtsp_transport', 'tcp', // TCP is more reliable than UDP on LAN
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
}

module.exports = { VigiSnapshot };
