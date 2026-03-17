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
  Calendar,
  Mail,
  ClipboardList,
  LayoutGrid,
  Users,
  FileSpreadsheet,
  ListTodo,
  Lock,
  ArrowUpRight,
  Key,
} from 'lucide-react';
import { getSupabaseFunctionUrl, getSupabaseUrl } from '../lib/supabase';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface IntegrationInfo {
  id: string;
  service_name: string;
  display_name: string;
  description: string;
  logo_url: string | null;
  is_enabled: boolean;
  auth_type: string;
  min_plan?: string;
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
  google_calendar: Calendar,
  gmail: Mail,
  jira: ClipboardList,
  trello: LayoutGrid,
  microsoft_teams: Users,
  google_sheets: FileSpreadsheet,
  asana: ListTodo,
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  slack: 'Monitor team communication patterns, response times, and channel activity to detect operational bottlenecks and collaboration trends.',
  hubspot: 'Track deal velocity, stalled deals, pipeline changes, and follow-up delays to identify revenue risks and sales performance patterns.',
  quickbooks: 'Analyze invoice aging, overdue payments, revenue trends, and expense anomalies for comprehensive financial health monitoring.',
  google_calendar: 'Track meeting patterns, scheduling conflicts, and calendar utilization to surface time-based operational signals and meeting overload.',
  gmail: 'Analyze email volume, response patterns, and communication trends to detect bottlenecks without reading message content.',
  jira: 'Monitor sprint progress, ticket velocity, and blocker patterns to detect delivery risks and team capacity issues early.',
  trello: 'Track board activity, card movement, and workflow bottlenecks to surface stalled tasks and productivity patterns.',
  microsoft_teams: 'Monitor team channel activity, meeting patterns, and collaboration metrics across departments for organizational health.',
  google_sheets: 'Connect key operational spreadsheets for real-time KPI monitoring and automated data change tracking.',
  asana: 'Track project milestones, task completion rates, and team workload to detect delivery risks and resource constraints.',
};

const PLAN_TIERS: Record<string, number> = {
  intelligence: 1,
  command_center: 2,
  enterprise: 3,
};

const CORE_INTEGRATIONS = ['slack', 'hubspot', 'quickbooks'];
const COMMAND_CENTER_INTEGRATIONS = ['google_calendar', 'gmail', 'jira', 'trello', 'microsoft_teams', 'google_sheets', 'asana'];
const ALL_INTEGRATIONS = [...CORE_INTEGRATIONS, ...COMMAND_CENTER_INTEGRATIONS];

const API_KEY_FIELDS: Record<string, { label: string; field: string; type: string; placeholder: string }[]> = {
  jira: [
    { label: 'Jira Domain', field: 'domain', type: 'text', placeholder: 'your-company.atlassian.net' },
    { label: 'Email', field: 'email', type: 'email', placeholder: 'you@company.com' },
    { label: 'API Token', field: 'api_token', type: 'password', placeholder: 'Your Jira API token' },
  ],
  trello: [
    { label: 'API Key', field: 'api_key', type: 'text', placeholder: 'Your Trello API key' },
    { label: 'API Token', field: 'api_token', type: 'password', placeholder: 'Your Trello API token' },
  ],
  asana: [
    { label: 'Personal Access Token', field: 'api_token', type: 'password', placeholder: 'Your Asana personal access token' },
  ],
};

