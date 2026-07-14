import ReactNativeBiometrics from 'react-native-biometrics';
import { securityLogger } from './securityLogger';

const biometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

const biometricOnly = new ReactNativeBiometrics({
  allowDeviceCredentials: false,
});

export const biometricService = {
  async isAvailable() {
    const result = await biometrics.isSensorAvailable();
    return result.available;
  },
  async assertAvailable(allowDeviceCredentials = true) {
    const result = await (allowDeviceCredentials ? biometrics : biometricOnly).isSensorAvailable();
    if (!result.available) {
      securityLogger.warn('Biometric unavailable', { allowDeviceCredentials });
      throw new Error('BIOMETRIC_NOT_ENROLLED');
    }
    securityLogger.info('Biometric sensor available', {
      allowDeviceCredentials,
      biometryType: result.biometryType,
    });
    return result;
  },
  async authenticate(promptMessage: string) {
    const result = await biometrics.simplePrompt({
      promptMessage,
      fallbackPromptMessage: 'Use device password',
    });
    return result.success;
  },
  async authenticateForAttendance() {
    await this.assertAvailable(false);
    const result = await biometricOnly.simplePrompt({
      promptMessage: 'Biometric confirmation required for attendance',
    });
    const success = result.success;
    securityLogger.info('Attendance biometric authentication result', {
      success,
      fallbackDisabled: true,
    });
    if (!success) {
      throw new Error('BIOMETRIC_CANCELLED');
    }
    return true;
  },
  async authenticateForLogin() {
    await this.assertAvailable(false);
    const result = await biometricOnly.simplePrompt({
      promptMessage: 'Confirm fingerprint or face for HRMS login',
    });
    if (!result.success) {
      throw new Error('BIOMETRIC_CANCELLED');
    }
    return true;
  },
  async authenticateForRegistration() {
    await this.assertAvailable(false);
    const result = await biometricOnly.simplePrompt({
      promptMessage: 'Register fingerprint or face for HRMS login',
    });
    securityLogger.info('Registration biometric authentication result', {
      success: result.success,
      fallbackDisabled: true,
    });
    if (!result.success) {
      throw new Error('BIOMETRIC_CANCELLED');
    }
    return true;
  },
};
