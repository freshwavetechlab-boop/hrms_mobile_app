jest.mock('../src/services/attendanceService', () => ({
  attendanceService: {
    getAttendancePeriod: jest.fn(),
  },
}));

jest.mock('../src/database/attendanceQueue', () => ({
  attendanceQueue: {
    getAll: jest.fn(),
  },
}));

jest.mock('../src/services/sessionStorage', () => ({
  sessionStorage: {
    getSession: jest.fn(),
    getSelectedClient: jest.fn(),
    getOrCreateDeviceId: jest.fn(() => 'device-test'),
  },
}));

import { attendanceQueue } from '../src/database/attendanceQueue';
import { attendanceRepository } from '../src/repositories/attendanceRepository';
import { attendanceService } from '../src/services/attendanceService';
import { sessionStorage } from '../src/services/sessionStorage';
import attendanceReducer, {
  loadAttendanceHistory,
  loadAttendancePeriod,
} from '../src/store/slices/attendanceSlice';
import { AttendanceRecord } from '../src/types/domain';

const record = (date: string, overrides: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  accuracyMeters: 5,
  appVersion: '1.0.0',
  attempts: 0,
  attendanceType: 'CHECK_IN',
  cameraCaptureConfirmed: true,
  biometricConfirmed: true,
  clientCode: 'GAD',
  deviceId: 'device-test',
  employeeId: 'REC135',
  hrmsClientId: 10,
  hrmsEmployeeId: 720,
  id: `local-${date}`,
  isPunchRecord: true,
  latitude: 28.61,
  longitude: 77.2,
  networkType: 'wifi',
  syncStatus: 'SYNCED',
  timestamp: `${date}T09:00:00`,
  ...overrides,
});

describe('attendance period repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sessionStorage.getSession as jest.Mock).mockReturnValue({
      hrmsClientId: 10,
      hrmsEmployeeId: 720,
    });
  });

  it('merges only local records inside the inclusive API period', async () => {
    (attendanceService.getAttendancePeriod as jest.Mock).mockResolvedValue({
      scope: 'attendance-cycle',
      month: '2026-07',
      fromDate: '2026-06-26',
      toDate: '2026-07-25',
      cycleAvailable: true,
      policy: { name: 'REC cycle' },
      records: [
        record('2026-07-14', {
          attendanceStatus: 'Present',
          cameraCaptureConfirmed: false,
          isPunchRecord: false,
          id: 'remote-2026-07-14',
        }),
      ],
    });
    (attendanceQueue.getAll as jest.Mock).mockResolvedValue([
      record('2026-06-25'),
      record('2026-06-26'),
      record('2026-07-14'),
      record('2026-07-25'),
      record('2026-07-26'),
    ]);

    const result = await attendanceRepository.getAttendancePeriod(
      'REC135',
      '2026-07',
      'attendance-cycle',
    );

    expect(result.records.map(item => item.timestamp.slice(0, 10))).toEqual([
      '2026-07-25',
      '2026-07-14',
      '2026-06-26',
    ]);
    expect(result.records.find(item => item.timestamp.startsWith('2026-07-14'))).toMatchObject({
      id: 'remote-2026-07-14',
      attendanceStatus: 'Present',
      cameraCaptureConfirmed: true,
      isPunchRecord: true,
    });
  });

  it('keeps dashboard calendar records separate from selected period records', () => {
    const currentMonthRecord = record('2026-07-14');
    const cycleRecord = record('2026-06-28');
    let state = attendanceReducer(undefined, { type: 'test/init' });

    state = attendanceReducer(
      state,
      loadAttendanceHistory.pending('calendar-request', '2026-07'),
    );
    state = attendanceReducer(
      state,
      loadAttendanceHistory.fulfilled(
        [currentMonthRecord],
        'calendar-request',
        '2026-07',
      ),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('period-request', {
        month: '2026-07',
        scope: 'attendance-cycle',
      }),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.fulfilled(
        {
          scope: 'attendance-cycle',
          month: '2026-07',
          fromDate: '2026-06-26',
          toDate: '2026-07-25',
          cycleAvailable: true,
          records: [cycleRecord],
        },
        'period-request',
        { month: '2026-07', scope: 'attendance-cycle' },
      ),
    );

    expect(state.records).toEqual([currentMonthRecord]);
    expect(state.loadedMonth).toBe('2026-07');
    expect(state.periodHistory.records).toEqual([cycleRecord]);
    expect(state.periodHistory.loadedKey).toBe('attendance-cycle:2026-07');
  });

  it('retains same-period cached records when a refresh fails', () => {
    const cachedRecord = record('2026-07-14');
    const periodArg = { month: '2026-07', scope: 'calendar-month' as const };
    let state = attendanceReducer(undefined, { type: 'test/init' });

    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('initial-request', periodArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.fulfilled(
        {
          scope: 'calendar-month',
          month: '2026-07',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          cycleAvailable: true,
          records: [cachedRecord],
        },
        'initial-request',
        periodArg,
      ),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('refresh-request', periodArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.rejected(
        new Error('ATTENDANCE_POLICY_INVALID'),
        'refresh-request',
        periodArg,
      ),
    );

    expect(state.periodHistory).toMatchObject({
      error: 'ATTENDANCE_POLICY_INVALID',
      loadedKey: 'calendar-month:2026-07',
      records: [cachedRecord],
      requestedKey: 'calendar-month:2026-07',
      status: 'error',
    });
  });

  it('keeps cached records keyed to their original period after another period fails', () => {
    const julyRecord = record('2026-07-14');
    const julyArg = { month: '2026-07', scope: 'calendar-month' as const };
    const juneArg = { month: '2026-06', scope: 'calendar-month' as const };
    let state = attendanceReducer(undefined, { type: 'test/init' });

    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('july-request', julyArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.fulfilled(
        {
          scope: 'calendar-month',
          month: '2026-07',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          cycleAvailable: true,
          records: [julyRecord],
        },
        'july-request',
        julyArg,
      ),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('june-request', juneArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.rejected(
        new Error('NETWORK_ERROR'),
        'june-request',
        juneArg,
      ),
    );

    expect(state.periodHistory.records).toEqual([julyRecord]);
    expect(state.periodHistory.loadedKey).toBe('calendar-month:2026-07');
    expect(state.periodHistory.requestedKey).toBe('calendar-month:2026-06');
    expect(state.periodHistory.loadedKey).not.toBe(state.periodHistory.requestedKey);
  });

  it('ignores an older period response after a newer request starts', () => {
    const julyArg = { month: '2026-07', scope: 'calendar-month' as const };
    const juneArg = { month: '2026-06', scope: 'calendar-month' as const };
    let state = attendanceReducer(undefined, { type: 'test/init' });

    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('july-request', julyArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.pending('june-request', juneArg),
    );
    state = attendanceReducer(
      state,
      loadAttendancePeriod.fulfilled(
        {
          scope: 'calendar-month',
          month: '2026-07',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          cycleAvailable: true,
          records: [record('2026-07-14')],
        },
        'july-request',
        julyArg,
      ),
    );

    expect(state.periodHistory.requestId).toBe('june-request');
    expect(state.periodHistory.requestedKey).toBe('calendar-month:2026-06');
    expect(state.periodHistory.loadedKey).toBeUndefined();
    expect(state.periodHistory.records).toEqual([]);
  });
});
