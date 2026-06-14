import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeConversationId: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    conversationSelected(state, action) {
      state.activeConversationId = action.payload;
    },
  },
});

export const { conversationSelected } = messagesSlice.actions;
export default messagesSlice.reducer;
