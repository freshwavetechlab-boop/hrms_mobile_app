import axios, { AxiosResponse } from 'axios';
import { initialLeaveBalances } from '../constants/leave';
import { APP_CONFIG } from '../constants/app';
import {
  AttendanceRecord,
  AttendanceType,
  Employee,
  FaceRegistrationCapture,
  LeaveApplication,
  LeaveStatus,
  LeaveType,
} from '../types/domain';
import { createId } from '../utils/id';
import { apiClient } from './apiClient';
import { imageCompressionService } from './imageCompressionService';
import { sessionStorage } from './sessionStorage';

type ApiObject = Record<string, unknown>;

const assertApiConfigured = () => {
  if (!APP_CONFIG.apiEnabled || !APP_CONFIG.apiBaseUrl) {
    throw new Error('LIVE_API_NOT_CONFIGURED');
  }
};

const isApiConfigured = () => Boolean(APP_CONFIG.apiEnabled && APP_CONFIG.apiBaseUrl);

const isObject = (value: unknown): value is ApiObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unwrap = (response: AxiosResponse<unknown>) => {
  const body = response.data;
  if (!isObject(body)) {
    return body;
  }
  return body.data ?? body.result ?? body.payload ?? body.response ?? body;
};

const getString = (source: ApiObject, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return fallback;
};

const getNumber = (source: ApiObject, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
};

const toArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isObject(payload)) {
    return [];
  }

  const candidates = ['items', 'records', 'rows', 'list', 'requests', 'attendance', 'data', 'result'];
  for (const key of candidates) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

