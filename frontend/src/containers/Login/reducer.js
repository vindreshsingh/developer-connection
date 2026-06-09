import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  error: '',
  needsVerification: false,
  resendMessage: '',
};

const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    submissionStarted(state) {
      state.error = '';
      state.resendMessage = '';
      state.needsVerification = false;
    },
    submissionFailed(state, action) {
      state.error = action.payload.error;
      state.needsVerification = action.payload.needsVerification;
    },
    resendMessageReceived(state, action) {
      state.resendMessage = action.payload;
    },
  },
});

export const { submissionStarted, submissionFailed, resendMessageReceived } = loginSlice.actions;
export default loginSlice.reducer;
