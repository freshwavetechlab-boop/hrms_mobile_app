import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NetworkState } from '../../types/domain';

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
  isSyncing: false,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworkState(
      state,
      action: PayloadAction<Pick<NetworkState, 'isConnected' | 'isInternetReachable' | 'type'>>,
    ) {
      state.isConnected = action.payload.isConnected;
      state.isInternetReachable = action.payload.isInternetReachable;
      state.type = action.payload.type;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setLastSyncedAt(state, action: PayloadAction<string>) {
      state.lastSyncedAt = action.payload;
    },
  },
});

export const { setNetworkState, setSyncing, setLastSyncedAt } = networkSlice.actions;
export default networkSlice.reducer;
