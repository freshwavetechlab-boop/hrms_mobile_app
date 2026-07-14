import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { initialLeaveBalances } from '../../constants/leave';
import { leaveRepository } from '../../repositories/leaveRepository';
import { LeaveApplication, LeaveType, LoadingState } from '../../types/domain';
import { createId } from '../../utils/id';
import { RootState } from '..';

type LeaveState = {
  balances: Record<LeaveType, number>;
  codes: Partial<Record<LeaveType, string>>;
  allowHalfDay: Partial<Record<LeaveType, boolean>>;
  applications: LeaveApplication[];
  status: LoadingState;
  error?: string;
};

type ApplyLeaveInput = {
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
};

const initialState: LeaveState = {
  balances: initialLeaveBalances,
  codes: {},
  allowHalfDay: {},
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

    const days = calculateLeaveDays(input.fromDate, input.toDate);
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new Error('LEAVE_REASON_REQUIRED');
    }

    if (input.leaveType !== 'LOSS_OF_PAY' && state.leave.balances[input.leaveType] < days) {
      throw new Error('INSUFFICIENT_LEAVE_BALANCE');
    }
    const leaveCode = state.leave.codes[input.leaveType];
    if (!leaveCode) {
      throw new Error('LEAVE_TYPE_UNAVAILABLE');
    }

    const application: LeaveApplication = {
      id: createId('leave'),
      employeeId,
      leaveType: input.leaveType,
      leaveCode,
      dayType: 'Full Day',
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
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
      .addCase(loadLeaveData.fulfilled, (state, action) => {
        state.balances = action.payload.balances;
        state.codes = action.payload.codes;
        state.allowHalfDay = action.payload.allowHalfDay;
        if (action.payload.applications.length > 0) {
          state.applications = action.payload.applications;
        }
      })
      .addCase(applyLeave.pending, state => {
        state.status = 'loading';
        state.error = undefined;
      })
      .addCase(applyLeave.fulfilled, (state, action) => {
        state.status = 'success';
        state.applications.unshift(action.payload);
      })
      .addCase(applyLeave.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      });
  },
});

export const { clearLeaveError, setLeaveStatus } = leaveSlice.actions;
export default leaveSlice.reducer;
