import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import NavBar from '@/widgets/NavBar/NavBar';
import CallProvider from '@/context/CallProvider';
import { routes } from '@/routes';

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen text-gray-400">
    Loading...
  </div>
);

function ProtectedRoute({ children }) {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function GuardedPage({ Page, guard }) {
  const element = (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-gray-400">
          Loading...
        </div>
      }
    >
      <Page />
    </Suspense>
  );

  if (guard === 'protected') return <ProtectedRoute>{element}</ProtectedRoute>;
  if (guard === 'public-only') return <PublicOnlyRoute>{element}</PublicOnlyRoute>;
  return element;
}

export default function App() {
  return (
    <CallProvider>
      <div className="min-h-screen">
        <NavBar />
        <Routes>
          {routes.map(({ path, Page, guard }) => (
            <Route key={path} path={path} element={<GuardedPage Page={Page} guard={guard} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </CallProvider>
  );
}
