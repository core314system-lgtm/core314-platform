import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Star, Filter, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Feedback {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  category: string | null;
  page_path: string | null;
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface FeedbackAnalytics {
  total_feedback: number;
  avg_rating: number;
  rating_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  recent_feedback_count: number;
}

export default function BetaFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchFeedback();
    fetchAnalytics();
  }, [statusFilter, ratingFilter, categoryFilter]);

  const fetchFeedback = async () => {
    setLoading(true);

    let query = supabase
      .from('beta_feedback')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (ratingFilter !== 'all') {
      query = query.eq('rating', parseInt(ratingFilter));
    }

    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching feedback:', error);
    } else {
      setFeedback(data || []);
    }

    setLoading(false);
  };

  const fetchAnalytics = async () => {
    const { data, error } = await supabase
      .rpc('get_feedback_analytics')
      .single();

    if (error) {
      console.error('Error fetching analytics:', error);
    } else {
      setAnalytics(data);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedFeedback || !newStatus) return;

    setUpdating(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('You must be logged in to update feedback');
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .rpc('update_feedback_status', {
        p_feedback_id: selectedFeedback.id,
        p_status: newStatus,
        p_admin_notes: adminNotes.trim() || null,
        p_admin_id: user.id,
      });

    if (error) {
      console.error('Error updating feedback:', error);
      alert('Failed to update feedback');
    } else {
      await fetchFeedback();
      await fetchAnalytics();
      setSelectedFeedback(null);
      setAdminNotes('');
      setNewStatus('');
    }

    setUpdating(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'reviewed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'wont_fix':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'reviewed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'wont_fix':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Beta Feedback
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and manage user feedback from the beta program
          </p>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total_feedback}</div>
              <p className="text-xs text-gray-500">
                {analytics.recent_feedback_count} in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {analytics.avg_rating?.toFixed(1) || '0.0'}
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(analytics.avg_rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">New Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.status_distribution?.new || 0}
              </div>
              <p className="text-xs text-gray-500">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.status_distribution?.resolved || 0}
              </div>
              <p className="text-xs text-gray-500">Successfully addressed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rating</Label>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="usability">Usability</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Submissions ({feedback.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : feedback.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No feedback found matching the selected filters
            </p>
          ) : (
            <div className="space-y-4">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedFeedback(item);
                    setAdminNotes(item.admin_notes || '');
                    setNewStatus(item.status);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= item.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.category && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.profiles?.full_name || 'Unknown User'} ({item.profiles?.email})
                    </p>
                    {item.page_path && (
                      <p className="text-xs text-gray-500">Page: {item.page_path}</p>
                    )}
                  </div>

                  {item.comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {item.comment}
                    </p>
                  )}

                  {item.admin_notes && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">
                        Admin Notes:
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-400">
                        {item.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Update Feedback Status
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="wont_fix">Won't Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this feedback..."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFeedback(null);
                  setAdminNotes('');
                  setNewStatus('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                disabled={updating}
                className="flex-1"
              >
                {updating ? 'Updating...' : 'Update Feedback'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
