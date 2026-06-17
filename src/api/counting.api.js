import { api } from './client';

export const countingApi = {
  postEvent: (data) => api.post('/counting/event', data).then((r) => r.data),
  getCameraCount: (cameraId, date) =>
    api.get(`/counting/cameras/${cameraId}/count`, { params: { date } }).then((r) => r.data),
  getSummary: (date) =>
    api.get('/counting/summary', { params: { date } }).then((r) => r.data),
};
