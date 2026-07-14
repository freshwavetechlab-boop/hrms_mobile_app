import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { attendanceRepository } from '../../repositories/attendanceRepository';
import { AttendanceRecord, AttendanceType, LoadingState } from '../../types/domain';
import { RootState } from '..';

type AttendanceState = {
  records: AttendanceRecord[];
  status: LoadingState;
  faceStatus: LoadingState;
  locationStatus: LoadingState;
  error?: string;
};

const initialState: AttendanceState = {
  records: [],
  status: 'idle',
  faceStatus: 'idle',
  locationStatus: 'idle',
};

export const markAttendance = createAsyncThunk(
  'attendance/mark',
  async (
    input: {
      attendanceType: AttendanceType;
      location: { latitude: number; longitude: number; accuracyMeters: number };
      imageRef: string;
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
      imageRef: input.imageRef,
      networkType: state.network.type,
      isOnline: state.network.isConnected && state.network.isInternetReachable,
    });
  },
);

export const loadAttendanceHistory = createAsyncThunk(
  'attendance/loadHistory',
  async (_, thunkApi) => {
    const state = thunkApi.getState() as RootState;
    const employeeId = state.auth.session?.employee.id;
    if (!employeeId) {
      throw new Error('SESSION_EXPIRED');
    }
    return attendanceRepository.getAttendanceHistory(employeeId);
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
      .addCase(markAttendance.pending, state => {
        state.status = 'loading';
        state.faceStatus = 'loading';
        state.locationStatus = 'loading';
        state.error = undefined;
      })
      .addCase(markAttendance.fulfilled, (state, action) => {
        state.status = 'success';
        state.faceStatus = 'success';
        state.locationStatus = 'success';
        state.records.unshift(action.payload);
      })
      .addCase(markAttendance.rejected, (state, action) => {
        state.status = 'error';
        state.faceStatus = action.error.message === 'FACE_MISMATCH' ? 'error' : state.faceStatus;
        state.locationStatus =
          action.error.message === 'OUTSIDE_GEOFENCE' ? 'error' : state.locationStatus;
        state.error = action.error.message;
      })
      .addCase(loadAttendanceHistory.fulfilled, (state, action) => {
        if (action.payload.length > 0) {
          state.records = action.payload;
        }
      });
  },
});

export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;
