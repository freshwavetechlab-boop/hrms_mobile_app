import { AttendancePeriodScope, AttendanceRecord } from '../types/domain';
import { essApiService } from './essApiService';

export const attendanceService = {
  async validateAttendance(record: AttendanceRecord) {
    await essApiService.validateAttendancePunch(record);
  },
  async markAttendance(record: AttendanceRecord) {
    return essApiService.punchAttendance(record);
  },
  async getAttendanceToday() {
    return essApiService.getAttendanceToday();
  },
  async getAttendanceHistory(employeeId: string, month: string) {
    const records = await essApiService.getAttendanceHistory(employeeId, month);
    return records.sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  },
  async getAttendancePeriod(
    employeeId: string,
    month: string,
    scope: AttendancePeriodScope,
  ) {
    const period = await essApiService.getAttendancePeriod(employeeId, month, scope);
    return {
      ...period,
      records: [...period.records].sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      ),
    };
  },
  async getAttendanceSummary(employeeId: string, month: string) {
    return essApiService.getAttendanceSummary(employeeId, month);
  },
};
