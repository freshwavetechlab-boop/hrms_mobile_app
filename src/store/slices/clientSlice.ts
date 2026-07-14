import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clientRepository } from '../../repositories/clientRepository';
import { ClientProfile } from '../../types/domain';

type ClientState = {
  selectedClient?: ClientProfile;
  isRestoring: boolean;
  isValidating: boolean;
  error?: string;
};

const initialState: ClientState = {
  isRestoring: true,
  isValidating: false,
};

export const restoreClient = createAsyncThunk('client/restore', async () =>
  clientRepository.restoreClient(),
);

export const validateClientCode = createAsyncThunk('client/validateCode', async (clientCode: string) =>
  clientRepository.validateClientCode(clientCode),
);

export const clearClientSelection = createAsyncThunk('client/clearSelection', async () => {
  clientRepository.clearClient();
});

const clientSlice = createSlice({
  name: 'client',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(restoreClient.fulfilled, (state, action) => {
        state.selectedClient = action.payload;
        state.isRestoring = false;
      })
      .addCase(validateClientCode.pending, state => {
        state.isValidating = true;
        state.error = undefined;
      })
      .addCase(validateClientCode.fulfilled, (state, action) => {
        state.selectedClient = action.payload;
        state.isValidating = false;
      })
      .addCase(validateClientCode.rejected, (state, action) => {
        state.isValidating = false;
        state.error = action.error.message;
      })
      .addCase(clearClientSelection.fulfilled, state => {
        state.selectedClient = undefined;
        state.error = undefined;
      });
  },
});

export default clientSlice.reducer;
