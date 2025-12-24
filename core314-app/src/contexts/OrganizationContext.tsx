import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabaseClient } from './SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../lib/supabase';
import { Organization } from '../types';
import { useAuth } from '../hooks/useAuth';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  hasNoOrganizations: boolean;
  requiresOrgSelection: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasNoOrganizations = !loading && organizations.length === 0;
  const requiresOrgSelection = !loading && organizations.length > 1 && !currentOrganization;

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setError(null);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      const orgIds = members?.map(m => m.organization_id) || [];

      if (orgIds.length === 0) {
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .order('name');

      if (orgsError) throw orgsError;

      setOrganizations(orgs || []);

      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const savedOrg = orgs?.find(o => o.id === savedOrgId);
      
      if (orgs && orgs.length === 1) {
        setCurrentOrganization(orgs[0]);
        localStorage.setItem('currentOrganizationId', orgs[0].id);
      } else if (savedOrg) {
        setCurrentOrganization(savedOrg);
      } else if (orgs && orgs.length > 0) {
        setCurrentOrganization(orgs[0]);
        localStorage.setItem('currentOrganizationId', orgs[0].id);
      } else {
        setCurrentOrganization(null);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user?.id]);

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', orgId);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const url = await getSupabaseFunctionUrl('organizations-switch');
          await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ organization_id: orgId }),
          });
        }
      } catch (error) {
        console.error('Failed to log organization switch:', error);
      }
    }
  };

  const refreshOrganizations = async () => {
    setLoading(true);
    await fetchOrganizations();
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        loading,
        error,
        hasNoOrganizations,
        requiresOrgSelection,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