const normalizeLeaveType = (value: unknown): LeaveType => {
  const text = String(value ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (text.includes('maternity')) {
    return 'MATERNITY';
  }
  if (text.includes('lop') || text.includes('lossofpay') || text.includes('unpaid')) {
    return 'LOSS_OF_PAY';
  }
  return 'CASUAL_LEAVE';
};

const normalizeLeaveStatus = (value: unknown): LeaveStatus => {
  const text = String(value ?? '').toUpperCase();
  if (text.includes('APPROV')) {
    return 'APPROVED';
  }
  if (text.includes('REJECT')) {
    return 'REJECTED';
  }
  return 'PENDING';
};

const normalizeAttendanceType = (value: unknown): AttendanceType => {
  const text = String(value ?? '').toUpperCase();
  return text.includes('OUT') ? 'CHECK_OUT' : 'CHECK_IN';
};

const mapEmployee = (payload: unknown, fallback: Employee): Employee => {
  const source = isObject(payload) ? payload : {};
  const firstName = getString(source, ['firstName']);
  const lastName = getString(source, ['lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return {
    id: getString(source, ['employeeId', 'employeeCode', 'empCode', 'code', 'id'], fallback.id),
    name: getString(source, ['employeeName', 'fullName', 'name'], fullName || fallback.name),
    email: getString(source, ['workEmail', 'email', 'officialEmail', 'emailId'], fallback.email),
    department: getString(source, ['department', 'departmentName'], fallback.department),
    designation: getString(source, ['designation', 'designationName', 'role'], fallback.designation),
    manager: getString(source, ['manager', 'reportingManager', 'reportingManagerName'], fallback.manager),
    avatarUrl: getString(source, ['avatarUrl', 'profileImage', 'photoUrl'], fallback.avatarUrl),
  };
};

const mapLeaveBalances = (payload: unknown) => {
  const balances: Record<LeaveType, number> = { ...initialLeaveBalances };
  const codes: Partial<Record<LeaveType, string>> = {};
  const allowHalfDay: Partial<Record<LeaveType, boolean>> = {};

  if (isObject(payload)) {
    const directKeys: Array<[LeaveType, string[]]> = [
      ['CASUAL_LEAVE', ['CASUAL_LEAVE', 'casualLeave', 'casual', 'cl']],
      ['LOSS_OF_PAY', ['LOSS_OF_PAY', 'lossOfPay', 'lop']],
      ['MATERNITY', ['MATERNITY', 'maternity', 'ml']],
    ];
    directKeys.forEach(([type, keys]) => {
      const value = getNumber(payload, keys, Number.NaN);
      if (Number.isFinite(value)) {
        balances[type] = value;
      }
    });
  }

  toArray(payload).forEach(item => {
    if (!isObject(item)) {
      return;
    }
    const type = normalizeLeaveType(
      item.leaveType ?? item.type ?? item.leaveName ?? item.name ?? item.leaveCode ?? item.code,
    );
    codes[type] = getString(item, ['leaveCode', 'code'], codes[type]);
    if (typeof item.allowHalfDay === 'boolean') {
      allowHalfDay[type] = item.allowHalfDay;
    }
    balances[type] = getNumber(
      item,
      ['balance', 'availableBalance', 'available', 'remaining', 'days', 'leaveBalance'],
      balances[type],
    );
  });

  return { balances, codes, allowHalfDay };
};

const mapLeaveApplication = (
  payload: unknown,
  fallbackEmployeeId: string,
): LeaveApplication | undefined => {
  if (!isObject(payload)) {
    return undefined;
  }
  const fromDate = getString(payload, ['fromDate', 'startDate', 'from', 'dateFrom']);
  const toDate = getString(payload, ['toDate', 'endDate', 'to', 'dateTo'], fromDate);
  if (!fromDate) {
    return undefined;
  }
  return {
    id: getString(payload, ['id', 'requestId', 'leaveRequestId'], createId('leave')),
    employeeId: getString(payload, ['employeeId', 'employeeCode'], fallbackEmployeeId),
    leaveType: normalizeLeaveType(
      payload.leaveType ?? payload.type ?? payload.leaveName ?? payload.leaveCode,
    ),
    leaveCode: getString(payload, ['leaveCode', 'code']),
    dayType: getString(payload, ['dayType'], 'Full Day') as LeaveApplication['dayType'],
    fromDate,
    toDate,
    days: getNumber(payload, ['days', 'noOfDays', 'leaveDays'], 1),
    reason: getString(payload, ['reason', 'remarks', 'description']),
    status: normalizeLeaveStatus(payload.status ?? payload.workflowStatus),
    appliedAt: getString(payload, ['appliedAt', 'createdAt', 'requestDate'], new Date().toISOString()),
  };
};

const mapAttendanceRecord = (
  payload: unknown,
  fallbackEmployeeId: string,
): AttendanceRecord | undefined => {
  if (!isObject(payload)) {
    return undefined;
  }

  const attendanceDate = getString(payload, ['attendanceDate', 'date']);
  const checkInTime = getString(payload, ['checkInTime']);
  const checkOutTime = getString(payload, ['checkOutTime']);
  const punchTimestamp = getString(
    payload,
    ['timestamp', 'punchTime', 'attendanceDateTime', 'createdAt'],
  );
  const timestamp =
    punchTimestamp ||
    (attendanceDate
      ? `${attendanceDate.slice(0, 10)}T${(checkOutTime || checkInTime || '00:00:00').slice(0, 8)}`
      : '');
  if (!timestamp) {
    return undefined;
  }

  return {
    id: getString(payload, ['id', 'attendanceId', 'punchId'], `daily-${timestamp}`),
    clientCode:
      sessionStorage.getSelectedClient()?.code ??
      sessionStorage.getSession()?.client?.code ??
      'UNASSIGNED',
    employeeId: getString(payload, ['employeeId', 'employeeCode'], fallbackEmployeeId),
    timestamp,
    latitude: getNumber(payload, ['latitude', 'lat']),
    longitude: getNumber(payload, ['longitude', 'lng', 'lon']),
    accuracyMeters: getNumber(payload, ['accuracyMeters', 'deviceAccuracyMeters']),
    attendanceType: checkOutTime
      ? 'CHECK_OUT'
      : normalizeAttendanceType(payload.action ?? payload.attendanceType ?? payload.punchType ?? payload.type),
    deviceId: getString(payload, ['deviceId'], sessionStorage.getOrCreateDeviceId()),
    batteryPercentage: getNumber(payload, ['batteryPercentage', 'battery'], 0),
    appVersion: APP_CONFIG.version,
    capturedImageRef: getString(payload, ['capturedImageRef', 'selfieRef', 'imageRef']),
    networkType: getString(payload, ['networkType'], 'unknown'),
    facialVerification: {
      passed: true,
      provider: 'backend-history',
      referenceId: getString(payload, ['faceReferenceId', 'referenceId']),
    },
    syncStatus: 'SYNCED',
    attempts: 0,
  };
};

const assertApiAccepted = (payload: unknown) => {
  if (!isObject(payload)) {
    return;
  }
  const success = payload.success ?? payload.isSuccess;
  const status = String(payload.status ?? payload.result ?? '').toLowerCase();
  if (success === false || status.includes('fail') || status.includes('error')) {
    throw new Error(getString(payload, ['message', 'error'], 'API_REQUEST_FAILED'));
  }
};

const attendanceErrorCode = (payload: ApiObject) => {
  const status = getString(payload, ['status']);
  if (status === 'OutsideFence') return 'OUTSIDE_GEOFENCE';
  if (status === 'FacialVerificationFailed') return 'FACE_MISMATCH';
  if (status === 'FacialVerificationRequired') return 'FACE_API_NOT_CONFIGURED';
  if (status === 'ReasonRequired' || payload.requiresReason === true) return 'ATTENDANCE_REASON_REQUIRED';
  if (status === 'AlreadyCheckedIn') return 'ALREADY_CHECKED_IN';
  if (status === 'CheckInRequired') return 'CHECK_IN_REQUIRED';
  return getString(payload, ['message', 'error'], 'ATTENDANCE_API_REJECTED');
};

const assertAttendanceAccepted = (payload: unknown, requireRecorded = false) => {
  if (!isObject(payload)) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }
  if (payload.allowed !== true || (requireRecorded && payload.punchRecorded !== true)) {
    throw new Error(attendanceErrorCode(payload));
  }
  if (payload.requiresReason === true) {
    throw new Error('ATTENDANCE_REASON_REQUIRED');
  }
  return payload;
};

const normalizeAttendanceApiError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }
  const payload = error.response.data;
  return new Error(isObject(payload) ? attendanceErrorCode(payload) : 'ATTENDANCE_API_REJECTED');
};

