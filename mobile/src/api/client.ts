import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('[API] Using environment URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Get host dev machine IP for real device debugging
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  
  if (!debuggerHost && !__DEV__) {
    // Production default? 
    // Usually environment variable should handle it, but fallback to localhost
  }
  
  const address = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const url = `http://${address}:3001/api/v1`;
  
  console.log('[API] Debugger Host:', debuggerHost);
  console.log('[API] Detected Base URL:', url);
  return url;
};

export const baseURL = getBaseUrl();
export const serverDomain = baseURL.replace('/api/v1', '');
export const frontendDomain = serverDomain.replace(':3001', ':5173');

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If we receive a 401 Unauthorized, we could automatically log out the user
    if (error.response?.status === 401 && error.config.url !== '/auth/login') {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
      // A navigation event or state update should ideally happen here
    }
    return Promise.reject(error);
  }
);
