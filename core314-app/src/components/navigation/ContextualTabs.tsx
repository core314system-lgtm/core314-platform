import { Link, useLocation } from 'react-router-dom';
import { Home, Brain, Layers, BarChart3 } from 'lucide-react';

/**
 * ContextualTabs - Primary navigation for the user application
 * 
 * These tabs are the ONLY primary navigation in the user app.
 * Each tab links to an existing route (styled as tabs, not nested routes).
 * 
 * Tab mapping:
 * - Overview -> /dashboard
 * - Insights -> /system-intelligence
 * - Integrations -> /integrations
 * - History -> /visualizations
 * 
 * The tabs are always visible and clearly indicate the current context.
 */

interface Tab {
  path: string;
  label: string;
  icon: typeof Home;
}

const tabs: Tab[] = [
  { path: '/dashboard', label: 'Overview', icon: Home },
  { path: '/system-intelligence', label: 'Insights', icon: Brain },
  { path: '/integrations', label: 'Integrations', icon: Layers },
  { path: '/visualizations', label: 'History', icon: BarChart3 },
];

export function ContextualTabs() {
  const location = useLocation();

  // Determine which tab is active based on current path
  const getIsActive = (tabPath: string) => {
    // Exact match for the tab paths
    if (location.pathname === tabPath) return true;
    
    // Also match sub-routes for integrations
    if (tabPath === '/integrations' && location.pathname.startsWith('/integrations/')) return true;
    
    return false;
  };

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="px-6">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getIsActive(tab.path);
            
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
