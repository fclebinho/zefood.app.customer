import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { EventEmitter } from 'events';

// Event emitter for auth events (session expiry, forced logout)
export const authEvents = new EventEmitter();
export const AUTH_EVENTS = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

// Para desenvolvimento local:
// - Porta 3001 direta: http://localhost:3001 (sem /api)
// - Via Traefik porta 80: http://localhost/api (com /api, que é removido pelo Traefik)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Se a URL já termina com /api, não adiciona novamente
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : BASE_URL;

// WebSocket URL - remove /api suffix since WebSocket routes don't use /api prefix
// Traefik routes /orders and /tracking directly to backend without /api prefix
const WS_URL = BASE_URL.replace(/\/api$/, '');

export { BASE_URL as API_URL, WS_URL }; // Export for WebSocket

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token to all requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 errors and refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');

        if (!refreshToken) {
          // No refresh token, user needs to login again
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('refreshToken');
          await SecureStore.deleteItemAsync('user');
          processQueue(error, null);
          return Promise.reject(error);
        }

        // Call refresh endpoint
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken, user } = response.data;

        // Store new tokens
        await SecureStore.setItemAsync('token', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        await SecureStore.setItemAsync('user', JSON.stringify(user));

        // Update authorization header
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and notify app to logout
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
        processQueue(refreshError, null);
        // Emit session expired event to force logout in AuthProvider
        authEvents.emit(AUTH_EVENTS.SESSION_EXPIRED);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    address?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
    };
  }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
  },

  getStoredUser: async () => {
    const user = await SecureStore.getItemAsync('user');
    return user ? JSON.parse(user) : null;
  },

  storeAuth: async (data: { accessToken: string; refreshToken: string; user: any }) => {
    await SecureStore.setItemAsync('token', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
  },

  updateStoredUser: async (user: any) => {
    await SecureStore.setItemAsync('user', JSON.stringify(user));
  },
};

export const restaurantService = {
  getAll: async (params?: { categoryId?: string; search?: string; page?: number }) => {
    const response = await api.get('/restaurants', { params });
    return response.data;
  },

  getBySlug: async (slug: string) => {
    const response = await api.get(`/restaurants/${slug}`);
    return response.data;
  },

  getMenu: async (id: string) => {
    const response = await api.get(`/restaurants/${id}/menu`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/restaurants/categories');
    return response.data;
  },
};

export const orderService = {
  create: async (data: any) => {
    const response = await api.post('/orders', data);
    return response.data;
  },

  getAll: async (page = 1) => {
    const response = await api.get(`/orders?page=${page}`);
    return response.data;
  },

  getMyOrders: async () => {
    const response = await api.get('/orders');
    return response.data.data || response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
};

export const userService = {
  getProfile: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  updateProfile: async (data: { name?: string; phone?: string }) => {
    const response = await api.patch('/users/me', data);
    return response.data;
  },
};

export default api;
