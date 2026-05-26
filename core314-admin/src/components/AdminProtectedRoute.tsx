import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { adminUser, authStatus } = useAdminAuth();

  // Explicit state machine handling - no ambiguous boolean combinations
  switch (authStatus) {
    case 'loading':
      // Show spinner while auth is resolving (max 3 seconds due to timeout)
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      );
    
    case 'unauthenticated':
      // Redirect to login - no spinner, immediate redirect
      console.debug('[AdminProtectedRoute] Redirecting to /login (unauthenticated)');
      return <Navigate to="/login" replace />;
    
    case 'authenticated':
      // Double-check admin status before rendering
      if (!adminUser?.is_platform_admin) {
        console.debug('[AdminProtectedRoute] Redirecting to /login (not admin)');
        return <Navigate to="/login" replace />;
      }
      return <>{children}</>;
    
    default:
      // Fallback - should never happen, but fail closed
      console.debug('[AdminProtectedRoute] Unknown auth status, redirecting to /login');
      return <Navigate to="/login" replace />;
  }
}
