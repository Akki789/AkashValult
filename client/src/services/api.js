import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

let inMemoryCsrfToken = '';
let sessionReplacedListeners = new Set();
let isRefreshing = false;
let refreshWaitQueue = [];

export function setInMemoryCsrfToken(token) {
  if (typeof token === 'string' && token.length > 0) {
    inMemoryCsrfToken = token;
  }
}

export function readCsrfCookie() {
  if (typeof document === 'undefined') return inMemoryCsrfToken;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return inMemoryCsrfToken;
}

export function onSessionInvalidated(listener) {
  sessionReplacedListeners.add(listener);
  return () => {
    sessionReplacedListeners.delete(listener);
  };
}

function notifySessionInvalidated(code, message) {
  for (const listener of sessionReplacedListeners) {
    listener({ code, message });
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrf = readCsrfCookie();
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

function processRefreshQueue(error) {
  refreshWaitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  refreshWaitQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.code;
    const errorMessage = error.response?.data?.error?.message;

    if (
      status === 401 &&
      (errorCode === 'SESSION_REPLACED' ||
        errorCode === 'SESSION_REVOKED' ||
        errorCode === 'SESSION_COMPROMISED')
    ) {
      notifySessionInvalidated(errorCode, errorMessage);
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      errorCode === 'AUTH_ACCESS_EXPIRED' &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshWaitQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/auth/refresh', {});
        processRefreshQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError);
        const refreshCode = refreshError.response?.data?.error?.code;
        const refreshMsg = refreshError.response?.data?.error?.message;
        if (
          refreshCode === 'SESSION_REPLACED' ||
          refreshCode === 'SESSION_REVOKED' ||
          refreshCode === 'SESSION_COMPROMISED'
        ) {
          notifySessionInvalidated(refreshCode, refreshMsg);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function extractApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'We could not reach the server. Check your connection and try again.',
      details: null,
      status: 0,
    };
  }
  const dataError = err.response.data?.error;
  return {
    code: dataError?.code || 'REQUEST_FAILED',
    message: dataError?.message || fallback,
    details: dataError?.details || null,
    status: err.response.status,
  };
}
