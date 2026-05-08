import { api } from './client';

export const usersApi = {
  list: (params = {}) => api.get('/users', { params }).then((r) => r.data),
  detail: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (body) => api.post('/users', body).then((r) => r.data),
  update: (id, body) => api.put(`/users/${id}`, body).then((r) => r.data),
  delete: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  changeRole: (id, role) => api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  unlock: (id) => api.post(`/users/${id}/unlock`).then((r) => r.data),
};
