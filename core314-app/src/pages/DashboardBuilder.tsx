import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, Plus, Activity, TrendingUp } from 'lucide-react';
import { generateDashboard } from '../services/dashboardBuilder';
import { IntegrationConfig, DashboardLayout } from '../types';

export default function DashboardBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [dashboards, setDashboards] = useState<DashboardLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchDashboards();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboards = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDashboards(data || []);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
    }
  };

  const handleBuildDashboard = async (integrationId: string) => {
    if (!user) return;

    setBuilding(true);
    setSelectedIntegration(integrationId);

    try {
      const result = await generateDashboard(integrationId, user.id);

      if (result) {
        navigate(`/dashboards/${result.dashboardId}`);
      } else {
        alert('Failed to generate dashboard. Please try again.');
      }
    } catch (error) {
      console.error('Error building dashboard:', error);
      alert('An error occurred while building the dashboard.');
    } finally {
      setBuilding(false);
      setSelectedIntegration(null);
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard Builder</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Automatically generate dashboards from your connected integrations using AI-powered schema analysis
        </p>
      </div>

      {dashboards.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((dashboard) => (
              <Card
                key={dashboard.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/dashboards/${dashboard.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    {dashboard.dashboard_name}
                  </CardTitle>
                  <CardDescription>
                    {dashboard.layout_config.widgets.length} widgets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={dashboard.is_default ? 'default' : 'secondary'}>
                      {dashboard.is_default ? 'Default' : 'Custom'}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {new Date(dashboard.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Build New Dashboard</h2>
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No active integrations found. Connect an integration first to build a dashboard.
                </p>
                <Button onClick={() => navigate('/integrations')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <CardTitle className="capitalize">
                    {integration.integration_type.replace('_', ' ')}
                  </CardTitle>
                  <CardDescription>
                    AI will analyze the schema and create relevant metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleBuildDashboard(integration.id)}
                    disabled={building && selectedIntegration === integration.id}
                    className="w-full"
                  >
                    {building && selectedIntegration === integration.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Build Dashboard
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
