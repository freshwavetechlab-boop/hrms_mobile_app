import { securityLogger } from './securityLogger';
import { sessionStorage } from './sessionStorage';

export const deviceRegistrationService = {
  getRegistration() {
    return sessionStorage.getRegisteredDevice();
  },
  assertCanLogin(clientCode: string, employeeId: string) {
    const normalizedClientCode = clientCode.trim().toUpperCase();
    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const currentDeviceId = sessionStorage.getOrCreateDeviceId();
    const registeredDevice = sessionStorage.getRegisteredDevice();

    if (!registeredDevice) {
      securityLogger.info('Device login allowed before first registration', {
        clientCode: normalizedClientCode,
        employeeId: normalizedEmployeeId,
        currentDeviceId,
      });
      return true;
    }

    if (
      registeredDevice.clientCode !== normalizedClientCode ||
      registeredDevice.employeeId !== normalizedEmployeeId ||
      registeredDevice.deviceId !== currentDeviceId
    ) {
      securityLogger.warn('Device registration mismatch', {
        clientCode: normalizedClientCode,
        employeeId: normalizedEmployeeId,
        currentDeviceId,
        registeredClientCode: registeredDevice.clientCode,
        registeredEmployeeId: registeredDevice.employeeId,
        registeredDeviceId: registeredDevice.deviceId,
      });
      throw new Error('DEVICE_REGISTRATION_MISMATCH');
    }

    securityLogger.info('Registered device loaded', {
      clientCode: normalizedClientCode,
      employeeId: normalizedEmployeeId,
      currentDeviceId,
    });
    return true;
  },
  assertCanUseBiometricLogin(clientCode: string) {
    const normalizedClientCode = clientCode.trim().toUpperCase();
    const currentDeviceId = sessionStorage.getOrCreateDeviceId();
    const registeredDevice = sessionStorage.getRegisteredDevice();

    if (
      !registeredDevice ||
      registeredDevice.clientCode !== normalizedClientCode ||
      registeredDevice.deviceId !== currentDeviceId ||
      !sessionStorage.isBiometricLoginEnabled(normalizedClientCode, registeredDevice.employeeId)
    ) {
      securityLogger.warn('Biometric login blocked because registration is missing or mismatched', {
        clientCode: normalizedClientCode,
        currentDeviceId,
        registeredDevice,
      });
      throw new Error('BIOMETRIC_LOGIN_NOT_REGISTERED');
    }

    return registeredDevice;
  },
  isBiometricLoginReady(clientCode: string) {
    try {
      this.assertCanUseBiometricLogin(clientCode);
      return true;
    } catch {
      return false;
    }
  },
  registerCurrentDevice(clientCode: string, employeeId: string) {
    const normalizedClientCode = clientCode.trim().toUpperCase();
    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const registration = sessionStorage.registerDevice(normalizedClientCode, normalizedEmployeeId);
    sessionStorage.setBiometricLoginEnrollment(normalizedClientCode, normalizedEmployeeId, true);
    securityLogger.info('Device registration saved', {
      clientCode: normalizedClientCode,
      employeeId: normalizedEmployeeId,
      deviceId: registration.deviceId,
    });
    return registration;
  },
};
