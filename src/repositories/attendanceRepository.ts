import axios from 'axios';
import { Platform } from 'react-native';
import { APP_CONFIG } from '../constants/app';
import { attendanceQueue } from '../database/attendanceQueue';
import { attendanceService } from '../services/attendanceService';
import { sessionStorage } from '../services/sessionStorage';
import {
  AttendancePeriodScope,
  AttendancePunchResult,
  AttendanceRecord,
  AttendanceTodayState,
  AttendanceType,
} from '../types/domain';
import { createId } from '../utils/id';
import { formatIsoDateKey, formatIsoMonthKey } from '../utils/time';

type MarkAttendanceInput = {
  employeeId: string;
  attendanceType: AttendanceType;
  location: { latitude: number; longitude: number; accuracyMeters: number };
  cameraCaptureConfirmed: boolean;
  biometricConfirmed: boolean;
  reason?: string;
  networkType: string;
  isOnline: boolean;
};

const isLiveApiEnabled = () =>
  Boolean(
    sessionStorage.getSelectedClient()?.apiBaseUrl ??
      sessionStorage.getSession()?.client.apiBaseUrl,
  );

const isTransientApiError = (error: unknown) =>
  (error instanceof Error && error.message === 'ATTENDANCE_SERVER_ERROR') ||
  (axios.isAxiosError(error) &&
    (!error.response ||
      error.code === 'ECONNABORTED' ||
      [408, 429, 502, 503, 504].includes(error.response.status)));

let syncInFlight: Promise<number> | undefined;

type DevicePlatformConstants = {
  Brand?: string;
  Manufacturer?: string;
  Model?: string;
  Release?: string;
};

const currentDeviceMetadata = () => {
  const constants = Platform.constants as unknown as DevicePlatformConstants;
  const manufacturer = (constants.Manufacturer || constants.Brand || '').trim();
  const model = (constants.Model || '').trim();
  return {
    deviceModel: [manufacturer, model].filter(Boolean).join(' ') || 'Unknown device',
    osVersion: `${Platform.OS === 'android' ? 'Android' : 'iOS'} ${constants.Release || String(Platform.Version)}`,
  };
};

const applyPunchResult = (
  record: AttendanceRecord,
  result: AttendancePunchResult,
): AttendanceRecord => ({
  ...record,
  attendanceDecision: result.decision,
  attendanceStatus: result.pendingApproval ? 'Pending Approval' : undefined,
  punchId: result.punchId,
  nextExpectedAction: result.nextExpectedAction,
  idempotentReplay: result.idempotentReplay,
  // A pending audit punch must not advance the app's confirmed CheckIn/CheckOut
  // state. The backend is still waiting for an approver's decision.
  isPunchRecord: !result.pendingApproval,
});

const mergeAttendanceRecords = (
  remoteRecords: AttendanceRecord[],
  localRecords: AttendanceRecord[],
) => {
  const remoteDates = new Set(
    remoteRecords.map(record => formatIsoDateKey(record.timestamp)),
  );
  const mergedRemote = remoteRecords.map(record => {
    const localPunch = localRecords.find(
      item => formatIsoDateKey(item.timestamp) === formatIsoDateKey(record.timestamp),
    );
    if (!localPunch) {
      return record;
    }
    // The server's daily row remains the confirmed attendance state. Keep a
    // local retry visible without allowing it to replace that confirmed punch.
    if (localPunch.syncStatus === 'PENDING') {
      return {
        ...record,
        attendanceStatus: 'Pending Sync',
        syncStatus: 'PENDING' as const,
        attempts: localPunch.attempts,
        lastAttemptAt: localPunch.lastAttemptAt,
        lastError: localPunch.lastError,
      };
    }
    return {
      ...localPunch,
      id: record.id,
      attendanceStatus: record.attendanceStatus,
      payableValue: record.payableValue,
      remarks: record.remarks,
    };
  });
  const localOnly = localRecords.filter(
    record => !remoteDates.has(formatIsoDateKey(record.timestamp)),
  );
  return [...localOnly, ...mergedRemote].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
};

