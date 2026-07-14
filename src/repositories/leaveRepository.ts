import { APP_CONFIG } from '../constants/app';
import { initialLeaveBalances } from '../constants/leave';
import { essApiService } from '../services/essApiService';
import { LeaveApplication, LeaveType } from '../types/domain';

const isLiveApiEnabled = () => Boolean(APP_CONFIG.apiEnabled && APP_CONFIG.apiBaseUrl);

export const leaveRepository = {
  async getLeaveData(employeeId: string) {
    const [balancesResult, requestsResult] = await Promise.allSettled([
      essApiService.getLeaveBalances(),
      essApiService.getLeaveRequests(employeeId),
    ]);

    return {
      balances:
        balancesResult.status === 'fulfilled'
          ? balancesResult.value.balances
          : ({ ...initialLeaveBalances } as Record<LeaveType, number>),
      codes: balancesResult.status === 'fulfilled' ? balancesResult.value.codes : {},
      allowHalfDay:
        balancesResult.status === 'fulfilled' ? balancesResult.value.allowHalfDay : {},
      applications: requestsResult.status === 'fulfilled' ? requestsResult.value : [],
    };
  },
  async createLeaveRequest(application: LeaveApplication) {
    try {
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
    } catch (error) {
      if (isLiveApiEnabled()) {
        throw error;
      }
      return application;
    }
  },
};
