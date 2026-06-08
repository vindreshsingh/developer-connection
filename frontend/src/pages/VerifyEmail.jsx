import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useVerifyEmailMutation } from '../store/api';

export default function VerifyEmail() {
  const { token } = useParams();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-extrabold text-purple-600 mb-4">DevConnect</h1>

        {status === 'loading' && <p className="text-gray-500">Verifying your email...</p>}

        {status === 'success' && (
          <>
            <p className="text-green-600 font-medium mb-4">{message}</p>
            <Link
              to="/login"
              className="inline-block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-500 font-medium mb-4">{message}</p>
            <Link to="/login" className="text-purple-600 font-medium">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
