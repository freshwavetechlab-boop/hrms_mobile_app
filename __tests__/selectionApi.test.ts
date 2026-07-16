import { apiClient } from '../src/services/apiClient';
import { essApiService } from '../src/services/essApiService';
import { sessionStorage } from '../src/services/sessionStorage';

const selectedClient = {
  code: 'GAD',
  name: 'GA Digital Web Word Pvt. Ltd.',
  supportEmail: '',
  apiBaseUrl: 'http://resolved-tenant.example',
  validFromUtc: '2026-01-01T00:00:00Z',
  validUntilUtc: '2027-01-01T00:00:00Z',
  isActive: true,
  validatedAt: '2026-07-14T00:00:00Z',
  branding: {
    primaryColor: '#062B6F',
    accentColor: '#13BFA6',
    logoInitials: 'GAD',
  },
};

const session = {
  accessToken: 'token',
  hrmsClientId: 10,
  hrmsEmployeeId: 720,
  expiresAt: Date.now() + 60_000,
  client: selectedClient,
  employee: {
    id: 'REC135',
    name: 'REC Employee',
    email: 'employee@example.com',
    department: 'RECL',
    designation: 'Executive Assistant',
    manager: '',
  },
};

describe('month-selected ESS API calls', () => {
  beforeEach(() => {
    sessionStorage.saveSelectedClient(selectedClient);
    sessionStorage.saveSession(session);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clearSelectedClient();
    sessionStorage.clearSession();
  });

  it('passes the selected attendance month to daily and summary endpoints', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });

    await essApiService.getAttendanceHistory('REC135', '2026-01');
    await essApiService.getAttendanceSummary('REC135', '2025-12');

    expect(get).toHaveBeenNthCalledWith(1, '/api/ess/dashboard/attendance/daily', {
      params: { month: '2026-01' },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/api/ess/dashboard/attendance', {
      params: { month: '2025-12' },
    });
  });

  it('treats server daily check-in and check-out times as recorded punches', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        {
          attendanceDate: '2026-07-14T00:00:00',
          checkInTime: '09:05:00',
          checkOutTime: '18:02:00',
          status: 'Present',
        },
      ],
    });

    const records = await essApiService.getAttendanceHistory('REC135', '2026-07');

    expect(records[0]).toMatchObject({
      attendanceType: 'CHECK_OUT',
      timestamp: '2026-07-14T18:02:00',
      cameraCaptureConfirmed: false,
      isPunchRecord: true,
    });
  });

  it('loads the employee cycle through the self-scoped ESS history endpoint only', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        scope: 'attendance-cycle',
        month: '2026-07',
        fromDate: '2026-06-25',
        toDate: '2026-07-24',
        cycleAvailable: true,
        policy: {
          id: 9,
          policyBatchId: 'rec-policy-batch',
          name: 'REC attendance policy',
          attendanceCycleStartDay: 25,
          attendanceCycleEndDay: 24,
        },
        records: [
          {
            attendanceDate: '2026-06-25T00:00:00',
            checkInTime: '09:00:00',
            status: 'Present',
          },
          {
            attendanceDate: '2026-07-24T00:00:00',
            status: 'Absent',
          },
        ],
      },
    });

    const result = await essApiService.getAttendancePeriod(
      'REC135',
      '2026-07',
      'attendance-cycle',
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/ess/attendance/history', {
      params: { month: '2026-07', scope: 'attendance-cycle' },
    });
    expect(get).not.toHaveBeenCalledWith(
      '/api/leave-attendance/groups',
      expect.anything(),
    );
    expect(result).toMatchObject({
      scope: 'attendance-cycle',
      month: '2026-07',
      fromDate: '2026-06-25',
      toDate: '2026-07-24',
      cycleAvailable: true,
      policy: {
        id: 9,
        policyBatchId: 'rec-policy-batch',
        name: 'REC attendance policy',
        attendanceCycleStartDay: 25,
        attendanceCycleEndDay: 24,
      },
    });
    expect(result.records.map(record => record.timestamp.slice(0, 10))).toEqual([
      '2026-06-25',
      '2026-07-24',
    ]);
    expect(result.records[0].isPunchRecord).toBe(true);
  });

  it('maps the server calendar fallback when no employee cycle is assigned', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        scope: 'calendar-month',
        month: '2026-02',
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
        cycleAvailable: false,
        policy: null,
        records: [],
      },
    });

    const result = await essApiService.getAttendancePeriod(
      'REC135',
      '2026-02',
      'attendance-cycle',
    );

    expect(get).toHaveBeenCalledWith('/api/ess/attendance/history', {
      params: { month: '2026-02', scope: 'attendance-cycle' },
    });
    expect(result).toEqual({
      scope: 'calendar-month',
      month: '2026-02',
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
      cycleAvailable: false,
      policy: undefined,
      records: [],
    });
  });

  it('preserves a policy conflict code returned by the self-scoped endpoint', async () => {
    jest.spyOn(apiClient, 'get').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: 'ATTENDANCE_POLICY_CONFLICT' },
      },
    });

    await expect(
      essApiService.getAttendancePeriod('REC135', '2026-07', 'attendance-cycle'),
    ).rejects.toThrow('ATTENDANCE_POLICY_CONFLICT');
  });

  it('passes the selected holiday month to the holiday endpoint', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });

    await essApiService.getHolidays('2026-07');

    expect(get).toHaveBeenCalledWith('/api/ess/dashboard/holidays', {
      params: { month: '2026-07' },
    });
  });

  it('rejects malformed month values before making a request', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });

    await expect(essApiService.getHolidays('2026-13')).rejects.toThrow(
      'INVALID_ATTENDANCE_MONTH',
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('preserves client-configured leave types and balances', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        {
          leaveCode: 'CL',
          leaveType: 'Casual Leave',
          balance: 2,
          balanceDate: '2026-07-09T00:00:00',
          allowHalfDay: true,
        },
        {
          leaveCode: 'ML',
          leaveType: 'Maternity',
          balance: 84,
          allowHalfDay: false,
        },
      ],
    });

    const result = await essApiService.getLeaveBalances();

    expect(result.availableTypes).toEqual([
      expect.objectContaining({
        key: 'CL',
        leaveCode: 'CL',
        leaveType: 'Casual Leave',
        balance: 2,
        allowHalfDay: true,
      }),
      expect.objectContaining({
        key: 'ML',
        leaveCode: 'ML',
        leaveType: 'Maternity',
        balance: 84,
        allowHalfDay: false,
      }),
    ]);
  });

  it('sends the selected leave dates only when the request is submitted', async () => {
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        id: 43,
        leaveCode: 'CL',
        leaveType: 'Casual Leave',
        fromDate: '2026-08-03T00:00:00',
        toDate: '2026-08-05T00:00:00',
        dayType: 'Full Day',
        days: 3,
        reason: 'Family work',
        status: 'Pending Approval',
        createdAt: '2026-07-14T10:00:00Z',
      },
    });

    await essApiService.createLeaveRequest({
      employeeId: 'REC135',
      leaveType: 'CL',
      leaveCode: 'CL',
      dayType: 'Full Day',
      fromDate: '2026-08-03',
      toDate: '2026-08-05',
      days: 3,
      reason: 'Family work',
    });

    expect(post).toHaveBeenCalledWith('/api/ess/leave/requests', {
      leaveCode: 'CL',
      fromDate: '2026-08-03',
      toDate: '2026-08-05',
      dayType: 'Full Day',
      reason: 'Family work',
    });
  });

  it('maps Pending Approval leave requests as pending', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        {
          id: 42,
          leaveCode: 'CL',
          leaveType: 'Casual Leave',
          fromDate: '2026-07-20T00:00:00',
          toDate: '2026-07-20T00:00:00',
          days: 1,
          status: 'Pending Approval',
        },
      ],
    });

    const result = await essApiService.getLeaveRequests('REC135');

    expect(result[0]).toMatchObject({
      leaveCode: 'CL',
      leaveTypeName: 'Casual Leave',
      status: 'PENDING',
    });
  });
});
