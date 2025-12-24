import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { useSupabaseClient } from '../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  User, 
  Building2, 
  Users, 
  Mail, 
  Shield, 
  Trash2, 
  UserPlus,
  Crown,
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';
import { InviteUserModal } from '../components/modals/InviteUserModal';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'analyst' | 'member';
  joined_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export function Settings() {
  const { user } = useAuth();
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const supabase = useSupabaseClient();
  const location = useLocation();
  
  // Detect if we're on /settings/organization path (redirect target for no-org users)
  const isOrgRoute = location.pathname === '/settings/organization';
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  
  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  
  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<string>('member');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Current user's role in the organization
  const currentUserRole = teamMembers.find(m => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (currentOrganization) {
      fetchTeamMembers();
      fetchPendingInvites();
    } else {
      // No organization - stop loading states to prevent infinite spinners
      setTeamLoading(false);
      setTeamMembers([]);
      setPendingInvites([]);
    }
  }, [currentOrganization]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setFullName(data.full_name || '');
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!currentOrganization) return;
    
    setTeamLoading(true);
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('organization_id', currentOrganization.id);
      
      if (error) throw error;
      
      // Transform the data to match our interface
      // Supabase returns joined data as arrays, so we need to handle that
      const members = (data || []).map(m => {
        // profiles can be an array or single object depending on the relationship
        const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as TeamMember['role'],
          joined_at: m.joined_at,
          profile: profileData as TeamMember['profile'],
        };
      });
      
      // Sort: owner first, then admins, then members
      members.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, analyst: 2, member: 3 };
        return roleOrder[a.role] - roleOrder[b.role];
      });
      
      setTeamMembers(members);
    } catch (err) {
      console.error('Error fetching team members:', err);
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchPendingInvites = async () => {
    if (!currentOrganization) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending');
      
      if (error) throw error;
      setPendingInvites(data || []);
    } catch (err) {
      console.error('Error fetching pending invites:', err);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !currentOrganization) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const url = await getSupabaseFunctionUrl('organizations-remove-member');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          user_id: selectedMember.user_id,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setShowRemoveModal(false);
      setSelectedMember(null);
      await fetchTeamMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember || !currentOrganization) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const url = await getSupabaseFunctionUrl('organizations-change-role');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          user_id: selectedMember.user_id,
          role: newRole,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setShowChangeRoleModal(false);
      setSelectedMember(null);
      await fetchTeamMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedMember || !currentOrganization) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const url = await getSupabaseFunctionUrl('organizations-transfer-ownership');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          new_owner_id: selectedMember.user_id,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setShowTransferModal(false);
      setSelectedMember(null);
      await fetchTeamMembers();
      await refreshOrganizations();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your profile and organization settings</p>
      </div>

      <Tabs defaultValue={isOrgRoute ? "organization" : "profile"} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              
              <Button onClick={saveProfile} disabled={profileLoading}>
                {profileLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : profileSaved ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {profileSaved ? 'Saved!' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>View and manage your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show friendly empty state when user has no organization */}
              {!currentOrganization ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Organization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
                    You're not currently a member of any organization. To use Core314's full features, you need to join an organization.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      Check your email for an organization invite, or contact your administrator to get access.
                    </p>
                  </div>
                </div>
              ) : (
              <>
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input 
                  value={currentOrganization?.name || ''} 
                  disabled 
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Plan</Label>
                  <div className="mt-1">
                    <Badge variant="secondary" className="capitalize">
                      {currentOrganization?.plan || 'starter'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge variant={currentOrganization?.status === 'active' ? 'default' : 'secondary'}>
                      {currentOrganization?.status || 'active'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Your Role</Label>
                  <div className="mt-1">
                    <Badge variant={getRoleBadgeVariant(currentUserRole || 'member')} className="capitalize">
                      {currentUserRole || 'member'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Created</Label>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {currentOrganization?.created_at 
                      ? new Date(currentOrganization.created_at).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Owner Information */}
              {teamMembers.length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Label>Organization Owner</Label>
                  <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {teamMembers.find(m => m.role === 'owner')?.profile?.full_name || 
                         teamMembers.find(m => m.role === 'owner')?.profile?.email || 
                         'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {teamMembers.find(m => m.role === 'owner')?.profile?.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your organization's team</CardDescription>
                </div>
                {isAdmin && currentOrganization && (
                  <Button onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {/* Show friendly empty state when user has no organization */}
                {!currentOrganization ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Team Management Requires an Organization
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      You're not currently a member of any organization. Once you join an organization, you'll be able to view and manage team members here.
                    </p>
                  </div>
                ) : teamLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            {member.role === 'owner' ? (
                              <Crown className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <User className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {member.profile?.full_name || member.profile?.email || 'Unknown User'}
                              {member.user_id === user?.id && (
                                <span className="ml-2 text-xs text-gray-500">(you)</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">{member.profile?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                            {member.role}
                          </Badge>
                          {isOwner && member.user_id !== user?.id && member.role !== 'owner' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setNewRole(member.role);
                                  setShowChangeRoleModal(true);
                                }}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setShowTransferModal(true);
                                }}
                              >
                                <Crown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedMember(member);
                                  setShowRemoveModal(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {isAdmin && !isOwner && member.user_id !== user?.id && 
                           member.role !== 'owner' && member.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedMember(member);
                                setShowRemoveModal(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            {isAdmin && pendingInvites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                  <CardDescription>Invitations waiting to be accepted</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => (
                      <div 
                        key={invite.id}
                        className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Mail className="h-5 w-5 text-yellow-600" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{invite.email}</p>
                            <p className="text-sm text-gray-500">
                              Expires {new Date(invite.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{invite.role}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        organizationId={currentOrganization?.id || null}
        onSuccess={() => {
          setShowInviteModal(false);
          fetchPendingInvites();
        }}
      />

      {/* Remove Member Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.email}</strong>{' '}
              from the organization? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog open={showChangeRoleModal} onOpenChange={setShowChangeRoleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for{' '}
              <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {actionError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeRoleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Transfer Ownership
            </DialogTitle>
            <DialogDescription>
              You are about to transfer ownership of this organization to{' '}
              <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.email}</strong>.
              You will be demoted to Admin and will no longer be able to delete the organization or transfer ownership.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Warning:</strong> This action cannot be undone. Only the new owner can transfer ownership back to you.
            </p>
          </div>
          {actionError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleTransferOwnership} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
