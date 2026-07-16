import axios from 'axios';
import { ClientProfile, Employee, Session } from '../types/domain';
import { apiClient } from './apiClient';

type ApiObject = Record<string, unknown>;

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

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => (typeof item === 'string' ? item : isObject(item) ? getString(item, ['name', 'code', 'key']) : ''))
    .filter(Boolean);
};

const getBoolean = (source: ApiObject, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
  }
  return false;
};

const parseExpiresAt = (value: unknown): number | undefined => {
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
  return undefined;
};

const mapEmployeeFromUser = (payload: unknown, employeeId: number): Employee => {
  const source = isObject(payload) ? payload : {};
  const firstName = getString(source, ['firstName']);
  const lastName = getString(source, ['lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    id: String(employeeId),
    name: getString(source, ['employeeName', 'fullName', 'name', 'displayName'], fullName),
    email: getString(source, ['workEmail', 'email', 'officialEmail', 'emailId', 'userName']),
    department: getString(source, ['department', 'departmentName']),
    designation: getString(source, ['designation', 'designationName', 'role']),
    manager: getString(source, ['manager', 'reportingManager', 'reportingManagerName']),
    avatarUrl: getString(source, ['avatarUrl', 'profileImage', 'photoUrl']) || undefined,
  };
};

const revokeToken = async (token: string) => {
  try {
    await apiClient.post(
      '/api/auth/logout',
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // A rejected or incomplete login is never persisted locally.
  }
};

const normalizeLoginError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responsePayload = isObject(error.response?.data) ? error.response.data : {};
    const responseCode = getString(responsePayload, [
      'code',
      'errorCode',
      'error',
      'message',
      'detail',
    ])
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const knownCode = [
      'INVALID_LOGIN',
      'LOGIN_FIELDS_REQUIRED',
      'LOGIN_RATE_LIMITED',
      'PASSWORD_CHANGE_REQUIRED',
      'ESS_IDENTITY_REQUIRED',
      'ESS_ACCESS_REQUIRED',
      'ESS_ACCOUNT_INACTIVE',
      'LOGIN_CLIENT_REQUIRED',
      'LOGIN_EMPLOYEE_REQUIRED',
      'LOGIN_ESS_PERMISSION_REQUIRED',
      'ESS_PROFILE_REQUIRED',
    ].find(code => responseCode === code || responseCode.includes(code));
    if (knownCode) {
      return new Error(knownCode);
    }
    if (
      responseCode.includes('INACTIVE') ||
      responseCode.includes('DISABLED') ||
      responseCode.includes('ACCESS_DENIED')
    ) {
      return new Error('LOGIN_ACCESS_DENIED');
    }
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

    try {
      const response = await apiClient.post('/api/auth/login', {
        identifier: normalizedIdentifier,
        email: normalizedIdentifier,
        password: input.password,
        portal: 'ESS',
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
      const authenticatedEmployeeId = getNumber(user, ['employeeId', 'EmployeeId']);
      const roles = normalizeStringArray(user.roles ?? payload.roles ?? root.roles);
      const permissions = normalizeStringArray(
        user.permissions ?? payload.permissions ?? root.permissions,
      );
      const expiresAt = parseExpiresAt(
        payload.expiresAt ?? root.expiresAt ?? payload.expiry ?? root.expiry,
      );
      const mustChangePassword = getBoolean(user, [
        'mustChangePassword',
        'MustChangePassword',
      ]);

      // The resolver row id and Payroll authusers.ClientId belong to different
      // namespaces. The resolver chooses the deployment; Payroll identity then
      // supplies the internal client and employee scope.
      if (!authenticatedClientId) {
        await revokeToken(token);
        throw new Error('LOGIN_CLIENT_REQUIRED');
      }
      if (!authenticatedEmployeeId) {
        await revokeToken(token);
        throw new Error('LOGIN_EMPLOYEE_REQUIRED');
      }
      if (!permissions.some(permission => permission.toLowerCase() === 'ess.self')) {
        await revokeToken(token);
        throw new Error('LOGIN_ESS_PERMISSION_REQUIRED');
      }
      return {
        accessToken: token,
        userId: getString(user, ['id', 'Id', 'userId', 'UserId']),
        hrmsClientId: authenticatedClientId,
        hrmsEmployeeId: authenticatedEmployeeId,
        mustChangePassword,
        refreshToken:
          getString(payload, ['refreshToken']) || getString(root, ['refreshToken']) || undefined,
        expiresAt,
        client: input.client,
        employee: mapEmployeeFromUser(user, authenticatedEmployeeId),
        roles,
        permissions,
      };
    } catch (error) {
      throw normalizeLoginError(error);
    }
  },
  async validateSession(session: Session): Promise<boolean> {
    try {
      const response = await apiClient.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const unwrapped = unwrap(response.data);
      const user = isObject(unwrapped) ? unwrapped : {};
      const authenticatedClientId = getNumber(user, ['clientId', 'ClientId']);
      const authenticatedEmployeeId = getNumber(user, ['employeeId', 'EmployeeId']);
      const permissions = normalizeStringArray(user.permissions);
      const userId = getString(user, ['id', 'Id', 'userId', 'UserId']);
      const isActive = getBoolean(user, ['isActive', 'IsActive']);
      const mustChangePassword = getBoolean(user, ['mustChangePassword', 'MustChangePassword']);

      if (
        !isActive ||
        authenticatedClientId !== session.hrmsClientId ||
        authenticatedEmployeeId !== session.hrmsEmployeeId ||
        (session.userId && userId !== session.userId) ||
        !permissions.some(permission => permission.toLowerCase() === 'ess.self')
      ) {
        throw new Error('RESTORED_SESSION_INVALID');
      }
      return mustChangePassword;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('RESTORED_SESSION_INVALID');
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('REQUEST_TIMEOUT');
        }
        if (!error.response) {
          throw new Error('NETWORK_UNAVAILABLE');
        }
        if (error.response.status >= 500) {
          throw new Error('SERVER_UNAVAILABLE');
        }
      }
      throw error;
    }
  },
  async changePassword(accessToken: string, currentPassword: string, newPassword: string) {
    try {
      const response = await apiClient.post(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const unwrapped = unwrap(response.data);
      const user = isObject(unwrapped) ? unwrapped : {};
      if (getBoolean(user, ['mustChangePassword', 'MustChangePassword'])) {
        throw new Error('PASSWORD_CHANGE_FAILED');
      }
      return user;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const payload = isObject(error.response?.data) ? error.response.data : {};
        const code = getString(payload, ['error', 'code', 'message'])
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_');
        if (code.includes('CURRENT_PASSWORD')) {
          throw new Error('CURRENT_PASSWORD_INVALID');
        }
        if (code.includes('TOO_SHORT') || code.includes('AT_LEAST_8')) {
          throw new Error('NEW_PASSWORD_TOO_SHORT');
        }
        if (error.response?.status === 401) {
          throw new Error('SESSION_EXPIRED');
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('SERVER_UNAVAILABLE');
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('REQUEST_TIMEOUT');
        }
        if (!error.response) {
          throw new Error('NETWORK_UNAVAILABLE');
        }
      }
      throw error;
    }
  },
  async logout(accessToken: string) {
    await revokeToken(accessToken);
  },
};
