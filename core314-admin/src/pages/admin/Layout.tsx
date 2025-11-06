import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
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
  Wrench,
  Zap,
  TrendingUp,
  AlertTriangle,
  Shield,
  Gauge,
  LogOut
} from 'lucide-react';

const navItems = [
  { path: '/users', label: 'User Management', icon: Users },
  { path: '/integrations', label: 'Integration Tracking', icon: Layers },
  { path: '/metrics', label: 'Metrics Dashboard', icon: BarChart3 },
  { path: '/billing', label: 'Billing Overview', icon: DollarSign },
  { path: '/ai-logs', label: 'AI Logs', icon: Bot },
  { path: '/system-health', label: 'System Health', icon: Activity },
  { path: '/self-healing', label: 'Self-Healing Activity', icon: Wrench },
  { path: '/adaptive-workflows', label: 'Adaptive Workflows', icon: Zap },
  { path: '/fusion-risk-dashboard', label: 'Fusion Risk Dashboard', icon: TrendingUp },
  { path: '/audit', label: 'Audit & Anomalies', icon: AlertTriangle },
  { path: '/alerts', label: 'Alert Center', icon: Shield },
  { path: '/efficiency', label: 'Efficiency Index', icon: Gauge },
  { path: '/notifications', label: 'Notification Center', icon: Bell },
  { path: '/audit-trail', label: 'Audit Trail', icon: FileText },
];

export function AdminLayout() {
  const location = useLocation();
  const { signOut, adminUser } = useAdminAuth();

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
            <div className="mt-3 px-3 py-2 bg-purple-100 dark:bg-purple-900 rounded-md">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                🛡 Platform Administrator
              </p>
            </div>
          </div>
          
          <nav className="px-3 space-y-1">
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
                  {adminUser?.full_name || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {adminUser?.email}
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
