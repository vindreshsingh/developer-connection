import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  error: '',
};

const signupSlice = createSlice({
  name: 'signup',
  initialState,
  reducers: {
    submissionStarted(state) {
      state.error = '';
    },
    submissionFailed(state, action) {
      state.error = action.payload;
    },
  },
});

export const { submissionStarted, submissionFailed } = signupSlice.actions;
export default signupSlice.reducer;
