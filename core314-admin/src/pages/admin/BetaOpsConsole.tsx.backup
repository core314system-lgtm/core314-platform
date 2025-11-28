
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, RefreshCw, Eye, Save, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BetaUser {
  user_id: string;
  full_name: string | null;
  email: string;
  onboarding_completed: boolean;
  created_at: string;
  onboarding_score: number;
  activity_score: number;
  feature_usage_score: number;
  total_score: number;
  last_calculated_at: string | null;
  internal_notes: string;
  recent_events: BetaEvent[];
}

interface BetaEvent {
  event_type: string;
  event_name: string;
  metadata: any;
  created_at: string;
}

export default function BetaOpsConsole() {
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<BetaEvent[]>([]);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState<string | null>(null);

  useEffect(() => {
    fetchBetaUsers();
  }, []);

  const fetchBetaUsers = async () => {
    try {
      setLoading(true);

      const { data: betaUsersData, error: betaUsersError } = await supabase
        .from('beta_users')
        .select('user_id, onboarding_completed, created_at');

      if (betaUsersError) throw betaUsersError;

      if (!betaUsersData || betaUsersData.length === 0) {
        setBetaUsers([]);
        setLoading(false);
        return;
      }

      const userIds = betaUsersData.map(u => u.user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const { data: scoresData, error: scoresError } = await supabase
        .from('user_quality_scores')
        .select('user_id, onboarding_score, activity_score, feature_usage_score, total_score, last_calculated_at')
        .in('user_id', userIds);

      if (scoresError) throw scoresError;

      const { data: notesData, error: notesError } = await supabase
        .from('beta_user_notes')
        .select('user_id, internal_notes')
        .in('user_id', userIds);

      if (notesError) throw notesError;

      const { data: eventsData, error: eventsError } = await supabase
        .from('beta_events_admin_view')
        .select('user_id, event_type, event_name, metadata, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(300); // Fetch more to ensure we get enough per user

      if (eventsError) throw eventsError;

      const combinedData: BetaUser[] = betaUsersData.map(betaUser => {
        const profile = profilesData?.find(p => p.id === betaUser.user_id);
        const score = scoresData?.find(s => s.user_id === betaUser.user_id);
        const notes = notesData?.find(n => n.user_id === betaUser.user_id);
        const userEvents = eventsData?.filter(e => e.user_id === betaUser.user_id).slice(0, 3) || [];

        return {
          user_id: betaUser.user_id,
          full_name: profile?.full_name || null,
          email: profile?.email || 'Unknown',
          onboarding_completed: betaUser.onboarding_completed,
          created_at: betaUser.created_at,
          onboarding_score: score?.onboarding_score || 0,
          activity_score: score?.activity_score || 0,
          feature_usage_score: score?.feature_usage_score || 0,
          total_score: score?.total_score || 0,
          last_calculated_at: score?.last_calculated_at || null,
          internal_notes: notes?.internal_notes || '',
          recent_events: userEvents.map(e => ({
            event_type: e.event_type,
            event_name: e.event_name,
            metadata: e.metadata,
            created_at: e.created_at,
          })),
        };
      });

      combinedData.sort((a, b) => b.total_score - a.total_score);

      setBetaUsers(combinedData);
    } catch (error) {
      console.error('Error fetching beta users:', error);
      toast.error('Failed to load beta users');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllEvents = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('beta_events_admin_view')
        .select('event_type, event_name, metadata, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setAllEvents(data || []);
      setSelectedUser(userId);
      setShowEventsModal(true);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    }
  };

  const handleSaveNotes = async (userId: string, notes: string) => {
    try {
      setSavingNotes(userId);

      const { error } = await supabase
        .from('beta_user_notes')
        .upsert({
          user_id: userId,
          internal_notes: notes,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast.success('Notes saved');
      
      setBetaUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, internal_notes: notes } : u
      ));
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(null);
    }
  };

  const handleRecalculateScore = async (userId: string) => {
    try {
      setRecalculating(userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-user-score`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to recalculate score');
      }

      const result = await response.json();

      toast.success('Score recalculated');

      setBetaUsers(prev => prev.map(u => 
        u.user_id === userId ? {
          ...u,
          onboarding_score: result.onboarding_score,
          activity_score: result.activity_score,
          feature_usage_score: result.feature_usage_score,
          total_score: result.total_score,
          last_calculated_at: new Date().toISOString(),
        } : u
      ));
    } catch (error) {
      console.error('Error recalculating score:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to recalculate score');
    } finally {
      setRecalculating(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Beta Operations Console</h1>
            <p className="text-sm text-gray-600">Monitor beta users, scores, and activity</p>
          </div>
        </div>
        <button
          onClick={fetchBetaUsers}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {betaUsers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No beta users found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {betaUsers.map(user => (
            <div key={user.user_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* User Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">User Info</h3>
                  <p className="font-semibold text-gray-900">{user.full_name || 'No name'}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>

                {/* Onboarding */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Onboarding</h3>
                  <div className="flex items-center gap-2 mb-1">
                    {user.onboarding_completed ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">Completed</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">Not Complete</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Joined {formatDate(user.created_at)}</p>
                </div>

                {/* Quality Score */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Quality Score</h3>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={`text-2xl font-bold ${getScoreColor(user.total_score)}`}>
                      {user.total_score}
                    </span>
                    <span className="text-sm text-gray-500">/ 100</span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>Onboarding: {user.onboarding_score}</div>
                    <div>Activity: {user.activity_score}</div>
                    <div>Usage: {user.feature_usage_score}</div>
                  </div>
                  {user.last_calculated_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Updated {formatDate(user.last_calculated_at)}
                    </p>
                  )}
                  <button
                    onClick={() => handleRecalculateScore(user.user_id)}
                    disabled={recalculating === user.user_id}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${recalculating === user.user_id ? 'animate-spin' : ''}`} />
                    Recalculate
                  </button>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Recent Activity</h3>
                  {user.recent_events.length === 0 ? (
                    <p className="text-xs text-gray-500">No events yet</p>
                  ) : (
                    <div className="space-y-1">
                      {user.recent_events.map((event, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-medium text-gray-700">{event.event_name}</span>
                          <span className="text-gray-500 ml-1">
                            {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleViewAllEvents(user.user_id)}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-3 h-3" />
                    View All Events
                  </button>
                </div>

                {/* Internal Notes */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Internal Notes</h3>
                  <textarea
                    value={user.internal_notes}
                    onChange={(e) => {
                      const newNotes = e.target.value;
                      setBetaUsers(prev => prev.map(u => 
                        u.user_id === user.user_id ? { ...u, internal_notes: newNotes } : u
                      ));
                    }}
                    placeholder="Add internal notes..."
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                  <button
                    onClick={() => handleSaveNotes(user.user_id, user.internal_notes)}
                    disabled={savingNotes === user.user_id}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {savingNotes === user.user_id ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Events Modal */}
      {showEventsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Recent Events (Last 10)</h2>
              <p className="text-sm text-gray-600">
                User: {betaUsers.find(u => u.user_id === selectedUser)?.email}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {allEvents.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No events found</p>
              ) : (
                <div className="space-y-3">
                  {allEvents.map((event, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold text-gray-900">{event.event_name}</span>
                          <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {event.event_type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(event.created_at)}</span>
                      </div>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowEventsModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
