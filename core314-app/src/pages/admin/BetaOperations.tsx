import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { 
  Send, 
  RefreshCw, 
  Mail, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  UserPlus,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

interface BetaApplication {
  id: string;
  full_name: string;
  email: string;
  role_title: string;
  company_size: string;
  tools_systems_used: string;
  biggest_challenge: string;
  why_beta_test: string;
  status: 'pending' | 'approved' | 'rejected' | 'waitlisted';
  created_at: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface BetaInvitation {
  id: string;
  email: string;
  name?: string;
  company?: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'revoked';
  sent_count: number;
  last_sent_at?: string;
  created_at: string;
}

interface MessagingLog {
  id: string;
  admin_user_id: string;
  recipient_email: string;
  recipient_name?: string;
  template_name: string;
  message_type: string;
  send_status: 'pending' | 'sent' | 'failed' | 'bounced';
  created_at: string;
  sent_at?: string;
  error_message?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BetaOperations() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState('invitations');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');

  // Data state
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [messagingLogs, setMessagingLogs] = useState<MessagingLog[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    totalInvitations: 0,
    sentInvitations: 0,
    acceptedInvitations: 0,
    totalMessages: 0,
    sentMessages: 0,
    failedMessages: 0,
  });

  // =============================================================================
  // AUTH CHECK
  // =============================================================================

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [profile, navigate, isAdmin]);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchApplications(),
        fetchInvitations(),
        fetchMessagingLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('beta_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);

      // Update stats
      const pending = data?.filter(a => a.status === 'pending').length || 0;
      const approved = data?.filter(a => a.status === 'approved').length || 0;
      setStats(prev => ({
        ...prev,
        totalApplications: data?.length || 0,
        pendingApplications: pending,
        approvedApplications: approved,
      }));
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('beta_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);

      // Update stats
      const sent = data?.filter(i => i.status === 'sent').length || 0;
      const accepted = data?.filter(i => i.status === 'accepted').length || 0;
      setStats(prev => ({
        ...prev,
        totalInvitations: data?.length || 0,
        sentInvitations: sent,
        acceptedInvitations: accepted,
      }));
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchMessagingLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_messaging_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessagingLogs(data || []);

      // Update stats
      const sent = data?.filter(m => m.send_status === 'sent').length || 0;
      const failed = data?.filter(m => m.send_status === 'failed').length || 0;
      setStats(prev => ({
        ...prev,
        totalMessages: data?.length || 0,
        sentMessages: sent,
        failedMessages: failed,
      }));
    } catch (error) {
      console.error('Error fetching messaging logs:', error);
    }
  };

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const sendBetaInvitation = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Email is required',
        variant: 'destructive',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast({
        title: 'Error',
        description: 'Invalid email format',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-messaging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'send_beta_invite',
          recipient_email: inviteEmail.trim(),
          recipient_name: inviteName.trim() || undefined,
          recipient_company: inviteCompany.trim() || undefined,
          admin_user_id: profile?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Invitation Sent',
          description: `Beta invitation sent to ${inviteEmail}`,
        });
        // Clear form
        setInviteEmail('');
        setInviteName('');
        setInviteCompany('');
        // Refresh data
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const resendInvitation = async (invitation: BetaInvitation) => {
    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-messaging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'send_beta_reminder',
          recipient_email: invitation.email,
          recipient_name: invitation.name || undefined,
          recipient_company: invitation.company || undefined,
          admin_user_id: profile?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Reminder Sent',
          description: `Reminder sent to ${invitation.email}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reminder',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const sendCheckinEmail = async (email: string, name?: string) => {
    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-messaging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'send_beta_checkin',
          recipient_email: email,
          recipient_name: name || undefined,
          admin_user_id: profile?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Check-in Sent',
          description: `Check-in email sent to ${email}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to send check-in');
      }
    } catch (error) {
      console.error('Error sending check-in:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send check-in',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // =============================================================================
  // HELPERS
  // =============================================================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
      case 'accepted':
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'rejected':
      case 'failed':
      case 'bounced':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'waitlisted':
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300"><AlertTriangle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Beta Operations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage beta invitations, applications, and messaging
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Applications</p>
                <p className="text-2xl font-bold">{stats.totalApplications}</p>
                <p className="text-xs text-gray-500">{stats.pendingApplications} pending</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Invitations</p>
                <p className="text-2xl font-bold">{stats.totalInvitations}</p>
                <p className="text-xs text-gray-500">{stats.acceptedInvitations} accepted</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Messages Sent</p>
                <p className="text-2xl font-bold">{stats.sentMessages}</p>
                <p className="text-xs text-gray-500">{stats.failedMessages} failed</p>
              </div>
              <Mail className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Beta Capacity</p>
                <p className="text-2xl font-bold">{stats.approvedApplications}/25</p>
                <p className="text-xs text-gray-500">{25 - stats.approvedApplications} spots left</p>
              </div>
              <CheckCircle className="h-8 w-8 text-sky-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invitations">
            <UserPlus className="w-4 h-4 mr-2" />
            Invitations
          </TabsTrigger>
          <TabsTrigger value="applications">
            <Users className="w-4 h-4 mr-2" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="messaging">
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Log
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Mail className="w-4 h-4 mr-2" />
            Sent History
          </TabsTrigger>
        </TabsList>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-6">
          {/* Send Invitation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send Beta Invitation
              </CardTitle>
              <CardDescription>
                Send a beta invitation email directly. No confirmation dialogs—click send and it goes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="recipient@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Name (optional)</Label>
                  <Input
                    id="invite-name"
                    type="text"
                    placeholder="John Smith"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-company">Company (optional)</Label>
                  <Input
                    id="invite-company"
                    type="text"
                    placeholder="Acme Corp"
                    value={inviteCompany}
                    onChange={(e) => setInviteCompany(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={sendBetaInvitation} 
                    disabled={sending || !inviteEmail.trim()}
                    className="w-full"
                  >
                    {sending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Beta Invitation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sent Invitations List */}
          <Card>
            <CardHeader>
              <CardTitle>Sent Invitations ({invitations.length})</CardTitle>
              <CardDescription>
                Track and resend beta invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No invitations sent yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{invitation.name || '—'}</TableCell>
                        <TableCell>{invitation.company || '—'}</TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {invitation.last_sent_at 
                            ? format(new Date(invitation.last_sent_at), 'MMM d, yyyy HH:mm')
                            : '—'}
                          {invitation.sent_count > 1 && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({invitation.sent_count}x)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resendInvitation(invitation)}
                              disabled={sending || invitation.status === 'accepted'}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendCheckinEmail(invitation.email, invitation.name)}
                              disabled={sending}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Check-in
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Beta Applications ({applications.length})</CardTitle>
              <CardDescription>
                Review and manage inbound beta applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No applications received yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell className="font-medium">{application.full_name}</TableCell>
                        <TableCell>{application.email}</TableCell>
                        <TableCell>{application.role_title}</TableCell>
                        <TableCell>{application.company_size}</TableCell>
                        <TableCell>{getStatusBadge(application.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {format(new Date(application.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendCheckinEmail(application.email, application.full_name)}
                            disabled={sending}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messaging Tab */}
        <TabsContent value="messaging" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Log ({messagingLogs.length})</CardTitle>
              <CardDescription>
                Audit trail of all admin-initiated messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messagingLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages sent yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messagingLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.recipient_email}</p>
                            {log.recipient_name && (
                              <p className="text-xs text-gray-500">{log.recipient_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.template_name}</Badge>
                        </TableCell>
                        <TableCell>{log.message_type}</TableCell>
                        <TableCell>{getStatusBadge(log.send_status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {log.sent_at 
                            ? format(new Date(log.sent_at), 'MMM d, yyyy HH:mm')
                            : format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent History Tab */}
        <TabsContent value="sent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sent Email History</CardTitle>
              <CardDescription>
                Complete history of all emails sent through the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messagingLogs.filter(m => m.send_status === 'sent').length === 0 ? (
                <p className="text-gray-500 text-center py-8">No emails sent yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject/Template</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messagingLogs
                      .filter(m => m.send_status === 'sent')
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.recipient_email}</p>
                              {log.recipient_name && (
                                <p className="text-xs text-gray-500">{log.recipient_name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.template_name}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {log.sent_at && format(new Date(log.sent_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BetaOperations;
