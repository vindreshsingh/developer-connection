import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import Banner from '@/components/Banner/Banner';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useLogin } from '@/hooks/auth/useLogin';
import reducer, { submissionStarted, submissionFailed, resendMessageReceived } from './reducer';
import { parseLoginOutcome, parseResendOutcome } from './parser';

export default function LoginContainer() {
  useInjectReducer('login', reducer);

  const dispatch = useDispatch();
  const { error, needsVerification, resendMessage } = useSelector((state) => state.login);
  const { login, isLoading, resendVerification, isResending, goToFeed } = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(submissionStarted());

    const result = await login({ email, password });
    const outcome = parseLoginOutcome(result);
    if (!outcome.ok) {
      dispatch(submissionFailed(outcome));
      return;
    }
    goToFeed();
  };

  const handleResend = async () => {
    const result = await resendVerification(email);
    dispatch(resendMessageReceived(parseResendOutcome(result)));
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 [background:radial-gradient(circle_at_top_left,#f3e8ff,transparent_55%),radial-gradient(circle_at_bottom_right,#fce7f3,transparent_55%),linear-gradient(to_bottom_right,#faf5ff,#fdf2f8)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_24px_-12px_rgba(147,51,234,0.2)] [animation:dc-pop-in_0.4s_ease_both] sm:p-8">
        <h1 className="mb-1 bg-gradient-to-br from-purple-600 to-pink-500 bg-clip-text text-center text-[1.75rem] font-extrabold text-transparent">DevConnect</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Find your next collaborator</p>

        <Banner variant="error" className="text-center mb-3">{error}</Banner>

        {needsVerification && (
          <Banner variant="warning" className="mb-4">
            <span className="block mb-1">Didn't get the email?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-sm font-medium text-purple-600 hover:underline disabled:opacity-60"
            >
              {isResending ? 'Resending...' : 'Resend verification email'}
            </button>
            {resendMessage && <span className="block text-gray-500 text-xs mt-1">{resendMessage}</span>}
          </Banner>
        )}

        <FormInput
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          wrapperClassName="mb-4"
        />
        <FormInput
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          wrapperClassName="mb-6"
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Logging in...' : 'Log In'}
        </Button>

        <p className="mt-4 text-center text-sm text-gray-500">
          New here?{' '}
          <Link to="/signup" className="font-medium text-purple-600">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
