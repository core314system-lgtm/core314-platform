import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TrendingUp, TrendingDown, Activity, Gauge, Zap, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface FusionMetrics {
  fusion_score: number;
  efficiency_index: number;
  stability_confidence: number;
  trend_7d: number;
  updated_at: string;
}

export function FusionOverviewWidget() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<FusionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchMetrics();
    }
  }, [profile?.id]);

  const fetchMetrics = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('fusion_efficiency_metrics')
        .select('fusion_score, efficiency_index, stability_confidence, trend_7d, updated_at')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching fusion metrics:', error);
        setMetrics(null);
      } else {
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching fusion metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            Fusion Efficiency Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            Fusion Efficiency Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No fusion efficiency metrics available yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Metrics will appear once your integrations are monitored.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            Fusion Efficiency Overview
          </CardTitle>
          <Link to="/fusion-details">
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Fusion Score */}
          <div className={`p-4 rounded-lg ${getScoreBgColor(metrics.fusion_score)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Fusion Score
              </span>
              <Gauge className={`w-4 h-4 ${getScoreColor(metrics.fusion_score)}`} />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.fusion_score)}`}>
              {metrics.fusion_score.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              0-100 scale
            </p>
          </div>

          {/* Efficiency Index */}
          <div className={`p-4 rounded-lg ${getScoreBgColor(metrics.efficiency_index)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Efficiency Index
              </span>
              <Zap className={`w-4 h-4 ${getScoreColor(metrics.efficiency_index)}`} />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.efficiency_index)}`}>
              {metrics.efficiency_index.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Throughput ratio
            </p>
          </div>

          {/* Stability Confidence */}
          <div className={`p-4 rounded-lg ${getScoreBgColor(metrics.stability_confidence)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Stability
              </span>
              <Shield className={`w-4 h-4 ${getScoreColor(metrics.stability_confidence)}`} />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(metrics.stability_confidence)}`}>
              {metrics.stability_confidence.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Confidence level
            </p>
          </div>

          {/* 7-Day Trend */}
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                7-Day Trend
              </span>
              {getTrendIcon(metrics.trend_7d)}
            </div>
            <div className={`text-2xl font-bold ${
              metrics.trend_7d > 0 ? 'text-green-600' : 
              metrics.trend_7d < 0 ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {metrics.trend_7d > 0 ? '+' : ''}{metrics.trend_7d.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Reliability change
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {formatTimestamp(metrics.updated_at)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