export function IntegrationManager() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [ingestionStates, setIngestionStates] = useState<IngestionState[]>([]);
  const [userPlan, setUserPlan] = useState<string>('intelligence');
  const [apiKeyForm, setApiKeyForm] = useState<{ service: string; credentials: Record<string, string> } | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

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
      fetchUserPlan();
    }
  }, [profile?.id]);

  const fetchUserPlan = async () => {
    if (!profile?.id) return;

    // Primary source of truth: user_subscriptions table (per-user, linked to Stripe)
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_name')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscription?.plan_name) {
      const planName = subscription.plan_name.toLowerCase();
      if (planName.includes('command') || planName.includes('center')) {
        setUserPlan('command_center');
      } else if (planName.includes('enterprise')) {
        setUserPlan('enterprise');
      } else {
        setUserPlan('intelligence');
      }
    }
  };

  const fetchIntegrations = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Fetch ALL enabled integrations
    const { data: registryData } = await supabase
      .from('integration_registry')
      .select('id, service_name, display_name, description, logo_url, is_enabled, auth_type')
      .in('service_name', ALL_INTEGRATIONS)
      .eq('is_enabled', true);

    if (registryData) {
      const sorted = [...registryData].sort((a, b) => {
        const aIdx = ALL_INTEGRATIONS.indexOf(a.service_name);
        const bIdx = ALL_INTEGRATIONS.indexOf(b.service_name);
        return aIdx - bIdx;
      });
      setIntegrations(sorted as IntegrationInfo[]);
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

    // Fetch ingestion state for all integrations
    const { data: stateData } = await supabase
      .from('integration_ingestion_state')
      .select('service_name, last_polled_at, next_poll_after')
      .eq('user_id', profile.id);

    if (stateData) {
      setIngestionStates(stateData as IngestionState[]);
    }

    setLoading(false);
  };

  const canAccessIntegration = (serviceName: string): boolean => {
    if (CORE_INTEGRATIONS.includes(serviceName)) return true;
    if (COMMAND_CENTER_INTEGRATIONS.includes(serviceName)) {
      return (PLAN_TIERS[userPlan] || 0) >= PLAN_TIERS['command_center'];
    }
    return false;
  };

  const handleConnect = async (serviceName: string) => {
    if (!profile?.id) return;
    if (!canAccessIntegration(serviceName)) return;
    if (API_KEY_FIELDS[serviceName]) {
      setApiKeyForm({ service: serviceName, credentials: {} });
      setApiKeyError(null);
      return;
    }
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

  const handleApiKeySubmit = async () => {
    if (!apiKeyForm || !profile?.id) return;
    setConnecting(apiKeyForm.service);
    setApiKeyError(null);
    try {
      const { data, error } = await supabase.functions.invoke('connect-api-key', {
        body: {
          service_name: apiKeyForm.service,
          credentials: apiKeyForm.credentials,
        },
      });
      if (error) {
        setApiKeyError('Failed to connect. Please check your credentials.');
        return;
      }
      if (data && !data.success) {
        setApiKeyError(data.message || data.error || 'Connection failed');
        return;
      }
      setApiKeyForm(null);
      setConnectionSuccess(apiKeyForm.service);
      setTimeout(() => setConnectionSuccess(null), 5000);
      await fetchIntegrations();
    } catch {
      setApiKeyError('An unexpected error occurred. Please try again.');
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

  const coreIntegrations = integrations.filter(i => CORE_INTEGRATIONS.includes(i.service_name));
  const commandCenterIntegrations = integrations.filter(i => COMMAND_CENTER_INTEGRATIONS.includes(i.service_name));
  const connectedCount = integrations.filter(i => isConnected(i.id)).length;
  const accessibleCount = integrations.filter(i => canAccessIntegration(i.service_name)).length;

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
                {connectionSuccess.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} connected successfully! Core314 will begin analyzing your data shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key Form */}
      {apiKeyForm && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-indigo-500" />
              Connect {apiKeyForm.service.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {API_KEY_FIELDS[apiKeyForm.service]?.map(field => (
                <div key={field.field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={apiKeyForm.credentials[field.field] || ''}
                    onChange={(e) => setApiKeyForm({
                      ...apiKeyForm,
                      credentials: { ...apiKeyForm.credentials, [field.field]: e.target.value },
                    })}
                  />
                </div>
              ))}
              {apiKeyError && (
                <p className="text-sm text-red-600">{apiKeyError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleApiKeySubmit}
                  disabled={connecting === apiKeyForm.service}
                  className="flex-1"
                >
                  {connecting === apiKeyForm.service ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {connecting === apiKeyForm.service ? 'Validating...' : 'Connect'}
                </Button>
                <Button variant="outline" onClick={() => setApiKeyForm(null)}>
                  Cancel
                </Button>
              </div>
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
                {connectedCount} of {accessibleCount} available integrations connected
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {connectedCount === accessibleCount && accessibleCount > 0
                  ? 'All signal sources active. Core314 is analyzing your full operational picture.'
                  : userPlan === 'intelligence'
                    ? 'Connect your core integrations. Upgrade to Command Center for 7 additional integrations.'
                    : 'Connect more integrations for richer operational insights.'}
              </p>
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(connectedCount / Math.max(accessibleCount, 1)) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Integrations Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Core Integrations</h2>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0">
            All Plans
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreIntegrations.map(integration => {
            const Icon = SERVICE_ICONS[integration.service_name] || Layers;
            const connected = isConnected(integration.id);
            const connDate = getConnectionDate(integration.id);
            const description = SERVICE_DESCRIPTIONS[integration.service_name] || integration.description;
            const ui = getUserIntegration(integration.id);
            const state = getIngestionState(integration.service_name);
            const health = getHealthStatus(ui);
            const isApiKeyService = !!API_KEY_FIELDS[integration.service_name];
            return (
              <Card key={integration.id} className={connected ? 'border-green-200 dark:border-green-800' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                      <Icon className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-indigo-600'}`} />
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
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
                  {connected ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Connected {connDate ? new Date(connDate).toLocaleDateString() : ''}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${health.color}`}>
                        <CheckCircle className="h-3 w-3" />
                        {health.label}
                        {ui?.last_verified_at && <span className="text-gray-400">({formatTimeAgo(ui.last_verified_at)})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <RefreshCw className={`h-3 w-3 ${state?.last_polled_at ? '' : 'text-gray-300'}`} />
                        {state?.last_polled_at ? (
                          <span>Last polled {formatTimeAgo(state.last_polled_at)}<span className="text-gray-400 ml-1">(every 15 min)</span></span>
                        ) : (<span className="text-gray-400">Awaiting first poll...</span>)}
                      </div>
                      {ui?.error_message && ui.consecutive_failures > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate" title={ui.error_message}>{ui.error_message.length > 60 ? ui.error_message.slice(0, 60) + '...' : ui.error_message}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        {disconnectConfirm === integration.id ? (
                          <div className="flex items-center gap-2">
                            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => handleDisconnect(integration.service_name, integration.id)} disabled={disconnecting === integration.service_name}>
                              {disconnecting === integration.service_name ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Unplug className="h-3 w-3 mr-1" />}
                              Confirm Disconnect
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisconnectConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-gray-400 hover:text-red-500" onClick={() => handleDisconnect(integration.service_name, integration.id)}>
                            <Unplug className="h-3 w-3 mr-1" /> Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => handleConnect(integration.service_name)} disabled={connecting === integration.service_name}>
                      {connecting === integration.service_name ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : isApiKeyService ? <Key className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      {connecting === integration.service_name ? 'Connecting...' : `Connect ${integration.display_name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Command Center Integrations Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Command Center Integrations</h2>
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-0">
            Command Center+
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMMAND_CENTER_INTEGRATIONS.map(serviceName => {
            const dbIntegration = commandCenterIntegrations.find(i => i.service_name === serviceName);
            const locked = !canAccessIntegration(serviceName);
            const Icon = SERVICE_ICONS[serviceName] || Layers;
            const displayName = dbIntegration?.display_name || serviceName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const description = SERVICE_DESCRIPTIONS[serviceName] || dbIntegration?.description || 'Connect this integration for operational intelligence.';
            const connected = dbIntegration ? isConnected(dbIntegration.id) : false;
            const connDate = dbIntegration ? getConnectionDate(dbIntegration.id) : null;
            const ui = dbIntegration ? getUserIntegration(dbIntegration.id) : null;
            const state = getIngestionState(serviceName);
            const health = getHealthStatus(ui);
            const isApiKeyService = !!API_KEY_FIELDS[serviceName];

            return (
              <Card key={serviceName} className={`${connected ? 'border-green-200 dark:border-green-800' : ''} ${locked ? 'opacity-75' : ''} relative`}>
                {locked && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-300">
                      <Lock className="h-3 w-3 mr-1" /> Command Center
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-green-100 dark:bg-green-900/30' : locked ? 'bg-gray-100 dark:bg-gray-800' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                      <Icon className={`h-5 w-5 ${connected ? 'text-green-600' : locked ? 'text-gray-400' : 'text-indigo-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{displayName}</CardTitle>
                      {connected && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" /> Connected
                        </Badge>
                      )}
                      {isApiKeyService && !locked && !connected && (
                        <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
                          <Key className="h-3 w-3 mr-1" /> API Key
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
                  {connected ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Connected {connDate ? new Date(connDate).toLocaleDateString() : ''}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${health.color}`}>
                        <CheckCircle className="h-3 w-3" />
                        {health.label}
                        {ui?.last_verified_at && <span className="text-gray-400">({formatTimeAgo(ui.last_verified_at)})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <RefreshCw className={`h-3 w-3 ${state?.last_polled_at ? '' : 'text-gray-300'}`} />
                        {state?.last_polled_at ? (
                          <span>Last polled {formatTimeAgo(state.last_polled_at)}<span className="text-gray-400 ml-1">(every 15 min)</span></span>
                        ) : (<span className="text-gray-400">Awaiting first poll...</span>)}
                      </div>
                      {ui?.error_message && ui.consecutive_failures > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate" title={ui.error_message}>{ui.error_message.length > 60 ? ui.error_message.slice(0, 60) + '...' : ui.error_message}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        {disconnectConfirm === dbIntegration?.id ? (
                          <div className="flex items-center gap-2">
                            <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => handleDisconnect(serviceName, dbIntegration!.id)} disabled={disconnecting === serviceName}>
                              {disconnecting === serviceName ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Unplug className="h-3 w-3 mr-1" />}
                              Confirm Disconnect
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDisconnectConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-gray-400 hover:text-red-500" onClick={() => handleDisconnect(serviceName, dbIntegration!.id)}>
                            <Unplug className="h-3 w-3 mr-1" /> Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : locked ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Available on the <span className="font-semibold">Command Center</span> plan and above.
                        </p>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white" onClick={() => navigate('/account-plan')}>
                        <ArrowUpRight className="h-4 w-4 mr-2" /> Upgrade to Command Center
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => handleConnect(serviceName)} disabled={connecting === serviceName}>
                      {connecting === serviceName ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : isApiKeyService ? <Key className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      {connecting === serviceName ? 'Connecting...' : `Connect ${displayName}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
                Securely connect your tools via OAuth or API key. Core314 never stores your passwords.
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
