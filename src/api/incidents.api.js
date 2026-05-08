import { api } from './client';

export const incidentsApi = {
  /** GET /api/incidents — filter: status, priority, type, assignedTo, limit, offset */
  list: (params = {}) => api.get('/incidents', { params }).then((r) => r.data),

  /** GET /api/incidents/:id — includes activities[], reporter, assignedMember */
  detail: (id) => api.get(`/incidents/${id}`).then((r) => r.data),

  /** PUT /api/incidents/:id — update status, priority, assignedTo */
  updateStatus: (id, body) => api.put(`/incidents/${id}`, body).then((r) => r.data),

  // ❌ DO NOT USE — buggy endpoints:
  // addNote: POST /incidents/:id/notes — field `notes` commented out in Sequelize model
  // escalate: POST /incidents/:id/escalate — field `escalation` commented out
  // getTimeline: GET /incidents/:id/timeline — Sequelize include → MySQL raw model error
  // getDashboardStats: GET /incidents/stats/dashboard — route order bug, may match /:id
};
