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
        // Emit as soon as a complete JSON object is in the buffer — do NOT wait
        // for the trailing multipart boundary. The camera often delays that
        // boundary until its next heartbeat, which would stall an event by up to
        // `heartbeat` seconds (observed ~15s). Greedy JSON extraction kills that.
        let obj;
        while ((obj = this._nextJsonObject(buffer)) !== null) {
          buffer = buffer.slice(obj.endIdx);
          this._handlePayload(obj.json);
        }
        // Safety: drop a stray unclosed '{' that never completes.
        if (buffer.length > 1_000_000) buffer = '';
      });

      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }

  // Find the first complete, brace-balanced JSON object in `buf` (string-aware,
  // so braces inside quoted strings don't fool it). Returns { json, endIdx } or
  // null if no complete object yet (wait for more chunks).
  _nextJsonObject(buf) {
    const start = buf.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        if (--depth === 0) return { json: buf.slice(start, i + 1), endIdx: i + 1 };
      }
    }
    return null; // incomplete object — more chunks needed
  }

  _handlePayload(jsonStr) {
    let payload;
    try {
      payload = JSON.parse(jsonStr);
    } catch (e) {
      return; // malformed — ignore
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
