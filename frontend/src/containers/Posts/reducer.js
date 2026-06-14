import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  scope: 'network',
  page: 1,
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    scopeChanged(state, action) {
      state.scope = action.payload;
      state.page = 1;
    },
    pageChanged(state, action) {
      state.page = action.payload;
    },
  },
});

export const { scopeChanged, pageChanged } = postsSlice.actions;
export default postsSlice.reducer;
