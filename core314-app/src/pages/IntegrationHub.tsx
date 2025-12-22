import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getSupabaseFunctionUrl } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Loader2, Search, Plus, Filter, Zap, BarChart3, Lightbulb, CheckCircle, ArrowRight, Shield, Lock, RefreshCw } from 'lucide-react';
import { UpgradeModal } from '../components/UpgradeModal';
import { addCustomIntegration } from '../services/addCustomIntegration';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
// Note: OAuthConnect component exists but modal-based flow is used for better UX with real OAuth
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';

// Integration-specific copy for data analyzed and benefits
const INTEGRATION_COPY: Record<string, { dataAnalyzed: string; benefit: string }> = {
  slack: {
    dataAnalyzed: 'Message volume, response time, channel activity',
    benefit: 'Spot bottlenecks in communication and overloaded teams',
  },
  teams: {
    dataAnalyzed: 'Meeting frequency, chat patterns, collaboration signals',
    benefit: 'Identify communication gaps and team coordination issues',
  },
  gmail: {
    dataAnalyzed: 'Email volume, response latency, thread patterns',
    benefit: 'Detect workflow delays and communication breakdowns',
  },
  asana: {
    dataAnalyzed: 'Task completion rates, project velocity, workload distribution',
    benefit: 'Optimize team productivity and project timelines',
  },
  jira: {
    dataAnalyzed: 'Issue throughput, sprint metrics, cycle time',
    benefit: 'Improve development velocity and delivery predictability',
  },
  hubspot: {
    dataAnalyzed: 'Pipeline activity, deal velocity, engagement metrics',
    benefit: 'Accelerate sales cycles and improve conversion rates',
  },
  salesforce: {
    dataAnalyzed: 'Opportunity stages, activity logs, forecast accuracy',
    benefit: 'Enhance sales visibility and revenue predictability',
  },
  stripe: {
    dataAnalyzed: 'Transaction volume, revenue trends, churn signals',
    benefit: 'Monitor financial health and identify growth opportunities',
  },
  quickbooks: {
    dataAnalyzed: 'Cash flow patterns, expense trends, invoice cycles',
    benefit: 'Improve financial planning and operational efficiency',
  },
  zendesk: {
    dataAnalyzed: 'Ticket volume, resolution time, satisfaction scores',
    benefit: 'Enhance customer support quality and team efficiency',
  },
  zoom: {
    dataAnalyzed: 'Meeting frequency, duration patterns, attendance rates',
    benefit: 'Optimize meeting culture and collaboration time',
  },
  trello: {
    dataAnalyzed: 'Card movement, list throughput, board activity',
    benefit: 'Streamline workflows and identify process bottlenecks',
  },
  notion: {
    dataAnalyzed: 'Page activity, collaboration patterns, content updates',
    benefit: 'Improve knowledge sharing and documentation practices',
  },
  sendgrid: {
    dataAnalyzed: 'Email delivery rates, engagement metrics, bounce patterns',
    benefit: 'Optimize email campaigns and communication reach',
  },
};

// Default copy for integrations not in the mapping
const DEFAULT_INTEGRATION_COPY = {
  dataAnalyzed: 'Usage patterns and operational signals',
  benefit: 'Improve visibility into how this tool impacts your workflows',
};

