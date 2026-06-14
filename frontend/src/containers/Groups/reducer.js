import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  appliedTags: '',
  page: 1,
};

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    filterApplied(state, action) {
      state.appliedTags = action.payload;
      state.page = 1;
    },
    filterCleared(state) {
      state.appliedTags = '';
      state.page = 1;
    },
    pageChanged(state, action) {
      state.page = action.payload;
    },
  },
});

export const { filterApplied, filterCleared, pageChanged } = groupsSlice.actions;
export default groupsSlice.reducer;
