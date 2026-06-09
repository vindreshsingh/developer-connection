import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { api } from './api';

const staticReducers = {
  [api.reducerPath]: api.reducer,
};

const createReducer = (asyncReducers = {}) =>
  combineReducers({ ...staticReducers, ...asyncReducers });

export const store = configureStore({
  reducer: createReducer(),
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

// Dynamic reducer injection: page-local slices are registered only when the
// page that owns them mounts, instead of being combined into the root reducer
// at startup. See commonUtils/useInjectReducer.js for the consumer-side hook.
store.asyncReducers = {};

store.injectReducer = (key, reducer) => {
  if (store.asyncReducers[key]) return;

  store.asyncReducers[key] = reducer;
  store.replaceReducer(createReducer(store.asyncReducers));
};
