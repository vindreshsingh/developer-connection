import { useGetMyProfileQuery } from '@/hooks/profile/profileApi';
import { AuthContext } from './authContextInstance';

// The profile query is called ONCE here at the top of the app and the result
// is shared via context — no component lower in the tree re-subscribes to the
// RTK Query endpoint independently, so there are no duplicate requests and no
// re-fetches triggered by component mount/unmount during SPA navigation.
export function AuthProvider({ children }) {
  const { data: user = null, isLoading } = useGetMyProfileQuery();

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
