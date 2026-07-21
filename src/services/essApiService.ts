import axios, { AxiosResponse } from 'axios';
import { APP_CONFIG } from '../constants/app';
import {
  AttendancePeriodResponse,
  AttendancePeriodScope,
  AttendancePunchResult,
  AttendanceRecord,
  AttendanceTodayState,
  AttendanceType,
  Employee,
  EmployeeSelfProfile,
  FaceRegistrationCapture,
  Holiday,
  LeaveApplication,
  LeaveBalance,
  LeaveStatus,
  LeaveType,
  Payslip,
  PayslipDocument,
  SaveEmployeeSelfProfileRequest,
} from '../types/domain';
import { createId } from '../utils/id';
import { apiClient } from './apiClient';
import { imageCompressionService } from './imageCompressionService';
import { sessionStorage } from './sessionStorage';

type ApiObject = Record<string, unknown>;

const assertApiConfigured = () => {
  const client = sessionStorage.getSelectedClient() ?? sessionStorage.getSession()?.client;
  if (!client?.apiBaseUrl) {
    throw new Error('LIVE_API_NOT_CONFIGURED');
  }
};

const isApiConfigured = () => {
  const client = sessionStorage.getSelectedClient() ?? sessionStorage.getSession()?.client;
  return Boolean(client?.apiBaseUrl);
};

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

