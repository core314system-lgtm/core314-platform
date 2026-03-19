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
  RefreshCw,
  XCircle,
  Clock,
  Send,
  History,
  ChevronDown,
  ChevronUp,
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
  sent_at: string | null;
  first_name: string | null;
  last_name: string | null;
}

export function TeamMembers() {
  const { user } = useAuth();
  const { currentOrganization, refreshOrganizations, loading: orgLoading, error: orgError } = useOrganization();
  const supabase = useSupabaseClient();

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Seat limit state (from check_organization_user_limit RPC)
  const [seatLimit, setSeatLimit] = useState<number | null>(null); // -1 = unlimited
  const [seatCount, setSeatCount] = useState<number>(0);
  const [seatPlanName, setSeatPlanName] = useState<string>('Free');

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
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

  // Invite action state (resend/cancel)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [inviteActionError, setInviteActionError] = useState<string | null>(null);
  const [inviteActionSuccess, setInviteActionSuccess] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<PendingInvite | null>(null);

  // Auto-create org state
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgCreateError, setOrgCreateError] = useState<string | null>(null);

  // Invitation history toggle
  const [showHistory, setShowHistory] = useState(false);

  // Current user's role — check both team members list and org owner_id for robustness
  const currentUserRole = teamMembers.find(m => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner' || currentOrganization?.owner_id === user?.id;

  useEffect(() => {
    if (currentOrganization) {
      fetchTeamMembers();
      fetchPendingInvites();
      fetchSeatLimits();
    } else if (user && !creatingOrg && !orgLoading) {
      // Only auto-create after org context has finished loading and confirmed no org exists
      autoCreateOrganization();
    }
  }, [currentOrganization, user, orgLoading]);

  const autoCreateOrganization = async () => {
    if (!user || creatingOrg) return;

    setCreatingOrg(true);
    setOrgCreateError(null);
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
      setOrgCreateError(err instanceof Error ? err.message : 'Failed to set up your team');
    } finally {
      setCreatingOrg(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!currentOrganization) return;

    setTeamLoading(true);
    try {
      // Step 1: Fetch organization members (no FK join needed)
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role, joined_at')
        .eq('organization_id', currentOrganization.id);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Step 2: Fetch profiles for all member user_ids
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, { full_name: p.full_name, email: p.email }])
      );

      const members: TeamMember[] = membersData.map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as TeamMember['role'],
        joined_at: m.joined_at,
        profile: profileMap.get(m.user_id) || null,
      }));

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

  const fetchSeatLimits = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .rpc('check_organization_user_limit', { p_organization_id: currentOrganization.id });

      if (error) {
        console.error('Error fetching seat limits:', error);
        return;
      }

      if (data && data.length > 0) {
        const info = data[0];
        setSeatLimit(info.user_limit);
        setSeatCount(info.current_count);
        setSeatPlanName(info.plan_name);
      }
    } catch (err) {
      console.error('Error fetching seat limits:', err);
    }
  };

  const fetchPendingInvites = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('id, email, role, status, created_at, expires_at, sent_at, first_name, last_name')
        .eq('organization_id', currentOrganization.id)
        .in('status', ['pending', 'cancelled', 'expired', 'accepted'])
        .order('created_at', { ascending: false });

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
          first_name: inviteFirstName.trim() || undefined,
          last_name: inviteLastName.trim() || undefined,
        }),
      });

      const data = await response.json();

      // Handle email delivery failure (502) — invite was created but email failed
      if (response.status === 502 && data.invite_link) {
        setInviteError('Email delivery failed. Share the invite link manually instead:');
        setInviteLink(data.invite_link);
        setInviteFirstName('');
        setInviteLastName('');
        setInviteEmail('');
        await fetchPendingInvites();
        await fetchSeatLimits();
        return;
      }

      if (!response.ok) throw new Error(data.error);

      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteLink(data.invite_link || null);
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      await fetchPendingInvites();
      await fetchSeatLimits(); // Refresh seat count after invite
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
      await fetchSeatLimits(); // Refresh seat count after removal
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

  const handleResendInvite = async (invite: PendingInvite) => {
    if (!currentOrganization) return;

    setActionLoadingId(invite.id);
    setInviteActionError(null);
    setInviteActionSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = await getSupabaseFunctionUrl('organizations-invite-manage');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resend',
          invitation_id: invite.id,
          organization_id: currentOrganization.id,
        }),
      });

      const data = await response.json();

      if (response.status === 502 && data.invite_link) {
        setInviteActionError(`Email delivery failed for ${invite.email}. Copy invite link: ${data.invite_link}`);
        await fetchPendingInvites();
        return;
      }

      if (!response.ok) throw new Error(data.error);

      setInviteActionSuccess(`Invitation resent to ${invite.email}`);
      await fetchPendingInvites();
    } catch (err) {
      setInviteActionError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvite = async () => {
    if (!currentOrganization || !selectedInvite) return;

    setActionLoadingId(selectedInvite.id);
    setInviteActionError(null);
    setInviteActionSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = await getSupabaseFunctionUrl('organizations-invite-manage');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          invitation_id: selectedInvite.id,
          organization_id: currentOrganization.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setInviteActionSuccess(`Invitation to ${selectedInvite.email} cancelled`);
      setShowCancelModal(false);
      setSelectedInvite(null);
      await fetchPendingInvites();
      await fetchSeatLimits();
    } catch (err) {
      setInviteActionError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getInviteStatusBadge = (invite: PendingInvite) => {
    const isExpired = invite.status === 'pending' && new Date(invite.expires_at) < new Date();
    if (isExpired || invite.status === 'expired') {
      return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    if (invite.status === 'cancelled') {
      return <Badge variant="outline" className="text-red-600 border-red-300"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    }
    return <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Send className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  // Loading state while org context is loading or auto-creating org
  if (orgLoading || creatingOrg) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {creatingOrg ? 'Setting up your team...' : 'Loading...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error or no-org fallback — prevents infinite spinner
  if (!currentOrganization && !orgLoading && !creatingOrg) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <Users className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Setup</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {orgError || orgCreateError || 'Unable to load your organization. Please try again.'}
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
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
            setInviteFirstName('');
            setInviteLastName('');
            setInviteEmail('');
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-first-name">First Name *</Label>
                  <Input
                    id="invite-first-name"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-last-name">Last Name *</Label>
                  <Input
                    id="invite-last-name"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Doe"
                    required
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
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
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
                <Button type="submit" disabled={inviteLoading || !inviteEmail.trim() || !inviteFirstName.trim() || !inviteLastName.trim()}>
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
                {seatLimit !== null ? (
                  seatLimit === -1
                    ? `${seatCount} ${seatCount === 1 ? 'member' : 'members'} (Unlimited seats — ${seatPlanName})`
                    : `${seatCount} of ${seatLimit} seats used — ${seatPlanName} plan`
                ) : (
                  `${teamMembers.length} ${teamMembers.length === 1 ? 'member' : 'members'}`
                )}
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
      {isOwner && pendingInvites.length > 0 && (() => {
        const activeInvites = pendingInvites.filter(
          (inv) => inv.status === 'pending' && new Date(inv.expires_at) >= new Date()
        );
        const historyInvites = pendingInvites.filter(
          (inv) => inv.status !== 'pending' || new Date(inv.expires_at) < new Date()
        );
        const displayedInvites = showHistory ? pendingInvites : activeInvites;

        // Only show the card if there are active invites or history toggle is on
        if (activeInvites.length === 0 && !showHistory && historyInvites.length === 0) return null;

        return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invitations</CardTitle>
                <CardDescription>
                  {activeInvites.length === 0
                    ? 'No pending invitations'
                    : `${activeInvites.length} pending invitation${activeInvites.length !== 1 ? 's' : ''}`}
                </CardDescription>
              </div>
              {historyInvites.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <History className="h-4 w-4 mr-1" />
                  {showHistory ? 'Hide' : 'Show'} History
                  {showHistory ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteActionError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{inviteActionError}</p>
              </div>
            )}
            {inviteActionSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-sm text-green-600 dark:text-green-400">{inviteActionSuccess}</p>
              </div>
            )}
            {displayedInvites.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No pending invitations
              </p>
            ) : (
            <div className="space-y-2">
              {displayedInvites.map((invite) => {
                const isPending = invite.status === 'pending' && new Date(invite.expires_at) >= new Date();
                const isExpiredPending = invite.status === 'pending' && new Date(invite.expires_at) < new Date();
                const isInactive = invite.status === 'cancelled' || invite.status === 'expired' || isExpiredPending;
                return (
                  <div
                    key={invite.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      isInactive
                        ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60'
                        : 'bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <Mail className={`h-5 w-5 shrink-0 ${
                        isInactive ? 'text-gray-400' : 'text-yellow-600'
                      }`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {invite.first_name || invite.last_name
                            ? `${invite.first_name || ''} ${invite.last_name || ''}`.trim()
                            : invite.email}
                        </p>
                        {(invite.first_name || invite.last_name) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{invite.email}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Sent {new Date(invite.sent_at || invite.created_at).toLocaleDateString()}
                          {' '}&middot;{' '}
                          {isPending
                            ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                            : invite.status === 'cancelled'
                            ? 'Cancelled'
                            : `Expired ${new Date(invite.expires_at).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getInviteStatusBadge(invite)}
                      {isPending && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendInvite(invite)}
                            disabled={actionLoadingId === invite.id}
                            title="Resend invitation email"
                          >
                            {actionLoadingId === invite.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedInvite(invite);
                              setShowCancelModal(true);
                              setInviteActionError(null);
                            }}
                            disabled={actionLoadingId === invite.id}
                            title="Cancel invitation"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Cancel Invitation Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the invitation to{' '}
              <strong>{selectedInvite?.email}</strong>?
              The invite link will be immediately invalidated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Keep Invitation
            </Button>
            <Button variant="destructive" onClick={handleCancelInvite} disabled={actionLoadingId === selectedInvite?.id}>
              {actionLoadingId === selectedInvite?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
