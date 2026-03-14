import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { useSupabaseClient } from '../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  User,
  Users,
  Mail,
  Trash2,
  UserPlus,
  Crown,
  Loader2,
  Check,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'analyst' | 'member' | 'viewer';
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

export function TeamMembers() {
  const { user } = useAuth();
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const supabase = useSupabaseClient();

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-create org state
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Current user's role
  const currentUserRole = teamMembers.find(m => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner';

  useEffect(() => {
    if (currentOrganization) {
      fetchTeamMembers();
      fetchPendingInvites();
    } else if (user && !creatingOrg) {
      // Auto-create organization for users who don't have one
      autoCreateOrganization();
    }
  }, [currentOrganization, user]);

  const autoCreateOrganization = async () => {
    if (!user || creatingOrg) return;

    setCreatingOrg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get user's name or email for org name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const orgName = profile?.full_name
        ? `${profile.full_name}'s Team`
        : `${(profile?.email || user.email || '').split('@')[0]}'s Team`;

      const url = await getSupabaseFunctionUrl('organizations-create');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: orgName,
          plan: 'intelligence',
        }),
      });

      if (response.ok) {
        await refreshOrganizations();
      }
    } catch (err) {
      console.error('Error auto-creating organization:', err);
    } finally {
      setCreatingOrg(false);
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

      const members = (data || []).map(m => {
        const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as TeamMember['role'],
          joined_at: m.joined_at,
          profile: profileData as TeamMember['profile'],
        };
      });

      // Sort: owner first, then by name
      members.sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        const nameA = a.profile?.full_name || a.profile?.email || '';
        const nameB = b.profile?.full_name || b.profile?.email || '';
        return nameA.localeCompare(nameB);
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLink(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = await getSupabaseFunctionUrl('organizations-invite');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          email: inviteEmail.trim(),
          role: 'member',
          invitee_name: inviteName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteLink(data.invite_link || null);
      setInviteName('');
      setInviteEmail('');
      await fetchPendingInvites();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !currentOrganization) return;

    setDeleteLoading(true);
    setDeleteError(null);

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

      setShowDeleteModal(false);
      setSelectedMember(null);
      await fetchTeamMembers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is not available
    }
  };

  // Loading state while auto-creating org
  if (creatingOrg || (!currentOrganization && teamLoading)) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Setting up your team...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Members</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage who has access to your account
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => {
            setShowInviteForm(true);
            setInviteError(null);
            setInviteSuccess(null);
            setInviteLink(null);
          }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Add Team Member Form */}
      {showInviteForm && isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite a New Team Member</CardTitle>
            <CardDescription>
              Send an email invitation to add someone to your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {inviteError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
                </div>
              )}

              {inviteSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm text-green-600 dark:text-green-400">{inviteSuccess}</p>
                  </div>
                  {inviteLink && (
                    <div className="flex items-center gap-2">
                      <Input value={inviteLink} readOnly className="text-xs" />
                      <Button type="button" variant="outline" size="sm" onClick={copyInviteLink}>
                        {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={inviteLoading || !inviteEmail.trim()}>
                  {inviteLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteError(null);
                    setInviteSuccess(null);
                    setInviteLink(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Team</CardTitle>
              <CardDescription>
                {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2">
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
                    <Badge
                      variant={member.role === 'owner' ? 'default' : 'outline'}
                      className="capitalize"
                    >
                      {member.role === 'owner' ? 'Admin' : 'Member'}
                    </Badge>
                    {/* Only owner can delete non-owner members */}
                    {isOwner && member.role !== 'owner' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowDeleteModal(true);
                          setDeleteError(null);
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
      {isOwner && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
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
                        Sent {new Date(invite.created_at).toLocaleDateString()} &middot;
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Member Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{selectedMember?.profile?.full_name || selectedMember?.profile?.email}</strong>{' '}
              from your team? They will lose access to all shared data immediately.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
