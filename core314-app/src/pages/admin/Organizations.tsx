import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Plus, Users, Trash2 } from 'lucide-react';
import { CreateOrgModal } from '../../components/modals/CreateOrgModal';
import { InviteUserModal } from '../../components/modals/InviteUserModal';
import type { OrganizationWithMembers } from '../../types';

export function Organizations() {
  const { user } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const supabase = useSupabaseClient();
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, [user?.id]);

  const fetchOrganizations = async () => {
    if (!user) return;

    try {
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      const orgIds = members?.map(m => m.organization_id) || [];

      if (orgIds.length === 0) {
        setOrganizations([]);
        setLoading(false);
        return;
      }

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      if (orgsError) throw orgsError;

      const { data: memberCounts } = await supabase
        .from('organization_members')
        .select('organization_id')
        .in('organization_id', orgIds);

      const orgsWithMembers = orgs?.map(org => {
        const count = memberCounts?.filter(m => m.organization_id === org.id).length || 0;
        const userRole = members?.find(m => m.organization_id === org.id)?.role || 'member';
        return {
          ...org,
          member_count: count,
          user_role: userRole as 'owner' | 'admin' | 'analyst' | 'member',
        };
      }) || [];

      setOrganizations(orgsWithMembers);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    await fetchOrganizations();
    await refreshOrganizations();
    setShowCreateModal(false);
  };

  const handleInviteUser = async () => {
    setShowInviteModal(false);
    setSelectedOrg(null);
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? This will delete all associated data.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = await getSupabaseFunctionUrl('organizations-delete');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organization_id: orgId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await fetchOrganizations();
      await refreshOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Failed to delete organization');
    }
  };

  if (loading) {
    return <div className="p-6">Loading organizations...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Organizations</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your organizations and team members</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Users className="h-4 w-4" />
                    {org.member_count} {org.member_count === 1 ? 'member' : 'members'}
                  </CardDescription>
                </div>
                <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                  {org.plan}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Your role:</span>
                <Badge variant="outline">{org.user_role}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                  {org.status}
                </Badge>
              </div>
              <div className="flex gap-2 mt-4">
                {['owner', 'admin'].includes(org.user_role) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedOrg(org.id);
                      setShowInviteModal(true);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Invite
                  </Button>
                )}
                {org.user_role === 'owner' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteOrg(org.id, org.name)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {organizations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't belong to any organizations yet.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Organization
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateOrgModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateOrg}
      />

      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        organizationId={selectedOrg}
        onSuccess={handleInviteUser}
      />
    </div>
  );
}