// Editable fields are allowed to be cleared. Unlike getString(), this helper
// returns the first string property even when its value is empty.
const getEditableString = (source: ApiObject, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      return value.trim();
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

const getBoolean = (source: ApiObject, keys: string[], fallback = false) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
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

const leaveTypeKey = (leaveCode: unknown, leaveType?: unknown): LeaveType => {
  const normalizedCode = String(leaveCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const normalizedName = String(leaveType ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalizedCode || normalizedName;
};

const normalizeLeaveStatus = (value: unknown): LeaveStatus => {
  const text = String(value ?? '').trim().toUpperCase();
  if (text.includes('REJECT')) {
    return 'REJECTED';
  }
  if (text.includes('SENT BACK') || text.includes('RETURN')) {
    return 'RETURNED';
  }
  // "Pending Approval" contains the word "Approval", so pending must be
  // checked before approved.
  if (
    text.includes('PENDING') ||
    text.includes('AWAIT') ||
    text.includes('SUBMIT') ||
    text.includes('IN PROGRESS')
  ) {
    return 'PENDING';
  }
  if (text.includes('APPROVED')) {
    return 'APPROVED';
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
    dateOfJoining: getString(source, ['dateOfJoining', 'joiningDate'], fallback.dateOfJoining),
    workLocation: getString(source, ['workLocation', 'workLocationName'], fallback.workLocation),
    attendanceOffice: getString(source, ['attendanceOffice', 'geoFenceOffice', 'officeLocation'], fallback.attendanceOffice),
    avatarUrl: getString(source, ['avatarUrl', 'profileImage', 'photoUrl'], fallback.avatarUrl),
  };
};

const mapEmployeeSelfProfile = (payload: unknown): EmployeeSelfProfile => {
  if (!isObject(payload)) {
    throw new Error('ESS_PROFILE_INVALID');
  }

  return {
    clientId: getNumber(payload, ['clientId', 'ClientId']),
    employeeCode: getEditableString(payload, ['employeeCode', 'EmployeeCode']),
    firstName: getEditableString(payload, ['firstName', 'FirstName']),
    lastName: getEditableString(payload, ['lastName', 'LastName']),
    workEmail: getEditableString(payload, ['workEmail', 'WorkEmail']),
    dateOfBirth: getEditableString(payload, ['dateOfBirth', 'DateOfBirth']).slice(0, 10),
    mobile: getEditableString(payload, ['mobile', 'Mobile']),
    panNumber: getEditableString(payload, ['panNumber', 'PanNumber']),
    aadhaarNumber: getEditableString(payload, ['aadhaarNumber', 'AadhaarNumber']),
    address: getEditableString(payload, ['address', 'Address']),
    correspondenceAddress: getEditableString(
      payload,
      ['correspondenceAddress', 'CorrespondenceAddress'],
    ),
    permanentAddress: getEditableString(payload, ['permanentAddress', 'PermanentAddress']),
    city: getEditableString(payload, ['city', 'City']),
    district: getEditableString(payload, ['district', 'District']),
    state: getEditableString(payload, ['state', 'State']),
    bankName: getEditableString(payload, ['bankName', 'BankName']),
    bankAccountNo: getEditableString(payload, ['bankAccountNo', 'BankAccountNo']),
    ifscCode: getEditableString(payload, ['ifscCode', 'IfscCode']),
    paymentMode: getEditableString(payload, ['paymentMode', 'PaymentMode']),
    department: getEditableString(payload, ['department', 'Department']),
    designation: getEditableString(payload, ['designation', 'Designation']),
    dateOfJoining: getEditableString(payload, ['dateOfJoining', 'DateOfJoining']).slice(0, 10),
    workLocation: getEditableString(payload, ['workLocation', 'WorkLocation']),
    attendanceOffice: getEditableString(payload, ['attendanceOffice', 'AttendanceOffice']),
    reportingManager: getEditableString(payload, ['reportingManager', 'ReportingManager']),
    canEdit: getBoolean(payload, ['canEdit', 'CanEdit']),
    travelExpenseEnabled: getBoolean(
      payload,
      ['travelExpenseEnabled', 'TravelExpenseEnabled'],
    ),
  };
};

export const employeeFromSelfProfile = (
  profile: EmployeeSelfProfile,
  fallback: Employee,
): Employee => ({
  ...fallback,
  id: profile.employeeCode || fallback.id,
  name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || fallback.name,
  email: profile.workEmail,
  department: profile.department,
  designation: profile.designation,
  manager: profile.reportingManager,
  dateOfJoining: profile.dateOfJoining,
  workLocation: profile.workLocation,
  attendanceOffice: profile.attendanceOffice,
});

const normalizeProfileApiError = (error: unknown, operation: 'load' | 'save') => {
  if (!axios.isAxiosError(error)) {
    return error;
  }
  if (error.code === 'ECONNABORTED') {
    return new Error('REQUEST_TIMEOUT');
  }
  if (!error.response) {
    return new Error('NETWORK_UNAVAILABLE');
  }

  const status = error.response.status;
  const payload = error.response.data;
  const message = isObject(payload)
    ? getString(payload, ['error', 'message', 'detail'])
    : typeof payload === 'string'
      ? payload
      : '';
  const normalized = message.toLowerCase();

  if (status === 401) return new Error('SESSION_EXPIRED');
  if (status === 403) return new Error('PROFILE_ACCESS_DENIED');
  if (status === 404) return new Error('ESS_PROFILE_REQUIRED');
  if (status >= 500) return new Error('SERVER_UNAVAILABLE');
  if (normalized.includes('self-update is not enabled')) {
    return new Error('PROFILE_EDIT_DISABLED');
  }
  if (normalized.includes('valid email')) {
    return new Error('PROFILE_EMAIL_INVALID');
  }
  return new Error(message || (operation === 'load' ? 'PROFILE_LOAD_FAILED' : 'PROFILE_UPDATE_FAILED'));
};

const mapLeaveBalances = (payload: unknown) => {
  const balances: Record<LeaveType, number> = {};
  const codes: Partial<Record<LeaveType, string>> = {};
  const allowHalfDay: Partial<Record<LeaveType, boolean>> = {};
  const availableTypes = new Map<LeaveType, LeaveBalance>();
  let items = toArray(payload);

  if (items.length === 0 && isObject(payload)) {
    const isSingleBalance = ['leaveCode', 'code', 'leaveType', 'leaveName'].some(
      key => payload[key] !== undefined,
    );
    items = isSingleBalance
      ? [payload]
      : Object.entries(payload)
          .filter(([, value]) =>
            typeof value === 'number' ||
            (typeof value === 'string' && Number.isFinite(Number(value))),
          )
          .map(([code, balance]) => ({ leaveCode: code, leaveType: code, balance }));
  }

  items.forEach(item => {
    if (!isObject(item)) {
      return;
    }
    const rawCode = getString(item, ['leaveCode', 'code']);
    const rawType = getString(item, ['leaveType', 'leaveName', 'name', 'type']);
    const key = leaveTypeKey(rawCode, rawType);
    if (!key) {
      return;
    }
    const leaveCode = rawCode || key;
    const leaveType = rawType || leaveCode;
    const balance = getNumber(
      item,
      ['balance', 'availableBalance', 'available', 'remaining', 'days', 'leaveBalance'],
      0,
    );
    const canUseHalfDay =
      typeof item.allowHalfDay === 'boolean' ? item.allowHalfDay : true;
    const balanceDate = getString(item, ['balanceDate', 'asOfDate', 'date']);

    balances[key] = balance;
    codes[key] = leaveCode;
    allowHalfDay[key] = canUseHalfDay;
    availableTypes.set(key, {
      key,
      leaveCode,
      leaveType,
      balance,
      balanceDate: balanceDate || undefined,
      allowHalfDay: canUseHalfDay,
    });
  });

  return { balances, codes, allowHalfDay, availableTypes: [...availableTypes.values()] };
};

const mapLeaveApplication = (
  payload: unknown,
  fallbackEmployeeId: string,
): LeaveApplication | undefined => {
  if (!isObject(payload)) {
    return undefined;
  }
  const rawFromDate = getString(payload, ['fromDate', 'startDate', 'from', 'dateFrom']);
  const rawToDate = getString(payload, ['toDate', 'endDate', 'to', 'dateTo'], rawFromDate);
  if (!rawFromDate) {
    return undefined;
  }
  const fromDate = rawFromDate.slice(0, 10);
  const toDate = rawToDate.slice(0, 10);
  const leaveCode = getString(payload, ['leaveCode', 'code']);
  const leaveTypeName = getString(
    payload,
    ['leaveType', 'leaveName', 'name', 'type'],
    leaveCode,
  );
  return {
    id: getString(payload, ['id', 'requestId', 'leaveRequestId'], createId('leave')),
    employeeId: getString(payload, ['employeeId', 'employeeCode'], fallbackEmployeeId),
    leaveType: leaveTypeKey(leaveCode, leaveTypeName),
    leaveTypeName,
    leaveCode,
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
  const hasRecordedPunch = Boolean(checkInTime || checkOutTime);
  const cameraCaptureConfirmed = getBoolean(
    payload,
    ['cameraCaptureConfirmed', 'cameraConfirmed'],
    false,
  );
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
    hrmsClientId: sessionStorage.getSession()?.hrmsClientId,
    hrmsEmployeeId: sessionStorage.getSession()?.hrmsEmployeeId,
    timestamp,
    latitude: getNumber(payload, ['latitude', 'lat']),
    longitude: getNumber(payload, ['longitude', 'lng', 'lon']),
    accuracyMeters: getNumber(payload, ['accuracyMeters', 'deviceAccuracyMeters']),
    attendanceType: checkOutTime
      ? 'CHECK_OUT'
      : normalizeAttendanceType(payload.action ?? payload.attendanceType ?? payload.punchType ?? payload.type),
    attendanceStatus: getString(payload, ['status', 'attendanceStatus']),
    payableValue: getNumber(payload, ['payableValue'], 0),
    remarks: getString(payload, ['remarks']),
    deviceId: getString(payload, ['deviceId'], sessionStorage.getOrCreateDeviceId()),
    deviceModel: getString(payload, ['deviceModel']) || undefined,
    osVersion: getString(payload, ['osVersion']) || undefined,
    appVersion: getString(payload, ['appVersion'], APP_CONFIG.version),
    cameraCaptureConfirmed,
    biometricConfirmed: getBoolean(payload, ['biometricConfirmed'], false),
    isPunchRecord:
      hasRecordedPunch || getBoolean(payload, ['punchRecorded', 'isPunchRecord'], false),
    networkType: getString(payload, ['networkType'], 'unknown'),
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
  if (status === 'AlreadyCheckedOut') return 'ALREADY_CHECKED_OUT';
  if (status === 'CheckInRequired') return 'CHECK_IN_REQUIRED';
  if (status === 'ApprovalPending') return 'ATTENDANCE_APPROVAL_PENDING';
  if (status === 'ActionNotAllowed') return 'ATTENDANCE_ACTION_NOT_ALLOWED';
  if (status === 'AttendanceStateConflict') return 'ATTENDANCE_STATE_CONFLICT';
  if (status === 'IdempotencyKeyConflict') return 'ATTENDANCE_REQUEST_CONFLICT';
  if (status === 'EmployeeNotFound') return 'ATTENDANCE_EMPLOYEE_NOT_FOUND';
  if (status === 'CameraConfirmationRequired') return 'ATTENDANCE_CAMERA_REQUIRED';
  if (status === 'BiometricConfirmationRequired') return 'ATTENDANCE_BIOMETRIC_REQUIRED';
  if (status === 'AttendanceLocked') return 'ATTENDANCE_DATE_LOCKED';
  if (status === 'InvalidCapturedAt') return 'ATTENDANCE_DEVICE_TIME_INVALID';
  if (status === 'LocationAccuracyTooLow') return 'LOCATION_ACCURACY_LOW';
  if (status === 'ApprovalWorkflowUnavailable') return 'ATTENDANCE_APPROVAL_UNAVAILABLE';
  if (
    status === 'ClientRequestIdRequired' ||
    status === 'DeviceIdRequired' ||
    status === 'NetworkTypeRequired' ||
    status === 'AppVersionRequired'
  ) {
    return 'ATTENDANCE_DEVICE_CONTEXT_REQUIRED';
  }
  if (status === 'EmployeeOrClientInactive') return 'ATTENDANCE_EMPLOYEE_INACTIVE';
  return getString(payload, ['message', 'error'], 'ATTENDANCE_API_REJECTED');
};

const mapPayslip = (payload: unknown): Payslip | undefined => {
  if (!isObject(payload)) {
    return undefined;
  }
  const payRunId = getNumber(payload, ['payRunId', 'id']);
  const payPeriod = getString(payload, ['payPeriod', 'month']);
  if (!payRunId || !payPeriod) {
    return undefined;
  }
  return {
    payRunId,
    payPeriod,
    payDate: getString(payload, ['payDate']),
    runStatus: getString(payload, ['runStatus', 'status']),
    grossPay: getNumber(payload, ['grossPay']),
    statutoryDeductions: getNumber(payload, ['statutoryDeductions']),
    oneTimeDeductions: getNumber(payload, ['oneTimeDeductions']),
    netPay: getNumber(payload, ['netPay']),
    paymentStatus: getString(payload, ['paymentStatus'], 'Pending'),
    paymentDate: getString(payload, ['paymentDate']) || undefined,
  };
};

const mapPayslipDocument = (payload: unknown): PayslipDocument => {
  if (!isObject(payload)) {
    throw new Error('PAYSLIP_DOCUMENT_INVALID');
  }
  const payRunId = getNumber(payload, ['payRunId']);
  const payPeriod = getString(payload, ['payPeriod']);
  const html = getString(payload, ['html']);
  if (!payRunId || !payPeriod || !html) {
    throw new Error('PAYSLIP_DOCUMENT_INVALID');
  }
  return {
    payRunId,
    payPeriod,
    employeeCode: getString(payload, ['employeeCode']),
    fileName: getString(payload, ['fileName'], `payslip-${payPeriod}.html`),
    html,
  };
};

const assertAttendanceAccepted = (
  payload: unknown,
  requireRecorded = false,
  submittedReason = '',
) => {
  if (!isObject(payload)) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }
  if (payload.allowed !== true || (requireRecorded && payload.punchRecorded !== true)) {
    throw new Error(attendanceErrorCode(payload));
  }
  if (payload.requiresReason === true && !submittedReason.trim()) {
    throw new Error('ATTENDANCE_REASON_REQUIRED');
  }
  return payload;
};

const normalizeAttendanceApiError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }
  if ([408, 429, 502, 503, 504].includes(error.response.status)) {
    return error;
  }
  if (error.response.status >= 500) {
    return new Error('ATTENDANCE_SERVER_ERROR');
  }
  const payload = error.response.data;
  return new Error(isObject(payload) ? attendanceErrorCode(payload) : 'ATTENDANCE_API_REJECTED');
};

const attendancePayload = (record: AttendanceRecord) => ({
  clientRequestId: record.id,
  action: record.attendanceType === 'CHECK_IN' ? 'CheckIn' : 'CheckOut',
  latitude: record.latitude,
  longitude: record.longitude,
  accuracyMeters: record.accuracyMeters,
  capturedAt: record.timestamp,
  deviceId: record.deviceId,
  deviceModel: record.deviceModel ?? '',
  osVersion: record.osVersion ?? '',
  networkType: record.networkType,
  appVersion: record.appVersion,
  cameraCaptureConfirmed: record.cameraCaptureConfirmed,
  biometricConfirmed: record.biometricConfirmed,
  reason: record.reason?.trim() ?? '',
});

const mapAttendanceTodayState = (payload: unknown): AttendanceTodayState => {
  if (!isObject(payload)) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }
  const attendanceDate = getString(payload, ['attendanceDate', 'date']).slice(0, 10);
  const nextExpectedAction = getString(
    payload,
    ['nextExpectedAction'],
    'CheckIn',
  ) as AttendanceTodayState['nextExpectedAction'];
  if (!attendanceDate) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }
  return {
    attendanceDate,
    status: getString(payload, ['status'], 'NotMarked'),
    checkInTime: getString(payload, ['checkInTime']) || undefined,
    checkOutTime: getString(payload, ['checkOutTime']) || undefined,
    totalHours: getNumber(payload, ['totalHours']),
    payableValue: getNumber(payload, ['payableValue']),
    nextExpectedAction,
    approvalPending: getBoolean(payload, ['approvalPending']),
    shiftCheckInTime: getString(payload, ['shiftCheckInTime'], '09:00:00'),
    shiftCheckOutTime: getString(payload, ['shiftCheckOutTime'], '18:00:00'),
    minimumHoursForHalfDay: getNumber(payload, ['minimumHoursForHalfDay'], 4),
    minimumHoursForFullDay: getNumber(payload, ['minimumHoursForFullDay'], 8),
    maximumHoursAllowedForFullDay: getNumber(
      payload,
      ['maximumHoursAllowedForFullDay'],
      12,
    ),
  };
};

