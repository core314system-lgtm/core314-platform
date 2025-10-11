import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { 
  Home,
  Layers, 
  LayoutDashboard,
  Target,
  Bell,
  Settings,
  LogOut,
  Shield
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/integrations', label: 'Integrations', icon: Layers },
  { path: '/dashboard-builder', label: 'Dashboard Builder', icon: LayoutDashboard },
  { path: '/goals', label: 'Goals & KPIs', icon: Target },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/integration-hub', label: 'Integration Hub', icon: Settings },
];

export function MainLayout() {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Core314</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Operations Control</p>
          </div>
          
          <nav className="px-3 space-y-1">
            {profile?.role === 'admin' && (
              <>
                <Link
                  to="/admin"
                  className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Shield className="mr-3 h-5 w-5" />
                  Admin Dashboard
                </Link>
                
                <div className="pt-2 pb-2">
                  <div className="border-t border-gray-200 dark:border-gray-700"></div>
                </div>
              </>
            )}
            
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
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