const attendancePayload = (record: AttendanceRecord) => ({
  action: record.attendanceType === 'CHECK_IN' ? 'CheckIn' : 'CheckOut',
  latitude: record.latitude,
  longitude: record.longitude,
  accuracyMeters: record.accuracyMeters,
  capturedAt: record.timestamp,
  reason: '',
  facial: {
    passed: record.facialVerification.passed,
    faceMatchScore: record.facialVerification.faceMatchScore,
    livenessScore: record.facialVerification.livenessScore,
    provider: record.facialVerification.provider,
    referenceId: record.facialVerification.referenceId,
  },
});

const currentPayrollMonth = () => new Date().toISOString().slice(0, 7);

const faceEnrollmentAngles = ['FRONT', 'LEFT', 'RIGHT'] as const;

const apiFaceAngle = (angle: FaceRegistrationCapture['angle']) => angle.toLowerCase();

export type FaceEnrollmentResponse = {
  registered: true;
  status: string;
  captureCount: number;
  angles: string[];
  templateVersion: number;
  requestId: string;
};

const normalizeFaceEnrollmentError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  if (!error.response) {
    return new Error('FACE_ENROLLMENT_NETWORK_FAILED');
  }
  const payload = error.response.data;
  const message = isObject(payload)
    ? getString(payload, ['message', 'error', 'detail'])
    : String(payload ?? '');
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes('no face') ||
    normalizedMessage.includes('multiple face') ||
    normalizedMessage.includes('quality') ||
    normalizedMessage.includes('confidence')
  ) {
    return new Error('FACE_QUALITY_REJECTED');
  }
  return new Error('FACE_ENROLLMENT_API_FAILED');
};