const normalizedAttendanceOutcome = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const mapAttendancePunchResult = (
  payload: ApiObject,
  record: AttendanceRecord,
): AttendancePunchResult => {
  const rawDecision = getString(payload, ['decision']);
  const status = getString(payload, ['status']);
  const nextExpectedAction = getString(payload, [
    'nextExpectedAction',
    'nextAction',
  ]);
  const pendingApproval =
    [rawDecision, status].some(value => {
      const normalized = normalizedAttendanceOutcome(value);
      return normalized === 'pendingapproval' || normalized === 'approvalpending';
    }) ||
    payload.requiresApproval === true ||
    normalizedAttendanceOutcome(nextExpectedAction) === 'waitforapproval';
  const decision = rawDecision || (pendingApproval ? 'PendingApproval' : 'Accepted');
  const punchId = getString(payload, ['punchId', 'id', 'attendanceId'], record.id);

  return {
    punchId,
    decision,
    nextExpectedAction: nextExpectedAction || undefined,
    idempotentReplay: getBoolean(payload, ['idempotentReplay'], false),
    pendingApproval,
  };
};

const attendanceMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const assertAttendanceMonth = (month: string) => {
  if (!attendanceMonthPattern.test(month)) {
    throw new Error('INVALID_ATTENDANCE_MONTH');
  }
  return month;
};

