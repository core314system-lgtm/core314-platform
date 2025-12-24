import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../lib/supabase';
import {
  Home,
  Layers, 
  LayoutDashboard,
  Target,
  Bell,
  Settings,
  LogOut,
  BarChart3,
  Building2,
  Zap,
  FileText,
  Sparkles,
  Activity,
  Globe,
  Shield,
  TrendingUp,
  Code,
  FileCheck,
  Headphones,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  badge?: string;
}

const getNavItems = (integrationBadge?: string, isAdmin?: boolean, subscriptionTier?: string): NavItem[] => {
  const baseItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/integrations', label: 'Integrations', icon: Layers, badge: integrationBadge },
    { path: '/visualizations', label: 'Visualizations', icon: BarChart3 },
    { path: '/fusion-details', label: 'Fusion Overview', icon: Zap },
    { path: '/dashboard-builder', label: 'Dashboard Builder', icon: LayoutDashboard },
    { path: '/goals', label: 'Goals & KPIs', icon: Target },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/integration-hub', label: 'Integration Hub', icon: Layers },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/settings/security', label: 'Security', icon: Shield },
  ];
  
  if (subscriptionTier === 'professional' || subscriptionTier === 'enterprise') {
    baseItems.push(
      { path: '/advanced-analytics', label: 'Advanced Analytics', icon: TrendingUp },
      { path: '/optimization-engine', label: 'Optimization Engine', icon: Zap }
    );
  }
  
  if (subscriptionTier === 'enterprise') {
    baseItems.push(
      { path: '/api-access', label: 'API Access', icon: Code },
      { path: '/audit-trails', label: 'Audit Trails', icon: FileCheck },
      { path: '/account-support', label: 'Account Support', icon: Headphones }
    );
  }
  
  if (isAdmin) {
    baseItems.push(
      { path: '/admin/automation-rules-manager', label: 'Automation Rules', icon: Zap },
      { path: '/admin/automation-logs', label: 'Automation Logs', icon: FileText },
      { path: '/admin/ai-narratives', label: 'AI Narratives', icon: Sparkles },
      { path: '/admin/simulations', label: 'Simulations', icon: Zap },
      { path: '/admin/optimizations', label: 'Optimizations', icon: Activity },
      { path: '/admin/insight-hub', label: 'Global Insights', icon: Globe },
      { path: '/admin/governance', label: 'AI Governance & Ethics', icon: Shield },
      { path: '/admin/organizations', label: 'Organizations', icon: Building2 }
    );
  }
  
  return baseItems;
};

function OrganizationRequiredGuard({ children }: { children: React.ReactNode }) {
  const { loading, error, hasNoOrganizations, currentOrganization, organizations, switchOrganization, refreshOrganizations } = useOrganization();

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
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={refreshOrganizations} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
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
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              To use Core314, you need to be part of an organization. You can either create a new organization or ask an existing organization owner to invite you.
            </p>
            <div className="space-y-2">
              <Button className="w-full" asChild>
                <Link to="/create-organization">Create Organization</Link>
              </Button>
              <p className="text-xs text-center text-gray-500">
                Or check your email for an organization invite
              </p>
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

  return <>{children}</>;
}

export function MainLayout() {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [integrationCount, setIntegrationCount] = useState<{ current: number; max: number }>({ current: 0, max: 0 });
  const [subscriptionTier, setSubscriptionTier] = useState<string>('none');

  useEffect(() => {
    const fetchIntegrationCount = async () => {
      if (!profile?.id) return;
      
      const { data, error } = await supabase
        .from('user_integrations')
        .select('id')
        .eq('user_id', profile.id)
        .eq('status', 'active');

      if (!error && data) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', profile.id)
          .single();
        
        const tierLimits: Record<string, number> = {
          none: 0,
          starter: 3,
          professional: 5,
          enterprise: -1,
        };
        
        const tier = profileData?.subscription_tier || 'none';
        setSubscriptionTier(tier);
        const maxIntegrations = tierLimits[tier];
        setIntegrationCount({ current: data.length, max: maxIntegrations });
      }
    };

    fetchIntegrationCount();
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = getNavItems(
    integrationCount.max === -1 
      ? `${integrationCount.current}` 
      : `${integrationCount.current}/${integrationCount.max}`,
    profile?.role === 'admin',
    subscriptionTier
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 h-screen flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Core314</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Operations Control</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto pb-4 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </div>
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        integrationCount.current >= integrationCount.max && integrationCount.max !== -1
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          : ''
                      }`}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="mb-3">
              <OrganizationSwitcher />
            </div>
            <div className="flex items-center mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {profile?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>
        
        <main className="flex-1 overflow-auto">
          <OrganizationRequiredGuard>
            <Outlet />
          </OrganizationRequiredGuard>
        </main>
      </div>
    </div>
  );
}
