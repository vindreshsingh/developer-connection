import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  message: '',
  error: '',
  imageError: '',
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    saveStarted(state) {
      state.message = '';
      state.error = '';
    },
    saveSucceeded(state) {
      state.message = 'Profile updated successfully';
      state.error = '';
    },
    saveFailed(state, action) {
      state.error = action.payload;
      state.message = '';
    },
    imageUploadSucceeded(state) {
      state.imageError = '';
      state.message = 'Image uploaded successfully';
    },
    imageUploadFailed(state, action) {
      state.imageError = action.payload;
    },
    messagesCleared(state) {
      state.message = '';
      state.error = '';
      state.imageError = '';
    },
  },
});

export const {
  saveStarted,
  saveSucceeded,
  saveFailed,
  imageUploadSucceeded,
  imageUploadFailed,
  messagesCleared,
} = profileSlice.actions;
export default profileSlice.reducer;
