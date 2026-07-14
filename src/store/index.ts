import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import attendanceReducer from './slices/attendanceSlice';
import clientReducer from './slices/clientSlice';
import leaveReducer from './slices/leaveSlice';
import networkReducer from './slices/networkSlice';
import preferencesReducer from './slices/preferencesSlice';
import securityReducer from './slices/securitySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    attendance: attendanceReducer,
    client: clientReducer,
    leave: leaveReducer,
    network: networkReducer,
    preferences: preferencesReducer,
    security: securityReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
