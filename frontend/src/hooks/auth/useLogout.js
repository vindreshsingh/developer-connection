import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from './authApi';

export const useLogout = () => {
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return { logout: handleLogout };
};
