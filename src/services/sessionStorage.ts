import { createMMKV, deleteMMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';
import {
  ClientProfile,
  DeviceRegistration,
  FaceEmbeddingRecord,
  FaceRegistrationCapture,
  Session,
} from '../types/domain';

// The previous namespace mixed bearer tokens with local UI state. Delete the
// whole legacy file without opening/decrypting it, then start clean on the
// non-secret v2 namespace. Users re-enter their client code once after upgrade.
try {
  deleteMMKV('secure-session');
} catch {
  // A missing legacy file is the normal case on fresh installs.
}

const storage = createMMKV({ id: 'app-local-state-v2' });
const sessionKeychainService = 'com.frevone.hrms.session.v2';

const persistSecureSession = (username: string, password: string) =>
  Keychain.setGenericPassword(username, password, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    service: sessionKeychainService,
    // An ESS bearer session is an app-level secret and must not depend on a
    // biometric prompt. Explicit AES-GCM also avoids device-specific fallback
    // selection failures in the Android Keystore.
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });

const keys = {
  selectedClient: 'selectedClient',
  faceEnrollmentPrefix: 'faceEnrollment:',
  faceImagePrefix: 'faceImage:',
  faceImagesPrefix: 'faceImages:',
  faceEmbeddingPrefix: 'faceEmbedding:',
  biometricLoginPrefix: 'biometricLogin:',
  deviceId: 'deviceId',
  registeredDevice: 'registeredDevice',
  registeredDeviceId: 'registeredDeviceId',
  registeredEmployeeId: 'registeredEmployeeId',
};

type PersistedSession = Omit<Session, 'client'> & {
  version: 2;
  clientCode: string;
};

let sessionCache: Session | undefined;
let sessionHydrated = false;

const persistedSessionFor = (session: Session): PersistedSession => {
  const { client, ...authSession } = session;
  return {
    ...authSession,
    version: 2,
    clientCode: client.code,
  };
};

const resetSecureSession = async () => {
  try {
    await Keychain.resetGenericPassword({ service: sessionKeychainService });
  } catch {
    // The in-memory session is already cleared; a keychain cleanup failure
    // must not keep Redux authenticated or block logout/navigation.
  }
};

const scopedKey = (prefix: string, clientCode: string, employeeId: string) =>
  `${prefix}${clientCode}:${employeeId}`;

