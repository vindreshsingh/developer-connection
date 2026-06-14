import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  applicantsPage: 1,
};

const jobDetailSlice = createSlice({
  name: 'jobDetail',
  initialState,
  reducers: {
    applicantsPageChanged(state, action) {
      state.applicantsPage = action.payload;
    },
  },
});

export const { applicantsPageChanged } = jobDetailSlice.actions;
export default jobDetailSlice.reducer;
