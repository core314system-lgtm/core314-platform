import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Button } from '../../components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { useState, useEffect } from 'react';
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
  Brain,
  Lightbulb,
  Sparkles,
  Cpu,
  LogOut,
  Workflow,
  History,
  Settings,
  FolderKanban,
  LineChart,
  Sparkle,
  HeartPulse
} from 'lucide-react';

const navGroups = [
  {
    id: 'management',
    label: 'Management',
    icon: FolderKanban,
    items: [
      { path: '/users', label: 'User Management', icon: Users },
      { path: '/integrations', label: 'Integration Tracking', icon: Layers },
      { path: '/billing', label: 'Billing Overview', icon: DollarSign },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: LineChart,
    items: [
      { path: '/metrics', label: 'Metrics Dashboard', icon: BarChart3 },
      { path: '/efficiency', label: 'Efficiency Index', icon: Gauge },
      { path: '/fusion-efficiency', label: 'Fusion Efficiency', icon: Zap },
      { path: '/behavioral-analytics', label: 'Behavioral Analytics', icon: Brain },
      { path: '/predictive-insights', label: 'Predictive Insights', icon: Lightbulb },
    ]
  },
  {
    id: 'ai-intelligence',
    label: 'AI & System Intelligence',
    icon: Sparkle,
    items: [
      { path: '/ai-logs', label: 'AI Logs', icon: Bot },
      { path: '/self-healing', label: 'Self-Healing Activity', icon: Wrench },
      { path: '/adaptive-workflows', label: 'Adaptive Workflows', icon: Zap },
      { path: '/fusion-risk-dashboard', label: 'Fusion Risk Dashboard', icon: TrendingUp },
      { path: '/fusion-calibration', label: 'Fusion Calibration', icon: Sparkles },
      { path: '/autonomous-oversight', label: 'Autonomous Oversight', icon: Shield },
      { path: '/core-orchestrator', label: 'Core Orchestrator', icon: Cpu },
      { path: '/insight-hub', label: 'Insight Hub', icon: Lightbulb },
      { path: '/adaptive-policy', label: 'Policy Intelligence', icon: Shield },
      { path: '/trust-graph', label: 'Trust Graph', icon: TrendingUp },
      { path: '/governance-insights', label: 'Governance Insights', icon: Shield },
      { path: '/automation-center', label: 'Automation Center', icon: Workflow },
      { path: '/agent-activity', label: 'Agent Activity Log', icon: History },
      { path: '/optimizations', label: 'Optimization Results', icon: Settings },
      { path: '/reliability', label: 'Reliability Dashboard', icon: Activity },
    ]
  },
  {
    id: 'system-health',
    label: 'System Health',
    icon: HeartPulse,
    items: [
      { path: '/system-health', label: 'System Health', icon: Activity },
      { path: '/audit', label: 'Audit & Anomalies', icon: AlertTriangle },
      { path: '/alerts', label: 'Alert Center', icon: Bell },
      { path: '/notifications', label: 'Notification Center', icon: Bell },
      { path: '/audit-trail', label: 'Audit Trail', icon: FileText },
    ]
  }
];

export function AdminLayout() {
  const location = useLocation();
  const { signOut, adminUser } = useAdminAuth();

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('core314-sidebar-accordion-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return ['management', 'analytics', 'ai-intelligence', 'system-health'];
      }
    }
    return ['management', 'analytics', 'ai-intelligence', 'system-health'];
  });

  useEffect(() => {
    localStorage.setItem('core314-sidebar-accordion-state', JSON.stringify(openGroups));
  }, [openGroups]);

  const handleSignOut = async () => {
    await signOut();
  };

  const isGroupActive = (groupId: string) => {
    const group = navGroups.find(g => g.id === groupId);
    return group?.items.some(item => location.pathname === item.path) || false;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Core314</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Admin Dashboard</p>
            <div className="mt-3 px-3 py-2 bg-purple-100 dark:bg-purple-900 rounded-md">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                🛡 Platform Administrator
              </p>
            </div>
          </div>

          <div className="px-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {adminUser?.full_name || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
          
          <nav className="flex-1 overflow-y-auto pt-4 pb-4">
            <Accordion
              type="multiple"
              value={openGroups}
              onValueChange={setOpenGroups}
              className="px-3"
            >
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const groupActive = isGroupActive(group.id);
                
                return (
                  <AccordionItem key={group.id} value={group.id} className="border-b-0">
                    <AccordionTrigger 
                      className={`py-2 px-3 rounded-md hover:no-underline hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        groupActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <GroupIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="leading-none">{group.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-1 pt-1">
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = location.pathname === item.path;
                          
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ml-6 transition-colors ${
                                isActive
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="leading-none">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </nav>
        </aside>
        
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
