import axios from 'axios';
import { APP_CONFIG } from '../constants/app';
import { attendanceQueue } from '../database/attendanceQueue';
import { attendanceService } from '../services/attendanceService';
import { faceVerificationService } from '../services/faceVerificationService';
import { sessionStorage } from '../services/sessionStorage';
import { AttendanceRecord, AttendanceType } from '../types/domain';
import { createId } from '../utils/id';

type MarkAttendanceInput = {
  employeeId: string;
  attendanceType: AttendanceType;
  location: { latitude: number; longitude: number; accuracyMeters: number };
  imageRef: string;
  networkType: string;
  isOnline: boolean;
};

const isLiveApiEnabled = () => Boolean(APP_CONFIG.apiEnabled && APP_CONFIG.apiBaseUrl);

const isTransientApiError = (error: unknown) =>
  axios.isAxiosError(error) &&
  (!error.response || error.code === 'ECONNABORTED' || [408, 429, 502, 503, 504].includes(error.response.status));

export const attendanceRepository = {
  async createAttendance(input: MarkAttendanceInput) {
    const facialVerification = await faceVerificationService.verifyRegisteredFace(
      input.employeeId,
      input.imageRef,
    );
    if (!facialVerification.passed) {
      throw new Error('FACE_MISMATCH');
    }

    const record: AttendanceRecord = {
      id: createId('att'),
      clientCode:
        sessionStorage.getSelectedClient()?.code ??
        sessionStorage.getSession()?.client?.code ??
        'UNASSIGNED',
      employeeId: input.employeeId,
      timestamp: new Date().toISOString(),
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      accuracyMeters: input.location.accuracyMeters,
      attendanceType: input.attendanceType,
      deviceId: sessionStorage.getOrCreateDeviceId(),
      batteryPercentage: 90,
      appVersion: APP_CONFIG.version,
      capturedImageRef: input.imageRef,
      networkType: input.networkType,
      facialVerification,
      syncStatus: isLiveApiEnabled() && !input.isOnline ? 'PENDING' : 'SYNCED',
      attempts: 0,
    };

    if (input.isOnline && isLiveApiEnabled()) {
      try {
        await attendanceService.validateAttendance(record);
        await attendanceService.markAttendance(record);
        record.syncStatus = 'SYNCED';
      } catch (error) {
        if (!isTransientApiError(error)) {
          throw error;
        }
        record.syncStatus = 'PENDING';
        record.lastAttemptAt = new Date().toISOString();
        record.lastError = error instanceof Error ? error.message : 'ATTENDANCE_API_FAILED';
        record.attempts += 1;
      }
    }

    await attendanceQueue.upsert(record);
    return record;
  },
  async getAttendanceHistory(employeeId: string) {
    const [remote, local] = await Promise.all([
      attendanceService.getAttendanceHistory(employeeId),
      attendanceQueue.getAll(),
    ]);
    const records = [...local.filter(item => item.employeeId === employeeId), ...remote];
    return Array.from(new Map(records.map(record => [record.id, record])).values()).sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  },
  async syncPending() {
    if (!isLiveApiEnabled()) {
      return 0;
    }

    const pendingRecords = await attendanceQueue.getPending();
    let syncedCount = 0;

    for (const record of pendingRecords) {
      try {
        await attendanceService.validateAttendance(record);
        await attendanceService.markAttendance(record);
        await attendanceQueue.upsert({
          ...record,
          syncStatus: 'SYNCED',
          lastAttemptAt: new Date().toISOString(),
        });
        syncedCount += 1;
      } catch (error) {
        await attendanceQueue.upsert({
          ...record,
          syncStatus: isTransientApiError(error) ? 'PENDING' : 'FAILED',
          attempts: record.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : 'ATTENDANCE_SYNC_FAILED',
        });
      }
    }

    return syncedCount;
  },
};
