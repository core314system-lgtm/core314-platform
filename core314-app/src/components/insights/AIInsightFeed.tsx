
import React, { useEffect, useState } from 'react';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Brain, TrendingUp, AlertTriangle, Info, XCircle, Sparkles, RefreshCw } from 'lucide-react';

interface Insight {
  id: string;
  metric_group: string;
  insight_text: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'warning' | 'critical';
  confidence: number;
  recommendations: string[];
  created_at: string;
}

export const AIInsightFeed: React.FC = () => {
  const supabase = useSupabaseClient();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadInsights();

    const subscription = supabase
      .channel('insight_logs_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'insight_logs',
      }, () => {
        loadInsights();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: insightsData, error: insightsError } = await supabase
        .rpc('get_recent_insights', {
          p_user_id: user.id,
          p_limit: 10,
        });

      if (insightsError) throw insightsError;

      setInsights(insightsData || []);
    } catch (err) {
      console.error('Error loading insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const generateNewInsight = async () => {
    try {
      setGenerating(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const url = await getSupabaseFunctionUrl('generate-insights');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metric_group: 'general',
            time_window: '7 days',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insight');
      }

      const data = await response.json();
      if (data.success) {
        await loadInsights();
      }
    } catch (err) {
      console.error('Error generating insight:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setGenerating(false);
    }
  };

  const explainInsight = async (insight: Insight) => {
    try {
      setGenerating(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const metricNames = (insight as any).metrics_analyzed?.map((m: any) => m.name) || [];

      const url = await getSupabaseFunctionUrl('generate-insights');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metric_group: insight.metric_group,
            time_window: '7 days',
            metrics: metricNames.length > 0 ? metricNames : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate deeper insight');
      }

      const data = await response.json();
      if (data.success) {
        await loadInsights();
      }
    } catch (err) {
      console.error('Error explaining insight:', err);
      setError(err instanceof Error ? err.message : 'Failed to explain insight');
    } finally {
      setGenerating(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'negative':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'negative':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Brain className="w-6 h-6 animate-pulse text-purple-600" />
        <span className="ml-2 text-gray-600">Loading AI Insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Brain className="w-6 h-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">AI Insight Feed</h2>
        </div>
        <button
          onClick={generateNewInsight}
          disabled={generating}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-lg transition-colors"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Insight
            </>
          )}
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <Brain className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Yet</h3>
          <p className="text-gray-600 mb-4">
            Generate your first AI-powered insight to understand your business metrics.
          </p>
          <button
            onClick={generateNewInsight}
            disabled={generating}
            className="px-6 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-lg transition-colors"
          >
            Generate First Insight
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-6 rounded-lg border ${getSentimentColor(insight.sentiment)} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {getSentimentIcon(insight.sentiment)}
                  <span className="ml-2 text-sm font-medium text-gray-700 capitalize">
                    {insight.sentiment}
                  </span>
                  <span className="ml-3 text-sm text-gray-500">
                    {formatTimestamp(insight.created_at)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 mr-2">
                    Confidence: {(insight.confidence * 100).toFixed(0)}%
                  </span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${insight.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-gray-900 mb-4 leading-relaxed">{insight.insight_text}</p>

              {insight.recommendations && insight.recommendations.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations:</h4>
                  <ul className="space-y-2">
                    {insight.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-700">
                        <span className="text-purple-600 mr-2">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {insight.metric_group}
                </span>
                <button
                  onClick={() => explainInsight(insight)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Explain Insight →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
