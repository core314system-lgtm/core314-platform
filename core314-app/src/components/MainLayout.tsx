import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import {
  Home,
  Layers, 
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
  User,
  ChevronDown,
  Menu,
  Brain,
  Eye,
  Cpu,
  AlertTriangle,
  RefreshCw,
  TestTube,
  MessageSquare
} from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { SystemHealthIndicator } from './navigation/SystemHealthIndicator';
import { ContextualTabs } from './navigation/ContextualTabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from './ui/dropdown-menu';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
}

/**
 * Get core navigation items (non-admin)
 */
const getCoreNavItems = (subscriptionTier?: string): NavItem[] => {
  const items: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/integrations', label: 'Integrations', icon: Layers },
    { path: '/visualizations', label: 'Visualizations', icon: BarChart3 },
    { path: '/fusion-details', label: 'Fusion Overview', icon: Zap },
    { path: '/system-intelligence', label: 'System Intelligence', icon: Brain },
    { path: '/goals', label: 'Goals & KPIs', icon: Target },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/integration-hub', label: 'Integration Hub', icon: Layers },
    { path: '/predictive-insights', label: 'Predictive Insights', icon: Eye },
    { path: '/decision-center', label: 'Decision Center', icon: Cpu },
    { path: '/automation-center', label: 'Automation Center', icon: Zap },
    { path: '/system-monitor', label: 'System Monitor', icon: Activity },
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
 * Get admin navigation items
 */
const getAdminNavItems = (): NavItem[] => [
  { path: '/admin/automation-rules-manager', label: 'Automation Rules', icon: Zap },
  { path: '/admin/automation-logs', label: 'Automation Logs', icon: FileText },
  { path: '/admin/ai-narratives', label: 'AI Narratives', icon: Sparkles },
  { path: '/admin/simulations', label: 'Simulations', icon: Zap },
  { path: '/admin/optimizations', label: 'Optimizations', icon: Activity },
  { path: '/admin/insight-hub', label: 'Global Insights', icon: Globe },
  { path: '/admin/governance', label: 'AI Governance & Ethics', icon: Shield },
  { path: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { path: '/admin/fusion-weights', label: 'Fusion Weights', icon: Zap },
  { path: '/admin/fusion-intelligence', label: 'Fusion Intelligence', icon: Brain },
  { path: '/admin/predictive-models', label: 'Predictive Models', icon: TrendingUp },
  { path: '/admin/memory-engine', label: 'Memory Engine', icon: Cpu },
  { path: '/admin/decision-audit', label: 'Decision Audit', icon: FileCheck },
  { path: '/admin/integration-health', label: 'Integration Health', icon: Activity },
  { path: '/admin/entitlements', label: 'Entitlements', icon: Shield },
  { path: '/admin/kill-switches', label: 'Kill Switches', icon: AlertTriangle },
  { path: '/admin/launch-readiness', label: 'Launch Readiness', icon: TestTube },
  { path: '/admin/beta-operations', label: 'Beta Operations', icon: Sparkles },
];

/**
 * MainLayout - Top navigation layout for the user application
 * 
 * UI/UX Restructure:
 * - Removed left sidebar navigation
 * - Added clean top navigation bar with:
 *   - Logo (left)
 *   - Organization selector
 *   - System Health indicator
 *   - Navigate dropdown (all product features)
 *   - Admin dropdown (admin-only, if applicable)
 *   - User profile menu (settings, logout)
 * - Added contextual page tabs below top nav for dashboard context
 * 
 * All existing routes and functionality are preserved.
 */
export function MainLayout() {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [subscriptionTier, setSubscriptionTier] = useState<string>('none');

  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      if (!profile?.id) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', profile.id)
        .single();
      
      setSubscriptionTier(profileData?.subscription_tier || 'none');
    };

    fetchSubscriptionTier();
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
  };

  const coreNavItems = getCoreNavItems(subscriptionTier);
  const adminNavItems = getAdminNavItems();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        {/* Left section: Logo + Org Selector */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Core<span className="text-sky-500">314</span>
            </h1>
          </Link>
          
          {/* Organization Selector */}
          <div className="hidden md:block">
            <OrganizationSwitcher />
          </div>
        </div>

        {/* Center section: System Health */}
        <div className="hidden lg:flex items-center">
          <SystemHealthIndicator />
        </div>

        {/* Right section: Navigate + Admin + User Menu */}
        <div className="flex items-center gap-2">
          {/* Navigate Dropdown - All product features */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">Navigate</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel>Product Features</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {coreNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link 
                        to={item.path} 
                        className={`flex items-center gap-2 cursor-pointer ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Admin Dropdown - Admin-only features */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
                <DropdownMenuLabel>Admin Tools</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link 
                          to={item.path} 
                          className={`flex items-center gap-2 cursor-pointer ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="hidden md:inline font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
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
              <DropdownMenuItem asChild>
                <Link to="/billing" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  <span>Billing</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/account/plan" className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="h-4 w-4" />
                  <span>Subscription Plan</span>
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

      {/* Contextual Tabs - shown on dashboard context pages */}
      <ContextualTabs />
      
      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
