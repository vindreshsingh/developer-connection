import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'pending',
};

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    tabChanged(state, action) {
      state.activeTab = action.payload;
    },
  },
});

export const { tabChanged } = requestsSlice.actions;
export default requestsSlice.reducer;
