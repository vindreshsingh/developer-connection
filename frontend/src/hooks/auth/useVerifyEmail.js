import { useEffect, useRef, useState } from 'react';
import { useVerifyEmailMutation } from './authApi';

// Fires the verification request exactly once per token (StrictMode-safe via the ref guard)
// and exposes a small status machine for the container to render.
export const useVerifyEmail = (token) => {
  const [verifyEmail] = useVerifyEmailMutation();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    verifyEmail(token)
      .unwrap()
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Email verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.data?.error || 'Invalid or expired verification link.');
      });
  }, [token, verifyEmail]);

  return { status, message };
};
