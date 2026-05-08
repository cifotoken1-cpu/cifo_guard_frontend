import { api } from './client';

/**
 * Endpoints for security activities (log entries).
 * Source: api-contracts-backend.md section 5.
 */
export const activitiesApi = {
  /** GET /api/activities */
  list: (params = {}) => api.get('/activities', { params }).then((r) => r.data),

  /** GET /api/activities/recent */
  recent: (params = {}) =>
    api.get('/activities/recent', { params }).then((r) => r.data),

  /** GET /api/activities/stats */
  stats: () => api.get('/activities/stats').then((r) => r.data),

  /** GET /api/activities/critical */
  critical: () => api.get('/activities/critical').then((r) => r.data),
};
