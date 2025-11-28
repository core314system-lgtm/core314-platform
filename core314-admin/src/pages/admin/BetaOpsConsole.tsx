
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, RefreshCw, Eye, Save, CheckCircle, XCircle, MessageSquare, Key, Plus, BarChart3, TrendingDown, Activity, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import AnalyticsPanel from './components/AnalyticsPanel';
import ChurnPanel from './components/ChurnPanel';
import ReliabilityPanel from './components/ReliabilityPanel';
import AlertsPanel from './components/AlertsPanel';

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

interface FeedbackItem {
  feedback_id: string;
  user_id: string;
  category: string;
  message: string;
  screenshot_url: string | null;
  resolved: boolean;
  resolved_at: string | null;
  admin_notes: string;
  created_at: string;
  user_name: string | null;
  user_email: string;
  ai_category: string | null;
  ai_summary: string | null;
  ai_sentiment: string | null;
}

interface AccessCode {
  id: string;
  code: string;
  max_uses: number;
  uses: number;
  assigned_to: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

type TabType = 'beta-users' | 'feedback' | 'access-codes' | 'analytics' | 'churn-intelligence' | 'reliability' | 'alerts';

interface BetaOpsConsoleProps {
  defaultTab?: TabType;
}

export default function BetaOpsConsole({ defaultTab = 'beta-users' }: BetaOpsConsoleProps = {}) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<BetaEvent[]>([]);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [categorizingFeedback, setCategorizingFeedback] = useState<string | null>(null);
  const [bulkCategorizing, setBulkCategorizing] = useState(false);
  const [categorizationProgress, setCategorizationProgress] = useState({ current: 0, total: 0 });

  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    max_uses: 1,
    assigned_to: '',
    expires_at: '',
    notes: '',
  });
  const [creatingCode, setCreatingCode] = useState(false);

  useEffect(() => {
    if (activeTab === 'beta-users') {
      fetchBetaUsers();
    } else if (activeTab === 'feedback') {
      fetchFeedback();
    } else if (activeTab === 'access-codes') {
      fetchAccessCodes();
    } else if (activeTab === 'analytics') {
      setLoading(false);
    }
  }, [activeTab]);

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

  const fetchFeedback = async () => {
    try {
      setLoading(true);

      const { data: feedbackData, error: feedbackError } = await supabase
        .from('beta_feedback')
        .select(`
          feedback_id,
          user_id,
          category,
          message,
          screenshot_url,
          resolved,
          resolved_at,
          admin_notes,
          created_at,
          ai_category,
          ai_summary,
          ai_sentiment
        `)
        .order('created_at', { ascending: false });

      if (feedbackError) throw feedbackError;

      if (!feedbackData || feedbackData.length === 0) {
        setFeedback([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(feedbackData.map(f => f.user_id))];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const feedbackWithUsers: FeedbackItem[] = feedbackData.map(fb => {
        const profile = profilesData?.find(p => p.id === fb.user_id);
        return {
          ...fb,
          user_name: profile?.full_name || null,
          user_email: profile?.email || 'Unknown',
        };
      });

      setFeedback(feedbackWithUsers);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccessCodes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('beta_access_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAccessCodes(data || []);
    } catch (error) {
      console.error('Error fetching access codes:', error);
      toast.error('Failed to load access codes');
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

  const handleViewFeedback = (feedbackItem: FeedbackItem) => {
    setSelectedFeedback(feedbackItem);
    setShowFeedbackModal(true);
  };

  const handleSaveFeedback = async () => {
    if (!selectedFeedback) return;

    try {
      setSavingFeedback(true);

      const { error } = await supabase
        .from('beta_feedback')
        .update({
          resolved: selectedFeedback.resolved,
          resolved_at: selectedFeedback.resolved ? new Date().toISOString() : null,
          admin_notes: selectedFeedback.admin_notes,
        })
        .eq('feedback_id', selectedFeedback.feedback_id);

      if (error) throw error;

      toast.success('Feedback updated');

      setFeedback(prev => prev.map(f =>
        f.feedback_id === selectedFeedback.feedback_id ? selectedFeedback : f
      ));

      setShowFeedbackModal(false);
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Failed to save feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleCategorizeFeedback = async (feedbackId: string) => {
    try {
      setCategorizingFeedback(feedbackId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorize-feedback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedback_id: feedbackId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to categorize feedback');
      }

      const result = await response.json();

      toast.success('AI Categorization Complete');

      setFeedback(prev => prev.map(f =>
        f.feedback_id === feedbackId ? {
          ...f,
          ai_category: result.ai_category,
          ai_summary: result.ai_summary,
          ai_sentiment: result.ai_sentiment,
        } : f
      ));

    } catch (error) {
      console.error('Error categorizing feedback:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to categorize feedback');
    } finally {
      setCategorizingFeedback(null);
    }
  };

  const handleBulkCategorize = async () => {
    const unprocessedFeedback = feedback.filter(f => !f.ai_category);
    
    if (unprocessedFeedback.length === 0) {
      toast.error('No unprocessed feedback found');
      return;
    }

    try {
      setBulkCategorizing(true);
      setCategorizationProgress({ current: 0, total: unprocessedFeedback.length });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      for (let i = 0; i < unprocessedFeedback.length; i++) {
        const feedbackItem = unprocessedFeedback[i];
        setCategorizationProgress({ current: i + 1, total: unprocessedFeedback.length });

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorize-feedback`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ feedback_id: feedbackItem.feedback_id }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            
            setFeedback(prev => prev.map(f =>
              f.feedback_id === feedbackItem.feedback_id ? {
                ...f,
                ai_category: result.ai_category,
                ai_summary: result.ai_summary,
                ai_sentiment: result.ai_sentiment,
              } : f
            ));
          } else {
            console.error(`Failed to categorize feedback ${feedbackItem.feedback_id}`);
          }
        } catch (itemError) {
          console.error(`Error categorizing feedback ${feedbackItem.feedback_id}:`, itemError);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success(`Categorized ${unprocessedFeedback.length} feedback items`);

    } catch (error) {
      console.error('Error in bulk categorization:', error);
      toast.error('Bulk categorization failed');
    } finally {
      setBulkCategorizing(false);
      setCategorizationProgress({ current: 0, total: 0 });
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Bug': return 'bg-red-100 text-red-700';
      case 'Feature Request': return 'bg-blue-100 text-blue-700';
      case 'UI/UX': return 'bg-purple-100 text-purple-700';
      case 'Performance': return 'bg-yellow-100 text-yellow-700';
      case 'Confusion/Clarity': return 'bg-orange-100 text-orange-700';
      case 'Praise': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-700';
      case 'negative': return 'bg-red-100 text-red-700';
      case 'neutral': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateCode = async () => {
    if (!newCode.code.trim()) {
      toast.error('Please enter a code');
      return;
    }

    try {
      setCreatingCode(true);

      const { error } = await supabase
        .from('beta_access_codes')
        .insert({
          code: newCode.code.trim(),
          max_uses: newCode.max_uses,
          assigned_to: newCode.assigned_to.trim() || null,
          expires_at: newCode.expires_at || null,
          notes: newCode.notes.trim() || null,
        });

      if (error) throw error;

      toast.success('Access code created');
      setShowCreateCodeModal(false);
      setNewCode({
        code: '',
        max_uses: 1,
        assigned_to: '',
        expires_at: '',
        notes: '',
      });
      fetchAccessCodes();
    } catch (error) {
      console.error('Error creating code:', error);
      toast.error('Failed to create access code');
    } finally {
      setCreatingCode(false);
    }
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
            <p className="text-sm text-gray-600">Monitor beta users, scores, feedback, and activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'access-codes' && (
            <button
              onClick={() => setShowCreateCodeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Code
            </button>
          )}
          {activeTab === 'feedback' && (
            <button
              onClick={handleBulkCategorize}
              disabled={bulkCategorizing || feedback.filter(f => !f.ai_category).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {bulkCategorizing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Categorizing ({categorizationProgress.current}/{categorizationProgress.total})
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  Categorize All Unprocessed
                </>
              )}
            </button>
          )}
          {activeTab !== 'analytics' && activeTab !== 'churn-intelligence' && activeTab !== 'reliability' && activeTab !== 'alerts' && (
            <button
              onClick={() => {
                if (activeTab === 'beta-users') fetchBetaUsers();
                else if (activeTab === 'feedback') fetchFeedback();
                else if (activeTab === 'access-codes') fetchAccessCodes();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('beta-users')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'beta-users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Beta Users
            </div>
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'feedback'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback
            </div>
          </button>
          <button
            onClick={() => setActiveTab('access-codes')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'access-codes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Access Codes
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </div>
          </button>
          <button
            onClick={() => setActiveTab('churn-intelligence')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'churn-intelligence'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Churn Intelligence
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'beta-users' && (
        <>
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
        </>
      )}

      {activeTab === 'feedback' && (
        <>
          {feedback.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No feedback submissions yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AI Summary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedback.map((item) => (
                    <tr key={item.feedback_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.user_name || 'No name'}</div>
                        <div className="text-sm text-gray-500">{item.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-md truncate">
                          {item.message.substring(0, 80)}
                          {item.message.length > 80 && '...'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.ai_category ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(item.ai_category)}`}>
                            {item.ai_category}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {item.ai_summary ? (
                          <div className="text-xs text-gray-600 truncate" title={item.ai_summary}>
                            {item.ai_summary.substring(0, 60)}
                            {item.ai_summary.length > 60 && '...'}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.ai_sentiment ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getSentimentColor(item.ai_sentiment)}`}>
                            {item.ai_sentiment}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.resolved ? (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                            Resolved
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => handleViewFeedback(item)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View
                        </button>
                        {!item.ai_category && (
                          <button
                            onClick={() => handleCategorizeFeedback(item.feedback_id)}
                            disabled={categorizingFeedback === item.feedback_id}
                            className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                          >
                            {categorizingFeedback === item.feedback_id ? 'Categorizing...' : 'Categorize'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'access-codes' && (
        <>
          {accessCodes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No access codes created yet</p>
              <button
                onClick={() => setShowCreateCodeModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Code
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accessCodes.map((code) => {
                    const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                    const isMaxedOut = code.uses >= code.max_uses;
                    const isActive = !isExpired && !isMaxedOut;

                    return (
                      <tr key={code.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono font-medium text-gray-900">{code.code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {code.uses} / {code.max_uses}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {code.assigned_to || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {code.expires_at ? formatDate(code.expires_at) : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {code.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(code.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                              Active
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
                              Expired
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                              Used Up
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'analytics' && <AnalyticsPanel />}

      {activeTab === 'churn-intelligence' && <ChurnPanel />}

      {activeTab === 'reliability' && <ReliabilityPanel />}

      {activeTab === 'alerts' && <AlertsPanel />}

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

      {showFeedbackModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Feedback Details</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">User</h3>
                <p className="font-semibold text-gray-900">{selectedFeedback.user_name || 'No name'}</p>
                <p className="text-sm text-gray-600">{selectedFeedback.user_email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(selectedFeedback.category)}`}>
                  {selectedFeedback.category}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Submitted</h3>
                <p className="text-sm text-gray-900">{formatDate(selectedFeedback.created_at)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Message</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedFeedback.message}</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFeedback.resolved}
                    onChange={(e) => setSelectedFeedback({
                      ...selectedFeedback,
                      resolved: e.target.checked,
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">Mark as Resolved</span>
                </label>
                {selectedFeedback.resolved && selectedFeedback.resolved_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Resolved at: {formatDate(selectedFeedback.resolved_at)}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Admin Notes</h3>
                <textarea
                  value={selectedFeedback.admin_notes}
                  onChange={(e) => setSelectedFeedback({
                    ...selectedFeedback,
                    admin_notes: e.target.value,
                  })}
                  placeholder="Add internal notes about this feedback..."
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSaveFeedback}
                disabled={savingFeedback}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingFeedback ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setShowFeedbackModal(false)}
                disabled={savingFeedback}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create Access Code</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                    placeholder="XXXX-XXXX-XXXX"
                    className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setNewCode({ ...newCode, code: generateRandomCode() })}
                    className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={newCode.max_uses}
                  onChange={(e) => setNewCode({ ...newCode, max_uses: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To (Optional)
                </label>
                <input
                  type="text"
                  value={newCode.assigned_to}
                  onChange={(e) => setNewCode({ ...newCode, assigned_to: e.target.value })}
                  placeholder="Name or email"
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newCode.expires_at}
                  onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={newCode.notes}
                  onChange={(e) => setNewCode({ ...newCode, notes: e.target.value })}
                  placeholder="Internal notes about this code"
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCreateCode}
                disabled={creatingCode}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creatingCode ? 'Creating...' : 'Create Code'}
              </button>
              <button
                onClick={() => {
                  setShowCreateCodeModal(false);
                  setNewCode({
                    code: '',
                    max_uses: 1,
                    assigned_to: '',
                    expires_at: '',
                    notes: '',
                  });
                }}
                disabled={creatingCode}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
