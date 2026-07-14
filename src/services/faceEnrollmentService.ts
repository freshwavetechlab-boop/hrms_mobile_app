import { deviceRegistrationService } from './deviceRegistrationService';
import { APP_CONFIG } from '../constants/app';
import { FaceCaptureAngle, FaceRegistrationCapture } from '../types/domain';
import { essApiService } from './essApiService';
import { faceEmbeddingService } from './faceEmbeddingService';
import { securityLogger } from './securityLogger';
import { sessionStorage } from './sessionStorage';

const requiredAngles: FaceCaptureAngle[] = ['FRONT', 'LEFT', 'RIGHT'];

const getActiveClientCode = () =>
  sessionStorage.getSelectedClient()?.code ?? sessionStorage.getSession()?.client?.code;

const assertCompleteCaptureSet = (captures: FaceRegistrationCapture[]) => {
  const capturedAngles = new Set(captures.map(capture => capture.angle));
  const missingAngle = requiredAngles.find(angle => !capturedAngles.has(angle));
  if (missingAngle) {
    throw new Error(`FACE_CAPTURE_${missingAngle}_REQUIRED`);
  }
};

export const faceEnrollmentService = {
  getStatus(employeeId: string) {
    const clientCode = getActiveClientCode();
    if (!clientCode) {
      securityLogger.warn('Face registration status blocked because client code is missing', {
        employeeId: employeeId.trim().toUpperCase(),
      });
      return false;
    }

    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const registeredDevice = sessionStorage.getRegisteredDevice();
    const currentDeviceId = sessionStorage.getOrCreateDeviceId();
    const hasRegisteredDevice =
      registeredDevice?.clientCode === clientCode &&
      registeredDevice?.employeeId === normalizedEmployeeId &&
      registeredDevice.deviceId === currentDeviceId;
    const isRegistered =
      sessionStorage.isFaceEnrolled(clientCode, normalizedEmployeeId) &&
      hasRegisteredDevice;
    securityLogger.info('Face registration status loaded', {
      clientCode,
      employeeId: normalizedEmployeeId,
      isRegistered,
      hasRegisteredFaceImage: Boolean(
        clientCode && sessionStorage.getRegisteredFaceImage(clientCode, normalizedEmployeeId),
      ),
      hasRegisteredFaceImages: Boolean(
        clientCode && sessionStorage.getRegisteredFaceImages(clientCode, normalizedEmployeeId)?.length,
      ),
      hasRegisteredFaceEmbedding: Boolean(
        clientCode && sessionStorage.getRegisteredFaceEmbedding(clientCode, normalizedEmployeeId),
      ),
      hasRegisteredDevice,
    });
    return isRegistered;
  },
  async enroll(employeeId: string, captures: FaceRegistrationCapture[]) {
    const clientCode = getActiveClientCode();
    if (!clientCode) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }
    assertCompleteCaptureSet(captures);

    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const registeredDevice = sessionStorage.getRegisteredDevice();
    const currentDeviceId = sessionStorage.getOrCreateDeviceId();
    const hasRegisteredDevice =
      registeredDevice?.clientCode === clientCode &&
      registeredDevice?.employeeId === normalizedEmployeeId &&
      registeredDevice.deviceId === currentDeviceId;

    if (sessionStorage.isFaceEnrolled(clientCode, normalizedEmployeeId) && hasRegisteredDevice) {
      securityLogger.info('Face registration skipped because it already exists', {
        clientCode,
        employeeId: normalizedEmployeeId,
      });
      return true;
    }

    if (!APP_CONFIG.faceRegistrationUploadEnabled || !essApiService.isConfigured()) {
      throw new Error('FACE_ENROLLMENT_API_NOT_CONFIGURED');
    }
    const registration = deviceRegistrationService.registerCurrentDevice(clientCode, normalizedEmployeeId);
    const enrollment = await essApiService.registerFaceEnrollment({
      clientCode,
      employeeId: normalizedEmployeeId,
      deviceId: registration.deviceId,
      captures,
    });
    securityLogger.info('Face registration posted to API', {
      clientCode,
      employeeId: normalizedEmployeeId,
      deviceId: registration.deviceId,
      requestId: enrollment.requestId,
      status: enrollment.status,
      captureCount: enrollment.captureCount,
      angles: enrollment.angles,
      templateVersion: enrollment.templateVersion,
    });

    const frontCapture = captures.find(capture => capture.angle === 'FRONT') ?? captures[0];
    sessionStorage.setFaceEnrollment(clientCode, normalizedEmployeeId, true);
    sessionStorage.setRegisteredFaceImage(clientCode, normalizedEmployeeId, frontCapture.imageRef);
    sessionStorage.setRegisteredFaceImages(clientCode, normalizedEmployeeId, captures);

    try {
      const embedding = await faceEmbeddingService.createEmbedding(frontCapture.imageRef);
      sessionStorage.setRegisteredFaceEmbedding(clientCode, normalizedEmployeeId, embedding);
      securityLogger.info('Face embedding saved', {
        clientCode,
        employeeId: normalizedEmployeeId,
        modelVersion: embedding.modelVersion,
        sampleCount: embedding.sampleCount,
        threshold: embedding.threshold,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'FACE_MODEL_NOT_CONFIGURED') {
        securityLogger.warn('Face registration completed without embedding because model is missing', {
          clientCode,
          employeeId: normalizedEmployeeId,
          imageRef: frontCapture.imageRef,
        });
      } else {
        throw error;
      }
    }

    securityLogger.info('Face registration success', {
      clientCode,
      employeeId: normalizedEmployeeId,
      deviceId: registration.deviceId,
      captureCount: captures.length,
      angles: captures.map(capture => capture.angle),
    });
    securityLogger.info('Biometric login registration saved', {
      clientCode,
      employeeId: normalizedEmployeeId,
      storage: 'MMKV local biometric login flag + OS biometric prompt',
    });
    return true;
  },
};
