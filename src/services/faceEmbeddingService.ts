import { FaceEmbeddingRecord } from '../types/domain';
import { securityLogger } from './securityLogger';

const threshold = 0.82;
const modelVersion = 'pending-tflite-model';

const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length === 0) {
    throw new Error('FACE_EMBEDDING_INVALID');
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    throw new Error('FACE_EMBEDDING_INVALID');
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export const faceEmbeddingService = {
  isModelConfigured() {
    return false;
  },
  async createEmbedding(imageRef: string): Promise<FaceEmbeddingRecord> {
    securityLogger.warn('Face embedding model is not configured', {
      imageRef,
      requiredModel: 'MobileFaceNet/ArcFace compatible .tflite',
      modelVersion,
      threshold,
    });
    throw new Error('FACE_MODEL_NOT_CONFIGURED');
  },
  compare(savedEmbedding: FaceEmbeddingRecord, freshEmbedding: FaceEmbeddingRecord) {
    const similarityScore = cosineSimilarity(savedEmbedding.vector, freshEmbedding.vector);
    const requiredThreshold = savedEmbedding.threshold || threshold;
    return {
      similarityScore,
      threshold: requiredThreshold,
      isMatch: similarityScore >= requiredThreshold,
    };
  },
};
