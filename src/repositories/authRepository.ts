import { Session } from '../types/domain';
import { clientRepository } from './clientRepository';
import { authApiService } from '../services/authApiService';
import { deviceRegistrationService } from '../services/deviceRegistrationService';
import { essApiService } from '../services/essApiService';
import { sessionStorage } from '../services/sessionStorage';
import { getErrorMessage } from '../utils/errorMessage';

const isRealAccessToken = (token?: string): token is string =>
  Boolean(token?.trim() && !token.startsWith('demo-token-'));

const hasEssAccess = (session: Session) =>
  session.permissions?.some(permission => permission.toLowerCase() === 'ess.self') === true;

const revokeAndClearSession = async (session?: Session) => {
  const accessToken = session?.accessToken;
  try {
    if (isRealAccessToken(accessToken)) {
      await authApiService.logout(accessToken);
    }
  } finally {
    await sessionStorage.clearSession();
  }
};

const isTransientValidationError = (error: unknown) =>
  ['NETWORK_UNAVAILABLE', 'REQUEST_TIMEOUT', 'SERVER_UNAVAILABLE'].includes(
    getErrorMessage(error),
  );

export const authRepository = {
  async login(identifier: string, password: string): Promise<Session> {
    const client = sessionStorage.getSelectedClient();
    if (!client) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }

    const session = await authApiService.login({ client, identifier, password });
    // The profile endpoint needs the freshly issued bearer token. Persist it
    // only for this mandatory validation window and remove it on any failure.
    try {
      await sessionStorage.saveSession(session);
    } catch (error) {
      await revokeAndClearSession(session);
      throw error;
    }
    sessionStorage.saveSelectedClient(session.client);
    if (session.mustChangePassword) {
      return session;
    }
    try {
      session.employee = await essApiService.getProfile(session.employee);
      if (!session.employee.id.trim() || !session.employee.email.trim()) {
        throw new Error('ESS_PROFILE_INVALID');
      }
      session.profileValidatedAt = Date.now();
    } catch (error) {
      await revokeAndClearSession(session);
      if (isTransientValidationError(error)) {
        throw error;
      }
      throw new Error('ESS_PROFILE_REQUIRED');
    }

    try {
      deviceRegistrationService.assertCanLogin(session.client.code, session.employee.id);
    } catch (error) {
      await revokeAndClearSession(session);
      throw error;
    }
    sessionStorage.saveSelectedClient(session.client);
    await sessionStorage.saveSession(session);
    return session;
  },
  async loginWithBiometric(): Promise<Session> {
    const client = sessionStorage.getSelectedClient();
    if (!client) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }
    const registration = deviceRegistrationService.assertCanUseBiometricLogin(client.code);
    const restoredSession = sessionStorage.getSession();
    if (
      !restoredSession ||
      !isRealAccessToken(restoredSession.accessToken) ||
      restoredSession.mustChangePassword ||
      !restoredSession.hrmsClientId ||
      !restoredSession.hrmsEmployeeId ||
      !restoredSession.profileValidatedAt ||
      !hasEssAccess(restoredSession) ||
      restoredSession.client.code !== client.code ||
      restoredSession.employee.id !== registration.employeeId
    ) {
      await sessionStorage.clearSession();
      throw new Error('BIOMETRIC_LOGIN_NOT_REGISTERED');
    }

    try {
      restoredSession.employee = await essApiService.getProfile(restoredSession.employee);
      if (!restoredSession.employee.id.trim() || !restoredSession.employee.email.trim()) {
        throw new Error('ESS_PROFILE_INVALID');
      }
      restoredSession.profileValidatedAt = Date.now();
      await sessionStorage.saveSession(restoredSession);
      return restoredSession;
    } catch {
      await revokeAndClearSession(restoredSession);
      throw new Error('ESS_PROFILE_REQUIRED');
    }
  },
  async restoreSession() {
    const session = await sessionStorage.hydrateSession();
    if (
      session &&
      (!isRealAccessToken(session.accessToken) ||
        !session.hrmsClientId ||
        !session.hrmsEmployeeId ||
        (!session.mustChangePassword && !session.profileValidatedAt) ||
        !session.employee?.id ||
        !hasEssAccess(session))
    ) {
      await sessionStorage.clearSession();
      return undefined;
    }
    if (session && (!session.client || !clientRepository.isApprovedClientCode(session.client.code))) {
      await sessionStorage.clearSession();
      return undefined;
    }
    if (!session) {
      return undefined;
    }

    try {
      session.mustChangePassword = await authApiService.validateSession(session);
      if (session.mustChangePassword) {
        session.profileValidatedAt = undefined;
      }
      await sessionStorage.saveSession(session);
      return session;
    } catch (error) {
      if (isTransientValidationError(error)) {
        return session;
      }
      await sessionStorage.clearSession();
      return undefined;
    }
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<Session> {
    const session = sessionStorage.getSession();
    if (!session || !isRealAccessToken(session.accessToken)) {
      throw new Error('SESSION_EXPIRED');
    }

    await authApiService.changePassword(session.accessToken, currentPassword, newPassword);
    session.mustChangePassword = false;
    await sessionStorage.saveSession(session);

    try {
      session.employee = await essApiService.getProfile(session.employee);
      if (!session.employee.id.trim() || !session.employee.email.trim()) {
        throw new Error('ESS_PROFILE_INVALID');
      }
      session.profileValidatedAt = Date.now();
      deviceRegistrationService.assertCanLogin(session.client.code, session.employee.id);
      sessionStorage.saveSelectedClient(session.client);
      await sessionStorage.saveSession(session);
      return session;
    } catch (error) {
      await revokeAndClearSession(session);
      if (isTransientValidationError(error)) {
        throw error;
      }
      throw new Error('ESS_PROFILE_REQUIRED');
    }
  },
  async logout() {
    await revokeAndClearSession(sessionStorage.getSession());
  },
};
