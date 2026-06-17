import { api } from './client';

export const countingApi = {
  postEvent: (data) => api.post('/counting/event', data).then((r) => r.data),
  getCameraCount: (cameraId, date) =>
    api.get(`/counting/cameras/${cameraId}/count`, { params: { date } }).then((r) => r.data),
  getSummary: (date) =>
    api.get('/counting/summary', { params: { date } }).then((r) => r.data),
};

export const visitsApi = {
  getDurationSummary: (date) =>
    api.get('/visits/duration-summary', { params: { date } }).then((r) => r.data),
  getCameraVisits: (cameraId, date, status) =>
    api.get(`/visits/cameras/${cameraId}`, { params: { date, status } }).then((r) => r.data),
};

export const reportsApi = {
  getDailySummary: (date) =>
    api.get('/reports/daily-summary', { params: { date } }).then((r) => r.data),
  getExportCSVUrl: (date) => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/reports/export/csv?date=${date}`;
  },
};
