import { getApiErrorMessage } from '@/commonUtils/apiError';

export const parseSignupOutcome = (result) =>
  result.error ? { ok: false, error: getApiErrorMessage(result.error, 'Signup failed') } : { ok: true };
