import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireAdminProps {
  children: React.ReactNode;
}

/**
 * Hard guard for /admin/* routes.
 * Redirects non-admin users to /brief immediately.
 * Must wrap every admin route in App.tsx.
 */
export function RequireAdmin({ children }: RequireAdminProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/brief" replace />;
  }

  return <>{children}</>;
}
