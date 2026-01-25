import { Link, useLocation } from 'react-router-dom';
import { Home, Brain, Layers, BarChart3 } from 'lucide-react';

/**
 * ContextualTabs - Renders contextual navigation tabs below the top nav
 * 
 * Tabs are shown when on dashboard-related pages:
 * - Overview → /dashboard
 * - Insights → /system-intelligence
 * - Integrations → /integrations
 * - History → /visualizations
 * 
 * Each tab maps to an EXISTING route/component - no new features created.
 * Tabs remain visible when navigating among them for context continuity.
 */

interface Tab {
  path: string;
  label: string;
  icon: typeof Home;
}

const DASHBOARD_TABS: Tab[] = [
  { path: '/dashboard', label: 'Overview', icon: Home },
  { path: '/system-intelligence', label: 'Insights', icon: Brain },
  { path: '/integrations', label: 'Integrations', icon: Layers },
  { path: '/visualizations', label: 'History', icon: BarChart3 },
];

const DASHBOARD_CONTEXT_PATHS = DASHBOARD_TABS.map(tab => tab.path);

export function ContextualTabs() {
  const location = useLocation();
  
  // Only show tabs when on dashboard context pages
  const isInDashboardContext = DASHBOARD_CONTEXT_PATHS.includes(location.pathname);
  
  if (!isInDashboardContext) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="px-6">
        <nav className="flex gap-1" aria-label="Dashboard tabs">
          {DASHBOARD_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;
            
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
