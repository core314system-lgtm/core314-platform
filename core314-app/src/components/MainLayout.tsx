import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
  Shield
} from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  badge?: string;
}

const getNavItems = (integrationBadge?: string, isAdmin?: boolean): NavItem[] => {
  const baseItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/integrations', label: 'Integrations', icon: Layers, badge: integrationBadge },
    { path: '/visualizations', label: 'Visualizations', icon: BarChart3 },
    { path: '/dashboard-builder', label: 'Dashboard Builder', icon: LayoutDashboard },
    { path: '/goals', label: 'Goals & KPIs', icon: Target },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/integration-hub', label: 'Integration Hub', icon: Settings },
    { path: '/settings/security', label: 'Security', icon: Shield },
  ];
  
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

export function MainLayout() {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const [integrationCount, setIntegrationCount] = useState<{ current: number; max: number }>({ current: 0, max: 0 });

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
        
        const maxIntegrations = tierLimits[profileData?.subscription_tier || 'none'];
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
    profile?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Core314</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Operations Control</p>
          </div>
          
          <nav className="px-3 space-y-1">
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
          
          <div className="px-3 mb-4">
            <OrganizationSwitcher />
          </div>
          
          <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 dark:border-gray-700">
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
