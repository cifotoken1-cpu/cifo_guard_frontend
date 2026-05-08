// backend/services/vigi/vigiEventListener.js
// Long-polls the camera's subscribeMsg endpoint and emits 'event' for each
// detection push. Auto-reconnects on disconnect with exponential backoff.

const axios = require('axios');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class VigiEventListener extends EventEmitter {
  constructor(auth, { events = ['all'], heartbeat = 15 } = {}) {
    super();
    this.auth = auth;
    this.events = events;
    this.heartbeat = heartbeat;
    this.running = false;
    this._abortController = null;
    this._backoff = 1000; // start at 1s, cap at 30s
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this._loop().catch((err) => this.emit('error', err));
  }

  async stop() {
    this.running = false;
    if (this._abortController) this._abortController.abort();
  }

  async _loop() {
    while (this.running) {
      try {
        await this._connect();
        this._backoff = 1000; // reset on clean disconnect
      } catch (err) {
        if (axios.isCancel?.(err) || err.name === 'CanceledError') break;
        this.emit('error', err);
      }
      if (!this.running) break;
      const delay = this._backoff;
      this._backoff = Math.min(this._backoff * 2, 30000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  async _connect() {
    if (!this.auth.stok) await this.auth.login();

    this._abortController = new AbortController();

    const res = await axios.post(
      `${this.auth.baseUrl}/stok=${this.auth.stok}`,
      {
        method: 'subscribeMsg',
        params: { event_type: this.events, heartbeat: this.heartbeat },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent,
        responseType: 'stream',
        timeout: 0, // long-poll connection — no timeout
        signal: this._abortController.signal,
      }
    );

    this.emit('connected');

    return new Promise((resolve, reject) => {
      let buffer = '';
      const stream = res.data;

      stream.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        // VIGI uses a literal "--boundary--" boundary value, so parts are
        // separated by "----boundary--" in the raw stream.
        const SEP = '----boundary--';
        let idx;
        while ((idx = buffer.indexOf(SEP)) !== -1) {
          const part = buffer.slice(0, idx);
          buffer = buffer.slice(idx + SEP.length);
          if (part.trim()) this._handlePart(part);
        }
      });

      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }

  _handlePart(part) {
    // Each part has HTTP-like headers, a blank line, then a JSON body.
    // We just look for the first {...} block.
    const start = part.indexOf('{');
    const end = part.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return;

    let payload;
    try {
      payload = JSON.parse(part.slice(start, end + 1));
    } catch (e) {
      return; // partial / malformed chunk — ignore
    }

    if (payload.Heartbeat !== undefined) {
      this.emit('heartbeat', payload.Heartbeat);
    } else if (payload.event_type) {
      // payload looks like: { "event_type": "PeopleDetection", "time": 1723175020 }
      this.emit('event', payload);
    } else if (payload.result === 'success') {
      this.emit('subscribed');
    } else if (payload.result === 'failed') {
      this.emit('subscribeFailed', payload);
    }
  }
}

module.exports = { VigiEventListener };
