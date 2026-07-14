import { AttendanceRecord } from '../types/domain';
import { essApiService } from './essApiService';

export const attendanceService = {
  async validateAttendance(record: AttendanceRecord) {
    await essApiService.validateAttendancePunch(record);
  },
  async markAttendance(record: AttendanceRecord) {
    return essApiService.punchAttendance(record);
  },
  async getAttendanceHistory(employeeId: string) {
    const [summary, daily] = await Promise.allSettled([
      essApiService.getAttendanceSummary(employeeId),
      essApiService.getAttendanceHistory(employeeId),
    ]);

    const records = [
      ...(summary.status === 'fulfilled' ? summary.value : []),
      ...(daily.status === 'fulfilled' ? daily.value : []),
    ];
    const uniqueRecords = new Map(records.map(record => [record.id, record]));
    return Array.from(uniqueRecords.values()).sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  },
};
