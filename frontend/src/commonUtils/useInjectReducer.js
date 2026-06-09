import { store } from '@/store';

// Registers a page-local RTK slice reducer with the store synchronously so
// that state[key] is available on the very first render (a useEffect fires
// after render, which is too late for useSelector calls in the same component).
// store.injectReducer guards against double-registration, so this is safe to
// call on every render.
export const useInjectReducer = (key, reducer) => {
  store.injectReducer(key, reducer);
};
