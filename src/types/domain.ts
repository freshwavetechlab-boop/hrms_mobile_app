export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendancePeriodScope = 'calendar-month' | 'attendance-cycle';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
// Leave types are configured per client in Payroll.API, so the mobile domain must
// not restrict them to a fixed catalogue.
export type LeaveType = string;
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';

export type ClientLogoKey = 'gaDigital' | 'frevone';

export type ClientBranding = {
  primaryColor: string;
  accentColor: string;
  logoInitials: string;
  logoKey?: ClientLogoKey;
  logoDataUrl?: string;
};

export type ClientProfile = {
  id?: number;
  code: string;
  name: string;
  supportEmail: string;
  apiBaseUrl: string;
  validFromUtc: string;
  validUntilUtc: string;
  isActive: boolean;
  validatedAt: string;
  branding: ClientBranding;
};

export type DeviceRegistration = {
  clientCode: string;
  employeeId: string;
  deviceId: string;
  registeredAt: string;
};

export type FaceEmbeddingRecord = {
  vector: number[];
  modelVersion: string;
  threshold: number;
  sampleCount: number;
  createdAt: string;
};

export type FaceCaptureAngle = 'FRONT' | 'RIGHT' | 'LEFT';

export type FaceRegistrationCapture = {
  angle: FaceCaptureAngle;
  imageRef: string;
  capturedAt: string;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  manager: string;
  dateOfJoining?: string;
  workLocation?: string;
  attendanceOffice?: string;
  avatarUrl?: string;
};

export type AttachmentFieldConfiguration = {
  id: number;
  clientId: number;
  attachmentAttributeId: number;
  attributeCode: string;
  attributeName: string;
  dataClassification: string;
  requiresDocumentNumber: boolean;
  requiresIssueDate: boolean;
  requiresExpiryDate: boolean;
  moduleCode: string;
  formCode: string;
  fieldKey: string;
  fieldLabel: string;
  helpText: string;
  isRequired: boolean;
  allowMultiple: boolean;
  maximumFileCount: number;
  allowedExtensionsJson: string;
  maximumFileSizeBytes: number;
  maximumTotalSizeBytes?: number;
  ownerCanView: boolean;
  ownerCanUpload: boolean;
  ownerCanReplace: boolean;
  ownerCanDelete: boolean;
  requiresVerification: boolean;
  versioningEnabled: boolean;
};

export type EntityAttachment = {
  publicId: string;
  clientId: number;
  fieldConfigurationId: number;
  entityType: string;
  entityId: number;
  attributeCode: string;
  attributeName: string;
  fieldLabel: string;
  originalFileName: string;
  fileExtension: string;
  detectedMimeType: string;
  fileSizeBytes: number;
  versionNumber: number;
  documentNumber: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: string;
  rejectionReason: string;
  malwareScanStatus: string;
  uploadedAtUtc: string;
};

export type AttachmentAccessTicket = {
  url: string;
  expiresAtUtc: string;
};

export type AttachmentUploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export type Session = {
  accessToken: string;
  userId?: string;
  hrmsClientId: number;
  hrmsEmployeeId: number;
  mustChangePassword?: boolean;
  profileValidatedAt?: number;
  refreshToken?: string;
  // Informational only. Android never decides token validity from its local
  // clock; Payroll.API remains authoritative through auth/me and HTTP 401.
  expiresAt?: number;
  client: ClientProfile;
  employee: Employee;
  roles?: string[];
  permissions?: string[];
};

export type AttendanceRecord = {
  id: string;
  clientCode: string;
  employeeId: string;
  hrmsClientId?: number;
  hrmsEmployeeId?: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  attendanceType: AttendanceType;
  attendanceStatus?: string;
  attendanceDecision?: string;
  punchId?: string;
  nextExpectedAction?: string;
  idempotentReplay?: boolean;
  payableValue?: number;
  remarks?: string;
  reason?: string;
  deviceId: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion: string;
  cameraCaptureConfirmed: boolean;
  biometricConfirmed: boolean;
  isPunchRecord: boolean;
  networkType: string;
  syncStatus: SyncStatus;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
};

export type AttendancePunchResult = {
  punchId: string;
  decision: string;
  nextExpectedAction?: string;
  idempotentReplay: boolean;
  pendingApproval: boolean;
};

export type AttendanceTodayState = {
  attendanceDate: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours: number;
  payableValue: number;
  nextExpectedAction: 'CheckIn' | 'CheckOut' | 'Completed' | 'WaitForApproval' | 'Unavailable';
  approvalPending: boolean;
  shiftCheckInTime: string;
  shiftCheckOutTime: string;
  minimumHoursForHalfDay: number;
  minimumHoursForFullDay: number;
  maximumHoursAllowedForFullDay: number;
  syncPending?: boolean;
};

export type AttendancePolicySummary = {
  id?: number;
  policyBatchId?: string;
  name: string;
  attendanceCycleStartDay?: number;
  attendanceCycleEndDay?: number;
};

export type AttendancePeriodResponse = {
  scope: AttendancePeriodScope;
  month: string;
  fromDate: string;
  toDate: string;
  cycleAvailable: boolean;
  policy?: AttendancePolicySummary;
  records: AttendanceRecord[];
};

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isSyncing: boolean;
  lastSyncedAt?: string;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type LeaveBalance = {
  key: LeaveType;
  leaveCode: string;
  leaveType: string;
  balance: number;
  balanceDate?: string;
  allowHalfDay: boolean;
};

export type Holiday = {
  name: string;
  startDate: string;
  endDate: string;
};

export type LeaveApplication = {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  leaveTypeName?: string;
  leaveCode?: string;
  dayType?: 'Full Day' | 'First Half' | 'Second Half';
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
};
