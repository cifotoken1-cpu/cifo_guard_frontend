/**
 * Central runtime config. Reads from Vite env vars (VITE_*).
 * Empty string = use Vite proxy in dev (vite.config.js).
 */

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;
export const HEALTH_URL = import.meta.env.VITE_HEALTH_URL || '/health';

export const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID || 'guard-001';

// Polling/refetch intervals (ms)
export const REFETCH = {
  alertsStats: 30_000,
  cameras: 15_000,
  sensors: 15_000,
  activitiesRecent: 10_000,
  health: 30_000,
  metrics: 30_000,
};

// WebSocket rooms (must match backend services/WebSocketService.js)
export const WS_ROOMS = ['alerts_room', 'cameras_room', 'team_room', 'system_room'];

// Panic alert types (must match backend POST /panic schema)
export const PANIC_TYPES = ['MEDICAL', 'CRIME', 'FIRE', 'OTHER'];
