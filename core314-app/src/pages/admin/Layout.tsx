import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { 
  Users, 
  Layers, 
  BarChart3, 
  DollarSign, 
  Bot, 
  Activity, 
  Bell, 
  FileText,
  LogOut,
  Home
} from 'lucide-react';

const navItems = [
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/integrations', label: 'Integration Tracking', icon: Layers },
  { path: '/admin/metrics', label: 'Metrics Dashboard', icon: BarChart3 },
  { path: '/admin/billing', label: 'Billing Overview', icon: DollarSign },
  { path: '/admin/ai-logs', label: 'AI Logs', icon: Bot },
  { path: '/admin/system-health', label: 'System Health', icon: Activity },
  { path: '/admin/notifications', label: 'Notification Center', icon: Bell },
  { path: '/admin/audit-trail', label: 'Audit Trail', icon: FileText },
];

export function AdminLayout() {
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Admin Dashboard</p>
          </div>
          
          <nav className="px-3 space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Home className="mr-3 h-5 w-5" />
              Back to Dashboard
            </Link>
            
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Admin Modules
              </p>
            </div>
            
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
