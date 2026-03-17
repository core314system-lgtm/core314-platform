import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { useSupabaseClient } from '../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Building2, Mail, UserPlus, AlertCircle, CheckCircle, Loader2, Clock, XCircle, RefreshCw } from 'lucide-react';

interface InviteDetails {
  valid: boolean;
  organization_name: string | null;
  invited_email: string | null;
  role: string | null;
  expires_at: string | null;
  status: string;
}

export function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const supabase = useSupabaseClient();
  
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }

    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      const url = await getSupabaseFunctionUrl('organizations-invite-details');
      const response = await fetch(`${url}?token=${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to load invite details');
        return;
      }

      setInviteDetails(data);
      
      if (!data.valid) {
        if (data.status === 'expired') {
          setError('This invitation has expired. Please contact your organization administrator to request a new invitation.');
        } else if (data.status === 'accepted') {
          setError('This invitation has already been accepted.');
        } else if (data.status === 'cancelled') {
          setError('This invitation has been cancelled. Please contact your organization administrator to request a new invitation.');
        } else {
          setError('This invitation is no longer valid. Please contact your organization administrator to request a new invitation.');
        }
      }
    } catch (err) {
      console.error('Error fetching invite details:', err);
      setError('Failed to load invite details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user || !token) return;

    setAccepting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to accept this invitation');
        return;
      }

      const url = await getSupabaseFunctionUrl('organizations-accept-invite');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to accept invitation');
        return;
      }

      setSuccess(true);
      
      // Refresh organization context to include the newly joined org
      await refreshOrganizations();
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to {inviteDetails?.organization_name}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You've successfully joined the organization as a {inviteDetails?.role}.
            </p>
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !inviteDetails?.valid) {
    const statusIcon = () => {
      switch (inviteDetails?.status) {
        case 'expired':
          return <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />;
        case 'cancelled':
          return <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />;
        case 'accepted':
          return <CheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />;
        default:
          return <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />;
      }
    };

    const statusTitle = () => {
      switch (inviteDetails?.status) {
        case 'expired':
          return 'Invitation Expired';
        case 'cancelled':
          return 'Invitation Cancelled';
        case 'accepted':
          return 'Invitation Already Used';
        default:
          return 'Invalid Invitation';
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            {statusIcon()}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {statusTitle()}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>

            {inviteDetails?.organization_name && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 justify-center">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Organization: <strong className="text-gray-900 dark:text-white">{inviteDetails.organization_name}</strong>
                  </span>
                </div>
                {inviteDetails.invited_email && (
                  <div className="flex items-center gap-2 justify-center mt-1">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{inviteDetails.invited_email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Request New Invitation hint */}
            {(inviteDetails?.status === 'expired' || inviteDetails?.status === 'cancelled') && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Need a new invitation?</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Contact your organization administrator and ask them to resend your invitation from the Team Members page.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <Button asChild variant="outline">
                <Link to="/login">Go to Login</Link>
              </Button>
              {inviteDetails?.invited_email && (
                <Button
                  variant="default"
                  onClick={() => {
                    window.location.href = `mailto:?subject=New Invitation Request&body=Hi, I tried to accept my invitation to ${inviteDetails?.organization_name || 'your organization'} on Core314 but it is no longer valid (${inviteDetails?.status || 'invalid'}). Could you please send me a new invitation to ${inviteDetails?.invited_email}? Thank you!`;
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Request New Invite
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-orange-500" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join an organization on Core314
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {inviteDetails && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Building2 className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Organization</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {inviteDetails.organization_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Invited Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {inviteDetails.invited_email}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-500">Role</span>
                <Badge variant="secondary" className="capitalize">
                  {inviteDetails.role}
                </Badge>
              </div>

              {inviteDetails.expires_at && (
                <p className="text-xs text-gray-500 text-center">
                  This invitation expires on{' '}
                  {new Date(inviteDetails.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Logged in as <strong>{user.email}</strong>
              </p>
              {user.email?.toLowerCase() !== inviteDetails?.invited_email?.toLowerCase() && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Note: You're logged in with a different email than the invitation was sent to.
                    Make sure you're using the correct account.
                  </p>
                </div>
              )}
              <Button 
                className="w-full" 
                onClick={handleAcceptInvite}
                disabled={accepting}
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Please log in or create an account to accept this invitation
              </p>
              <div className="flex gap-3">
                <Button asChild variant="outline" className="flex-1">
                  <Link to={`/login?redirect=/invite?token=${token}`}>Log In</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link to={`/signup?redirect=/invite?token=${token}&email=${encodeURIComponent(inviteDetails?.invited_email || '')}`}>
                    Sign Up
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