export const essApiService = {
  isConfigured() {
    return isApiConfigured();
  },
  async getProfile(fallback: Employee) {
    assertApiConfigured();
    const payload = unwrap(await apiClient.get('/api/ess/profile'));
    return mapEmployee(payload, fallback);
  },
  async registerFaceEnrollment(input: {
    clientCode: string;
    employeeId: string;
    deviceId: string;
    captures: FaceRegistrationCapture[];
  }): Promise<FaceEnrollmentResponse> {
    assertApiConfigured();
    const capturesByAngle = new Map(input.captures.map(capture => [capture.angle, capture]));
    const orderedCaptures = faceEnrollmentAngles.map(angle => capturesByAngle.get(angle));
    if (orderedCaptures.some(capture => !capture)) {
      throw new Error('FACE_CAPTURE_SET_INCOMPLETE');
    }

    const requestId = createId('face_enrollment');
    try {
      const enrollmentImages = await Promise.all(
        orderedCaptures.map(async capture => ({
          angle: apiFaceAngle(capture!.angle),
          image: {
            kind: 'base64_jpeg' as const,
            data: await imageCompressionService.enrollmentSelfieToBase64(capture!.imageRef),
          },
        })),
      );
      const response = await apiClient.post(APP_CONFIG.faceRegistrationEndpoint, {
        request_id: requestId,
        enrollment_images: enrollmentImages,
        face_selector: 'largest',
        quality_policy: {
          reject_if_no_face: true,
          reject_if_multiple_faces: true,
          min_detection_confidence: 0.85,
        },
      });
      const payload = unwrap(response);
      if (!isObject(payload) || payload.registered !== true) {
        throw new Error('FACE_ENROLLMENT_REJECTED');
      }
      return {
        registered: true,
        status: getString(payload, ['status']),
        captureCount: getNumber(payload, ['capture_count', 'captureCount']),
        angles: Array.isArray(payload.angles)
          ? payload.angles.filter((angle): angle is string => typeof angle === 'string')
          : [],
        templateVersion: getNumber(payload, ['template_version', 'templateVersion']),
        requestId,
      };
    } catch (error) {
      throw normalizeFaceEnrollmentError(error);
    }
  },
  async getLeaveBalances() {
    assertApiConfigured();
    const payload = unwrap(await apiClient.get('/api/ess/leave/balances'));
    return mapLeaveBalances(payload);
  },
  async getLeaveRequests(employeeId: string) {
    assertApiConfigured();
    const payload = unwrap(await apiClient.get('/api/ess/leave/requests'));
    return toArray(payload)
      .map(item => mapLeaveApplication(item, employeeId))
      .filter((item): item is LeaveApplication => Boolean(item));
  },
  async createLeaveRequest(input: Omit<LeaveApplication, 'id' | 'status' | 'appliedAt'>) {
    assertApiConfigured();
    const payload = unwrap(
      await apiClient.post('/api/ess/leave/requests', {
        leaveCode: input.leaveCode,
        fromDate: input.fromDate,
        toDate: input.toDate,
        dayType: input.dayType ?? 'Full Day',
        reason: input.reason,
      }),
    );
    assertApiAccepted(payload);
    return mapLeaveApplication(payload, input.employeeId);
  },
  async getAttendanceHistory(employeeId: string) {
    assertApiConfigured();
    const payload = unwrap(
      await apiClient.get('/api/ess/dashboard/attendance/daily', {
        params: { month: currentPayrollMonth() },
      }),
    );
    return toArray(payload)
      .map(item => mapAttendanceRecord(item, employeeId))
      .filter((item): item is AttendanceRecord => Boolean(item));
  },
  async getAttendanceSummary(employeeId: string) {
    assertApiConfigured();
    const payload = unwrap(
      await apiClient.get('/api/ess/dashboard/attendance', {
        params: { month: currentPayrollMonth() },
      }),
    );
    const directRecord = mapAttendanceRecord(payload, employeeId);
    if (directRecord) {
      return [directRecord];
    }
    return toArray(payload)
      .map(item => mapAttendanceRecord(item, employeeId))
      .filter((item): item is AttendanceRecord => Boolean(item));
  },
  async validateAttendancePunch(record: AttendanceRecord) {
    assertApiConfigured();
    try {
      const payload = unwrap(
        await apiClient.post('/api/ess/attendance/punch/validate', attendancePayload(record)),
      );
      return assertAttendanceAccepted(payload);
    } catch (error) {
      throw normalizeAttendanceApiError(error);
    }
  },
  async punchAttendance(record: AttendanceRecord) {
    assertApiConfigured();
    try {
      const payload = unwrap(await apiClient.post('/api/ess/attendance/punch', attendancePayload(record)));
      const accepted = assertAttendanceAccepted(payload, true);
      return {
        remoteId: getString(accepted, ['id', 'attendanceId', 'punchId'], record.id),
      };
    } catch (error) {
      throw normalizeAttendanceApiError(error);
    }
  },
  async getHolidays() {
    assertApiConfigured();
    const payload = unwrap(
      await apiClient.get('/api/ess/dashboard/holidays', {
        params: { month: currentPayrollMonth() },
      }),
    );
    return toArray(payload)
      .map(item => (isObject(item) ? getString(item, ['name', 'title', 'holidayName']) : String(item)))
      .filter(Boolean);
  },
};
