import axios from 'axios';
import { sessionStorage } from './sessionStorage';
import { authSessionEvents } from './authSessionEvents';

export const apiClient = axios.create({
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(config => {
  const session = sessionStorage.getSession();
  const selectedClient = sessionStorage.getSelectedClient() ?? session?.client;
  const tenantApiBaseUrl = selectedClient?.apiBaseUrl?.trim().replace(/\/+$/, '');
  if (!selectedClient || !tenantApiBaseUrl || !/^https?:\/\//i.test(tenantApiBaseUrl)) {
    throw new Error('TENANT_API_NOT_SELECTED');
  }
  const validFrom = Date.parse(selectedClient.validFromUtc);
  const validUntil = Date.parse(selectedClient.validUntilUtc);
  const now = Date.now();
  if (
    selectedClient.isActive !== true ||
    !Number.isFinite(validFrom) ||
    !Number.isFinite(validUntil) ||
    now < validFrom ||
    now >= validUntil
  ) {
    throw new Error('INVALID_CLIENT_CODE');
  }
  if (/^https?:\/\//i.test(config.url ?? '')) {
    throw new Error('TENANT_API_ROUTE_REQUIRED');
  }
  config.baseURL = tenantApiBaseUrl;

  const isLoginRequest = (config.url ?? '').split('?')[0].endsWith('/api/auth/login');
  const explicitAuthorization = config.headers.Authorization;
  const hasExplicitBearer =
    typeof explicitAuthorization === 'string' && /^Bearer\s+\S+$/i.test(explicitAuthorization);
  if (hasExplicitBearer && /demo-token-/i.test(String(explicitAuthorization))) {
    throw new Error('AUTH_SESSION_REQUIRED');
  }
  const token = session?.accessToken?.trim();
  if (!hasExplicitBearer && token && !token.startsWith('demo-token-')) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!hasExplicitBearer && session && !isLoginRequest) {
    throw new Error('AUTH_SESSION_REQUIRED');
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

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const route = (error.config?.url ?? '').split('?')[0];
      const isLoginOrLogout =
        route.endsWith('/api/auth/login') || route.endsWith('/api/auth/logout');
      if (!isLoginOrLogout) {
        sessionStorage.clearSession().catch(() => undefined);
        authSessionEvents.notifyUnauthorized();
      }
    }
    return Promise.reject(error);
  },
);
