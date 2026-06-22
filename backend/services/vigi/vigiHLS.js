// backend/services/vigi/vigiHLS.js
// Transcodes an RTSP stream to HLS segments using ffmpeg.
// Output files land in <outputDir>/<cameraId>/ and are served statically.

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

class VigiHLSTranscoder {
  /**
   * @param {object} cfg
   * @param {string} cfg.host         Camera IP
   * @param {number} [cfg.port=554]   RTSP port
   * @param {string} [cfg.username='admin']
   * @param {string} cfg.password
   * @param {string} cfg.cameraId     Used as subdirectory name and for logging
   * @param {string} cfg.outputDir    Root dir for HLS files (e.g. uploads/hls)
   */
  constructor({ host, port = 554, username = 'admin', password, cameraId, outputDir }) {
    const u = encodeURIComponent(username);
    const p = encodeURIComponent(password);
    this.rtspUrl = `rtsp://${u}:${p}@${host}:${port}/stream1`;
    this.cameraId = cameraId;
    this.outputDir = path.join(outputDir, cameraId);
    this.playlistPath = path.join(this.outputDir, 'index.m3u8');
    // Relative URL served by express.static — frontend uses this as streamUrl
    this.hlsUrl = `/uploads/hls/${cameraId}/index.m3u8`;
    this._proc = null;
    this._stopped = false;
  }

  start() {
    fs.mkdirSync(this.outputDir, { recursive: true });
    // Clean stale segments from previous runs
    for (const f of fs.readdirSync(this.outputDir)) {
      if (f.endsWith('.ts') || f.endsWith('.m3u8')) {
        try { fs.unlinkSync(path.join(this.outputDir, f)); } catch (_) {}
      }
    }
    this._spawn();
    return this.hlsUrl;
  }

  _spawn() {
    if (this._stopped) return;

    const args = [
      '-y',                            // overwrite output files
      '-rtsp_transport', 'tcp',        // TCP is more reliable than UDP on LAN
      '-fflags', '+nobuffer+discardcorrupt',
      '-flags', 'low_delay',
      '-i', this.rtspUrl,
      '-c:v', 'copy',                  // remux only — no transcode, minimal CPU
      '-an',                           // drop audio track
      '-f', 'hls',
      '-hls_time', '1',                // 1-second segments
      '-hls_list_size', '3',           // keep 3 segments in playlist
      '-hls_flags', 'delete_segments',  // delete old .ts files (no append_list)
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(this.outputDir, 'seg%05d.ts'),
      '-loglevel', 'error',
      this.playlistPath,
    ];

    this._proc = spawn('ffmpeg', args);

    this._proc.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[HLS][${this.cameraId}] ${msg}`);
    });

    this._proc.on('error', (err) => {
      this._proc = null;
      if (err.code === 'ENOENT') {
        console.error('[HLS] ffmpeg not found in PATH — HLS streaming disabled');
        this._stopped = true;
        return;
      }
      console.error(`[HLS][${this.cameraId}] spawn error: ${err.message}`);
    });

    this._proc.on('close', (code) => {
      this._proc = null;
      if (!this._stopped) {
        console.warn(`[HLS] ${this.cameraId} exited (code=${code}), restarting in 5s…`);
        setTimeout(() => this._spawn(), 5000);
      }
    });

    console.log(`[HLS] Transcoder started: ${this.cameraId} → ${this.hlsUrl}`);
  }

  stop() {
    this._stopped = true;
    if (this._proc) {
      this._proc.kill('SIGKILL');
      this._proc = null;
      console.log(`[HLS] Transcoder stopped: ${this.cameraId}`);
    }
  }

  get isRunning() {
    return this._proc !== null;
  }
}

module.exports = { VigiHLSTranscoder };
