import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.122:3000/api/v1';
export const TOKEN_KEY = 'sigo_patrol_token';
export const SESSION_KEY = 'sigo_patrol_session';

// ── Instancia de Axios con interceptores (Tarea #44) ─────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Interceptor de REQUEST — inyecta Bearer token automáticamente ────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de RESPONSE — maneja errores 401/403 ────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expirado: limpiar SecureStore
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
