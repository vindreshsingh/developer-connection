import { useNavigate } from 'react-router-dom';
import { useLoginMutation, useResendVerificationMutation } from './authApi';

// Thin API wrapper — interpretation of the raw mutation result lives in
// containers/Login/parser.js so the hook stays a pure data-fetching boundary.
export const useLogin = () => {
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();

  return {
    login,
    isLoading,
    resendVerification,
    isResending,
    goToFeed: () => navigate('/'),
  };
};
