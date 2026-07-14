import axios from 'axios';
import { demoEmployee } from '../constants/staticData';
import { ClientProfile, Employee, Session } from '../types/domain';
import { apiClient } from './apiClient';

type ApiObject = Record<string, unknown>;

const fallbackSessionMs = 1000 * 60 * 60 * 24 * 365;

const isObject = (value: unknown): value is ApiObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unwrap = (payload: unknown): unknown => {
  if (!isObject(payload)) {
    return payload;
  }
  return payload.data ?? payload.result ?? payload.payload ?? payload.response ?? payload;
};

const getString = (source: ApiObject, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return fallback;
};

const getNumber = (source: ApiObject, keys: string[]) => {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return undefined;
};

const getNestedObject = (source: ApiObject, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (isObject(value)) {
      return value;
    }
  }
  return undefined;
};

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map(item => (typeof item === 'string' ? item : isObject(item) ? getString(item, ['name', 'code', 'key']) : ''))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};

const parseExpiresAt = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1000000000000 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric < 1000000000000 ? numeric * 1000 : numeric;
    }
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return Date.now() + fallbackSessionMs;
};

const mapEmployeeFromUser = (payload: unknown, fallback: Employee): Employee => {
  const source = isObject(payload) ? payload : {};
  const firstName = getString(source, ['firstName']);
  const lastName = getString(source, ['lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const id = getString(
    source,
    ['employeeId', 'employeeCode', 'empCode', 'code', 'id', 'userId'],
    fallback.id,
  );

  return {
    id,
    name: getString(
      source,
      ['employeeName', 'fullName', 'name', 'displayName'],
      fullName || fallback.name,
    ),
    email: getString(
      source,
      ['workEmail', 'email', 'officialEmail', 'emailId', 'userName'],
      fallback.email,
    ),
    department: getString(source, ['department', 'departmentName'], fallback.department),
    designation: getString(source, ['designation', 'designationName', 'role'], fallback.designation),
    manager: getString(source, ['manager', 'reportingManager', 'reportingManagerName'], fallback.manager),
    avatarUrl: getString(source, ['avatarUrl', 'profileImage', 'photoUrl'], fallback.avatarUrl),
  };
};

const normalizeLoginError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 400 || error.response?.status === 401) {
      return new Error('INVALID_LOGIN');
    }
    if (error.response?.status === 403) {
      return new Error('LOGIN_ACCESS_DENIED');
    }
    if (error.response && error.response.status >= 500) {
      return new Error('SERVER_UNAVAILABLE');
    }
    if (error.code === 'ECONNABORTED') {
      return new Error('REQUEST_TIMEOUT');
    }
    if (!error.response) {
      return new Error('NETWORK_UNAVAILABLE');
    }
  }
  return error;
};

export const authApiService = {
  async login(input: { client: ClientProfile; identifier: string; password: string }): Promise<Session> {
    const normalizedIdentifier = input.identifier.trim();
    const fallbackEmployee: Employee = {
      ...demoEmployee,
      id: normalizedIdentifier.toUpperCase(),
      email: normalizedIdentifier.includes('@')
        ? normalizedIdentifier
        : `${normalizedIdentifier.toLowerCase()}@${input.client.code.toLowerCase()}.example`,
    };

    try {
      const response = await apiClient.post('/api/auth/login', {
        email: normalizedIdentifier,
        password: input.password,
      });
      const root = isObject(response.data) ? response.data : {};
      const unwrapped = unwrap(response.data);
      const payload = isObject(unwrapped) ? unwrapped : root;
      const token = getString(payload, ['token', 'accessToken', 'bearerToken', 'jwt']) ||
        getString(root, ['token', 'accessToken', 'bearerToken', 'jwt']);

      if (!token) {
        throw new Error('API_LOGIN_TOKEN_MISSING');
      }

      const user = getNestedObject(payload, ['user', 'employee', 'profile']) ??
        getNestedObject(root, ['user', 'employee', 'profile']) ??
        payload;
      const authenticatedClientId = getNumber(user, ['clientId', 'ClientId']);
      if (input.client.id && authenticatedClientId && input.client.id !== authenticatedClientId) {
        try {
          await apiClient.post(
            '/api/auth/logout',
            {},
            { headers: { Authorization: `Bearer ${token}` } },
          );
        } catch {
          // The rejected token is never persisted locally.
        }
        throw new Error('CLIENT_AUTH_MISMATCH');
      }

      return {
        accessToken: token,
        userId: getString(user, ['id', 'Id', 'userId', 'UserId']),
        refreshToken: getString(payload, ['refreshToken'], getString(root, ['refreshToken'], undefined)),
        expiresAt: parseExpiresAt(payload.expiresAt ?? root.expiresAt ?? payload.expiry ?? root.expiry),
        client: input.client,
        employee: mapEmployeeFromUser(user, fallbackEmployee),
        roles: normalizeStringArray(user.roles ?? payload.roles ?? root.roles),
        permissions: normalizeStringArray(user.permissions ?? payload.permissions ?? root.permissions),
      };
    } catch (error) {
      throw normalizeLoginError(error);
    }
  },
};
