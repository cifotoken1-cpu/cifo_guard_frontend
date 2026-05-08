import { v4 as uuid } from 'uuid';
import { api } from './client';

/**
 * Endpoints for panic + alerts.
 * Source: api-contracts-backend.md sections 1 & 2.
 */
export const alertsApi = {
  /** POST /api/panic — create panic alert */
  triggerPanic: ({ type, userId, gps, requestId }) =>
    api
      .post('/panic', {
        type,
        userId,
        requestId: requestId || uuid(),
        gps,
      })
      .then((r) => r.data),

  /** GET /api/alerts — with filters */
  list: (params = {}) => api.get('/alerts', { params }).then((r) => r.data),

  /** GET /api/alerts/stats */
  stats: () => api.get('/alerts/stats').then((r) => r.data),

  /** GET /api/alerts/:id */
  detail: (id) => api.get(`/alerts/${id}`).then((r) => r.data),

  /** PATCH /api/alerts/:id/acknowledge */
  acknowledge: (id) =>
    api.patch(`/alerts/${id}/acknowledge`).then((r) => r.data),

  /** PATCH /api/alerts/:id/resolve */
  resolve: (id) => api.patch(`/alerts/${id}/resolve`).then((r) => r.data),

  /** PATCH /api/alerts/:id — update status/metadata */
  updateStatus: (id, body) => api.patch(`/alerts/${id}`, body).then((r) => r.data),

  /** GET /api/alerts?category=PANIC_BUTTON — for Panic Alerts page */
  listPanic: (params = {}) =>
    api
      .get('/alerts', {
        params: { category: 'PANIC_BUTTON', sortBy: 'created_at', sortOrder: 'DESC', ...params },
      })
      .then((r) => r.data),

  /** GET /api/alerts?source=camera — for CCTV pins on Interactive Map */
  listCCTV: (params = {}) =>
    api
      .get('/alerts', {
        params: { source: 'camera', sortBy: 'created_at', sortOrder: 'DESC', ...params },
      })
      .then((r) => r.data),

  // ❌ DO NOT USE — buggy endpoints:
  // getByRadius: GET /alerts/radius — PostGIS syntax crash on MySQL
  // getStats: GET /alerts/stats — ::float PostgreSQL syntax crash
  // search: GET /alerts?search= — Op.iLike crash on MySQL
};
