import { useContext } from 'react';
import { AuthContext } from '@/context/authContextInstance';

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
