import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Loader2, Settings, Trash2, RefreshCw, Plug } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';

interface ConnectedIntegration {
  id: string;
  user_id: string;
  provider_id: string;
  integration_id?: string;
  status: string;
  created_at: string;
  last_verified_at?: string;
  error_message?: string;
  registry?: {
    id: string;
    service_name: string;
    display_name: string;
    logo_url?: string;
    category?: string;
    description?: string;
    auth_type: string;
  };
}

export function Integrations() {
  const { user } = useAuth();
  const { subscription } = useSubscription(user?.id);
  const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConnectedIntegrations();
    }
  }, [user]);

  const fetchConnectedIntegrations = async () => {
    try {
      const { data: userIntegrations, error: userError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user?.id);

      if (userError) throw userError;

      if (!userIntegrations || userIntegrations.length === 0) {
        setConnectedIntegrations([]);
        setLoading(false);
        return;
      }

      const providerIds = userIntegrations
        .map(ui => ui.provider_id || ui.integration_id)
        .filter(Boolean);

      const { data: registryData, error: registryError } = await supabase
        .from('integration_registry')
        .select('*')
        .in('id', providerIds);

      if (registryError) throw registryError;

      const merged: ConnectedIntegration[] = userIntegrations
        .map(ui => {
          const registry = registryData?.find(r => 
            r.id === ui.provider_id || r.id === ui.integration_id
          );
          return {
            ...ui,
            registry,
          };
        })
        .filter(integration => integration.registry !== undefined);

      setConnectedIntegrations(merged);
    } catch (error) {
      console.error('Error fetching connected integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('id', integrationId);

      if (!error) {
        await fetchConnectedIntegrations();
      }
    } catch (error) {
      console.error('Error disconnecting integration:', error);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleReconnect = async (integrationId: string) => {
    setReconnecting(integrationId);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .update({ status: 'active', error_message: null, last_verified_at: new Date().toISOString() })
        .eq('id', integrationId);

      if (!error) {
        await fetchConnectedIntegrations();
      }
    } catch (error) {
      console.error('Error reconnecting integration:', error);
    } finally {
      setReconnecting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Integrations</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your connected integrations
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">
            {subscription.tier === 'none' ? 'No active subscription' : `${subscription.tier} Plan`}
          </Badge>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connectedIntegrations.length} / {subscription.maxIntegrations === -1 ? '∞' : subscription.maxIntegrations} integrations connected
          </span>
        </div>
      </div>

      {connectedIntegrations.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Plug className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No integrations connected
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Connect your tools and services to Core314 to start tracking metrics and automating workflows.
          </p>
          <Button asChild>
            <Link to="/integration-hub">
              Browse available integrations
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectedIntegrations.map((integration) => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {integration.registry?.logo_url && (
                      <img
                        src={integration.registry.logo_url}
                        alt={integration.registry.display_name}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {integration.registry!.display_name}
                      </CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={
                            integration.status === 'active' 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : integration.status === 'error'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }
                        >
                          {integration.status === 'active' ? 'Connected' : 
                           integration.status === 'error' ? 'Error' : 'Inactive'}
                        </Badge>
                        {integration.registry?.category && (
                          <Badge variant="outline" className="text-xs">
                            {integration.registry.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {integration.registry!.description}
                </CardDescription>
                {integration.error_message && (
                  <p className="text-sm text-red-600 mt-2">
                    Error: {integration.error_message}
                  </p>
                )}
                {integration.last_verified_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last verified: {new Date(integration.last_verified_at).toLocaleDateString()}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to={`/integrations/${integration.registry?.service_name || integration.id}/configure`}>
                      <Settings className="h-4 w-4 mr-1" />
                      {integration.registry?.service_name === 'slack' ? 'Manage' : 'Configure'}
                    </Link>
                  </Button>
                  
                  {integration.status === 'error' || integration.status === 'inactive' ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReconnect(integration.id)}
                      disabled={reconnecting === integration.id}
                    >
                      {reconnecting === integration.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect {integration.registry?.display_name}? 
                          This will remove all associated data and stop syncing.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={disconnecting === integration.id}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {disconnecting === integration.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            'Disconnect'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {connectedIntegrations.length > 0 && (
        <div className="text-center pt-6 border-t">
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Looking to add more integrations?
          </p>
          <Button variant="outline" asChild>
            <Link to="/integration-hub">
              Browse available integrations
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
