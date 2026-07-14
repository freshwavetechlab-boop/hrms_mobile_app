import axios from 'axios';
import { APP_CONFIG } from '../constants/app';
import { createId } from '../utils/id';

type ApiObject = Record<string, unknown>;

export type FaceVerifyResult = {
  isMatch: boolean;
  decision: string;
  matchScorePercent?: number;
  similarityCosine?: number;
  referenceId: string;
};

const isObject = (value: unknown): value is ApiObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFileUri = (imageRef: string) =>
  imageRef.startsWith('file://') ? imageRef : `file://${imageRef}`;

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('IMAGE_BASE64_READ_FAILED'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(blob);
  });

const imageToBase64 = async (imageRef: string) => {
  const response = await fetch(toFileUri(imageRef));
  const blob = await response.blob();
  return blobToBase64(blob);
};

const unwrap = (payload: unknown): unknown => {
  if (!isObject(payload)) {
    return payload;
  }
  return payload.data ?? payload.result ?? payload.payload ?? payload.response ?? payload;
};

const getNumber = (source: ApiObject, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
};

const normalizeFaceApiError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  const payload = unwrap(error.response?.data);
  const message = isObject(payload)
    ? String(payload.message ?? payload.error ?? payload.detail ?? '')
    : String(payload ?? '');
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('no face') || normalizedMessage.includes('multiple face')) {
    return new Error('FACE_QUALITY_REJECTED');
  }
  return new Error('FACE_API_FAILED');
};

export const faceApiService = {
  isConfigured() {
    return Boolean(APP_CONFIG.faceApiEnabled && APP_CONFIG.faceApiBaseUrl && APP_CONFIG.faceApiToken);
  },
  async verifyFaces(input: {
    registeredImageRef: string;
    currentImageRef: string;
  }): Promise<FaceVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error('FACE_API_NOT_CONFIGURED');
    }

    try {
      const [registeredImage, currentImage] = await Promise.all([
        imageToBase64(input.registeredImageRef),
        imageToBase64(input.currentImageRef),
      ]);

      const requestId = createId('face');
      const response = await axios.post(
        `${APP_CONFIG.faceApiBaseUrl}${APP_CONFIG.faceVerifyEndpoint}`,
        {
          request_id: requestId,
          image_a: {
            kind: APP_CONFIG.faceApiImageKind,
            data: registeredImage,
          },
          image_b: {
            kind: APP_CONFIG.faceApiImageKind,
            data: currentImage,
          },
          face_selector: 'largest',
          return_embeddings: false,
          quality_policy: {
            reject_if_no_face: true,
            reject_if_multiple_faces: true,
            min_detection_confidence: 0.85,
          },
        },
        {
          timeout: 20000,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${APP_CONFIG.faceApiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const payload = unwrap(response.data);
      const source = isObject(payload) ? payload : {};
      const decision = String(source.decision ?? '').toLowerCase();
      return {
        isMatch: decision === 'match',
        decision,
        matchScorePercent: getNumber(source, ['match_score_percent', 'matchScorePercent']),
        similarityCosine: getNumber(source, ['similarity_cosine', 'similarityCosine']),
        referenceId: String(source.request_id ?? source.requestId ?? requestId),
      };
    } catch (error) {
      throw normalizeFaceApiError(error);
    }
  },
};
