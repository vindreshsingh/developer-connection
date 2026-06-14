import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tab: 'browse',
  page: 1,
  type: '',
  skills: '',
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    tabChanged(state, action) {
      state.tab = action.payload;
      state.page = 1;
    },
    pageChanged(state, action) {
      state.page = action.payload;
    },
    typeChanged(state, action) {
      state.type = action.payload;
      state.page = 1;
    },
    skillsChanged(state, action) {
      state.skills = action.payload;
      state.page = 1;
    },
  },
});

export const { tabChanged, pageChanged, typeChanged, skillsChanged } = jobsSlice.actions;
export default jobsSlice.reducer;
