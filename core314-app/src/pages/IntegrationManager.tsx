import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Layers,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Briefcase,
  DollarSign,
  Plug,
  Clock,
} from 'lucide-react';
import { getSupabaseFunctionUrl } from '../lib/supabase';

interface IntegrationInfo {
  id: string;
  service_name: string;
  display_name: string;
  description: string;
  icon_url: string | null;
  is_enabled: boolean;
}

interface UserIntegration {
  id: string;
  user_id: string;
  integration_registry_id: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const SERVICE_ICONS: Record<string, typeof MessageSquare> = {
  slack: MessageSquare,
  hubspot: Briefcase,
  quickbooks: DollarSign,
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  slack: 'Monitor team communication patterns, response times, and channel activity to detect operational bottlenecks.',
  hubspot: 'Track deal velocity, stalled deals, pipeline changes, and follow-up delays to identify revenue risks.',
  quickbooks: 'Analyze invoice aging, overdue payments, revenue trends, and expense anomalies for financial health.',
};

export function IntegrationManager() {
  const { profile } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchIntegrations();
    }
  }, [profile?.id]);

  const fetchIntegrations = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Fetch available integrations (only Phase 1 services)
    const { data: registryData } = await supabase
      .from('integration_registry')
      .select('*')
      .in('service_name', ['slack', 'hubspot', 'quickbooks'])
      .eq('is_enabled', true);

    if (registryData) {
      setIntegrations(registryData as IntegrationInfo[]);
    }

    // Fetch user's connected integrations
    const { data: userIntData } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (userIntData) {
      setUserIntegrations(userIntData as UserIntegration[]);
    }

    setLoading(false);
  };

  const handleConnect = async (serviceName: string) => {
    if (!profile?.id) return;
    setConnecting(serviceName);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('oauth-initiate');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          redirect_uri: `${window.location.origin}/oauth-callback`,
        }),
      });

      const data = await response.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (data.error) {
        console.error('OAuth error:', data.error);
      }
    } catch (err) {
      console.error('Error connecting:', err);
    } finally {
      setConnecting(null);
    }
  };

  const isConnected = (registryId: string) => {
    return userIntegrations.some(ui => ui.integration_registry_id === registryId);
  };

  const getConnectionDate = (registryId: string) => {
    const ui = userIntegrations.find(u => u.integration_registry_id === registryId);
    return ui?.created_at || null;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-indigo-500" />
          Integration Manager
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Connect your business tools to enable operational intelligence
        </p>
      </div>

      {/* Connection Status Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Plug className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {userIntegrations.length} of 3 integrations connected
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {userIntegrations.length === 3
                  ? 'All signal sources active. Core314 is analyzing your full operational picture.'
                  : 'Connect more integrations for richer operational insights.'}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(userIntegrations.length / 3) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {integrations.map(integration => {
          const Icon = SERVICE_ICONS[integration.service_name] || Layers;
          const connected = isConnected(integration.id);
          const connDate = getConnectionDate(integration.id);
          const description = SERVICE_DESCRIPTIONS[integration.service_name] || integration.description;

          return (
            <Card
              key={integration.id}
              className={connected ? 'border-green-200 dark:border-green-800' : ''}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Icon className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.display_name}</CardTitle>
                      {connected && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {description}
                </p>

                {connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      Connected {connDate ? new Date(connDate).toLocaleDateString() : ''}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <RefreshCw className="h-3 w-3" />
                      Polling every 15 minutes
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleConnect(integration.service_name)}
                    disabled={connecting === integration.service_name}
                  >
                    {connecting === integration.service_name ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {connecting === integration.service_name ? 'Connecting...' : `Connect ${integration.display_name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Signal Detection Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Connect</h4>
              <p className="text-xs text-gray-500">
                Securely connect your tools via OAuth. Core314 never stores your passwords.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Detect</h4>
              <p className="text-xs text-gray-500">
                Core314 polls your systems every 15 minutes and detects operational patterns.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h4 className="text-sm font-medium mb-1">Brief</h4>
              <p className="text-xs text-gray-500">
                Receive AI-generated operational briefs explaining what&apos;s happening in your business.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
