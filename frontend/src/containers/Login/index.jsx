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
import './Login.scss';

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
    <div className="dc-auth-page">
      <form onSubmit={handleSubmit} className="dc-auth-card">
        <h1 className="dc-auth-title">DevConnect</h1>
        <p className="dc-auth-subtitle">Find your next collaborator</p>

        <Banner variant="error" className="text-center mb-3">{error}</Banner>

        {needsVerification && (
          <Banner variant="warning" className="mb-4">
            <span className="block mb-1">Didn't get the email?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="dc-auth-link text-sm hover:underline disabled:opacity-60"
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

        <p className="dc-auth-footer">
          New here?{' '}
          <Link to="/signup" className="dc-auth-link">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
