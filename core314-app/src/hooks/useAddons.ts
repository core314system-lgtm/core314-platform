import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';

interface UseAddonsReturn {
  activeAddons: string[];
  hasAddon: (addonId: string) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to check active add-on entitlements for the current user/organization.
 * Queries user_addons table for active entitlements at the org level.
 */
export function useAddons(): UseAddonsReturn {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveAddons = async () => {
    if (!user?.id) {
      setActiveAddons([]);
      setLoading(false);
      return;
    }

    try {
      // Get all users in the same org for org-level addon checking
      let userIds = [user.id];
      
      if (currentOrganization?.id) {
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', currentOrganization.id);
        
        if (orgMembers) {
          userIds = orgMembers.map(m => m.user_id);
        }
      }

      const { data: addons, error } = await supabase
        .from('user_addons')
        .select('addon_name')
        .in('user_id', userIds)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching active addons:', error);
        setActiveAddons([]);
        return;
      }

      setActiveAddons(addons?.map(a => a.addon_name) || []);
    } catch (error) {
      console.error('Error fetching active addons:', error);
      setActiveAddons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveAddons();
  }, [user?.id, currentOrganization?.id]);

  const hasAddon = (addonId: string): boolean => {
    return activeAddons.includes(addonId);
  };

  const refresh = async () => {
    setLoading(true);
    await fetchActiveAddons();
  };

  return {
    activeAddons,
    hasAddon,
    loading,
    refresh,
  };
}
