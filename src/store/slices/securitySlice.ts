import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type SecurityState = {
  isLocked: boolean;
  backgroundedAt?: number;
};

const initialState: SecurityState = {
  isLocked: false,
};

const securitySlice = createSlice({
  name: 'security',
  initialState,
  reducers: {
    setLocked(state, action: PayloadAction<boolean>) {
      state.isLocked = action.payload;
    },
    setBackgroundedAt(state, action: PayloadAction<number | undefined>) {
      state.backgroundedAt = action.payload;
    },
  },
});

export const { setLocked, setBackgroundedAt } = securitySlice.actions;
export default securitySlice.reducer;
