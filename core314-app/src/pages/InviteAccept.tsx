import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { useSupabaseClient } from '../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Building2, Mail, UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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
          setError('This invitation has expired');
        } else if (data.status === 'accepted') {
          setError('This invitation has already been accepted');
        } else {
          setError('This invitation is no longer valid');
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Button asChild>
              <Link to="/login">Go to Login</Link>
            </Button>
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
