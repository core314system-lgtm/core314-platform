import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { supabase } from '../lib/supabase';
import {
  Home,
  Layers, 
  Target,
  Bell,
  Settings,
  LogOut,
  BarChart3,
  Zap,
  TrendingUp,
  Code,
  FileCheck,
  Headphones,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

/**
 * Navigation structure for the user app sidebar.
 * 
 * PRODUCT-CORRECTIVE UI REFACTOR:
 * - PRIMARY (Always Visible): Dashboard, Integrations, Notifications
 * - SECONDARY (Collapsible "Analysis" group): Visualizations, Fusion Overview, Goals & KPIs
 * - ADVANCED (Collapsible "Advanced" group): Integration Hub, Advanced Analytics, Optimization Engine, etc.
 * 
 * Rules:
 * - Secondary and Advanced groups are collapsed by default
 * - Groups auto-expand when the current route is inside them
 * - All existing routes remain reachable
 * - No feature disappears from navigation
 */
const getPrimaryNavItems = (integrationBadge?: string): NavItem[] => [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/integrations', label: 'Integrations', icon: Layers, badge: integrationBadge },
  { path: '/notifications', label: 'Notifications', icon: Bell },
];

const getAnalysisNavItems = (): NavItem[] => [
  { path: '/visualizations', label: 'Visualizations', icon: BarChart3 },
  { path: '/fusion-details', label: 'Fusion Overview', icon: Zap },
  { path: '/goals', label: 'Goals & KPIs', icon: Target },
];

const getAdvancedNavItems = (subscriptionTier?: string): NavItem[] => {
  const items: NavItem[] = [
    { path: '/integration-hub', label: 'Integration Hub', icon: Layers },
  ];
  
  if (subscriptionTier === 'professional' || subscriptionTier === 'enterprise') {
    items.push(
      { path: '/advanced-analytics', label: 'Advanced Analytics', icon: TrendingUp },
      { path: '/optimization-engine', label: 'Optimization Engine', icon: Zap }
    );
  }
  
  if (subscriptionTier === 'enterprise') {
    items.push(
      { path: '/api-access', label: 'API Access', icon: Code },
      { path: '/audit-trails', label: 'Audit Trails', icon: FileCheck },
      { path: '/account-support', label: 'Account Support', icon: Headphones }
    );
  }
  
  return items;
};

/**
 * MainLayout - Layout for organization-dependent routes
 * 
 * This layout has the sidebar and assumes an organization is already resolved.
 * It is ONLY rendered inside OrganizationRouteGuard, which ensures:
 * - User is authenticated (handled by ProtectedRoute)
 * - Organization is resolved (no-org users are redirected to /settings/organization)
 * 
 * This layout should NEVER render for:
 * - Users without an organization
 * - Account-only pages (settings, billing, etc.)
 */
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

  // Get navigation items
  const integrationBadge = integrationCount.max === -1 
    ? `${integrationCount.current}` 
    : `${integrationCount.current}/${integrationCount.max}`;
  
  const primaryItems = getPrimaryNavItems(integrationBadge);
  const analysisItems = getAnalysisNavItems();
  const advancedItems = getAdvancedNavItems(subscriptionTier);

  // Check if current route is in a group (for auto-expand)
  const isRouteInGroup = (items: NavItem[]) => 
    items.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

  // Collapsible group state - auto-expand if current route is in the group
  const [analysisOpen, setAnalysisOpen] = useState(isRouteInGroup(analysisItems));
  const [advancedOpen, setAdvancedOpen] = useState(isRouteInGroup(advancedItems));

  // Auto-expand groups when navigating to a route within them
  useEffect(() => {
    if (isRouteInGroup(analysisItems)) setAnalysisOpen(true);
    if (isRouteInGroup(advancedItems)) setAdvancedOpen(true);
  }, [location.pathname]);

  // Render a single nav item
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    
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
  };

  // Render a collapsible nav group
  const renderNavGroup = (label: string, items: NavItem[], isOpen: boolean, setIsOpen: (open: boolean) => void) => {
    const hasActiveRoute = isRouteInGroup(items);
    
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors">
          <span className={hasActiveRoute ? 'text-blue-600 dark:text-blue-400' : ''}>{label}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-2">
          {items.map(renderNavItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 h-screen flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 flex-shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Core<span className="text-sky-500">314</span>
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">Operations Control</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto pb-4 px-3 py-4 space-y-4">
            {/* PRIMARY: Always visible */}
            <div className="space-y-1">
              {primaryItems.map(renderNavItem)}
            </div>
            
            {/* SECONDARY: Collapsible "Analysis" group */}
            {renderNavGroup('Analysis', analysisItems, analysisOpen, setAnalysisOpen)}
            
            {/* ADVANCED: Collapsible "Advanced" group */}
            {advancedItems.length > 0 && renderNavGroup('Advanced', advancedItems, advancedOpen, setAdvancedOpen)}
          </nav>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <OrganizationSwitcher />
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col overflow-auto">
          {/* Top header with account controls */}
          <header className="h-16 flex items-center justify-end px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* User Menu Dropdown - contains Account Settings and Sign Out */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="hidden sm:inline font-medium text-gray-700 dark:text-gray-300">
                      {profile?.email || 'Account'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      <span>Account Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          
          {/* Page content */}
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
