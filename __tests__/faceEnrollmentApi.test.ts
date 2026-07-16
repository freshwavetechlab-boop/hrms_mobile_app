import { apiClient } from '../src/services/apiClient';
import { essApiService } from '../src/services/essApiService';
import { imageCompressionService } from '../src/services/imageCompressionService';
import { FaceRegistrationCapture } from '../src/types/domain';

jest.mock('../src/services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    enrollmentSelfieToBase64: jest.fn(),
  },
}));

jest.mock('../src/services/sessionStorage', () => ({
  sessionStorage: {
    getSelectedClient: () => ({ apiBaseUrl: 'http://resolved-tenant.example' }),
    getSession: () => undefined,
  },
}));

const captures: FaceRegistrationCapture[] = [
  { angle: 'RIGHT', imageRef: '/tmp/right.jpg', capturedAt: '2026-07-13T10:02:00Z' },
  { angle: 'FRONT', imageRef: '/tmp/front.jpg', capturedAt: '2026-07-13T10:00:00Z' },
  { angle: 'LEFT', imageRef: '/tmp/left.jpg', capturedAt: '2026-07-13T10:01:00Z' },
];

describe('face enrollment API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(imageCompressionService.enrollmentSelfieToBase64)
      .mockImplementation(async imageRef => `base64:${imageRef}`);
  });

  it('posts the three JPEG captures in front, left, right order and accepts 201', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      status: 201,
      data: {
        registered: true,
        status: 'active',
        capture_count: 3,
        angles: ['front', 'left', 'right'],
        template_version: 1,
      },
    });

    const result = await essApiService.registerFaceEnrollment({
      clientCode: 'RECL',
      employeeId: 'EMP-1',
      deviceId: 'device-1',
      captures,
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/ess/face/register',
      expect.objectContaining({
        request_id: expect.stringMatching(/^face_enrollment_/),
        enrollment_images: [
          {
            angle: 'front',
            image: { kind: 'base64_jpeg', data: 'base64:/tmp/front.jpg' },
          },
          {
            angle: 'left',
            image: { kind: 'base64_jpeg', data: 'base64:/tmp/left.jpg' },
          },
          {
            angle: 'right',
            image: { kind: 'base64_jpeg', data: 'base64:/tmp/right.jpg' },
          },
        ],
        face_selector: 'largest',
        quality_policy: {
          reject_if_no_face: true,
          reject_if_multiple_faces: true,
          min_detection_confidence: 0.85,
        },
      }),
    );
    expect(result).toMatchObject({
      registered: true,
      status: 'active',
      captureCount: 3,
      angles: ['front', 'left', 'right'],
      templateVersion: 1,
    });
  });

  it('does not accept a response unless registered is true', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      status: 201,
      data: { registered: false, status: 'rejected' },
    });

    await expect(
      essApiService.registerFaceEnrollment({
        clientCode: 'RECL',
        employeeId: 'EMP-1',
        deviceId: 'device-1',
        captures,
      }),
    ).rejects.toThrow('FACE_ENROLLMENT_REJECTED');
  });
});
