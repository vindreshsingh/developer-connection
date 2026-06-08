import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLoginMutation, useResendVerificationMutation } from '../store/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [login, { isLoading }] = useLoginMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setNeedsVerification(false);
    const result = await login({ email, password });
    if (result.error) {
      setError(result.error.data?.error || 'Login failed');
      setNeedsVerification(result.error.status === 403);
      return;
    }
    navigate('/');
  };

  const handleResend = async () => {
    setResendMessage('');
    const result = await resendVerification(email);
    setResendMessage(
      result.error ? result.error.data?.error || 'Could not resend verification email' : result.data.message
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-extrabold text-purple-600 text-center mb-1">DevConnect</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Find your next collaborator</p>

        {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

        {needsVerification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-center">
            <p className="text-amber-700 text-sm mb-1">Didn't get the email?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-purple-600 font-medium text-sm hover:underline disabled:opacity-60"
            >
              {isResending ? 'Resending...' : 'Resend verification email'}
            </button>
            {resendMessage && <p className="text-gray-500 text-xs mt-1">{resendMessage}</p>}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
        >
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          New here?{' '}
          <Link to="/signup" className="text-purple-600 font-medium">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
