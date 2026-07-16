jest.mock('../src/services/attendanceService', () => ({
  attendanceService: {
    getAttendanceHistory: jest.fn(),
    validateAttendance: jest.fn(),
    markAttendance: jest.fn(),
  },
}));

jest.mock('../src/database/attendanceQueue', () => ({
  attendanceQueue: {
    getAll: jest.fn(),
    getPending: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../src/services/sessionStorage', () => ({
  sessionStorage: {
    getSession: jest.fn(),
    getSelectedClient: jest.fn(),
    getOrCreateDeviceId: jest.fn(() => 'device-test'),
  },
}));

import { attendanceQueue } from '../src/database/attendanceQueue';
import { attendanceRepository } from '../src/repositories/attendanceRepository';
import { attendanceService } from '../src/services/attendanceService';
import { sessionStorage } from '../src/services/sessionStorage';

describe('attendance punch repository outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sessionStorage.getSession as jest.Mock).mockReturnValue({
      client: { code: 'GAD', apiBaseUrl: 'http://tenant.example' },
      employee: { id: 'REC135' },
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
    });
    (sessionStorage.getSelectedClient as jest.Mock).mockReturnValue({
      code: 'GAD',
      apiBaseUrl: 'http://tenant.example',
    });
    (attendanceService.validateAttendance as jest.Mock).mockResolvedValue(undefined);
    (attendanceQueue.getAll as jest.Mock).mockResolvedValue([]);
    (attendanceQueue.upsert as jest.Mock).mockResolvedValue(undefined);
  });

  it('stores pending approval as a synced request, not a confirmed attendance punch', async () => {
    (attendanceService.markAttendance as jest.Mock).mockResolvedValue({
      punchId: '43',
      decision: 'PendingApproval',
      nextExpectedAction: 'WaitForApproval',
      idempotentReplay: false,
      pendingApproval: true,
    });

    const result = await attendanceRepository.createAttendance({
      attendanceType: 'CHECK_IN',
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      employeeId: 'REC135',
      isOnline: true,
      location: { latitude: 28.61, longitude: 77.2, accuracyMeters: 8 },
      networkType: 'wifi',
    });

    expect(result).toMatchObject({
      attendanceDecision: 'PendingApproval',
      attendanceStatus: 'Pending Approval',
      idempotentReplay: false,
      isPunchRecord: false,
      nextExpectedAction: 'WaitForApproval',
      punchId: '43',
      syncStatus: 'SYNCED',
    });
    expect(attendanceQueue.upsert).toHaveBeenCalledWith(result);
  });

  it('queues a temporary server failure without confirming the punch', async () => {
    (attendanceService.markAttendance as jest.Mock).mockRejectedValue(
      new Error('ATTENDANCE_SERVER_ERROR'),
    );

    const result = await attendanceRepository.createAttendance({
      attendanceType: 'CHECK_IN',
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      employeeId: 'REC135',
      isOnline: true,
      location: { latitude: 28.61, longitude: 77.2, accuracyMeters: 8 },
      networkType: 'wifi',
    });

    expect(result).toMatchObject({
      attendanceStatus: 'Pending Sync',
      isPunchRecord: false,
      syncStatus: 'PENDING',
    });
  });

  it('keeps an offline-created punch pending and non-confirmed', async () => {
    const result = await attendanceRepository.createAttendance({
      attendanceType: 'CHECK_IN',
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      employeeId: 'REC135',
      isOnline: false,
      location: { latitude: 28.61, longitude: 77.2, accuracyMeters: 8 },
      networkType: 'none',
    });

    expect(attendanceService.validateAttendance).not.toHaveBeenCalled();
    expect(attendanceService.markAttendance).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attendanceStatus: 'Pending Sync',
      isPunchRecord: false,
      syncStatus: 'PENDING',
    });
    expect(attendanceQueue.upsert).toHaveBeenCalledWith(result);
  });

  it('replays a queued POST directly with the original idempotency id', async () => {
    const queuedRecord = {
      accuracyMeters: 8,
      appVersion: '1.0.0',
      attempts: 1,
      attendanceType: 'CHECK_IN' as const,
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      clientCode: 'GAD',
      deviceId: 'device-test',
      employeeId: 'REC135',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      id: 'att-original-request',
      isPunchRecord: true,
      latitude: 28.61,
      longitude: 77.2,
      networkType: 'wifi',
      syncStatus: 'PENDING' as const,
      timestamp: '2026-07-15T09:30:00.000Z',
    };
    (attendanceQueue.getPending as jest.Mock).mockResolvedValue([queuedRecord]);
    (attendanceService.markAttendance as jest.Mock).mockResolvedValue({
      punchId: '44',
      decision: 'Accepted',
      nextExpectedAction: 'CheckOut',
      idempotentReplay: true,
      pendingApproval: false,
    });

    await expect(attendanceRepository.syncPending()).resolves.toBe(1);

    expect(attendanceService.validateAttendance).not.toHaveBeenCalled();
    expect(attendanceService.markAttendance).toHaveBeenCalledWith(queuedRecord);
    expect(attendanceQueue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceStatus: undefined,
        id: 'att-original-request',
        idempotentReplay: true,
        isPunchRecord: true,
        punchId: '44',
        syncStatus: 'SYNCED',
      }),
    );
  });

  it('does not keep a permanently rejected queued request as an official punch', async () => {
    const queuedRecord = {
      accuracyMeters: 8,
      appVersion: '1.0.0',
      attempts: 1,
      attendanceType: 'CHECK_IN' as const,
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      clientCode: 'GAD',
      deviceId: 'device-test',
      employeeId: 'REC135',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      id: 'att-rejected-request',
      isPunchRecord: true,
      latitude: 28.61,
      longitude: 77.2,
      networkType: 'wifi',
      syncStatus: 'PENDING' as const,
      timestamp: '2026-07-15T09:30:00.000Z',
    };
    (attendanceQueue.getPending as jest.Mock).mockResolvedValue([queuedRecord]);
    (attendanceService.markAttendance as jest.Mock).mockRejectedValue(
      new Error('OUTSIDE_GEOFENCE'),
    );

    await expect(attendanceRepository.syncPending()).resolves.toBe(0);

    expect(attendanceQueue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        attendanceStatus: 'Failed',
        id: 'att-rejected-request',
        isPunchRecord: false,
        syncStatus: 'FAILED',
      }),
    );
  });

  it('keeps the server check-in authoritative while a same-day check-out is pending sync', async () => {
    const remoteCheckIn = {
      accuracyMeters: 8,
      appVersion: '1.0.0',
      attempts: 0,
      attendanceStatus: 'Present',
      attendanceType: 'CHECK_IN' as const,
      cameraCaptureConfirmed: true,
      biometricConfirmed: true,
      clientCode: 'GAD',
      deviceId: 'device-test',
      employeeId: 'REC135',
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
      id: 'daily-2026-07-15',
      isPunchRecord: true,
      latitude: 28.61,
      longitude: 77.2,
      networkType: 'wifi',
      syncStatus: 'SYNCED' as const,
      timestamp: '2026-07-15T09:30:00',
    };
    const pendingCheckOut = {
      ...remoteCheckIn,
      attendanceStatus: 'Pending Sync',
      attendanceType: 'CHECK_OUT' as const,
      id: 'att-pending-checkout',
      isPunchRecord: false,
      syncStatus: 'PENDING' as const,
      timestamp: '2026-07-15T18:00:00.000Z',
    };
    (attendanceService.getAttendanceHistory as jest.Mock).mockResolvedValue([
      remoteCheckIn,
    ]);
    (attendanceQueue.getAll as jest.Mock).mockResolvedValue([pendingCheckOut]);

    await expect(
      attendanceRepository.getAttendanceHistory('REC135', '2026-07'),
    ).resolves.toEqual([
      expect.objectContaining({
        attendanceStatus: 'Pending Sync',
        attendanceType: 'CHECK_IN',
        isPunchRecord: true,
        syncStatus: 'PENDING',
      }),
    ]);
  });
});
