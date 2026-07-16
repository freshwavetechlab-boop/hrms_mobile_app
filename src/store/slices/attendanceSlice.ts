import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { format } from 'date-fns/format';
import { attendanceRepository } from '../../repositories/attendanceRepository';
import {
  AttendancePeriodScope,
  AttendancePolicySummary,
  AttendanceRecord,
  AttendanceTodayState,
  AttendanceType,
  LoadingState,
} from '../../types/domain';
import { RootState } from '..';
import { formatIsoMonthKey } from '../../utils/time';

type AttendanceState = {
  records: AttendanceRecord[];
  status: LoadingState;
  historyRequestId?: string;
  loadedMonth?: string;
  markRequestId?: string;
  locationStatus: LoadingState;
  error?: string;
  today: {
    data?: AttendanceTodayState;
    status: LoadingState;
    requestId?: string;
    error?: string;
  };
  periodHistory: {
    records: AttendanceRecord[];
    status: LoadingState;
    cycleAvailable: boolean;
    requestId?: string;
    requestedKey?: string;
    loadedKey?: string;
    scope?: AttendancePeriodScope;
    month?: string;
    fromDate?: string;
    toDate?: string;
    policy?: AttendancePolicySummary;
    error?: string;
  };
};

const initialState: AttendanceState = {
  records: [],
  status: 'idle',
  locationStatus: 'idle',
  today: {
    status: 'idle',
  },
  periodHistory: {
    records: [],
    status: 'idle',
    cycleAvailable: false,
  },
};

const currentPayrollMonth = () => format(new Date(), 'yyyy-MM');

export const markAttendance = createAsyncThunk(
  'attendance/mark',
  async (
    input: {
      attendanceType: AttendanceType;
      location: { latitude: number; longitude: number; accuracyMeters: number };
      cameraCaptureConfirmed: boolean;
      biometricConfirmed: boolean;
      reason?: string;
    },
    thunkApi,
  ) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return attendanceRepository.createAttendance({
      employeeId,
      attendanceType: input.attendanceType,
      location: input.location,
      cameraCaptureConfirmed: input.cameraCaptureConfirmed,
      biometricConfirmed: input.biometricConfirmed,
      reason: input.reason,
      networkType: state.network.type,
      isOnline: state.network.isConnected && state.network.isInternetReachable,
    });
  },
);

export const loadAttendanceHistory = createAsyncThunk(
  'attendance/loadHistory',
  async (month: string | undefined, thunkApi) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return attendanceRepository.getAttendanceHistory(employeeId, month ?? currentPayrollMonth());
  },
);

export const loadAttendanceToday = createAsyncThunk(
  'attendance/loadToday',
  async (_, thunkApi) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return attendanceRepository.getAttendanceToday(employeeId);
  },
);

export const loadAttendancePeriod = createAsyncThunk(
  'attendance/loadPeriod',
  async (
    input: { month: string; scope: AttendancePeriodScope },
    thunkApi,
  ) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return attendanceRepository.getAttendancePeriod(
      employeeId,
      input.month,
      input.scope,
    );
  },
);

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    clearAttendanceError(state) {
      state.error = undefined;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(markAttendance.pending, (state, action) => {
        state.status = 'loading';
        state.locationStatus = 'loading';
        state.error = undefined;
        // A history request started before this punch must not overwrite the
        // newly-created record when its response arrives later.
        state.historyRequestId = undefined;
        state.markRequestId = action.meta.requestId;
      })
      .addCase(markAttendance.fulfilled, (state, action) => {
        if (state.markRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'success';
        state.locationStatus = 'success';
        state.markRequestId = undefined;
        const recordMonth = formatIsoMonthKey(action.payload.timestamp);
        if (state.loadedMonth === recordMonth) {
          state.records.unshift(action.payload);
        } else {
          state.records = [action.payload];
          state.loadedMonth = recordMonth;
        }
      })
      .addCase(markAttendance.rejected, (state, action) => {
        if (state.markRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'error';
        state.locationStatus =
          action.error.message === 'OUTSIDE_GEOFENCE' ? 'error' : state.locationStatus;
        state.error = action.error.message;
        state.markRequestId = undefined;
      })
      .addCase(loadAttendanceHistory.pending, (state, action) => {
        state.status = 'loading';
        state.error = undefined;
        state.historyRequestId = action.meta.requestId;
      })
      .addCase(loadAttendanceHistory.fulfilled, (state, action) => {
        if (state.historyRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'success';
        state.error = undefined;
        state.records = action.payload;
        state.loadedMonth = action.meta.arg ?? currentPayrollMonth();
        state.historyRequestId = undefined;
      })
      .addCase(loadAttendanceHistory.rejected, (state, action) => {
        if (state.historyRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'error';
        state.error = action.error.message;
        state.historyRequestId = undefined;
      })
      .addCase(loadAttendancePeriod.pending, (state, action) => {
        state.periodHistory.status = 'loading';
        state.periodHistory.error = undefined;
        state.periodHistory.requestId = action.meta.requestId;
        state.periodHistory.requestedKey = `${action.meta.arg.scope}:${action.meta.arg.month}`;
      })
      .addCase(loadAttendancePeriod.fulfilled, (state, action) => {
        if (state.periodHistory.requestId !== action.meta.requestId) {
          return;
        }
        const period = action.payload;
        state.periodHistory.status = 'success';
        state.periodHistory.records = period.records;
        state.periodHistory.cycleAvailable = period.cycleAvailable;
        state.periodHistory.loadedKey = `${period.scope}:${period.month}`;
        state.periodHistory.scope = period.scope;
        state.periodHistory.month = period.month;
        state.periodHistory.fromDate = period.fromDate;
        state.periodHistory.toDate = period.toDate;
        state.periodHistory.policy = period.policy;
        state.periodHistory.error = undefined;
        state.periodHistory.requestId = undefined;
      })
      .addCase(loadAttendancePeriod.rejected, (state, action) => {
        if (state.periodHistory.requestId !== action.meta.requestId) {
          return;
        }
        state.periodHistory.status = 'error';
        state.periodHistory.error = action.error.message;
        state.periodHistory.requestId = undefined;
      })
      .addCase(loadAttendanceToday.pending, (state, action) => {
        state.today.status = 'loading';
        state.today.error = undefined;
        state.today.requestId = action.meta.requestId;
      })
      .addCase(loadAttendanceToday.fulfilled, (state, action) => {
        if (state.today.requestId !== action.meta.requestId) {
          return;
        }
        state.today.status = 'success';
        state.today.data = action.payload;
        state.today.error = undefined;
        state.today.requestId = undefined;
      })
      .addCase(loadAttendanceToday.rejected, (state, action) => {
        if (state.today.requestId !== action.meta.requestId) {
          return;
        }
        state.today.status = 'error';
        state.today.error = action.error.message;
        state.today.requestId = undefined;
      })
      .addMatcher(action => action.type === 'auth/logout/fulfilled', () => {
        return initialState;
      });
  },
});

export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;
