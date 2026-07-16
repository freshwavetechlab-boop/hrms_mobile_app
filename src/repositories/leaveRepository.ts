import { essApiService } from '../services/essApiService';
import { LeaveApplication } from '../types/domain';

export const leaveRepository = {
  async getLeaveData(employeeId: string) {
    const [balances, applications] = await Promise.all([
      essApiService.getLeaveBalances(),
      essApiService.getLeaveRequests(employeeId),
    ]);

    return {
      ...balances,
      applications,
    };
  },
  async createLeaveRequest(application: LeaveApplication) {
    return (
      await essApiService.createLeaveRequest({
        employeeId: application.employeeId,
        leaveType: application.leaveType,
        leaveCode: application.leaveCode,
        dayType: application.dayType,
        fromDate: application.fromDate,
        toDate: application.toDate,
        days: application.days,
        reason: application.reason,
      })
    ) ?? application;
  },
};
