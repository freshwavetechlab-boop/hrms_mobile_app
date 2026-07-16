import { Images } from 'react-native-nitro-image';

const normalizeFilePath = (imageRef: string) =>
  imageRef.startsWith('file://') ? imageRef.replace('file://', '') : imageRef;

const toFileUri = (imageRef: string) =>
  imageRef.startsWith('file://') ? imageRef : `file://${imageRef}`;

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('IMAGE_BASE64_READ_FAILED'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      if (!base64) {
        reject(new Error('IMAGE_BASE64_READ_FAILED'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });

export const imageCompressionService = {
  async compressEnrollmentSelfie(imageRef: string) {
    const image = await Images.loadFromFileAsync(normalizeFilePath(imageRef));
    return image.saveToTemporaryFileAsync('jpg', 85);
  },
  async enrollmentSelfieToBase64(imageRef: string) {
    const response = await fetch(toFileUri(imageRef));
    return blobToBase64(await response.blob());
  },
};
