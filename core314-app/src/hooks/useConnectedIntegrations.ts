import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export interface ConnectedIntegration {
  id: string;
  provider_id: string;
  service_name: string;
  display_name: string;
  status: string;
}

export function useConnectedIntegrations() {
  const { profile } = useAuth();
  const [integrations, setIntegrations] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!profile?.id) {
        setIntegrations([]);
        setLoading(false);
        return;
      }

      try {
        // Query user_integrations with registry join - same source as Integration Hub
        const { data, error } = await supabase
          .from('user_integrations')
          .select(`
            id,
            provider_id,
            status,
            integration_registry (
              id,
              service_name,
              display_name
            )
          `)
          .eq('user_id', profile.id)
          .eq('added_by_user', true)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching connected integrations:', error);
          setIntegrations([]);
          return;
        }

        const mapped: ConnectedIntegration[] = (data || [])
          .filter((item) => item.integration_registry)
          .map((item) => {
            // Handle both single object and array responses from Supabase join
            const registryData = item.integration_registry;
            const registry = Array.isArray(registryData) ? registryData[0] : registryData;
            if (!registry) return null;
            return {
              id: item.id,
              provider_id: item.provider_id || registry.id,
              service_name: registry.service_name,
              display_name: registry.display_name,
              status: item.status,
            };
          })
          .filter((item): item is ConnectedIntegration => item !== null);

        setIntegrations(mapped);
      } catch (err) {
        console.error('Error in useConnectedIntegrations:', err);
        setIntegrations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, [profile?.id]);

  // Helper functions to check specific integrations
  const hasSlack = integrations.some(
    (i) => i.service_name.toLowerCase() === 'slack'
  );
  
  const hasTeams = integrations.some(
    (i) => i.service_name.toLowerCase() === 'microsoft_teams' || 
           i.service_name.toLowerCase() === 'teams'
  );

  return {
    integrations,
    loading,
    hasSlack,
    hasTeams,
  };
}
