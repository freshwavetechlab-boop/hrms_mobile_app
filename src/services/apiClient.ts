import axios from 'axios';
import { APP_CONFIG } from '../constants/app';
import { sessionStorage } from './sessionStorage';

export const apiClient = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(config => {
  const session = sessionStorage.getSession();
  const selectedClient = sessionStorage.getSelectedClient() ?? session?.client;
  config.baseURL = selectedClient?.apiBaseUrl ?? APP_CONFIG.apiBaseUrl;
  const token = session?.accessToken;
  if (token && !token.startsWith('demo-token-')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const clientCode = selectedClient?.code;
  if (clientCode) {
    config.headers['X-Client-Code'] = clientCode;
  }
  config.headers['X-Device-Id'] = sessionStorage.getOrCreateDeviceId();
  if (session?.userId) {
    config.headers['X-User-ID'] = session.userId;
  }
  return config;
});
