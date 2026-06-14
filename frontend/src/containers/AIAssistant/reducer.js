import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'recommendations',
};

const aiAssistantSlice = createSlice({
  name: 'aiAssistant',
  initialState,
  reducers: {
    tabChanged(state, action) {
      state.activeTab = action.payload;
    },
  },
});

export const { tabChanged } = aiAssistantSlice.actions;
export default aiAssistantSlice.reducer;
