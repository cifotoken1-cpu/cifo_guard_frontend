import { api, fetchHealth } from './client';

/**
 * System-level endpoints.
 * Source: api-contracts-backend.md sections 17 & 18.
 */
export const systemApi = {
  /** GET /health (NOT /api/health) */
  health: () => fetchHealth(),

  /** GET /api/metrics */
  metrics: () => api.get('/metrics').then((r) => r.data),
};
