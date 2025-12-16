import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Loader2, Search, Plus, Filter } from 'lucide-react';
import { IntegrationWithStatus } from '../types';
import { UpgradeModal } from '../components/UpgradeModal';
import { addCustomIntegration } from '../services/addCustomIntegration';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { OAuthConnect } from '../components/integrations/OAuthConnect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

export default function IntegrationHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, canAddIntegration } = useSubscription(user?.id);
  const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [enabledCount, setEnabledCount] = useState(0);
  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('');
  const [customLogo, setCustomLogo] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [integrationRegistry, setIntegrationRegistry] = useState<Array<{
    id: string;
    service_name: string;
    display_name: string;
    auth_type: string;
    logo_url?: string;
    category?: string;
    description?: string;
    is_custom?: boolean;
  }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customAuthType, setCustomAuthType] = useState<string>('api_key');
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchIntegrationRegistry();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    try {
      const { data: masterIntegrations, error: masterError } = await supabase
        .from('integrations_master')
        .select('*')
        .order('is_core_integration', { ascending: false })
        .order('integration_name');

      if (masterError) throw masterError;

      const { data: userIntegrations, error: userError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user?.id);

      if (userError) throw userError;

      const mergedIntegrations: IntegrationWithStatus[] = (masterIntegrations || []).map(master => {
        const userInt = userIntegrations?.find(ui => ui.integration_id === master.id);
        return {
          ...master,
          user_integration_id: userInt?.id,
          is_enabled: !!userInt && userInt.status === 'active',
          date_added: userInt?.date_added,
        };
      });

      setIntegrations(mergedIntegrations);
      setEnabledCount(mergedIntegrations.filter(i => i.is_enabled).length);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrationRegistry = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_registry')
        .select('*')
        .eq('is_enabled', true);

      if (error) throw error;
      setIntegrationRegistry(data || []);
    } catch (error) {
      console.error('Error fetching integration registry:', error);
    }
  };

  const handleToggleIntegration = async (integration: IntegrationWithStatus) => {
    if (integration.is_enabled) {
      // Disconnect: delete the integration
      if (integration.user_integration_id) {
        const { error } = await supabase
          .from('user_integrations')
          .delete()
          .eq('id', integration.user_integration_id);

        if (!error) {
          await fetchIntegrations();
        }
      }
    } else {
      if (!canAddIntegration(enabledCount)) {
        setUpgradeModalOpen(true);
        return;
      }

      navigate('/integrations', { 
        state: { 
          selectedIntegration: integration.integration_name,
          integrationId: integration.id 
        } 
      });
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    integrationRegistry.forEach(r => {
      if (r.category) cats.add(r.category);
    });
    return Array.from(cats).sort();
  }, [integrationRegistry]);

  const filteredIntegrations = useMemo(() => {
    let filtered = integrations.filter(integration =>
      integration.integration_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedCategory !== 'all') {
      const registryIdsInCategory = integrationRegistry
        .filter(r => r.category === selectedCategory)
        .map(r => r.service_name);
      filtered = filtered.filter(i => 
        registryIdsInCategory.includes(i.integration_type)
      );
    }

    return filtered;
  }, [integrations, searchQuery, selectedCategory, integrationRegistry]);

  const registryIntegrations = useMemo(() => {
    let filtered = integrationRegistry.filter(r => 
      r.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    return filtered;
  }, [integrationRegistry, searchQuery, selectedCategory]);

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
        <h1 className="text-3xl font-bold mb-2">Integration Hub</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your tools and services to Core314
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">
            {subscription.tier === 'none' ? 'No active subscription' : `${subscription.tier} Plan`}
          </Badge>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {enabledCount} / {subscription.maxIntegrations === -1 ? '∞' : subscription.maxIntegrations} integrations
          </span>
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => {
          const registryEntry = integrationRegistry.find(
            r => r.service_name === integration.integration_type
          );
          
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {integration.logo_url && (
                      <img
                        src={integration.logo_url}
                        alt={integration.integration_name}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <div>
                      <CardTitle className="text-lg">{integration.integration_name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={integration.is_core_integration ? 'default' : 'secondary'} className="text-xs">
                          {integration.is_core_integration ? 'Core' : 'Custom'}
                        </Badge>
                        {integration.is_enabled && (
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
              </CardHeader>
              <CardContent>
                {registryEntry && registryEntry.auth_type === 'oauth2' ? (
                  <OAuthConnect
                    serviceName={registryEntry.service_name}
                    displayName={registryEntry.display_name}
                    logoUrl={registryEntry.logo_url}
                  />
                ) : (
                  <Button
                    onClick={() => handleToggleIntegration(integration)}
                    variant={integration.is_enabled ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {integration.is_enabled ? 'Disconnect' : 'Connect'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No integrations found matching "{searchQuery}"
          </p>
        </div>
      )}

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentTier={subscription.tier}
        currentCount={enabledCount}
        maxCount={subscription.maxIntegrations}
      />

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
                    await fetchIntegrationRegistry();
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
