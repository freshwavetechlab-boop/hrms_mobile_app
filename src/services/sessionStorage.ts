import { createMMKV } from 'react-native-mmkv';
import {
  ClientProfile,
  DeviceRegistration,
  FaceEmbeddingRecord,
  FaceRegistrationCapture,
  Session,
} from '../types/domain';

const storage = createMMKV({
  id: 'secure-session',
  encryptionKey: 'replace-with-native-keystore-managed-key',
});

const keys = {
  session: 'session',
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

const scopedKey = (prefix: string, clientCode: string, employeeId: string) =>
  `${prefix}${clientCode}:${employeeId}`;

export const sessionStorage = {
  saveSession(session: Session) {
    storage.set(keys.session, JSON.stringify(session));
  },
  getSession(): Session | undefined {
    const value = storage.getString(keys.session);
    return value ? (JSON.parse(value) as Session) : undefined;
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
  clearSession() {
    storage.remove(keys.session);
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
