import { api } from './client';

/**
 * Cameras endpoints.
 *
 * Two backend systems:
 * 1. LEGACY (in-memory) — `/api/cameras` — smoke test PASS, 18 hardcoded cameras
 * 2. DATABASE — `/api/api/cameras` (double prefix bug) — has 3 active bugs
 * 
 * Frontend uses legacy by default. DB endpoints available for CRUD when ready.
 */
export const camerasApi = {
  // ──── LEGACY SYSTEM (in-memory) ────
  /**
   * GET /api/cameras — 18 hardcoded cameras.
   * Also injects Vigi AI (C240-01) from DB if registered.
   * normalizeCameraList will move it to index 0 (Vigi-First ordering).
   */
  list: async () => {
    const data = await api.get('/cameras').then((r) => r.data);

    try {
      const vigiRes = await api.get('/api/cameras/C240-01').then((r) => r.data);
      if (vigiRes?.success && vigiRes?.data) {
        const cameras = data.cameras ?? [];
        if (!cameras.some((c) => c.id === 'C240-01')) {
          data.cameras = [...cameras, vigiRes.data];
          data.total = (data.total ?? cameras.length) + 1;
        }
      }
    } catch (_) {
      // C240-01 not in DB yet — skip silently
    }

    return data;
  },

  /** POST /api/cameras/:id/heartbeat */
  heartbeat: (id, body) =>
    api.post(`/cameras/${id}/heartbeat`, body).then((r) => r.data),

  // ──── DATABASE SYSTEM (when Bug #1 is fixed) ────
  db: {
    /**
     * GET /api/api/cameras — list all cameras
     * NOTE: Bug #1 — Camera.getCount() missing. Workaround: use stats() endpoint.
     */
    list: (params) =>
      api.get('/api/cameras', { params }).then((r) => r.data),

    /** GET /api/api/cameras/:id */
    get: (id) =>
      api.get(`/api/cameras/${id}`).then((r) => r.data),

    /**
     * POST /api/api/cameras
     * NOTE: Bug #2 — controller validation requires {name, ip_address, location}
     * but model uses {label, lat, lng, stream_url}.
     * Workaround: send both sets of fields (dual-field in body).
     */
    create: (body) =>
      api.post('/api/cameras', body).then((r) => r.data),

    /** PUT /api/api/cameras/:id */
    update: (id, body) =>
      api.put(`/api/cameras/${id}`, body).then((r) => r.data),

    /** PATCH /api/api/cameras/:id/status */
    patchStatus: (id, status) =>
      api.patch(`/api/cameras/${id}/status`, { status }).then((r) => r.data),

    /** DELETE /api/api/cameras/:id */
    delete: (id) =>
      api.delete(`/api/cameras/${id}`).then((r) => r.data),

    /**
     * GET /api/api/cameras/stats
     * Workaround for Bug #1: use stats endpoint to get count + summary
     */
    stats: () =>
      api.get('/api/cameras/stats').then((r) => r.data),

    /** POST /api/api/cameras/:id/heartbeat */
    heartbeat: (id, body) =>
      api.post(`/api/cameras/${id}/heartbeat`, body).then((r) => r.data),
  },
};
