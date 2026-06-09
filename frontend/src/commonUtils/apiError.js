// Extracts the human-readable message our backend puts on `error.data.error`
// for RTK Query error shapes, falling back to a generic message.
export const getApiErrorMessage = (error, fallback = 'Something went wrong') => error?.data?.error || fallback;
