export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type LeaveType = 'CASUAL_LEAVE' | 'LOSS_OF_PAY' | 'MATERNITY';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ClientLogoKey = 'gaDigital' | 'frevone';

export type ClientBranding = {
  primaryColor: string;
  accentColor: string;
  logoInitials: string;
  logoKey?: ClientLogoKey;
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
  avatarUrl?: string;
};

export type Session = {
  accessToken: string;
  userId?: string;
  refreshToken?: string;
  expiresAt: number;
  client: ClientProfile;
  employee: Employee;
  roles?: string[];
  permissions?: string[];
};

export type AttendanceRecord = {
  id: string;
  clientCode: string;
  employeeId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  attendanceType: AttendanceType;
  deviceId: string;
  batteryPercentage: number;
  appVersion: string;
  capturedImageRef: string;
  networkType: string;
  facialVerification: {
    passed: boolean;
    faceMatchScore?: number;
    livenessScore?: number;
    provider: string;
    referenceId: string;
  };
  syncStatus: SyncStatus;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
};

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isSyncing: boolean;
  lastSyncedAt?: string;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type LeaveApplication = {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  leaveCode?: string;
  dayType?: 'Full Day' | 'First Half' | 'Second Half';
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
};
