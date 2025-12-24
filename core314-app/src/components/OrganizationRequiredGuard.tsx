import { Outlet, Link } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Building2, AlertCircle, RefreshCw, Loader2, Settings } from 'lucide-react';

/**
 * OrganizationRequiredGuard - Route wrapper that ensures user has an active organization
 * 
 * This component should wrap org-dependent routes in App.tsx, NOT the entire MainLayout.
 * It displays fallback UI inside the page content area while keeping sidebar/navigation accessible.
 * 
 * Usage in App.tsx:
 * <Route element={<OrganizationRequiredGuard />}>
 *   <Route path="dashboard" element={<Dashboard />} />
 *   <Route path="integrations" element={<Integrations />} />
 * </Route>
 */
export function OrganizationRequiredGuard() {
  const { 
    loading, 
    error, 
    hasNoOrganizations, 
    currentOrganization, 
    organizations, 
    switchOrganization, 
    refreshOrganizations 
  } = useOrganization();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <CardTitle>Failed to Load Organizations</CardTitle>
            </div>
            <CardDescription>
              We couldn't load your organization data. This might be a temporary issue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
            <Button onClick={refreshOrganizations} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-2">
                You can still access your account settings:
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasNoOrganizations) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <CardTitle>No Organization Found</CardTitle>
            </div>
            <CardDescription>
              You're not a member of any organization yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              To access this feature, you need to be part of an organization. Check your email for an organization invite, or contact your administrator.
            </p>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-2">
                You can still access your account settings:
              </p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentOrganization && organizations.length > 1) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <CardTitle>Select an Organization</CardTitle>
            </div>
            <CardDescription>
              You belong to multiple organizations. Please select one to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organizations.map((org) => (
                <Button
                  key={org.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => switchOrganization(org.id)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {org.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization is selected, render the child routes
  return <Outlet />;
}
