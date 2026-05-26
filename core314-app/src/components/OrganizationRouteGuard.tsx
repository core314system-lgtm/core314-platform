import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { Loader2 } from 'lucide-react';

/**
 * OrganizationRouteGuard - Pure routing guard for org-dependent routes
 * 
 * This guard ONLY performs routing decisions:
 * - While loading: Shows a global spinner OUTSIDE any dashboard/layout
 * - No organizations: Redirects to /settings/organization (valid onboarding state)
 * - Organization resolved: Renders child routes via Outlet
 * 
 * This guard NEVER renders:
 * - Error UI
 * - Retry buttons
 * - Dashboard shell or sidebar
 * - Any messaging for no-org state
 * 
 * No-org is a valid onboarding state, not an error.
 * Users without orgs are redirected BEFORE any org route renders.
 */
export function OrganizationRouteGuard() {
  const { loading, hasNoOrganizations, organizations, currentOrganization } = useOrganization();
  const location = useLocation();

  // While loading org data, show a global spinner OUTSIDE dashboard/layout
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // No organizations is a valid onboarding state - redirect to settings/organization
  // This is NOT an error, so we redirect cleanly without any error UI
  if (hasNoOrganizations || organizations.length === 0) {
    return (
      <Navigate
        to="/settings/organization"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Organizations exist but no current org selected (edge case - context auto-picks first org)
  // If this happens, wait for context to resolve or redirect
  if (!currentOrganization) {
    return (
      <Navigate
        to="/settings/organization"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Organization is resolved - allow org routes to render
  return <Outlet />;
}
