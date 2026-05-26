import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Users, AlertTriangle, TrendingDown, CheckCircle, RefreshCw, Mail, MessageSquare } from 'lucide-react';
import { useSupabaseClient } from '../../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../../lib/supabaseRuntimeConfig';

interface ChurnData {
  user_id: string;
  churn_score: number;
  last_activity: string | null;
  sessions_last_7d: number;
  events_last_7d: number;
  streak_days: number;
  prediction_reason: string;
  updated_at: string;
  user_name: string | null;
  user_email: string;
}

interface ChurnKPIs {
  highRisk: number;
  moderateRisk: number;
  lowRisk: number;
  veryLowRisk: number;
}

interface NotesModalData {
  user_id: string;
  user_name: string;
  user_email: string;
  notes: string;
}

function getChurnColor(score: number) {
  if (score >= 0.8) return 'text-red-600';
  if (score >= 0.6) return 'text-yellow-600';
  if (score >= 0.4) return 'text-blue-600';
  return 'text-green-600';
}

function getChurnBadgeColor(score: number) {
  if (score >= 0.8) return 'bg-red-100 text-red-700';
  if (score >= 0.6) return 'bg-yellow-100 text-yellow-700';
  if (score >= 0.4) return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700';
}

export default function ChurnPanel() {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [churnData, setChurnData] = useState<ChurnData[]>([]);
  const [kpis, setKpis] = useState<ChurnKPIs>({ highRisk: 0, moderateRisk: 0, lowRisk: 0, veryLowRisk: 0 });
  const [recalculating, setRecalculating] = useState<string | null>(null);
  const [bulkRecalculating, setBulkRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0 });
  const [notesModal, setNotesModal] = useState<NotesModalData | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    fetchChurnData();
  }, []);

  const fetchChurnData = async () => {
    try {
      setLoading(true);

      const { data: churnScores, error: churnError } = await supabase
        .from('user_churn_scores')
        .select('*')
        .order('churn_score', { ascending: false });

      if (churnError) {
        console.error('Error fetching churn scores:', churnError);
        toast.error('Failed to load churn data');
        setLoading(false);
        return;
      }

      if (!churnScores || churnScores.length === 0) {
        setChurnData([]);
        setLoading(false);
        return;
      }

      const userIds = churnScores.map(c => c.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const combinedData: ChurnData[] = churnScores.map(score => {
        const profile = profiles?.find(p => p.id === score.user_id);
        return {
          user_id: score.user_id,
          churn_score: score.churn_score,
          last_activity: score.last_activity,
          sessions_last_7d: score.sessions_last_7d,
          events_last_7d: score.events_last_7d,
          streak_days: score.streak_days,
          prediction_reason: score.prediction_reason,
          updated_at: score.updated_at,
          user_name: profile?.full_name || null,
          user_email: profile?.email || 'Unknown',
        };
      });

      setChurnData(combinedData);

      const highRisk = combinedData.filter(d => d.churn_score >= 0.7).length;
      const moderateRisk = combinedData.filter(d => d.churn_score >= 0.4 && d.churn_score < 0.7).length;
      const lowRisk = combinedData.filter(d => d.churn_score >= 0.2 && d.churn_score < 0.4).length;
      const veryLowRisk = combinedData.filter(d => d.churn_score < 0.2).length;

      setKpis({ highRisk, moderateRisk, lowRisk, veryLowRisk });
    } catch (error) {
      console.error('Error in fetchChurnData:', error);
      toast.error('Failed to load churn data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async (userId: string) => {
    try {
      setRecalculating(userId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const url = await getSupabaseFunctionUrl('calc-churn-score');
      const response = await fetch(
        url,
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
        throw new Error(error.error || 'Failed to recalculate churn score');
      }

      const result = await response.json();
      toast.success('Churn score recalculated');

      setChurnData(prev => prev.map(d =>
        d.user_id === userId ? {
          ...d,
          churn_score: result.churn_score,
          sessions_last_7d: result.sessions_last_7d,
          events_last_7d: result.events_last_7d,
          streak_days: result.streak_days,
          last_activity: result.last_activity,
          prediction_reason: result.prediction_reason,
          updated_at: new Date().toISOString(),
        } : d
      ));

      const updatedData = churnData.map(d =>
        d.user_id === userId ? { ...d, churn_score: result.churn_score } : d
      );
      const highRisk = updatedData.filter(d => d.churn_score >= 0.7).length;
      const moderateRisk = updatedData.filter(d => d.churn_score >= 0.4 && d.churn_score < 0.7).length;
      const lowRisk = updatedData.filter(d => d.churn_score >= 0.2 && d.churn_score < 0.4).length;
      const veryLowRisk = updatedData.filter(d => d.churn_score < 0.2).length;
      setKpis({ highRisk, moderateRisk, lowRisk, veryLowRisk });

    } catch (error) {
      console.error('Error recalculating churn score:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to recalculate churn score');
    } finally {
      setRecalculating(null);
    }
  };

  const handleBulkRecalculate = async () => {
    if (churnData.length === 0) {
      toast.error('No users to recalculate');
      return;
    }

    try {
      setBulkRecalculating(true);
      setRecalcProgress({ current: 0, total: churnData.length });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      for (let i = 0; i < churnData.length; i++) {
        const user = churnData[i];
        setRecalcProgress({ current: i + 1, total: churnData.length });

        try {
          const url = await getSupabaseFunctionUrl('calc-churn-score');
          const response = await fetch(
            url,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ user_id: user.user_id }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            
            setChurnData(prev => prev.map(d =>
              d.user_id === user.user_id ? {
                ...d,
                churn_score: result.churn_score,
                sessions_last_7d: result.sessions_last_7d,
                events_last_7d: result.events_last_7d,
                streak_days: result.streak_days,
                last_activity: result.last_activity,
                prediction_reason: result.prediction_reason,
                updated_at: new Date().toISOString(),
              } : d
            ));
          } else {
            console.error(`Failed to recalculate for user ${user.user_id}`);
          }
        } catch (itemError) {
          console.error(`Error recalculating for user ${user.user_id}:`, itemError);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success(`Recalculated ${churnData.length} churn scores`);
      
      await fetchChurnData();
    } catch (error) {
      console.error('Error in bulk recalculation:', error);
      toast.error('Bulk recalculation failed');
    } finally {
      setBulkRecalculating(false);
      setRecalcProgress({ current: 0, total: 0 });
    }
  };

  const handleOpenNotes = async (user: ChurnData) => {
    try {
      toast('Notes feature not yet available in simplified schema');
      
      setNotesModal({
        user_id: user.user_id,
        user_name: user.user_name || 'Unknown User',
        user_email: user.user_email,
        notes: '',
      });
    } catch (error) {
      console.error('Error opening notes:', error);
      toast.error('Failed to load notes');
    }
  };

  const handleSaveNotes = async () => {
    if (!notesModal) return;

    try {
      setSavingNotes(true);

      toast('Notes feature not yet available in simplified schema');
      setNotesModal(null);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (churnData.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg mb-4">Churn data not yet available. Please run Recalculate All.</p>
        <button
          onClick={handleBulkRecalculate}
          disabled={bulkRecalculating}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {bulkRecalculating ? 'Calculating...' : 'Recalculate All'}
        </button>
      </div>
    );
  }

  const highRiskUsers = churnData.filter(d => d.churn_score >= 0.7).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">High Risk Users</h3>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-600">{kpis.highRisk}</p>
          <p className="text-xs text-gray-500 mt-1">Churn score ≥ 0.7</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Moderate Risk</h3>
            <TrendingDown className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-yellow-600">{kpis.moderateRisk}</p>
          <p className="text-xs text-gray-500 mt-1">Churn score 0.4-0.69</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Low Risk</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{kpis.lowRisk}</p>
          <p className="text-xs text-gray-500 mt-1">Churn score 0.2-0.39</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Very Low Risk</h3>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">{kpis.veryLowRisk}</p>
          <p className="text-xs text-gray-500 mt-1">Churn score &lt; 0.2</p>
        </div>
      </div>

      {/* Bulk Recalculate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleBulkRecalculate}
          disabled={bulkRecalculating}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {bulkRecalculating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Recalculating ({recalcProgress.current}/{recalcProgress.total})
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Recalculate All
            </>
          )}
        </button>
      </div>

      {/* High-Risk Users List */}
      {highRiskUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">High-Risk Users (Top 20)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Churn Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prediction Reason</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Streak Days</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Events (7d)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {highRiskUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{user.user_name || 'No name'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{user.user_email}</td>
                    <td className="px-4 py-2">
                      <span className={`text-sm font-bold ${getChurnColor(user.churn_score)}`}>
                        {user.churn_score.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {user.last_activity ? new Date(user.last_activity).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate" title={user.prediction_reason}>
                      {user.prediction_reason}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{user.streak_days}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{user.events_last_7d}</td>
                    <td className="px-4 py-2 text-sm space-x-2">
                      <a
                        href={`mailto:${user.user_email}`}
                        className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        Message
                      </a>
                      <button
                        onClick={() => handleRecalculate(user.user_id)}
                        disabled={recalculating === user.user_id || bulkRecalculating}
                        className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                      >
                        {recalculating === user.user_id ? 'Recalculating...' : 'Recalculate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Churn Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Users - Churn Intelligence</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Churn Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sessions (7d)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Events (7d)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Streak Days</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prediction Reason</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updated At</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {churnData.map((user) => (
                <tr key={user.user_id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{user.user_name || 'No name'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{user.user_email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getChurnBadgeColor(user.churn_score)}`}>
                      {user.churn_score.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{user.sessions_last_7d}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{user.events_last_7d}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{user.streak_days}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {user.last_activity ? new Date(user.last_activity).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate" title={user.prediction_reason}>
                    {user.prediction_reason}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {new Date(user.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-sm space-x-2">
                    <button
                      onClick={() => handleRecalculate(user.user_id)}
                      disabled={recalculating === user.user_id || bulkRecalculating}
                      className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      {recalculating === user.user_id ? 'Recalc...' : 'Recalculate'}
                    </button>
                    <button
                      onClick={() => handleOpenNotes(user)}
                      disabled={bulkRecalculating}
                      className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Notes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">User Notes</h3>
                <button
                  onClick={() => setNotesModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Name:</strong> {notesModal.user_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {notesModal.user_email}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={notesModal.notes}
                  onChange={(e) => setNotesModal({ ...notesModal, notes: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes about this user..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setNotesModal(null)}
                  disabled={savingNotes}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
