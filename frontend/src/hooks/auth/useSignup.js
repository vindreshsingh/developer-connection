import { useNavigate } from 'react-router-dom';
import { useSignupMutation } from './authApi';

export const useSignup = () => {
  const navigate = useNavigate();
  const [signup, { isLoading }] = useSignupMutation();

  return { signup, isLoading, goToLogin: () => navigate('/login') };
};
