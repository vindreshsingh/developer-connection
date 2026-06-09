import { useAuth } from '@/hooks/auth/useAuth';

// Reads the already-fetched auth state from AuthContext — does NOT trigger
// a new API request. The single useGetMyProfileQuery call lives in AuthProvider.
export const useCurrentUser = () => useAuth();
