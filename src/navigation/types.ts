import { AttendanceType } from '../types/domain';

export type RootStackParamList = {
  Splash: undefined;
  ClientCode: undefined;
  Login: undefined;
  ChangePassword: undefined;
  FaceEnrollment: undefined;
  AttendanceCapture: { attendanceType: AttendanceType };
  Payslips: undefined;
  AppLock: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Attendance: undefined;
  Requests: undefined;
  Profile: undefined;
  More: undefined;
};
