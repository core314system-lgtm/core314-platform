import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Layers, Bot, TrendingUp } from 'lucide-react';

export function Dashboard() {
  const { profile } = useAuth();
  const { subscription } = useSubscription(profile?.id);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome, {profile?.full_name || 'User'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Current Plan: <span className="font-semibold capitalize">{subscription.tier}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
            <Layers className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max: {subscription.maxIntegrations === -1 ? 'Unlimited' : subscription.maxIntegrations}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max: {subscription.maxUsers === -1 ? 'Unlimited' : subscription.maxUsers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Tasks</CardTitle>
            <Bot className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-300 font-semibold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Connect an Integration</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Link your first service to start unifying your operations
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-300 font-semibold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Explore the Dashboard</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View metrics, analytics, and system health
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-300 font-semibold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Enable AI Agents</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Activate intelligent automation for your workflows
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
