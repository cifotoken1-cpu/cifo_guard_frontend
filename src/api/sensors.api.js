import { api } from './client';

/**
 * Sensors endpoints (resolves #8).
 *
 * Backend: GET/PATCH /api/sensors via SensorController.
 */
export const sensorsApi = {
  /** GET /api/sensors — list semua sensor dengan optional filter ?type=&status= */
  list: (params) =>
    api.get('/sensors', { params }).then((r) => r.data),

  /** GET /api/sensors/:id — detail satu sensor */
  get: (id) =>
    api.get(`/sensors/${id}`).then((r) => r.data),

  /** PATCH /api/sensors/:id/status — update status sensor (untuk integrasi device) */
  updateStatus: (id, status) =>
    api.patch(`/sensors/${id}/status`, { status }).then((r) => r.data),
};
