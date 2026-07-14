import { APP_CONFIG } from '../constants/app';
import { faceApiService } from './faceApiService';
import { faceEmbeddingService } from './faceEmbeddingService';
import { securityLogger } from './securityLogger';
import { sessionStorage } from './sessionStorage';

const getActiveClientCode = () =>
  sessionStorage.getSelectedClient()?.code ?? sessionStorage.getSession()?.client?.code;

export const faceVerificationService = {
  async verifyRegisteredFace(employeeId: string, imageRef: string) {
    const clientCode = getActiveClientCode();
    if (!clientCode) {
      throw new Error('CLIENT_CODE_REQUIRED');
    }

    const normalizedEmployeeId = employeeId.trim().toUpperCase();
    const registeredDevice = sessionStorage.getRegisteredDevice();
    const currentDeviceId = sessionStorage.getOrCreateDeviceId();
    const hasRegisteredDevice =
      registeredDevice?.clientCode === clientCode &&
      registeredDevice?.employeeId === normalizedEmployeeId &&
      registeredDevice.deviceId === currentDeviceId;
    const isRegistered =
      sessionStorage.isFaceEnrolled(clientCode, normalizedEmployeeId) && hasRegisteredDevice;
    const registeredFaceImage = sessionStorage.getRegisteredFaceImage(clientCode, normalizedEmployeeId);
    const registeredFaceEmbedding = sessionStorage.getRegisteredFaceEmbedding(
      clientCode,
      normalizedEmployeeId,
    );

    securityLogger.info('Face embedding loaded', {
      clientCode,
      employeeId: normalizedEmployeeId,
      isRegistered,
      hasRegisteredFaceImage: Boolean(registeredFaceImage),
      hasRegisteredFaceEmbedding: Boolean(registeredFaceEmbedding),
      hasRegisteredDevice,
      currentImageRef: imageRef,
    });

    if (!isRegistered) {
      securityLogger.warn('Face authentication rejected because no local registration exists', {
        clientCode,
        employeeId: normalizedEmployeeId,
      });
      throw new Error('FACE_NOT_REGISTERED');
    }

    if (registeredFaceImage && faceApiService.isConfigured()) {
      const result = await faceApiService.verifyFaces({
        registeredImageRef: registeredFaceImage,
        currentImageRef: imageRef,
      });
      securityLogger.info('Face API verification completed', {
        clientCode,
        employeeId: normalizedEmployeeId,
        decision: result.decision,
        matchScorePercent: result.matchScorePercent,
        similarityCosine: result.similarityCosine,
      });
      if (!result.isMatch) {
        return { passed: false, provider: 'face-api', referenceId: result.referenceId };
      }
      return {
        passed: true,
        faceMatchScore: result.matchScorePercent ?? result.similarityCosine,
        provider: 'face-api',
        referenceId: result.referenceId,
      };
    }

    if (!registeredFaceEmbedding) {
      if (
        APP_CONFIG.allowSelfieAuditAttendanceFallback &&
        registeredFaceImage &&
        !faceEmbeddingService.isModelConfigured()
      ) {
        securityLogger.warn('Face model unavailable; attendance approved with live selfie fallback', {
          clientCode,
          employeeId: normalizedEmployeeId,
          registeredFaceImage,
          currentImageRef: imageRef,
          modelConfigured: false,
        });
        return {
          passed: true,
          provider: 'selfie-audit-fallback',
          referenceId: `local-${Date.now()}`,
        };
      }

      securityLogger.warn('Face authentication rejected because Face API is not configured', {
        clientCode,
        employeeId: normalizedEmployeeId,
        hasRegisteredFaceImage: Boolean(registeredFaceImage),
        faceApiConfigured: faceApiService.isConfigured(),
      });
      throw new Error('FACE_API_NOT_CONFIGURED');
    }

    const freshEmbedding = await faceEmbeddingService.createEmbedding(imageRef);
    const comparison = faceEmbeddingService.compare(registeredFaceEmbedding, freshEmbedding);
    securityLogger.info('Face authentication comparison', {
      clientCode,
      employeeId: normalizedEmployeeId,
      similarityScore: comparison.similarityScore,
      threshold: comparison.threshold,
      result: comparison.isMatch ? 'APPROVED' : 'REJECTED',
    });

    return {
      passed: comparison.isMatch,
      faceMatchScore: comparison.similarityScore,
      provider: registeredFaceEmbedding.modelVersion,
      referenceId: `local-${Date.now()}`,
    };
  },
};