const attendancePeriodScopes: AttendancePeriodScope[] = [
  'calendar-month',
  'attendance-cycle',
];

const assertAttendancePeriodScope = (scope: AttendancePeriodScope) => {
  if (!attendancePeriodScopes.includes(scope)) {
    throw new Error('INVALID_ATTENDANCE_SCOPE');
  }
  return scope;
};

const getLegacyAttendanceHistory = async (employeeId: string, month: string) => {
  const payload = unwrap(
    await apiClient.get('/api/ess/dashboard/attendance/daily', {
      params: { month },
    }),
  );
  return toArray(payload)
    .map(item => mapAttendanceRecord(item, employeeId))
    .filter((item): item is AttendanceRecord => Boolean(item));
};

const mapAttendancePeriodResponse = (
  payload: unknown,
  employeeId: string,
  requestedMonth: string,
  requestedScope: AttendancePeriodScope,
): AttendancePeriodResponse => {
  if (!isObject(payload)) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }

  const responseScope = getString(payload, ['scope'], requestedScope);
  const scope = attendancePeriodScopes.includes(responseScope as AttendancePeriodScope)
    ? (responseScope as AttendancePeriodScope)
    : requestedScope;
  const month = getString(payload, ['month'], requestedMonth);
  const fromDate = getString(payload, ['fromDate']).slice(0, 10);
  const toDate = getString(payload, ['toDate']).slice(0, 10);
  if (!attendanceMonthPattern.test(month) || !fromDate || !toDate) {
    throw new Error('ATTENDANCE_API_INVALID_RESPONSE');
  }

  const rawPolicy = payload.policy ?? payload.attendancePolicy;
  const policySource = isObject(rawPolicy) ? rawPolicy : undefined;
  const policyId = policySource
    ? getNumber(policySource, ['id', 'policyId'])
    : 0;
  const startDay = policySource
    ? getNumber(policySource, ['attendanceCycleStartDay', 'startDay'])
    : 0;
  const endDay = policySource
    ? getNumber(policySource, ['attendanceCycleEndDay', 'endDay'])
    : 0;
  const policy = policySource
    ? {
        id: policyId || undefined,
        policyBatchId:
          getString(policySource, ['policyBatchId']) || undefined,
        name: getString(policySource, ['name', 'policyName'], 'Attendance policy'),
        attendanceCycleStartDay: startDay || undefined,
        attendanceCycleEndDay: endDay || undefined,
      }
    : undefined;
  const rawRecords = payload.records ?? payload.attendance ?? [];
  const records = toArray(rawRecords)
    .map(item => mapAttendanceRecord(item, employeeId))
    .filter((item): item is AttendanceRecord => Boolean(item));

  return {
    scope,
    month,
    fromDate,
    toDate,
    cycleAvailable: getBoolean(payload, ['cycleAvailable'], Boolean(policy)),
    policy,
    records,
  };
};

