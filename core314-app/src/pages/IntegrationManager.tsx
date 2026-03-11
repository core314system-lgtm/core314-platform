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
  Unplug,
  AlertTriangle,
} from 'lucide-react';
import { getSupabaseFunctionUrl, getSupabaseUrl } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';

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
  integration_id: string;
  provider_id: string | null;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  last_error_at: string | null;
  error_message: string | null;
  consecutive_failures: number;
}

interface IngestionState {
  service_name: string;
  last_polled_at: string | null;
  next_poll_after: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [ingestionStates, setIngestionStates] = useState<IngestionState[]>([]);

  // Check for OAuth callback success (from Supabase oauth-callback or HubSpot Netlify callback)
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthService = searchParams.get('service');
    const hubspotStatus = searchParams.get('hubspot');

    if (oauthSuccess === 'true' && oauthService) {
      setConnectionSuccess(oauthService);
      searchParams.delete('oauth_success');
      searchParams.delete('service');
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setConnectionSuccess(null), 5000);
    } else if (hubspotStatus === 'connected') {
      setConnectionSuccess('hubspot');
      searchParams.delete('hubspot');
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setConnectionSuccess(null), 5000);
    }
  }, [searchParams, setSearchParams]);

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
      .select('id, user_id, integration_id, provider_id, status, config, created_at, updated_at, last_verified_at, last_error_at, error_message, consecutive_failures')
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (userIntData) {
      setUserIntegrations(userIntData as UserIntegration[]);
    }

    // Fetch ingestion state (last polled times)
    const { data: stateData } = await supabase
      .from('integration_ingestion_state')
      .select('service_name, last_polled_at, next_poll_after')
      .eq('user_id', profile.id)
      .in('service_name', ['slack', 'hubspot', 'quickbooks']);

    if (stateData) {
      setIngestionStates(stateData as IngestionState[]);
    }

    setLoading(false);
  };

  const handleConnect = async (serviceName: string) => {
    if (!profile?.id) return;
    setConnecting(serviceName);

    try {
      // HubSpot uses dedicated Netlify function for OAuth
      if (serviceName === 'hubspot') {
        // Get Supabase session token for secure server-side validation
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('No session');
        // Redirect to HubSpot OAuth via Netlify function with validated token
        window.location.href = `/.netlify/functions/hubspot-auth?access_token=${accessToken}`;
        return;
      }

      // Other integrations use Supabase Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('oauth-initiate');
      // Build redirect_uri pointing to the Supabase Edge Function callback,
      // not the frontend URL. OAuth providers (QuickBooks, Slack, etc.) must
      // have this exact URI whitelisted in their developer app settings.
      const supabaseUrl = await getSupabaseUrl();
      const callbackUri = `${supabaseUrl}/functions/v1/oauth-callback`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          redirect_uri: callbackUri,
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

  const handleDisconnect = async (serviceName: string, registryId: string) => {
    if (!profile?.id) return;

    // Require confirmation
    if (disconnectConfirm !== registryId) {
      setDisconnectConfirm(registryId);
      return;
    }

    setDisconnecting(serviceName);
    setDisconnectConfirm(null);

    try {
      // Call the disconnect Edge Function via supabase client
      // supabase.functions.invoke() automatically sends auth headers
      const { data, error } = await supabase.functions.invoke('disconnect-integration', {
        body: { integration_registry_id: registryId },
      });

      if (error) {
        console.error('Disconnect error:', error);
        return;
      }

      if (data && !data.success) {
        console.error('Disconnect failed:', data.error);
        return;
      }

      // Refresh the integrations list
      await fetchIntegrations();
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (registryId: string) => {
    return userIntegrations.some(ui => ui.provider_id === registryId);
  };

  const getConnectionDate = (registryId: string) => {
    const ui = userIntegrations.find(u => u.provider_id === registryId);
    return ui?.created_at || null;
  };

  const getUserIntegration = (registryId: string) => {
    return userIntegrations.find(u => u.provider_id === registryId) || null;
  };

  const getIngestionState = (serviceName: string) => {
    return ingestionStates.find(s => s.service_name === serviceName) || null;
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getHealthStatus = (ui: UserIntegration | null): { label: string; color: string } => {
    if (!ui) return { label: 'Not connected', color: 'text-gray-400' };
    if (ui.consecutive_failures >= 3) return { label: 'Error', color: 'text-red-600' };
    if (ui.consecutive_failures > 0) return { label: 'Degraded', color: 'text-yellow-600' };
    if (ui.last_verified_at) return { label: 'Verified', color: 'text-green-600' };
    return { label: 'Connected', color: 'text-green-600' };
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

      {/* Connection Success Banner */}
      {connectionSuccess && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {connectionSuccess === 'hubspot' ? 'HubSpot' : connectionSuccess === 'quickbooks' ? 'QuickBooks Online' : connectionSuccess === 'slack' ? 'Slack' : connectionSuccess} connected successfully! Core314 will begin analyzing your data shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Plug className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {integrations.filter(i => isConnected(i.id)).length} of {integrations.length} integrations connected
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {integrations.filter(i => isConnected(i.id)).length === integrations.length
                  ? 'All signal sources active. Core314 is analyzing your full operational picture.'
                  : 'Connect more integrations for richer operational insights.'}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(integrations.filter(i => isConnected(i.id)).length / Math.max(integrations.length, 1)) * 100}%` }}
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
          const ui = getUserIntegration(integration.id);
          const state = getIngestionState(integration.service_name);
          const health = getHealthStatus(ui);

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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      Connected {connDate ? new Date(connDate).toLocaleDateString() : ''}
                    </div>
                    {/* Health status */}
                    <div className={`flex items-center gap-2 text-xs ${health.color}`}>
                      <CheckCircle className="h-3 w-3" />
                      {health.label}
                      {ui?.last_verified_at && (
                        <span className="text-gray-400">({formatTimeAgo(ui.last_verified_at)})</span>
                      )}
                    </div>
                    {/* Last polled */}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <RefreshCw className={`h-3 w-3 ${state?.last_polled_at ? '' : 'text-gray-300'}`} />
                      {state?.last_polled_at ? (
                        <span>
                          Last polled {formatTimeAgo(state.last_polled_at)}
                          <span className="text-gray-400 ml-1">(every 15 min)</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">Awaiting first poll...</span>
                      )}
                    </div>
                    {/* Error message if any */}
                    {ui?.error_message && ui.consecutive_failures > 0 && (
                      <div className="flex items-center gap-2 text-xs text-red-500">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate" title={ui.error_message}>
                          {ui.error_message.length > 60 ? ui.error_message.slice(0, 60) + '...' : ui.error_message}
                        </span>
                      </div>
                    )}
                    {/* Disconnect button */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      {disconnectConfirm === integration.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleDisconnect(integration.service_name, integration.id)}
                            disabled={disconnecting === integration.service_name}
                          >
                            {disconnecting === integration.service_name ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Unplug className="h-3 w-3 mr-1" />
                            )}
                            Confirm Disconnect
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setDisconnectConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-gray-400 hover:text-red-500"
                          onClick={() => handleDisconnect(integration.service_name, integration.id)}
                        >
                          <Unplug className="h-3 w-3 mr-1" />
                          Disconnect
                        </Button>
                      )}
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
