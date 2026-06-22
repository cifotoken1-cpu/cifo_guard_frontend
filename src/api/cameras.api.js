import { api } from './client';

/**
 * Cameras endpoints — fully DB-backed.
 *
 * Primary: `/api/cameras` — DB query via Camera.getAll(), enriched with heartbeat status.
 * CRUD:    `/api/api/cameras` — full CRUD operations on cameras table.
 */
export const camerasApi = {
  /**
   * GET /api/cameras — list kamera dari database.
   * Juga inject Vigi AI (C240-01) dari endpoint terpisah jika belum ada di list.
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

  /** CRUD operations via CameraController (DB-backed) */
  db: {
    /** GET /api/api/cameras — list all cameras with pagination */
    list: (params) =>
      api.get('/api/cameras', { params }).then((r) => r.data),

    /** GET /api/api/cameras/:id */
    get: (id) =>
      api.get(`/api/cameras/${id}`).then((r) => r.data),

    /** POST /api/api/cameras — create camera */
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

    /** GET /api/api/cameras/stats — aggregated stats */
    stats: () =>
      api.get('/api/cameras/stats').then((r) => r.data),

    /** POST /api/api/cameras/:id/heartbeat */
    heartbeat: (id, body) =>
      api.post(`/api/cameras/${id}/heartbeat`, body).then((r) => r.data),
  },
};
