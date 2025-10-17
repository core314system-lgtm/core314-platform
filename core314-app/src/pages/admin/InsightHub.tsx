import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Globe, RefreshCw, TrendingUp, TrendingDown, Users, Target, AlertTriangle, Sparkles } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { GlobalInsight, GlobalRecommendation } from '../../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function InsightHub() {
  const { currentOrganization } = useOrganization();
  const [latestInsight, setLatestInsight] = useState<GlobalInsight | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<GlobalRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);
  const [orgComparison, setOrgComparison] = useState<any>(null);

  useEffect(() => {
    fetchInsights();
    fetchTrends();
    if (currentOrganization) {
      fetchRecommendations();
    }
  }, [currentOrganization?.id]);

  const fetchInsights = async () => {
    try {
      const { data, error } = await supabase
        .from('fusion_global_insights')
        .select('*')
        .order('aggregation_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setLatestInsight(data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-trends?limit=30`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    }
  };

  const fetchRecommendations = async () => {
    if (!currentOrganization) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-recommendations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setRecommendations(data.recommendations || []);
        setOrgComparison(data.organization_metrics);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const handleAggregate = async () => {
    setAggregating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-aggregate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert(data.message || 'Global insights aggregated successfully!');
        await fetchInsights();
        await fetchTrends();
        if (currentOrganization) {
          await fetchRecommendations();
        }
      } else {
        alert(`Aggregation failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error aggregating insights:', error);
      alert('Failed to aggregate. Please try again.');
    } finally {
      setAggregating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="p-6">Loading global insights...</div>;
  }

  const topIntegrations = latestInsight?.top_performing_integrations 
    ? Object.entries(latestInsight.top_performing_integrations)
        .map(([name, score]) => ({ name, score: Number(score) }))
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Global Insight Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Cross-organization intelligence and benchmarks (anonymized)
          </p>
        </div>
        <Button onClick={handleAggregate} disabled={aggregating}>
          {aggregating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Aggregating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Insights
            </>
          )}
        </Button>
      </div>

      {!latestInsight ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No global insights available yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Click "Refresh Insights" to aggregate global performance data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Global Overview Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Global Avg Fusion Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {latestInsight.aggregated_metrics.avg_fusion_score.toFixed(1)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Across {latestInsight.sample_size} organizations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Global Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(latestInsight.aggregated_metrics.avg_confidence * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Global Avg Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {(latestInsight.aggregated_metrics.avg_variance * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Optimization Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(latestInsight.avg_optimization_improvement * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Global Narrative */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Global Intelligence Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {latestInsight.ai_summary}
              </p>
              <p className="text-xs text-gray-500 mt-4">
                Last aggregated: {new Date(latestInsight.aggregation_date).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Trend Charts */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Confidence Trend (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Confidence']}
                      />
                      <Line type="monotone" dataKey="avg_confidence" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                {topIntegrations.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topIntegrations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => value.toFixed(3)} />
                      <Bar dataKey="score" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No integration data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Benchmark Comparison */}
          {orgComparison && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Your Organization vs Global Benchmarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Fusion Score Comparison
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {orgComparison.avg_fusion_score.toFixed(1)}
                      </span>
                      {orgComparison.avg_fusion_score > latestInsight.aggregated_metrics.avg_fusion_score ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Above Avg
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Below Avg
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Global avg: {latestInsight.aggregated_metrics.avg_fusion_score.toFixed(1)}
                      {' '}({((orgComparison.avg_fusion_score - latestInsight.aggregated_metrics.avg_fusion_score) / latestInsight.aggregated_metrics.avg_fusion_score * 100).toFixed(1)}%)
                    </p>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Confidence Comparison
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {(orgComparison.avg_confidence * 100).toFixed(1)}%
                      </span>
                      {orgComparison.avg_confidence > latestInsight.aggregated_metrics.avg_confidence ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Above Avg
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Below Avg
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Global avg: {(latestInsight.aggregated_metrics.avg_confidence * 100).toFixed(1)}%
                    </p>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Variance Comparison
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {(orgComparison.avg_variance * 100).toFixed(1)}%
                      </span>
                      {orgComparison.avg_variance < latestInsight.aggregated_metrics.avg_variance ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Better
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Worse
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Global avg: {(latestInsight.aggregated_metrics.avg_variance * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  AI-Powered Global Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div 
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {rec.title}
                        </h3>
                        <Badge variant={getPriorityBadge(rec.priority)}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {rec.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {rec.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
