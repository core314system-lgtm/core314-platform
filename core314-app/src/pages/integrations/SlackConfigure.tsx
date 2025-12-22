import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../components/ui/alert-dialog';

export function SlackConfigure() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [integration, setIntegration] = useState<{
    id: string;
    status: string;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchSlackIntegration();
    }
  }, [user]);

  const fetchSlackIntegration = async () => {
    try {
      const { data: registryData } = await supabase
        .from('integration_registry')
        .select('id')
        .eq('service_name', 'slack')
        .single();

      if (!registryData) {
        setLoading(false);
        return;
      }

      const { data: userIntegration } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('provider_id', registryData.id)
        .single();

      setIntegration(userIntegration);
    } catch (error) {
      console.error('Error fetching Slack integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('id', integration.id);

      if (!error) {
        navigate('/integrations');
      }
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
    } finally {
      setDisconnecting(false);
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
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/integrations')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Integrations
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <img
              src="https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg"
              alt="Slack"
              className="w-12 h-12 object-contain"
            />
            <div>
              <CardTitle className="text-2xl">Slack Integration</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant="outline" 
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  Connected
                </Badge>
              </div>
            </div>
          </div>
          <CardDescription className="mt-4">
            {integration ? 'Slack is connected to your Core314 account.' : 'Slack is connected.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              More Slack configuration options coming soon.
            </p>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Danger Zone
            </h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  Disconnect Slack
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Slack</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to disconnect Slack? This will remove all associated data and stop syncing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {disconnecting ? (
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
    </div>
  );
}
