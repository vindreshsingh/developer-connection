import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  dismissed: [],
};

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    profileDismissed(state, action) {
      if (!state.dismissed.includes(action.payload)) {
        state.dismissed.push(action.payload);
      }
    },
  },
});

export const { profileDismissed } = feedSlice.actions;
export default feedSlice.reducer;
