import { apiClient, setInMemoryCsrfToken } from './api.js';

export const authService = {
  async ensureCsrf() {
    const res = await apiClient.get('/auth/csrf');
    const token = res.data?.data?.csrfToken;
    if (token) setInMemoryCsrfToken(token);
    return token;
  },

  async register(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/register', payload);
    return res.data.data;
  },

  async sendOtp(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/send-otp', payload);
    return res.data.data;
  },

  async verifyOtp(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/verify-otp', payload);
    return res.data.data;
  },

  async createPin(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/create-pin', payload);
    if (res.data?.data?.csrfToken) {
      setInMemoryCsrfToken(res.data.data.csrfToken);
    }
    return res.data.data;
  },

  async login(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/login', payload);
    if (res.data?.data?.csrfToken) {
      setInMemoryCsrfToken(res.data.data.csrfToken);
    }
    return res.data.data;
  },

  async refresh() {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/refresh', {});
    return res.data.data;
  },

  async logout() {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/logout', {});
    return res.data;
  },

  async forgotPin(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/forgot-pin', payload);
    return res.data.data;
  },

  async resetPin(payload) {
    await this.ensureCsrf();
    const res = await apiClient.post('/auth/reset-pin', payload);
    return res.data;
  },

  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  },

  async getSession() {
    const res = await apiClient.get('/auth/session');
    return res.data.data;
  },
};
