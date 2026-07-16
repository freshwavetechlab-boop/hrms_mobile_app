export const APP_CONFIG = {
  name: 'Enterprise HRMS',
  version: '1.0.0',
  sessionExpiryMinutes: 60,
  appLockAfterMs: 5 * 60 * 1000,
  tenantResolverUrl: 'http://tenant-endpoints-api.frevo.co.in/api/v1/tenants/resolve',
  faceRegistrationEndpoint: '/api/ess/face/register',
  faceRegistrationUploadEnabled: true,
  faceApiBaseUrl: '',
  faceApiEnabled: false,
  faceApiToken: '',
  faceVerifyEndpoint: '/v1/faces/verify',
  faceApiImageKind: 'base64_png',
  allowSelfieAuditAttendanceFallback: false,
};

export const TOUCH_TARGET = 48;
