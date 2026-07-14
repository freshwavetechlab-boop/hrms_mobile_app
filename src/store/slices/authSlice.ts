import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authRepository } from '../../repositories/authRepository';
import { faceEnrollmentService } from '../../services/faceEnrollmentService';
import { FaceRegistrationCapture, Session } from '../../types/domain';

type FaceEnrollmentStatus = 'unknown' | 'checking' | 'required' | 'registered';

type AuthState = {
  session?: Session;
  isRestoring: boolean;
  isAuthenticated: boolean;
  faceEnrollmentStatus: FaceEnrollmentStatus;
  error?: string;
};

const initialState: AuthState = {
  isRestoring: true,
  isAuthenticated: false,
  faceEnrollmentStatus: 'unknown',
};

export const restoreSession = createAsyncThunk('auth/restore', async () => {
  const session = authRepository.restoreSession();
  return session;
});

export const login = createAsyncThunk(
  'auth/login',
  async ({ identifier, password }: { identifier: string; password: string }) =>
    authRepository.login(identifier, password),
);

export const loginWithBiometric = createAsyncThunk('auth/loginWithBiometric', async () =>
  authRepository.loginWithBiometric(),
);

export const logout = createAsyncThunk('auth/logout', async () => {
  authRepository.logout();
});

export const checkFaceEnrollment = createAsyncThunk(
  'auth/checkFaceEnrollment',
  async (employeeId: string) => faceEnrollmentService.getStatus(employeeId),
);

export const enrollFace = createAsyncThunk(
  'auth/enrollFace',
  async ({ employeeId, captures }: { employeeId: string; captures: FaceRegistrationCapture[] }) =>
    faceEnrollmentService.enroll(employeeId, captures),
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = Boolean(action.payload);
        state.isRestoring = false;
        state.faceEnrollmentStatus = action.payload ? 'unknown' : 'required';
      })
      .addCase(login.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = true;
        state.faceEnrollmentStatus = 'unknown';
        state.error = undefined;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(loginWithBiometric.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = true;
        state.faceEnrollmentStatus = 'unknown';
        state.error = undefined;
      })
      .addCase(loginWithBiometric.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(logout.fulfilled, state => {
        state.session = undefined;
        state.isAuthenticated = false;
        state.faceEnrollmentStatus = 'unknown';
      })
      .addCase(checkFaceEnrollment.pending, state => {
        state.faceEnrollmentStatus = 'checking';
      })
      .addCase(checkFaceEnrollment.fulfilled, (state, action) => {
        state.faceEnrollmentStatus = action.payload ? 'registered' : 'required';
      })
      .addCase(checkFaceEnrollment.rejected, state => {
        state.faceEnrollmentStatus = 'required';
      })
      .addCase(enrollFace.fulfilled, state => {
        state.faceEnrollmentStatus = 'registered';
      });
  },
});

export default authSlice.reducer;