// Pre-connection context component (shown when zero integrations connected)
function PreConnectionContext() {
  return (
    <Card className="mb-8 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          What happens when you connect an integration?
        </CardTitle>
        <CardDescription className="text-base">
          After connecting an integration, Core314 begins securely analyzing operational signals to power dashboards, alerts, and AI insights.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Core314 reads operational signals only — it never modifies your data</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Metrics and trends populate automatically</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Alerts and insights become available as patterns emerge</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Integrations can be disconnected at any time</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// First connection success component
interface FirstConnectionSuccessProps {
  enabledCount: number;
  onViewDashboard: () => void;
  onConnectAnother: () => void;
  onDismiss: () => void;
}

function FirstConnectionSuccess({ enabledCount, onViewDashboard, onConnectAnother, onDismiss }: FirstConnectionSuccessProps) {
  return (
    <Card className="mb-6 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              First Integration Connected
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              We're now monitoring signals from your connected tools. Initial insights will start appearing on your dashboard shortly as data begins flowing.
            </p>
            {enabledCount === 1 && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Adding at least one more integration will improve Fusion accuracy across your operations.
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={onViewDashboard}>
                View Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={onConnectAnother}>
                Connect Another Integration
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-auto">
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Trust & control reassurance component
function TrustReassuranceNote() {
  return (
    <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 flex items-center gap-3">
      <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Your data remains yours. Core314 uses read-only access where possible and never makes changes without your permission.
      </p>
    </div>
  );
}

// Integration Connect Modal - Reusable modal for integration connection flow
interface IntegrationConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  providerName: string;
  logoUrl?: string;
  dataAnalyzed: string;
  benefit: string;
  onConnect: (providerId: string, providerName: string) => void;
}

function IntegrationConnectModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  logoUrl,
  dataAnalyzed,
  benefit,
  onConnect,
}: IntegrationConnectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt={providerName} className="w-8 h-8 object-contain" />
            )}
            Connect {providerName} to Core314
          </DialogTitle>
          <DialogDescription>
            Once connected, Core314 will begin analyzing operational signals from {providerName} to power your dashboards, alerts, and AI insights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* What Core314 will analyze */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              What Core314 will analyze
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
              {dataAnalyzed}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-6 mt-1">
              <span className="font-medium">Benefit:</span> {benefit}
            </p>
          </div>

          {/* Permissions required */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              Permissions required
            </h4>
            <div className="space-y-2 ml-6">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Lock className="h-3.5 w-3.5 text-gray-400" />
                <span>Read-only access — Core314 never modifies your data</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                <span>No data modification — we only observe operational signals</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                <span>Disconnect anytime — you stay in full control</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConnect(providerId, providerName)}>
            Continue to Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RegistryIntegration {
  id: string;
  service_name: string;
  display_name: string;
  auth_type: string;
  base_url?: string;
  logo_url?: string;
  category?: string;
  description?: string;
  is_custom?: boolean;
  is_enabled?: boolean;
  provider_type?: string;
  user_integration_id?: string;
  is_connected?: boolean;
}

export default function IntegrationHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, canAddIntegration } = useSubscription(user?.id);
  const [integrations, setIntegrations] = useState<RegistryIntegration[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [enabledCount, setEnabledCount] = useState(0);
  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('');
  const [customLogo, setCustomLogo] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customAuthType, setCustomAuthType] = useState<string>('api_key');
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for first connection success detection
  const [showFirstConnectionSuccess, setShowFirstConnectionSuccess] = useState(false);
  const prevEnabledCountRef = useRef<number | null>(null);
  
  // State for integration connect modal
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<RegistryIntegration | null>(null);
  
  // Toast hook for stub connection
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  // Detect first connection (0 -> 1+ integrations)
  useEffect(() => {
    if (prevEnabledCountRef.current === null) {
      // First run - just initialize
      prevEnabledCountRef.current = enabledCount;
      return;
    }

    if (
      prevEnabledCountRef.current === 0 &&
      enabledCount > 0 &&
      !showFirstConnectionSuccess &&
      !sessionStorage.getItem('integrationHubFirstConnectionShown')
    ) {
      setShowFirstConnectionSuccess(true);
      sessionStorage.setItem('integrationHubFirstConnectionShown', 'true');
    }

    prevEnabledCountRef.current = enabledCount;
  }, [enabledCount, showFirstConnectionSuccess]);

  const handleDismissSuccess = () => {
    setShowFirstConnectionSuccess(false);
  };

  const handleViewDashboard = () => {
    navigate('/dashboard');
  };

  const handleConnectAnother = () => {
    setShowFirstConnectionSuccess(false);
    // Scroll to the grid
    document.getElementById('integration-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchIntegrations = async () => {
    try {
      const { data: registryData, error: registryError } = await supabase
        .from('integration_registry')
        .select('*')
        .eq('is_enabled', true)
        .order('is_custom', { ascending: true })
        .order('display_name');

      if (registryError) throw registryError;

      const { data: userIntegrations, error: userError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user?.id);

      if (userError) throw userError;

      const mergedIntegrations: RegistryIntegration[] = (registryData || []).map(registry => {
        const userInt = userIntegrations?.find(ui => 
          ui.provider_id === registry.id || ui.integration_id === registry.id
        );
        return {
          ...registry,
          user_integration_id: userInt?.id,
          is_connected: !!userInt && userInt.status === 'active',
        };
      });

      setIntegrations(mergedIntegrations);
      setEnabledCount(mergedIntegrations.filter(i => i.is_connected).length);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle disconnect - keeps existing Supabase logic intact
  const handleDisconnect = async (integration: RegistryIntegration) => {
    if (integration.user_integration_id) {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('id', integration.user_integration_id);

      if (!error) {
        await fetchIntegrations();
      }
    }
  };

  // Handle connect click - opens the modal instead of navigating
  const handleConnectClick = (integration: RegistryIntegration) => {
    if (!canAddIntegration(enabledCount)) {
      setUpgradeModalOpen(true);
      return;
    }

    setSelectedIntegration(integration);
    setConnectModalOpen(true);
  };

  // Real OAuth connection - initiates OAuth flow for the selected integration
  const startIntegrationConnection = async (providerId: string, providerName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to connect integrations',
          variant: 'destructive'
        });
        return;
      }

      const url = await getSupabaseFunctionUrl('oauth-initiate');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          service_name: providerId
          // redirect_uri omitted - Edge Function uses Supabase URL as default
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to initiate OAuth for ${providerName}`);
      }

      // Redirect to OAuth provider's authorization page
      window.location.href = data.authorization_url;
    } catch (error) {
      console.error('OAuth connect error:', error);
      toast({
        title: `Failed to connect ${providerName}`,
        description: error instanceof Error ? error.message : 'Connection failed',
        variant: 'destructive'
      });
      setConnectModalOpen(false);
      setSelectedIntegration(null);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    integrations.forEach(r => {
      if (r.category) cats.add(r.category);
    });
    return Array.from(cats).sort();
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    let filtered = integrations.filter(integration =>
      integration.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }

    return filtered;
  }, [integrations, searchQuery, selectedCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Connect Your Systems to Unlock Operational Insight</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Integrations allow Core314 to analyze real operational data across your tools. Once connected, Core314 can monitor performance, detect inefficiencies, and surface actionable insights automatically — without disrupting your existing workflows.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline">
            {subscription.tier === 'none' ? 'No active subscription' : `${subscription.tier} Plan`}
          </Badge>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {enabledCount} / {subscription.maxIntegrations === -1 ? '∞' : subscription.maxIntegrations} integrations
          </span>
        </div>
      </div>

      {/* Pre-connection context - only show if no integrations connected */}
      {enabledCount === 0 && <PreConnectionContext />}

      {/* First connection success state */}
      {showFirstConnectionSuccess && (
        <FirstConnectionSuccess
          enabledCount={enabledCount}
          onViewDashboard={handleViewDashboard}
          onConnectAnother={handleConnectAnother}
          onDismiss={handleDismissSuccess}
        />
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-1 gap-4 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={() => setAddCustomModalOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Custom
        </Button>
      </div>

      {/* Trust reassurance note - shown once per page */}
      <TrustReassuranceNote />

      <div id="integration-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {integration.logo_url && (
                    <img
                      src={integration.logo_url}
                      alt={integration.display_name}
                      className="w-10 h-10 object-contain"
                    />
                  )}
                  <div>
                    <CardTitle className="text-lg">{integration.display_name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={!integration.is_custom ? 'default' : 'secondary'} className="text-xs">
                        {!integration.is_custom ? 'Core' : 'Custom'}
                      </Badge>
                      {integration.category && (
                        <Badge variant="outline" className="text-xs">
                          {integration.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                      {integration.is_connected && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2">
                {integration.description}
              </CardDescription>
              {/* Enhanced data/benefit copy from INTEGRATION_COPY */}
              {(() => {
                const copy = INTEGRATION_COPY[integration.service_name.toLowerCase()] || DEFAULT_INTEGRATION_COPY;
                return (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <BarChart3 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span><span className="font-medium">Analyzes:</span> {copy.dataAnalyzed}</span>
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                      <span><span className="font-medium">Benefit:</span> {copy.benefit}</span>
                    </p>
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent>
              <Button
                onClick={() =>
                  integration.is_connected
                    ? handleDisconnect(integration)
                    : handleConnectClick(integration)
                }
                variant={integration.is_connected ? 'outline' : 'default'}
                className="w-full"
              >
                {integration.is_connected ? 'Disconnect' : 'Connect'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No integrations found matching "{searchQuery}"
          </p>
        </div>
      )}

      {/* Bottom Informational Callout */}
      <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          Why integrations matter
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Integrations allow Core314 to correlate signals across systems, detect issues earlier, and recommend operational improvements that would otherwise remain hidden.
        </p>
      </div>

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentTier={subscription.tier}
        currentCount={enabledCount}
        maxCount={subscription.maxIntegrations}
      />

      {/* Integration Connect Modal */}
      {selectedIntegration && (() => {
        const copy = INTEGRATION_COPY[selectedIntegration.service_name.toLowerCase()] || DEFAULT_INTEGRATION_COPY;
        return (
          <IntegrationConnectModal
            open={connectModalOpen}
            onOpenChange={setConnectModalOpen}
            providerId={selectedIntegration.service_name}
            providerName={selectedIntegration.display_name}
            logoUrl={selectedIntegration.logo_url}
            dataAnalyzed={copy.dataAnalyzed}
            benefit={copy.benefit}
            onConnect={startIntegrationConnection}
          />
        );
      })()}

      <AlertDialog open={addCustomModalOpen} onOpenChange={setAddCustomModalOpen}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Custom Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Connect any external system via API. Custom integrations will be validated for security before activation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customName">Integration Name *</Label>
                <Input
                  id="customName"
                  placeholder="e.g., My CRM"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customType">Category *</Label>
                <Select value={customType} onValueChange={setCustomType}>
                  <SelectTrigger id="customType">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="productivity">Productivity</SelectItem>
                    <SelectItem value="project_management">Project Management</SelectItem>
                    <SelectItem value="crm">CRM</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="customApiUrl">API Base URL *</Label>
              <Input
                id="customApiUrl"
                placeholder="https://api.example.com/v1"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Must use HTTPS. No internal IPs allowed.</p>
            </div>
            <div>
              <Label htmlFor="customAuthType">Authentication Type *</Label>
              <Select value={customAuthType} onValueChange={setCustomAuthType}>
                <SelectTrigger id="customAuthType">
                  <SelectValue placeholder="Select auth type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="customWebhookUrl">Webhook URL (optional)</Label>
              <Input
                id="customWebhookUrl"
                placeholder="https://api.example.com/webhooks"
                value={customWebhookUrl}
                onChange={(e) => setCustomWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customLogo">Logo URL (optional)</Label>
              <Input
                id="customLogo"
                placeholder="https://example.com/logo.svg"
                value={customLogo}
                onChange={(e) => setCustomLogo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customDescription">Description (optional)</Label>
              <Textarea
                id="customDescription"
                placeholder="Brief description of what this integration does"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting || !customName || !customType || !customApiUrl || !customAuthType}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const { error } = await addCustomIntegration({
                    name: customName,
                    type: customType,
                    logoUrl: customLogo,
                    description: customDescription,
                    apiUrl: customApiUrl,
                    authType: customAuthType,
                    webhookUrl: customWebhookUrl,
                  });
                  if (!error) {
                    await fetchIntegrations();
                    setAddCustomModalOpen(false);
                    setCustomName('');
                    setCustomType('');
                    setCustomLogo('');
                    setCustomDescription('');
                    setCustomApiUrl('');
                    setCustomAuthType('api_key');
                    setCustomWebhookUrl('');
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Add Integration'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
