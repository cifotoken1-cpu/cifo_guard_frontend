import axios from 'axios';
import { API_URL } from '../config';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request: attach JWT Bearer if token exists
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: normalize errors + handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Token invalid/expired — kick to login
      useAuthStore.getState().logout?.();
      // Don't redirect from here in dev mode, let UI handle it
    }

    // Normalized error shape for consumers
    const normalized = {
      status: err.response?.status,
      message:
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Network error',
      details: err.response?.data,
      isNetworkError: !err.response,
    };
    return Promise.reject(normalized);
  }
);

/** Health check endpoint is mounted outside /api — use raw fetch */
export async function fetchHealth() {
  const url = import.meta.env.VITE_HEALTH_URL || '/health';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
