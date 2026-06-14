import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  page: 1,
};

const callHistorySlice = createSlice({
  name: 'callHistory',
  initialState,
  reducers: {
    pageChanged(state, action) {
      state.page = action.payload;
    },
  },
});

export const { pageChanged } = callHistorySlice.actions;
export default callHistorySlice.reducer;
