import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authRepository } from '../../repositories/authRepository';
import { employeeFromSelfProfile, essApiService } from '../../services/essApiService';
import { faceEnrollmentService } from '../../services/faceEnrollmentService';
import { sessionStorage } from '../../services/sessionStorage';
import {
  FaceRegistrationCapture,
  SaveEmployeeSelfProfileRequest,
  Session,
} from '../../types/domain';

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
  const session = await authRepository.restoreSession();
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
  await authRepository.logout();
});

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
    authRepository.changePassword(currentPassword, newPassword),
);


export const saveSelfProfile = createAsyncThunk(
  'auth/saveSelfProfile',
  async (request: SaveEmployeeSelfProfileRequest) => {
    const session = sessionStorage.getSession();
    if (!session) {
      throw new Error('SESSION_EXPIRED');
    }
    const profile = await essApiService.saveProfile(request);
    const employee = employeeFromSelfProfile(profile, session.employee);
    await sessionStorage.saveSession({ ...session, employee });
    return { employee, profile };
  },
);

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
  reducers: {
    invalidateSession(state) {
      state.session = undefined;
      state.isAuthenticated = false;
      state.faceEnrollmentStatus = 'unknown';
      state.error = undefined;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = Boolean(action.payload && !action.payload.mustChangePassword);
        state.isRestoring = false;
        state.faceEnrollmentStatus = action.payload && !action.payload.mustChangePassword
          ? 'unknown'
          : 'required';
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.session = undefined;
        state.isAuthenticated = false;
        state.isRestoring = false;
        state.faceEnrollmentStatus = 'required';
        state.error = action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = !action.payload.mustChangePassword;
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
      .addCase(changePassword.fulfilled, (state, action) => {
        state.session = action.payload;
        state.isAuthenticated = true;
        state.faceEnrollmentStatus = 'unknown';
        state.error = undefined;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(saveSelfProfile.fulfilled, (state, action) => {
        if (state.session) {
          state.session.employee = action.payload.employee;
        }
        state.error = undefined;
      })
      .addCase(saveSelfProfile.rejected, (state, action) => {
        state.error = action.error.message;
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

export const { invalidateSession } = authSlice.actions;
export default authSlice.reducer;
