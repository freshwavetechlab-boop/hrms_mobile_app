import * as Keychain from 'react-native-keychain';
import { apiClient } from '../src/services/apiClient';
import { authApiService } from '../src/services/authApiService';
import { sessionStorage } from '../src/services/sessionStorage';
import { ClientProfile, Session } from '../src/types/domain';
import { getErrorMessage } from '../src/utils/errorMessage';
import { authSessionEvents } from '../src/services/authSessionEvents';
import {
  isValidEmployeeIdentifier,
  isValidPassword,
} from '../src/validators/authValidators';

const activeClient = (): ClientProfile => ({
  code: 'GAD',
  name: 'GA Digital',
  supportEmail: '',
  apiBaseUrl: 'https://hrms.example.test',
  validFromUtc: new Date(Date.now() - 60_000).toISOString(),
  validUntilUtc: new Date(Date.now() + 60_000).toISOString(),
  isActive: true,
  validatedAt: new Date().toISOString(),
  branding: {
    primaryColor: '#062B6F',
    accentColor: '#13BFA6',
    logoInitials: 'GAD',
  },
});

describe('mobile authentication contract', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    sessionStorage.clearSelectedClient();
    await sessionStorage.clearSession();
  });

  it('accepts employee codes and email addresses but rejects blank/control identifiers', () => {
    expect(isValidEmployeeIdentifier('REC135')).toBe(true);
    expect(isValidEmployeeIdentifier('employee@example.com')).toBe(true);
    expect(isValidEmployeeIdentifier('   ')).toBe(false);
    expect(isValidEmployeeIdentifier('REC\n135')).toBe(false);
    expect(isValidPassword('secret')).toBe(true);
  });

  it('reads error codes from Error and Redux Toolkit SerializedError objects', () => {
    expect(getErrorMessage(new Error('NETWORK_UNAVAILABLE'))).toBe('NETWORK_UNAVAILABLE');
    expect(getErrorMessage({ message: 'LOGIN_CLIENT_REQUIRED', name: 'Error' })).toBe(
      'LOGIN_CLIENT_REQUIRED',
    );
    expect(getErrorMessage('REQUEST_TIMEOUT')).toBe('REQUEST_TIMEOUT');
    expect(getErrorMessage({ code: 'UNKNOWN' })).toBe('');
  });

  it('sends the ESS generic-identifier contract with legacy email compatibility', async () => {
    const client = activeClient();
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        token: 'real-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: 5,
          email: 'rec135',
          displayName: 'Employee',
          clientId: 10,
          employeeId: 720,
          isActive: true,
          mustChangePassword: false,
          roles: ['employee'],
          permissions: ['ess.self'],
        },
      },
    });

    const session = await authApiService.login({
      client,
      identifier: ' REC135 ',
      password: 'secret',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      identifier: 'REC135',
      email: 'REC135',
      password: 'secret',
      portal: 'ESS',
    });
    expect(session.hrmsEmployeeId).toBe(720);
  });

  it('preserves structured backend login policy codes', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'PASSWORD_CHANGE_REQUIRED' },
      },
    });

    await expect(
      authApiService.login({
        client: activeClient(),
        identifier: 'REC135',
        password: 'secret',
      }),
    ).rejects.toThrow('PASSWORD_CHANGE_REQUIRED');
  });

  it.each([
    ['ESS_IDENTITY_REQUIRED', 403],
    ['ESS_ACCESS_REQUIRED', 403],
    ['ESS_ACCOUNT_INACTIVE', 403],
    ['LOGIN_RATE_LIMITED', 429],
  ])('preserves backend policy code %s', async (code, status) => {
    jest.spyOn(apiClient, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status, data: { error: code } },
    });

    await expect(
      authApiService.login({
        client: activeClient(),
        identifier: 'REC135',
        password: 'secret',
      }),
    ).rejects.toThrow(code);
  });

  it('persists bearer sessions through native keychain instead of MMKV', async () => {
    const client = activeClient();
    const session: Session = {
      accessToken: 'secure-token',
      userId: '5',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      profileValidatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      client,
      employee: {
        id: 'REC135',
        name: 'Employee',
        email: 'employee@example.com',
        department: '',
        designation: '',
        manager: '',
      },
      roles: ['employee'],
      permissions: ['ess.self'],
    };

    await sessionStorage.saveSession(session);

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'GAD',
      expect.stringContaining('secure-token'),
      expect.objectContaining({ service: 'com.frevone.hrms.session.v2' }),
    );
    expect(sessionStorage.getSession()).toEqual(session);
  });

  it('validates restored scope against auth/me using numeric HRMS identity', async () => {
    const client = activeClient();
    const session: Session = {
      accessToken: 'secure-token',
      userId: '5',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      expiresAt: Date.now() + 60_000,
      client,
      employee: {
        id: 'REC135',
        name: 'Employee',
        email: 'employee@example.com',
        department: '',
        designation: '',
        manager: '',
      },
      permissions: ['ess.self'],
    };
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        id: 5,
        clientId: 10,
        employeeId: 720,
        isActive: true,
        mustChangePassword: false,
        permissions: ['ess.self'],
      },
    });

    await expect(authApiService.validateSession(session)).resolves.toBe(false);

    jest.mocked(apiClient.get).mockResolvedValue({
      data: {
        id: 5,
        clientId: 10,
        employeeId: 999,
        isActive: true,
        mustChangePassword: false,
        permissions: ['ess.self'],
      },
    });
    await expect(authApiService.validateSession(session)).rejects.toThrow(
      'RESTORED_SESSION_INVALID',
    );
  });

  it('returns a restricted session for temporary-password users', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        token: 'temporary-session-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: 5,
          email: 'REC135',
          displayName: 'Employee',
          clientId: 10,
          employeeId: 720,
          isActive: true,
          mustChangePassword: true,
          permissions: ['ess.self'],
        },
      },
    });

    const session = await authApiService.login({
      client: activeClient(),
      identifier: 'REC135',
      password: 'temporary-password',
    });

    expect(session.mustChangePassword).toBe(true);
    expect(session.accessToken).toBe('temporary-session-token');
  });

  it('does not reject a token from the device clock or response expiry metadata', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        token: 'server-authoritative-token',
        expiresAt: new Date(0).toISOString(),
        user: {
          id: 5,
          email: 'REC135',
          displayName: 'Employee',
          clientId: 10,
          employeeId: 720,
          isActive: true,
          mustChangePassword: false,
          permissions: ['ess.self'],
        },
      },
    });

    await expect(
      authApiService.login({
        client: activeClient(),
        identifier: 'REC135',
        password: 'secret',
      }),
    ).resolves.toEqual(expect.objectContaining({ accessToken: 'server-authoritative-token' }));
  });

  it('submits password changes using the restricted bearer session', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: { id: 5, mustChangePassword: false },
    });

    await expect(
      authApiService.changePassword('temporary-session-token', 'OldPass123', 'NewPass123'),
    ).resolves.toEqual(expect.objectContaining({ id: 5 }));
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/auth/change-password',
      { currentPassword: 'OldPass123', newPassword: 'NewPass123' },
      { headers: { Authorization: 'Bearer temporary-session-token' } },
    );
  });

  it('clears an active session on global API 401 but ignores login 401', async () => {
    const client = activeClient();
    const session: Session = {
      accessToken: 'secure-token',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      expiresAt: Date.now() + 60_000,
      client,
      employee: {
        id: 'REC135',
        name: 'Employee',
        email: 'employee@example.com',
        department: '',
        designation: '',
        manager: '',
      },
      permissions: ['ess.self'],
    };
    sessionStorage.saveSelectedClient(client);
    await sessionStorage.saveSession(session);
    const unauthorized = jest.fn();
    const unsubscribe = authSessionEvents.subscribeUnauthorized(unauthorized);
    const rejectUnauthorized = (config: unknown) =>
      Promise.reject({
        isAxiosError: true,
        config,
        response: { status: 401, data: {} },
      });

    await expect(
      apiClient.get('/api/ess/mobile-profile', { adapter: rejectUnauthorized }),
    ).rejects.toBeDefined();
    expect(sessionStorage.getSession()).toBeUndefined();
    expect(unauthorized).toHaveBeenCalledTimes(1);

    await sessionStorage.saveSession(session);
    await expect(
      apiClient.post('/api/auth/login', {}, { adapter: rejectUnauthorized }),
    ).rejects.toBeDefined();
    expect(sessionStorage.getSession()).toEqual(session);
    expect(unauthorized).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