export const sessionStorage = {
  async saveSession(session: Session) {
    const serializedSession = JSON.stringify(persistedSessionFor(session));
    let result: Awaited<ReturnType<typeof Keychain.setGenericPassword>>;
    try {
      result = await persistSecureSession(session.client.code, serializedSession);
      if (!result) {
        await resetSecureSession();
        result = await persistSecureSession(session.client.code, serializedSession);
      }
    } catch {
      // A corrupt/incompatible entry can survive an app upgrade. Remove it
      // once and retry with the explicitly selected Android storage backend.
      await resetSecureSession();
      try {
        result = await persistSecureSession(session.client.code, serializedSession);
      } catch {
        result = false;
      }
    }
    if (!result) {
      sessionCache = undefined;
      sessionHydrated = true;
      throw new Error('SESSION_SECURE_STORAGE_FAILED');
    }
    sessionCache = session;
    sessionHydrated = true;
  },
  getSession(): Session | undefined {
    return sessionCache;
  },
  async hydrateSession(): Promise<Session | undefined> {
    if (sessionHydrated) {
      return sessionCache;
    }
    sessionHydrated = true;

    try {
      const credentials = await Keychain.getGenericPassword({ service: sessionKeychainService });
      if (!credentials) {
        return undefined;
      }

      const persisted = JSON.parse(credentials.password) as Partial<PersistedSession>;
      const selectedClient = this.getSelectedClient();
      if (
        persisted.version !== 2 ||
        !selectedClient ||
        persisted.clientCode !== selectedClient.code ||
        typeof persisted.accessToken !== 'string' ||
        !persisted.accessToken.trim() ||
        !persisted.employee
      ) {
        await resetSecureSession();
        return undefined;
      }

      const authSession = { ...persisted };
      delete authSession.version;
      delete authSession.clientCode;
      sessionCache = {
        ...(authSession as Omit<Session, 'client'>),
        client: selectedClient,
      };
      return sessionCache;
    } catch {
      sessionCache = undefined;
      await resetSecureSession();
      return undefined;
    }
  },
  getToken() {
    return this.getSession()?.accessToken;
  },
  saveSelectedClient(client: ClientProfile) {
    storage.set(keys.selectedClient, JSON.stringify(client));
  },
  getSelectedClient(): ClientProfile | undefined {
    const value = storage.getString(keys.selectedClient);
    return value ? (JSON.parse(value) as ClientProfile) : undefined;
  },
  clearSelectedClient() {
    storage.remove(keys.selectedClient);
  },
  async clearSession() {
    sessionCache = undefined;
    sessionHydrated = true;
    await resetSecureSession();
  },
  getOrCreateDeviceId() {
    const existingDeviceId = storage.getString(keys.deviceId);
    if (existingDeviceId) {
      return existingDeviceId;
    }
    const deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    storage.set(keys.deviceId, deviceId);
    return deviceId;
  },
  getRegisteredDevice(): DeviceRegistration | undefined {
    const value = storage.getString(keys.registeredDevice);
    if (value) {
      return JSON.parse(value) as DeviceRegistration;
    }

    const deviceId = storage.getString(keys.registeredDeviceId);
    const employeeId = storage.getString(keys.registeredEmployeeId);
    const clientCode = this.getSelectedClient()?.code;
    if (!deviceId || !employeeId || !clientCode) {
      return undefined;
    }

    const registration: DeviceRegistration = {
      clientCode,
      employeeId,
      deviceId,
      registeredAt: new Date().toISOString(),
    };
    storage.set(keys.registeredDevice, JSON.stringify(registration));
    return registration;
  },
  registerDevice(clientCode: string, employeeId: string) {
    const deviceId = this.getOrCreateDeviceId();
    const registration: DeviceRegistration = {
      clientCode,
      employeeId,
      deviceId,
      registeredAt: new Date().toISOString(),
    };
    storage.set(keys.registeredDevice, JSON.stringify(registration));
    storage.set(keys.registeredDeviceId, deviceId);
    storage.set(keys.registeredEmployeeId, employeeId);
    return registration;
  },
  setBiometricLoginEnrollment(clientCode: string, employeeId: string, isEnabled: boolean) {
    storage.set(scopedKey(keys.biometricLoginPrefix, clientCode, employeeId), isEnabled);
  },
  isBiometricLoginEnabled(clientCode: string, employeeId: string) {
    return storage.getBoolean(scopedKey(keys.biometricLoginPrefix, clientCode, employeeId)) === true;
  },
  setFaceEnrollment(clientCode: string, employeeId: string, isRegistered: boolean) {
    storage.set(scopedKey(keys.faceEnrollmentPrefix, clientCode, employeeId), isRegistered);
  },
  isFaceEnrolled(clientCode: string, employeeId: string) {
    return storage.getBoolean(scopedKey(keys.faceEnrollmentPrefix, clientCode, employeeId)) === true;
  },
  setRegisteredFaceImage(clientCode: string, employeeId: string, imageRef: string) {
    storage.set(scopedKey(keys.faceImagePrefix, clientCode, employeeId), imageRef);
  },
  getRegisteredFaceImage(clientCode: string, employeeId: string) {
    return storage.getString(scopedKey(keys.faceImagePrefix, clientCode, employeeId));
  },
  setRegisteredFaceImages(
    clientCode: string,
    employeeId: string,
    captures: FaceRegistrationCapture[],
  ) {
    storage.set(scopedKey(keys.faceImagesPrefix, clientCode, employeeId), JSON.stringify(captures));
  },
  getRegisteredFaceImages(clientCode: string, employeeId: string) {
    const value = storage.getString(scopedKey(keys.faceImagesPrefix, clientCode, employeeId));
    return value ? (JSON.parse(value) as FaceRegistrationCapture[]) : undefined;
  },
  setRegisteredFaceEmbedding(
    clientCode: string,
    employeeId: string,
    embedding: FaceEmbeddingRecord,
  ) {
    storage.set(scopedKey(keys.faceEmbeddingPrefix, clientCode, employeeId), JSON.stringify(embedding));
  },
  getRegisteredFaceEmbedding(clientCode: string, employeeId: string) {
    const value = storage.getString(scopedKey(keys.faceEmbeddingPrefix, clientCode, employeeId));
    return value ? (JSON.parse(value) as FaceEmbeddingRecord) : undefined;
  },
};