export const attendanceRepository = {
  async createAttendance(input: MarkAttendanceInput) {
    const session = sessionStorage.getSession();
    if (!session) {
      throw new Error('SESSION_EXPIRED');
    }
    const pendingSync = isLiveApiEnabled() && !input.isOnline;
    const deviceMetadata = currentDeviceMetadata();
    const record: AttendanceRecord = {
      id: createId('att'),
      clientCode:
        sessionStorage.getSelectedClient()?.code ??
        sessionStorage.getSession()?.client?.code ??
        'UNASSIGNED',
      employeeId: input.employeeId,
      hrmsClientId: session.hrmsClientId,
      hrmsEmployeeId: session.hrmsEmployeeId,
      timestamp: new Date().toISOString(),
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      accuracyMeters: input.location.accuracyMeters,
      attendanceType: input.attendanceType,
      deviceId: sessionStorage.getOrCreateDeviceId(),
      deviceModel: deviceMetadata.deviceModel,
      osVersion: deviceMetadata.osVersion,
      appVersion: APP_CONFIG.version,
      cameraCaptureConfirmed: input.cameraCaptureConfirmed,
      biometricConfirmed: input.biometricConfirmed,
      reason: input.reason?.trim() || undefined,
      attendanceStatus: pendingSync ? 'Pending Sync' : undefined,
      isPunchRecord: !pendingSync,
      networkType: input.networkType,
      syncStatus: pendingSync ? 'PENDING' : 'SYNCED',
      attempts: 0,
    };

    if (input.isOnline && isLiveApiEnabled()) {
      try {
        await attendanceService.validateAttendance(record);
        const result = await attendanceService.markAttendance(record);
        Object.assign(record, applyPunchResult(record, result));
        record.syncStatus = 'SYNCED';
      } catch (error) {
        if (!isTransientApiError(error)) {
          throw error;
        }
        record.syncStatus = 'PENDING';
        record.attendanceStatus = 'Pending Sync';
        record.isPunchRecord = false;
        record.lastAttemptAt = new Date().toISOString();
        record.lastError = error instanceof Error ? error.message : 'ATTENDANCE_API_FAILED';
        record.attempts += 1;
      }
    }

    await attendanceQueue.upsert(record);
    return record;
  },
  async getAttendanceHistory(employeeId: string, month: string) {
    const session = sessionStorage.getSession();
    const [remote, local] = await Promise.all([
      attendanceService.getAttendanceHistory(employeeId, month),
      attendanceQueue.getAll(),
    ]);
    const localRecords = local
      .filter(
        item =>
          item.syncStatus !== 'FAILED' &&
          item.employeeId === employeeId &&
          item.hrmsClientId === session?.hrmsClientId &&
          item.hrmsEmployeeId === session?.hrmsEmployeeId &&
          formatIsoMonthKey(item.timestamp) === month,
      )
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );
    return mergeAttendanceRecords(remote, localRecords);
  },
  async getAttendanceToday(employeeId: string): Promise<AttendanceTodayState> {
    const session = sessionStorage.getSession();
    const [remote, local] = await Promise.all([
      attendanceService.getAttendanceToday(),
      attendanceQueue.getAll(),
    ]);
    const syncPending = local.some(
      record =>
        record.syncStatus === 'PENDING' &&
        record.employeeId === employeeId &&
        record.hrmsClientId === session?.hrmsClientId &&
        record.hrmsEmployeeId === session?.hrmsEmployeeId &&
        formatIsoDateKey(record.timestamp) === remote.attendanceDate.slice(0, 10),
    );
    return { ...remote, syncPending };
  },
  async getAttendancePeriod(
    employeeId: string,
    month: string,
    scope: AttendancePeriodScope,
  ) {
    const session = sessionStorage.getSession();
    const [remotePeriod, local] = await Promise.all([
      attendanceService.getAttendancePeriod(employeeId, month, scope),
      attendanceQueue.getAll(),
    ]);
    const localRecords = local
      .filter(item => {
        const date = formatIsoDateKey(item.timestamp);
        return (
          item.syncStatus !== 'FAILED' &&
          item.employeeId === employeeId &&
          item.hrmsClientId === session?.hrmsClientId &&
          item.hrmsEmployeeId === session?.hrmsEmployeeId &&
          date >= remotePeriod.fromDate &&
          date <= remotePeriod.toDate
        );
      })
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

    return {
      ...remotePeriod,
      records: mergeAttendanceRecords(remotePeriod.records, localRecords),
    };
  },
  async syncPending() {
    if (syncInFlight) {
      return syncInFlight;
    }
    syncInFlight = (async () => {
      if (!isLiveApiEnabled()) {
        return 0;
      }

      const session = sessionStorage.getSession();
      if (!session) {
        return 0;
      }
      const queuedRecords = await attendanceQueue.getPending();
      const legacyRecords = queuedRecords.filter(
        record => !record.hrmsClientId || !record.hrmsEmployeeId,
      );
      for (const record of legacyRecords) {
        await attendanceQueue.upsert({
          ...record,
          syncStatus: 'FAILED',
          attempts: record.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: 'LEGACY_QUEUE_IDENTITY_MISSING',
        });
      }
      const pendingRecords = queuedRecords.filter(
        record =>
          record.clientCode === session.client.code &&
          record.employeeId === session.employee.id &&
          record.hrmsClientId === session.hrmsClientId &&
          record.hrmsEmployeeId === session.hrmsEmployeeId,
      );
      let syncedCount = 0;

      for (const record of pendingRecords) {
        try {
          // POST is authoritative and idempotent by record.id. A validation
          // preflight here could reject a retry after the first POST reached
          // the server but its response was lost.
          const result = await attendanceService.markAttendance(record);
          await attendanceQueue.upsert({
            ...applyPunchResult(record, result),
            syncStatus: 'SYNCED',
            lastAttemptAt: new Date().toISOString(),
          });
          syncedCount += 1;
        } catch (error) {
          const transient = isTransientApiError(error);
          await attendanceQueue.upsert({
            ...record,
            attendanceStatus: transient ? record.attendanceStatus : 'Failed',
            isPunchRecord: transient ? record.isPunchRecord : false,
            syncStatus: transient ? 'PENDING' : 'FAILED',
            attempts: record.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: error instanceof Error ? error.message : 'ATTENDANCE_SYNC_FAILED',
          });
        }
      }

      return syncedCount;
    })();
    try {
      return await syncInFlight;
    } finally {
      syncInFlight = undefined;
    }
  },
};
