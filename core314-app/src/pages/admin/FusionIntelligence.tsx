import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { RefreshCw, TrendingUp, AlertTriangle, TrendingDown, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FusionInsight } from '../../types';

interface ScoreHistoryData {
  date: string;
  score: number;
}

interface AuditLogEntry {
  id: string;
  event_type: string;
  triggered_by: string;
  metrics_count: number;
  execution_time_ms: number;
  status: string;
  created_at: string;
}

export function FusionIntelligence() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryData[]>([]);
  const [predictions, setPredictions] = useState<FusionInsight[]>([]);
  const [insights, setInsights] = useState<FusionInsight[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  useEffect(() => {
    if (profile && isAdmin()) {
      fetchAllData();
    }
  }, [profile, currentPage]);

  const fetchAllData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      await Promise.all([
        fetchScoreHistory(),
        fetchPredictions(),
        fetchInsights(),
        fetchLastAnalysis(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoreHistory = async () => {
    if (!profile?.id) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('fusion_score_history')
      .select('fusion_score, recorded_at')
      .eq('user_id', profile.id)
      .gte('recorded_at', thirtyDaysAgo.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('Error fetching score history:', error);
      return;
    }

    const formatted = (data || []).map(item => ({
      date: format(new Date(item.recorded_at), 'MMM dd'),
      score: item.fusion_score,
    }));

    setScoreHistory(formatted);
  };

  const fetchPredictions = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('fusion_insights')
      .select('*')
      .eq('user_id', profile.id)
      .eq('insight_type', 'prediction')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching predictions:', error);
      return;
    }

    setPredictions(data || []);
  };

  const fetchInsights = async () => {
    if (!profile?.id) return;

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    const { data, error, count } = await supabase
      .from('fusion_insights')
      .select('*', { count: 'exact' })
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching insights:', error);
      return;
    }

    setInsights(data || []);
    setTotalPages(Math.ceil((count || 0) / itemsPerPage));
  };

  const fetchLastAnalysis = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('fusion_audit_log')
      .select('*')
      .eq('user_id', profile.id)
      .eq('event_type', 'intelligence_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching last analysis:', error);
      return;
    }

    setLastAnalysis(data);
  };

  const handleRunAnalysis = async () => {
    if (!profile?.id) return;

    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'No active session. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusion-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: profile.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '✅ Fusion Intelligence Analysis completed successfully',
          description: `Generated ${result.totalInsights} insights across ${result.integrationsAnalyzed} integrations`,
        });
        await fetchAllData();
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: '❌ Analysis failed',
        description: error instanceof Error ? error.message : 'Check audit log for details.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'anomaly':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'prediction':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'summary':
        return <BarChart3 className="h-4 w-4 text-purple-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusIndicator = () => {
    if (!lastAnalysis) {
      return { icon: '🔵', label: 'Never Run', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    }

    if (analyzing) {
      return { icon: '🟡', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
    }

    if (lastAnalysis.status === 'success') {
      return { icon: '🟢', label: 'Success', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    }

    return { icon: '🔴', label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  };

  const statusInfo = getStatusIndicator();

  return (
    <div className="p-6 space-y-6">
      {profile && !isAdmin() ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This page is only accessible to administrators.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Fusion Intelligence Layer
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                AI-driven insights and predictive analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge className={statusInfo.color}>
                  {statusInfo.icon} {statusInfo.label}
                </Badge>
              </div>
              <Button onClick={handleRunAnalysis} disabled={analyzing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
                Run Analysis Now
              </Button>
            </div>
          </div>

          {lastAnalysis && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Last Analysis: {format(new Date(lastAnalysis.created_at), 'MMM dd, yyyy h:mm a')}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Generated {lastAnalysis.metrics_count} insights in {lastAnalysis.execution_time_ms}ms
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Fusion Score Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-600">Loading chart data...</p>
              ) : scoreHistory.length === 0 ? (
                <p className="text-center py-8 text-gray-600">
                  No score history available. Generate fusion scores to see trends.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="predictions" className="w-full">
            <TabsList>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
              <TabsTrigger value="insights">Insights Log</TabsTrigger>
            </TabsList>

            <TabsContent value="predictions">
              <Card>
                <CardHeader>
                  <CardTitle>7-Day Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center py-8 text-gray-600">Loading predictions...</p>
                  ) : predictions.length === 0 ? (
                    <p className="text-center py-8 text-gray-600">
                      No predictions available. Run analysis to generate predictions.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">Integration</th>
                            <th className="text-left p-3">Prediction</th>
                            <th className="text-center p-3">Confidence</th>
                            <th className="text-left p-3">Generated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {predictions.map((pred) => (
                            <tr key={pred.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="p-3">{pred.integration_name}</td>
                              <td className="p-3">{pred.message}</td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary">
                                  {(pred.confidence * 100).toFixed(0)}%
                                </Badge>
                              </td>
                              <td className="p-3">
                                {format(new Date(pred.created_at), 'MMM dd, h:mm a')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights">
              <Card>
                <CardHeader>
                  <CardTitle>All Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center py-8 text-gray-600">Loading insights...</p>
                  ) : insights.length === 0 ? (
                    <p className="text-center py-8 text-gray-600">
                      No insights available. Run analysis to generate insights.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Type</th>
                              <th className="text-left p-3">Integration</th>
                              <th className="text-left p-3">Message</th>
                              <th className="text-center p-3">Confidence</th>
                              <th className="text-left p-3">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insights.map((insight) => (
                              <tr key={insight.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {getInsightIcon(insight.insight_type)}
                                    <span className="text-xs capitalize">{insight.insight_type}</span>
                                  </div>
                                </td>
                                <td className="p-3">{insight.integration_name}</td>
                                <td className="p-3">{insight.message}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="secondary">
                                    {(insight.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  {format(new Date(insight.created_at), 'MMM dd, h:mm a')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages || loading}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
