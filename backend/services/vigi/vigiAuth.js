// backend/services/vigi/vigiAuth.js
// Handles two-step SHA-256 nonce authentication against VIGI camera OpenAPI
// and provides a single .call(method, params) helper that auto re-auths on stok expiry.

const axios = require('axios');
const https = require('node:https');
const crypto = require('node:crypto');

// VIGI cameras ship with self-signed certs — we trust them on the LAN.
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const sha256 = (input) => crypto.createHash('sha256').update(input).digest('hex');

class VigiAuth {
  constructor({ host, port = 20443, username = 'admin', password }) {
    if (!host) throw new Error('VigiAuth: host is required');
    if (!password) throw new Error('VigiAuth: password is required');
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.stok = null;
    this.baseUrl = `https://${host}:${port}`;
  }

  async _post(path, body) {
    const res = await axios.post(`${this.baseUrl}${path}`, body, {
      headers: { 'Content-Type': 'application/json' },
      httpsAgent,
      timeout: 10000,
      validateStatus: () => true, // we handle errCode in body
    });
    return res.data;
  }

  // Two-step authentication. Returns stok token.
  async login() {
    // Step 1 — request the nonce challenge
    const challenge = await this._post('/', { method: 'doAuth', params: null });
    if (!challenge || !challenge.authenticate) {
      throw new Error(`VigiAuth: challenge failed: ${JSON.stringify(challenge)}`);
    }

    const { realm, nonce, algorithm, uri, method } = challenge.authenticate;
    if (algorithm !== 'SHA-256') {
      throw new Error(`VigiAuth: unsupported algorithm ${algorithm}`);
    }

    // Step 2 — compute response = SHA256(A1:nonce:A2)
    const a1 = sha256(`${this.username}:${realm}:${this.password}`);
    const a2 = sha256(`${method}:${uri}`);
    const response = sha256(`${a1}:${nonce}:${a2}`);

    const auth = await this._post('/', {
      method: 'doAuth',
      params: { nonce, response },
    });

    if (auth.errCode !== 0 || !auth.stok) {
      throw new Error(`VigiAuth: login failed errCode=${auth.errCode}`);
    }

    this.stok = auth.stok;
    return this.stok;
  }

  // Authenticated call. Auto-relogs once if stok was rejected (-10020).
  async call(method, params = {}, { _retry = false } = {}) {
    if (!this.stok) await this.login();

    const res = await axios.post(
      `${this.baseUrl}/stok=${this.stok}`,
      { method, params },
      {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent,
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    const data = res.data;
    // -10020 = stok expired/invalid — re-auth and retry once.
    if (data && data.errCode === -10020 && !_retry) {
      this.stok = null;
      await this.login();
      return this.call(method, params, { _retry: true });
    }
    return data;
  }
}

module.exports = { VigiAuth };
