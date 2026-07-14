import { demoEmployee } from '../constants/staticData';
import { Session } from '../types/domain';
import { clientRepository } from './clientRepository';
import { authApiService } from '../services/authApiService';
import { deviceRegistrationService } from '../services/deviceRegistrationService';
import { essApiService } from '../services/essApiService';
import { sessionStorage } from '../services/sessionStorage';

const persistentSessionMs = 1000 * 60 * 60 * 24 * 365 * 10;

export const authRepository = {
  async login(identifier: string, password: string): Promise<Session> {
    const employeeId = identifier.trim().toUpperCase();
    const client = sessionStorage.getSelectedClient();
    if (!client) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }
    if (essApiService.isConfigured()) {
      const session = await authApiService.login({ client, identifier, password });
      sessionStorage.saveSession(session);
      try {
        session.employee = await essApiService.getProfile(session.employee);
      } catch {
        // Login response already contains the user; profile refresh can retry after login.
      }
      try {
        deviceRegistrationService.assertCanLogin(session.client.code, session.employee.id);
      } catch (error) {
        sessionStorage.clearSession();
        throw error;
      }
      sessionStorage.saveSelectedClient(session.client);
      sessionStorage.saveSession(session);
      return session;
    }

    deviceRegistrationService.assertCanLogin(client.code, employeeId);
    const session = this.createSession(client, employeeId, password.length);
    sessionStorage.saveSession(session);
    return session;
  },
  async loginWithBiometric(): Promise<Session> {
    const client = sessionStorage.getSelectedClient();
    if (!client) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }
    const registration = deviceRegistrationService.assertCanUseBiometricLogin(client.code);
    const restoredSession = sessionStorage.getSession();
    if (essApiService.isConfigured()) {
      if (restoredSession?.accessToken && restoredSession.employee.id === registration.employeeId) {
        return restoredSession;
      }
      throw new Error('BIOMETRIC_LOGIN_NOT_REGISTERED');
    }

    const session = this.createSession(client, registration.employeeId, 0);
    sessionStorage.saveSession(session);
    return session;
  },
  createSession(client: Session['client'], employeeId: string, passwordLength: number): Session {
    const session: Session = {
      accessToken: `demo-token-${client.code}-${employeeId}-${passwordLength}`,
      refreshToken: undefined,
      expiresAt: Date.now() + persistentSessionMs,
      client,
      employee: {
        ...demoEmployee,
        id: employeeId,
        email: `${employeeId.toLowerCase()}@${client.code.toLowerCase()}.example`,
      },
    };
    return session;
  },
  restoreSession() {
    const session = sessionStorage.getSession();
    if (session && session.expiresAt <= Date.now()) {
      sessionStorage.clearSession();
      return undefined;
    }
    if (session && (!session.client || !clientRepository.isApprovedClientCode(session.client.code))) {
      sessionStorage.clearSession();
      return undefined;
    }
    return session;
  },
  logout() {
    sessionStorage.clearSession();
  },
};
