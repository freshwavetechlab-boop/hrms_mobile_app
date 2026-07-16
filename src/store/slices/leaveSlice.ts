import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { leaveRepository } from '../../repositories/leaveRepository';
import { LeaveApplication, LeaveBalance, LeaveType, LoadingState } from '../../types/domain';
import { createId } from '../../utils/id';
import { RootState } from '..';

type LeaveState = {
  balances: Record<LeaveType, number>;
  codes: Partial<Record<LeaveType, string>>;
  allowHalfDay: Partial<Record<LeaveType, boolean>>;
  availableTypes: LeaveBalance[];
  applications: LeaveApplication[];
  status: LoadingState;
  loadRequestId?: string;
  applyRequestId?: string;
  error?: string;
};

type ApplyLeaveInput = {
  leaveType: LeaveType;
  dayType: NonNullable<LeaveApplication['dayType']>;
  fromDate: string;
  toDate: string;
  reason: string;
};

const initialState: LeaveState = {
  balances: {},
  codes: {},
  allowHalfDay: {},
  availableTypes: [],
  applications: [],
  status: 'idle',
};

const calculateLeaveDays = (fromDate: string, toDate: string) => {
  const start = parseISO(fromDate);
  const end = parseISO(toDate);

  if (!isValid(start) || !isValid(end)) {
    throw new Error('INVALID_LEAVE_DATES');
  }

  const days = differenceInCalendarDays(end, start) + 1;
  if (days <= 0) {
    throw new Error('INVALID_LEAVE_RANGE');
  }

  return days;
};

export const loadLeaveData = createAsyncThunk(
  'leave/loadData',
  async (_, thunkApi) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return leaveRepository.getLeaveData(employeeId);
  },
);

export const applyLeave = createAsyncThunk(
  'leave/apply',
  async (input: ApplyLeaveInput, thunkApi) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }

    const calendarDays = calculateLeaveDays(input.fromDate, input.toDate);
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new Error('LEAVE_REASON_REQUIRED');
    }

    const selectedType = state.leave.availableTypes.find(
      item => item.key === input.leaveType || item.leaveCode === input.leaveType,
    );
    const leaveCode = selectedType?.leaveCode ?? state.leave.codes[input.leaveType];
    if (!leaveCode) {
      throw new Error('LEAVE_TYPE_UNAVAILABLE');
    }
    const isHalfDay = input.dayType !== 'Full Day';
    if (isHalfDay && selectedType?.allowHalfDay !== true) {
      throw new Error('LEAVE_HALF_DAY_UNAVAILABLE');
    }
    if (isHalfDay && calendarDays !== 1) {
      throw new Error('INVALID_LEAVE_RANGE');
    }

    const application: LeaveApplication = {
      id: createId('leave'),
      employeeId,
      leaveType: input.leaveType,
      leaveTypeName: selectedType?.leaveType,
      leaveCode,
      dayType: input.dayType,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days: isHalfDay ? 0.5 : calendarDays,
      reason,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
    };

    return leaveRepository.createLeaveRequest(application);
  },
);

const leaveSlice = createSlice({
  name: 'leave',
  initialState,
  reducers: {
    clearLeaveError(state) {
      state.error = undefined;
    },
    setLeaveStatus(
      state,
      action: PayloadAction<{ id: string; status: LeaveApplication['status'] }>,
    ) {
      const application = state.applications.find(item => item.id === action.payload.id);
      if (application) {
        application.status = action.payload.status;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadLeaveData.pending, (state, action) => {
        state.status = 'loading';
        state.error = undefined;
        state.loadRequestId = action.meta.requestId;
      })
      .addCase(loadLeaveData.fulfilled, (state, action) => {
        if (state.loadRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'success';
        state.error = undefined;
        state.loadRequestId = undefined;
        state.balances = action.payload.balances;
        state.codes = action.payload.codes;
        state.allowHalfDay = action.payload.allowHalfDay;
        state.availableTypes = action.payload.availableTypes;
        state.applications = action.payload.applications;
      })
      .addCase(loadLeaveData.rejected, (state, action) => {
        if (state.loadRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'error';
        state.error = action.error.message;
        state.loadRequestId = undefined;
      })
      .addCase(applyLeave.pending, (state, action) => {
        state.status = 'loading';
        state.error = undefined;
        // Ignore any pre-submit snapshot that resolves after this mutation.
        state.loadRequestId = undefined;
        state.applyRequestId = action.meta.requestId;
      })
      .addCase(applyLeave.fulfilled, (state, action) => {
        if (state.applyRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'success';
        state.applyRequestId = undefined;
        state.applications.unshift(action.payload);
      })
      .addCase(applyLeave.rejected, (state, action) => {
        if (state.applyRequestId !== action.meta.requestId) {
          return;
        }
        state.status = 'error';
        state.error = action.error.message;
        state.applyRequestId = undefined;
      })
      .addMatcher(action => action.type === 'auth/logout/fulfilled', () => {
        return initialState;
      });
  },
});

export const { clearLeaveError, setLeaveStatus } = leaveSlice.actions;
export default leaveSlice.reducer;