const normalizeAttendanceHistoryApiError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }
  const payload = error.response.data;
  const errorCode = isObject(payload)
    ? getString(payload, ['error', 'code', 'message'])
    : '';
  if (errorCode) {
    return new Error(errorCode);
  }
  return error.response.status >= 500
    ? new Error('ATTENDANCE_SERVER_ERROR')
    : new Error('ATTENDANCE_API_REJECTED');
};

const normalizeLeaveApiError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }
  const payload = error.response.data;
  const message = isObject(payload)
    ? getString(payload, ['error', 'message', 'detail'])
    : String(payload ?? '');
  const normalized = message.toLowerCase();
  if (normalized.includes('available leave balance')) {
    return new Error('INSUFFICIENT_LEAVE_BALANCE');
  }
  if (normalized.includes('does not allow half-day')) {
    return new Error('LEAVE_HALF_DAY_UNAVAILABLE');
  }
  if (normalized.includes('leave type is unavailable')) {
    return new Error('LEAVE_TYPE_UNAVAILABLE');
  }
  if (normalized.includes('half-day leave can be applied for one date')) {
    return new Error('INVALID_LEAVE_RANGE');
  }
  if (normalized.includes('valid leave date range')) {
    return new Error('INVALID_LEAVE_DATES');
  }
  return new Error('LEAVE_REQUEST_FAILED');
};

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
  async getSelfProfile(): Promise<EmployeeSelfProfile> {
    assertApiConfigured();
    try {
      const payload = unwrap(await apiClient.get('/api/ess/profile'));
      return mapEmployeeSelfProfile(payload);
    } catch (error) {
      throw normalizeProfileApiError(error, 'load');
    }
  },
  async saveProfile(
    request: SaveEmployeeSelfProfileRequest,
  ): Promise<EmployeeSelfProfile> {
    assertApiConfigured();
    try {
      const payload = unwrap(await apiClient.post('/api/ess/profile', request));
      return mapEmployeeSelfProfile(payload);
    } catch (error) {
      throw normalizeProfileApiError(error, 'save');
    }
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
    try {
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
    } catch (error) {
      throw normalizeLeaveApiError(error);
    }
  },
  async getAttendanceHistory(employeeId: string, month: string) {
    assertApiConfigured();
    const selectedMonth = assertAttendanceMonth(month);
    return getLegacyAttendanceHistory(employeeId, selectedMonth);
  },
  async getAttendancePeriod(
    employeeId: string,
    month: string,
    scope: AttendancePeriodScope,
  ): Promise<AttendancePeriodResponse> {
    assertApiConfigured();
    const selectedMonth = assertAttendanceMonth(month);
    const selectedScope = assertAttendancePeriodScope(scope);
    try {
      const payload = unwrap(
        await apiClient.get('/api/ess/attendance/history', {
          params: { month: selectedMonth, scope: selectedScope },
        }),
      );
      return mapAttendancePeriodResponse(
        payload,
        employeeId,
        selectedMonth,
        selectedScope,
      );
    } catch (error) {
      throw normalizeAttendanceHistoryApiError(error);
    }
  },
  async getAttendanceSummary(_employeeId: string, month: string) {
    assertApiConfigured();
    const selectedMonth = assertAttendanceMonth(month);
    return unwrap(
      await apiClient.get('/api/ess/dashboard/attendance', {
        params: { month: selectedMonth },
      }),
    );
  },
  async getAttendanceToday(): Promise<AttendanceTodayState> {
    assertApiConfigured();
    try {
      return mapAttendanceTodayState(
        unwrap(await apiClient.get('/api/ess/attendance/today')),
      );
    } catch (error) {
      throw normalizeAttendanceHistoryApiError(error);
    }
  },
  async validateAttendancePunch(record: AttendanceRecord) {
    assertApiConfigured();
    try {
      const payload = unwrap(
        await apiClient.post('/api/ess/attendance/punch/validate', attendancePayload(record)),
      );
      return assertAttendanceAccepted(payload, false, record.reason);
    } catch (error) {
      throw normalizeAttendanceApiError(error);
    }
  },
  async punchAttendance(record: AttendanceRecord) {
    assertApiConfigured();
    try {
      const payload = unwrap(await apiClient.post('/api/ess/attendance/punch', attendancePayload(record)));
      const accepted = assertAttendanceAccepted(payload, true, record.reason);
      return mapAttendancePunchResult(accepted, record);
    } catch (error) {
      throw normalizeAttendanceApiError(error);
    }
  },
  async getHolidays(month: string): Promise<Holiday[]> {
    assertApiConfigured();
    const selectedMonth = assertAttendanceMonth(month);
    const payload = unwrap(
      await apiClient.get('/api/ess/dashboard/holidays', {
        params: { month: selectedMonth },
      }),
    );
    return toArray(payload)
      .map(item => {
        if (!isObject(item)) {
          return undefined;
        }
        const name = getString(item, ['name', 'title', 'holidayName']);
        const startDate = getString(item, ['startDate', 'date']);
        const endDate = getString(item, ['endDate'], startDate);
        return name && startDate ? { name, startDate, endDate } : undefined;
      })
      .filter((item): item is Holiday => Boolean(item));
  },
  async getPayslips(): Promise<Payslip[]> {
    assertApiConfigured();
    const payload = unwrap(await apiClient.get('/api/ess/pay/payslips'));
    return toArray(payload)
      .map(mapPayslip)
      .filter((item): item is Payslip => Boolean(item))
      .sort((left, right) => right.payPeriod.localeCompare(left.payPeriod));
  },
  async getPayslipDocument(payRunId: number): Promise<PayslipDocument> {
    assertApiConfigured();
    if (!Number.isInteger(payRunId) || payRunId <= 0) {
      throw new Error('PAYSLIP_DOCUMENT_INVALID');
    }
    return mapPayslipDocument(unwrap(await apiClient.get(`/api/ess/pay/payslips/${payRunId}`)));
  },
};
