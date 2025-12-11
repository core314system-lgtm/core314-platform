import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../hooks/useAuth';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { FusionInsight } from '../../types';
import { useToast } from '../../hooks/use-toast';
import { RefreshCw, TrendingUp, AlertTriangle, TrendingDown, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

interface AIInsightsPanelProps {
  hasAccess: boolean;
}

export function AIInsightsPanel({ hasAccess }: AIInsightsPanelProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const [insights, setInsights] = useState<FusionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'trend' | 'prediction' | 'anomaly' | 'summary'>('all');

  useEffect(() => {
    if (hasAccess && profile?.id) {
      fetchInsights();
    }
  }, [hasAccess, profile?.id, filter]);

  const fetchInsights = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('fusion_insights')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (filter !== 'all') {
        query = query.eq('insight_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInsights(data || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
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

      const url = await getSupabaseFunctionUrl('fusion-analyze');
      const response = await fetch(url, {
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
        await fetchInsights();
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

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI Insights</CardTitle>
            <Badge variant="secondary">Pro Feature</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unlock AI-powered insights with a Professional or Enterprise subscription.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI Insights</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as 'all' | 'trend' | 'prediction' | 'anomaly' | 'summary')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="trend">Trends</SelectItem>
                <SelectItem value="prediction">Predictions</SelectItem>
                <SelectItem value="anomaly">Anomalies</SelectItem>
                <SelectItem value="summary">Summaries</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleRunAnalysis}
              disabled={analyzing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
              Run Analysis
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-gray-600">Loading insights...</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No insights available. Click "Run Analysis" to generate AI insights from your integration data.
          </p>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div key={insight.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getInsightIcon(insight.insight_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{insight.integration_name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {insight.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(insight.created_at), 'MMM dd, h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
