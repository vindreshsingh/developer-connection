import { getApiErrorMessage } from '@/commonUtils/apiError';

// Reshapes the raw RTK Query mutation result into the view-model the
// container's reducer needs (display message + whether to show the resend banner).
export const parseLoginOutcome = (result) => {
  if (!result.error) return { ok: true };

  return {
    ok: false,
    error: getApiErrorMessage(result.error, 'Login failed'),
    needsVerification: result.error.status === 403,
  };
};

export const parseResendOutcome = (result) =>
  result.error ? getApiErrorMessage(result.error, 'Could not resend verification email') : result.data.message;
