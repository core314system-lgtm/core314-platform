import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface JourneyStage {
  name: string;
  status: 'completed' | 'pending' | 'missing';
  timestamp: string | null;
  description: string;
}

export function UserJourneyPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [journeyStages, setJourneyStages] = useState<JourneyStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserJourney(selectedUserId);
    }
  }, [selectedUserId]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      setUsers(data || []);
      
      if (data && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserJourney(userId: string) {
    try {
      setLoadingJourney(true);
      setError(null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: betaUser } = await supabase
        .from('beta_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data: firstAutomation } = await supabase
        .from('fusion_automation_events')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const { data: firstIntegration } = await supabase
        .from('integration_events')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const { data: firstError } = await supabase
        .from('system_reliability_events')
        .select('created_at')
        .eq('user_id', userId)
        .eq('event_type', 'error')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const { data: firstChurn } = await supabase
        .from('user_churn_scores')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const stages: JourneyStage[] = [
        {
          name: 'Account Created',
          status: 'completed',
          timestamp: profile.created_at,
          description: 'User account was created',
        },
        {
          name: 'Email Verified',
          status: profile.email_verified ? 'completed' : 'pending',
          timestamp: profile.email_verified ? profile.created_at : null,
          description: 'Email address verification',
        },
        {
          name: 'First Login',
          status: profile.last_sign_in_at ? 'completed' : 'pending',
          timestamp: profile.last_sign_in_at,
          description: 'Initial login to the platform',
        },
        {
          name: 'Onboarding Started',
          status: betaUser?.onboarding_started_at ? 'completed' : 'missing',
          timestamp: betaUser?.onboarding_started_at || null,
          description: 'User began onboarding process',
        },
        {
          name: 'Onboarding Completed',
          status: betaUser?.onboarding_completed_at ? 'completed' : 'missing',
          timestamp: betaUser?.onboarding_completed_at || null,
          description: 'User completed onboarding',
        },
        {
          name: 'First Dashboard Visit',
          status: profile.last_sign_in_at ? 'completed' : 'pending',
          timestamp: profile.last_sign_in_at,
          description: 'First visit to main dashboard',
        },
        {
          name: 'First Automation Created',
          status: firstAutomation ? 'completed' : 'missing',
          timestamp: firstAutomation?.created_at || null,
          description: 'Created first automation workflow',
        },
        {
          name: 'First Integration Connected',
          status: firstIntegration ? 'completed' : 'missing',
          timestamp: firstIntegration?.created_at || null,
          description: 'Connected first external integration',
        },
        {
          name: 'First Error Encounter',
          status: firstError ? 'completed' : 'missing',
          timestamp: firstError?.created_at || null,
          description: 'First system error encountered',
        },
        {
          name: 'First Churn Prediction',
          status: firstChurn ? 'completed' : 'missing',
          timestamp: firstChurn?.created_at || null,
          description: 'First churn risk assessment',
        },
      ];

      setJourneyStages(stages);
    } catch (err) {
      console.error('Error loading user journey:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user journey');
    } finally {
      setLoadingJourney(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'missing':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      completed: 'default',
      pending: 'secondary',
      missing: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  }

  function formatTimestamp(timestamp: string | null) {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  }

  function getFullTimestamp(timestamp: string | null) {
    if (!timestamp) return 'Not available';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return 'Invalid date';
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={loadUsers}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-gray-600">No users found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Journey Visualization</CardTitle>
          <CardDescription>
            Track user progression through key milestones and engagement stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingJourney ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {journeyStages.map((stage, index) => (
                <div key={index} className="flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className="flex-shrink-0">
                      {getStatusIcon(stage.status)}
                    </div>
                    {index < journeyStages.length - 1 && (
                      <div className="w-0.5 h-12 bg-gray-200 mt-2" />
                    )}
                  </div>

                  {/* Stage details */}
                  <div className="flex-1 pb-8">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {stage.name}
                      </h4>
                      {getStatusBadge(stage.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {stage.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span title={getFullTimestamp(stage.timestamp)}>
                        {formatTimestamp(stage.timestamp)}
                      </span>
                      {stage.timestamp && (
                        <span className="text-gray-400">
                          {getFullTimestamp(stage.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
