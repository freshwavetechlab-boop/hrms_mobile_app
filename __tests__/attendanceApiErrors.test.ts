import { apiClient } from '../src/services/apiClient';
import { essApiService } from '../src/services/essApiService';
import { sessionStorage } from '../src/services/sessionStorage';
import { AttendanceRecord } from '../src/types/domain';

const selectedClient = {
  code: 'GAD',
  name: 'GA Digital Web Word Pvt. Ltd.',
  supportEmail: '',
  apiBaseUrl: 'http://resolved-tenant.example',
  validFromUtc: '2026-01-01T00:00:00Z',
  validUntilUtc: '2027-01-01T00:00:00Z',
  isActive: true,
  validatedAt: '2026-07-14T00:00:00Z',
  branding: {
    primaryColor: '#062B6F',
    accentColor: '#13BFA6',
    logoInitials: 'GAD',
  },
};

const record: AttendanceRecord = {
  accuracyMeters: 8,
  appVersion: '1.0.0',
  attempts: 0,
  attendanceType: 'CHECK_IN',
  cameraCaptureConfirmed: true,
  biometricConfirmed: true,
  clientCode: 'GAD',
  deviceId: 'device-test',
  deviceModel: 'Nothing A063',
  osVersion: 'Android 15',
  employeeId: 'REC135',
  id: 'attendance-test',
  isPunchRecord: true,
  latitude: 28.61,
  longitude: 77.2,
  networkType: 'wifi',
  syncStatus: 'SYNCED',
  timestamp: '2026-07-14T10:00:00.000Z',
};

describe('attendance API error normalization', () => {
  beforeEach(() => {
    sessionStorage.saveSelectedClient(selectedClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clearSelectedClient();
    sessionStorage.clearSession();
  });

  it('reports a server failure instead of blaming GPS or the selfie', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { data: '', status: 500 },
    });

    await expect(essApiService.validateAttendancePunch(record)).rejects.toThrow(
      'ATTENDANCE_SERVER_ERROR',
    );
  });

  it('sends camera confirmation and device context without private image, face, or battery data', async () => {
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        allowed: true,
        status: 'NoGeoFenceConfigured',
        punchRecorded: true,
        punchId: 42,
      },
    });

    await essApiService.validateAttendancePunch(record);
    await essApiService.punchAttendance(record);

    const expectedPayload = {
      clientRequestId: 'attendance-test',
      action: 'CheckIn',
      latitude: 28.61,
      longitude: 77.2,
      accuracyMeters: 8,
      capturedAt: '2026-07-14T10:00:00.000Z',
      deviceId: 'device-test',
      deviceModel: 'Nothing A063',
      osVersion: 'Android 15',
      networkType: 'wifi',
      appVersion: '1.0.0',
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      reason: '',
    };
    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/ess/attendance/punch/validate',
      expectedPayload,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/ess/attendance/punch',
      expectedPayload,
    );
  });

  it('parses an idempotent replay without creating a new client request id', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        allowed: true,
        punchRecorded: true,
        punchId: 42,
        decision: 'Accepted',
        nextExpectedAction: 'CheckOut',
        idempotentReplay: true,
      },
    });

    await expect(essApiService.punchAttendance(record)).resolves.toEqual({
      punchId: '42',
      decision: 'Accepted',
      nextExpectedAction: 'CheckOut',
      idempotentReplay: true,
      pendingApproval: false,
    });
  });

  it('maps the backend today state used to enable Punch In and Punch Out', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        attendanceDate: '2026-07-16T00:00:00',
        status: 'Present',
        checkInTime: '09:05:00',
        checkOutTime: null,
        totalHours: 0,
        payableValue: 1,
        nextExpectedAction: 'CheckOut',
        approvalPending: false,
        shiftCheckInTime: '09:00:00',
        shiftCheckOutTime: '18:00:00',
        minimumHoursForHalfDay: 4,
        minimumHoursForFullDay: 8,
        maximumHoursAllowedForFullDay: 12,
      },
    });

    await expect(essApiService.getAttendanceToday()).resolves.toEqual({
      attendanceDate: '2026-07-16',
      status: 'Present',
      checkInTime: '09:05:00',
      checkOutTime: undefined,
      totalHours: 0,
      payableValue: 1,
      nextExpectedAction: 'CheckOut',
      approvalPending: false,
      shiftCheckInTime: '09:00:00',
      shiftCheckOutTime: '18:00:00',
      minimumHoursForHalfDay: 4,
      minimumHoursForFullDay: 8,
      maximumHoursAllowedForFullDay: 12,
    });
  });

  it('maps a recorded pending approval as pending instead of accepted', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        allowed: true,
        punchRecorded: true,
        punchId: 43,
        decision: 'pending_approval',
        nextExpectedAction: 'WaitForApproval',
        idempotentReplay: false,
      },
    });

    await expect(essApiService.punchAttendance(record)).resolves.toEqual({
      punchId: '43',
      decision: 'pending_approval',
      nextExpectedAction: 'WaitForApproval',
      idempotentReplay: false,
      pendingApproval: true,
    });
  });

  it.each([
    ['AlreadyCheckedOut', 'ALREADY_CHECKED_OUT'],
    ['ApprovalPending', 'ATTENDANCE_APPROVAL_PENDING'],
    ['ActionNotAllowed', 'ATTENDANCE_ACTION_NOT_ALLOWED'],
    ['AttendanceStateConflict', 'ATTENDANCE_STATE_CONFLICT'],
    ['IdempotencyKeyConflict', 'ATTENDANCE_REQUEST_CONFLICT'],
    ['LocationAccuracyTooLow', 'LOCATION_ACCURACY_LOW'],
    ['ApprovalWorkflowUnavailable', 'ATTENDANCE_APPROVAL_UNAVAILABLE'],
    ['DeviceIdRequired', 'ATTENDANCE_DEVICE_CONTEXT_REQUIRED'],
  ])('maps backend status %s to %s', async (status, expected) => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: { allowed: false, status },
    });

    await expect(essApiService.validateAttendancePunch(record)).rejects.toThrow(expected);
  });
});
