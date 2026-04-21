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
  MessageSquare,
  Activity,
  CreditCard,
  TrendingUp,
  CalendarPlus,
  ExternalLink,
  DollarSign
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

interface BetaLifecycle {
  lifecycle_id: string;
  user_id: string;
  full_name: string;
  email: string;
  company: string | null;
  lifecycle_status: string;
  beta_accepted_at: string | null;
  first_login_at: string | null;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
  total_logins: number;
  last_activity_at: string | null;
  day_38_email_sent_at: string | null;
  day_45_completed_at: string | null;
  first_payment_at: string | null;
  checkout_url: string | null;
  stripe_subscription_id: string | null;
  extension_days: number;
  admin_notes: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BetaOperations() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState('lifecycle');
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
  const [lifecycles, setLifecycles] = useState<BetaLifecycle[]>([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

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
    activeTesters: 0,
    convertedTesters: 0,
    conversionRate: 0,
    betaRevenue: 0,
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
        fetchLifecycles(),
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

  const fetchLifecycles = async () => {
    setLifecycleLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_beta_testers');

      if (error) {
        console.error('Error fetching lifecycles:', error);
        // Fallback: direct table query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('beta_tester_lifecycle')
          .select('*')
          .order('created_at', { ascending: false });

        if (!fallbackError && fallbackData) {
          const mapped: BetaLifecycle[] = fallbackData.map((bl) => {
            const firstLogin = bl.first_login_at ? new Date(bl.first_login_at) : null;
            const totalDays = 45 + (bl.extension_days || 0);
            const daysElapsed = firstLogin
              ? Math.floor((Date.now() - firstLogin.getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            return {
              lifecycle_id: bl.id,
              user_id: bl.user_id,
              full_name: 'Unknown',
              email: 'Unknown',
              company: null,
              lifecycle_status: bl.lifecycle_status,
              beta_accepted_at: bl.beta_accepted_at,
              first_login_at: bl.first_login_at,
              days_elapsed: daysElapsed,
              days_remaining: Math.max(0, totalDays - daysElapsed),
              total_days: totalDays,
              total_logins: bl.total_logins || 0,
              last_activity_at: bl.last_activity_at,
              day_38_email_sent_at: bl.day_38_email_sent_at,
              day_45_completed_at: bl.day_45_completed_at,
              first_payment_at: bl.first_payment_at,
              checkout_url: bl.checkout_url,
              stripe_subscription_id: bl.stripe_subscription_id,
              extension_days: bl.extension_days || 0,
              admin_notes: bl.admin_notes,
            };
          });
          setLifecycles(mapped);
        }
        return;
      }

      setLifecycles(data || []);

      // Update lifecycle stats
      const active = data?.filter((l: BetaLifecycle) => ['active', 'thanked', 'accepted'].includes(l.lifecycle_status)).length || 0;
      const converted = data?.filter((l: BetaLifecycle) => l.lifecycle_status === 'converted').length || 0;
      const completed = data?.filter((l: BetaLifecycle) => ['completed', 'converting', 'converted', 'churned'].includes(l.lifecycle_status)).length || 0;
      const rate = completed > 0 ? Math.round((converted / completed) * 100) : 0;
      const revenue = converted * 559.30;

      setStats(prev => ({
        ...prev,
        activeTesters: active,
        convertedTesters: converted,
        conversionRate: rate,
        betaRevenue: revenue,
      }));
    } catch (error) {
      console.error('Error fetching lifecycles:', error);
    } finally {
      setLifecycleLoading(false);
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
  // LIFECYCLE ACTIONS
  // =============================================================================

  const createCheckoutForUser = async (userId: string) => {
    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/beta-create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Checkout Created',
          description: `Checkout session created. URL: ${result.checkout_url}`,
        });
        await fetchLifecycles();
      } else {
        throw new Error(result.error || 'Failed to create checkout');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create checkout',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const extendBetaPeriod = async (userId: string) => {
    setSending(true);
    try {
      const { error } = await supabase.rpc('extend_beta_period', {
        p_user_id: userId,
        p_extra_days: 15,
        p_admin_id: profile?.id || null,
      });

      if (error) throw error;

      toast({
        title: 'Beta Extended',
        description: 'Beta period extended by 15 days',
      });
      await fetchLifecycles();
    } catch (error) {
      console.error('Error extending beta:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to extend beta',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const runLifecycleCheck = async () => {
    setSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/beta-lifecycle-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ action: 'auto' }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Lifecycle Check Complete',
          description: `Day 38 emails: ${result.day38_count || 0}, Day 41: ${result.day41_count || 0}, Day 44: ${result.day44_count || 0}, Completed: ${result.day45_count || 0}`,
        });
        await fetchLifecycles();
      } else {
        throw new Error(result.error || 'Lifecycle check failed');
      }
    } catch (error) {
      console.error('Error running lifecycle check:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run lifecycle check',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // =============================================================================
  // HELPERS
  // =============================================================================

  const getLifecycleStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Clock className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><Activity className="w-3 h-3 mr-1" />Active</Badge>;
      case 'thanked':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300"><Mail className="w-3 h-3 mr-1" />Thanked</Badge>;
      case 'completed':
        return <Badge className="bg-sky-100 text-sky-800 border-sky-300"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'converting':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><CreditCard className="w-3 h-3 mr-1" />Converting</Badge>;
      case 'converted':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><DollarSign className="w-3 h-3 mr-1" />Converted</Badge>;
      case 'churned':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" />Churned</Badge>;
      case 'extended':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300"><CalendarPlus className="w-3 h-3 mr-1" />Extended</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getActivityLevel = (logins: number, daysElapsed: number): string => {
    if (daysElapsed === 0) return 'New';
    const rate = logins / daysElapsed;
    if (rate >= 0.7) return 'High';
    if (rate >= 0.3) return 'Medium';
    return 'Low';
  };

  const getActivityColor = (level: string): string => {
    switch (level) {
      case 'High': return 'text-green-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getNextAction = (lifecycle: BetaLifecycle): string => {
    switch (lifecycle.lifecycle_status) {
      case 'accepted':
        return 'Awaiting first login';
      case 'active': {
        const daysUntilThankYou = lifecycle.total_days - 7 - lifecycle.days_elapsed;
        if (daysUntilThankYou > 0) return `Thank-you email in ${daysUntilThankYou}d`;
        return 'Thank-you email due';
      }
      case 'thanked':
        if (!lifecycle.stripe_subscription_id) return 'Awaiting CC collection';
        return 'CC collected, awaiting Day 45';
      case 'completed':
        return 'Create checkout link';
      case 'converting':
        return 'Awaiting first payment';
      case 'converted':
        return 'Active subscriber';
      case 'churned':
        return 'Follow up';
      default:
        return '—';
    }
  };

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="lifecycle">
            <Activity className="w-4 h-4 mr-2" />
            Active Testers
          </TabsTrigger>
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

        {/* Active Testers / Lifecycle Tab */}
        <TabsContent value="lifecycle" className="space-y-6">
          {/* Lifecycle Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Active Testers</p>
                    <p className="text-2xl font-bold">{stats.activeTesters}</p>
                    <p className="text-xs text-gray-500">in 45-day program</p>
                  </div>
                  <Activity className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Converted</p>
                    <p className="text-2xl font-bold">{stats.convertedTesters}</p>
                    <p className="text-xs text-gray-500">paying customers</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
                    <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                    <p className="text-xs text-gray-500">target: 25%+</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Beta Revenue</p>
                    <p className="text-2xl font-bold">${stats.betaRevenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">at $559.30/mo</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-center">
                <Button onClick={runLifecycleCheck} disabled={sending} variant="outline">
                  <RefreshCw className={`mr-2 h-4 w-4 ${sending ? 'animate-spin' : ''}`} />
                  Run Lifecycle Check
                </Button>
                <p className="text-sm text-gray-500">
                  Manually triggers Day 38/41/44 emails and Day 45 completions. This runs automatically daily via cron.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Testers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Beta Tester Lifecycle ({lifecycles.length})</CardTitle>
              <CardDescription>
                Track every beta tester from acceptance through paid conversion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lifecycleLoading ? (
                <p className="text-gray-500 text-center py-8">Loading lifecycle data...</p>
              ) : lifecycles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No beta testers in lifecycle tracking yet. Approve a beta application to begin.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>CC Collected</TableHead>
                        <TableHead>Next Action</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lifecycles.map((lifecycle) => {
                        const activityLevel = getActivityLevel(lifecycle.total_logins, lifecycle.days_elapsed);
                        return (
                          <TableRow key={lifecycle.lifecycle_id}>
                            <TableCell className="font-medium">
                              {lifecycle.full_name}
                              {lifecycle.company && (
                                <p className="text-xs text-gray-500">{lifecycle.company}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{lifecycle.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {lifecycle.first_login_at
                                    ? `Day ${lifecycle.days_elapsed} of ${lifecycle.total_days}`
                                    : 'Not started'}
                                </span>
                                {lifecycle.first_login_at && (
                                  <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                                    <div
                                      className="h-2 rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, (lifecycle.days_elapsed / lifecycle.total_days) * 100)}%`,
                                        backgroundColor:
                                          lifecycle.days_elapsed >= lifecycle.total_days - 7
                                            ? '#f59e0b'
                                            : lifecycle.days_elapsed >= lifecycle.total_days
                                            ? '#ef4444'
                                            : '#22c55e',
                                      }}
                                    />
                                  </div>
                                )}
                                {lifecycle.days_remaining > 0 && lifecycle.first_login_at && (
                                  <span className="text-xs text-gray-500">{lifecycle.days_remaining}d remaining</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getLifecycleStatusBadge(lifecycle.lifecycle_status)}</TableCell>
                            <TableCell>
                              <span className={`font-medium ${getActivityColor(activityLevel)}`}>
                                {activityLevel}
                              </span>
                              <p className="text-xs text-gray-500">{lifecycle.total_logins} logins</p>
                            </TableCell>
                            <TableCell>
                              {lifecycle.stripe_subscription_id ? (
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                  <CreditCard className="w-3 h-3 mr-1" />Yes
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                                  No
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">
                                {getNextAction(lifecycle)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {!lifecycle.stripe_subscription_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => createCheckoutForUser(lifecycle.user_id)}
                                    disabled={sending}
                                    title="Generate Stripe Checkout link"
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    Checkout
                                  </Button>
                                )}
                                {lifecycle.checkout_url && !lifecycle.stripe_subscription_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(lifecycle.checkout_url!, '_blank')}
                                    title="Open checkout URL"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                {['active', 'thanked', 'completed'].includes(lifecycle.lifecycle_status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => extendBetaPeriod(lifecycle.user_id)}
                                    disabled={sending}
                                    title="Extend beta by 15 days"
                                  >
                                    <CalendarPlus className="h-3 w-3 mr-1" />
                                    +15d
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendCheckinEmail(lifecycle.email, lifecycle.full_name)}
                                  disabled={sending}
                                  title="Send check-in email"
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
