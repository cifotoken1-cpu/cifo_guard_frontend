import { api } from './client';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (body) => api.put('/auth/change-password', body).then((r) => r.data),
  resetPassword: (email) => api.post('/auth/reset-password', { email }).then((r) => r.data),
  resetPasswordConfirm: (body) => api.post('/auth/reset-password/confirm', body).then((r) => r.data),
};
