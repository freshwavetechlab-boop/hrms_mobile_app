import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SupportedLocale = 'en';

type PreferencesState = {
  darkMode: boolean;
  locale: SupportedLocale;
};

const initialState: PreferencesState = {
  darkMode: false,
  locale: 'en',
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setDarkMode(state, action: PayloadAction<boolean>) {
      state.darkMode = action.payload;
    },
  },
});

export const { setDarkMode } = preferencesSlice.actions;
export default preferencesSlice.reducer;
