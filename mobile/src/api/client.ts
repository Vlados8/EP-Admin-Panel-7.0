import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('[API] Using environment URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Fallback to auto-detecting host dev machine IP for Expo Go debugging
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const address = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const url = `http://${address}:3001/api/v1`;

  console.log('[API] Debugger Host:', debuggerHost);
  console.log('[API] Detected fallback Base URL:', url);
  return url;
};

export const baseURL = getBaseUrl();
export const serverDomain = baseURL.replace('/api/v1', '');
export const frontendDomain = serverDomain.replace(':3001', ':5173');

export const getFullUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${serverDomain}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('[API] Request token loading error:', error);
  }
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config.url !== '/auth/login') {
      try {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user');
      } catch (e) {
        console.error('[API] Session eviction error:', e);
      }
    }
    return Promise.reject(error);
  }
);
