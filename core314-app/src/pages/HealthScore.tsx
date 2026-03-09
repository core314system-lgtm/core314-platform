import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
} from 'lucide-react';

interface HealthScoreData {
  id: string;
  score: number;
  label: string;
  signal_count: number;
  score_breakdown: {
    base_score: number;
    signal_penalties: { type: string; severity: string; penalty: number }[];
    integration_coverage: number;
    data_freshness_bonus: number;
  };
  integration_coverage: { connected: number; fresh: number };
  calculated_at: string;
}

// Safely parse JSONB fields that may be double-encoded as JSON strings
function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') return parsed as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeHealthScore(raw: Record<string, unknown>): HealthScoreData {
  const defaultBreakdown = { base_score: 0, signal_penalties: [] as { type: string; severity: string; penalty: number }[], integration_coverage: 0, data_freshness_bonus: 0 };
  const defaultCoverage = { connected: 0, fresh: 0 };
  const normalized = {
    ...raw,
    score_breakdown: parseJsonObject(raw.score_breakdown, defaultBreakdown),
    integration_coverage: parseJsonObject(raw.integration_coverage, defaultCoverage),
  };
  return normalized as unknown as HealthScoreData;
}

export function HealthScore() {
  const { profile } = useAuth();
  const [currentScore, setCurrentScore] = useState<HealthScoreData | null>(null);
  const [history, setHistory] = useState<HealthScoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchHealthData();
    }
  }, [profile?.id]);

  const fetchHealthData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('operational_health_scores')
      .select('*')
      .eq('user_id', profile.id)
      .order('calculated_at', { ascending: false })
      .limit(20);

    if (!error && data && data.length > 0) {
      const normalized = data.map(d => normalizeHealthScore(d as Record<string, unknown>));
      setCurrentScore(normalized[0]);
      setHistory(normalized);
    }
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
    if (score >= 40) return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800';
    return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
  };

  const getScoreRing = (score: number) => {
    if (score >= 80) return 'ring-green-500';
    if (score >= 60) return 'ring-yellow-500';
    if (score >= 40) return 'ring-orange-500';
    return 'ring-red-500';
  };

  const getLabelIcon = (label: string) => {
    switch (label) {
      case 'Healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Moderate': return <Activity className="h-5 w-5 text-yellow-500" />;
      case 'At Risk': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'Critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTrend = () => {
    if (history.length < 2) return null;
    const prev = history[1].score;
    const curr = history[0].score;
    if (curr > prev) return { direction: 'up', diff: curr - prev };
    if (curr < prev) return { direction: 'down', diff: prev - curr };
    return { direction: 'stable', diff: 0 };
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const trend = getTrend();

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500" />
          Operational Health Score
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Composite score reflecting your overall operational health
        </p>
      </div>

      {!currentScore ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Health Score Yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Your health score will be calculated automatically once your integrations
              are connected and signals are detected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Score Display */}
          <Card className={getScoreBg(currentScore.score)}>
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  {/* Score Circle */}
                  <div className={`w-28 h-28 rounded-full ring-4 ${getScoreRing(currentScore.score)} bg-white dark:bg-gray-900 flex items-center justify-center`}>
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(currentScore.score)}`}>
                        {currentScore.score}
                      </div>
                      <div className="text-xs text-gray-500">/ 100</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {getLabelIcon(currentScore.label)}
                      <span className={`text-2xl font-bold ${getScoreColor(currentScore.score)}`}>
                        {currentScore.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {currentScore.signal_count} active signal{currentScore.signal_count !== 1 ? 's' : ''} detected
                    </p>
                    {trend && (
                      <div className="flex items-center gap-1 mt-2">
                        {trend.direction === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : trend.direction === 'down' ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-500">
                          {trend.direction === 'stable'
                            ? 'No change from last check'
                            : `${trend.direction === 'up' ? '+' : '-'}${trend.diff} points from last check`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {new Date(currentScore.calculated_at).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          {currentScore.score_breakdown && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Base Score</span>
                    <span className="font-medium">{currentScore.score_breakdown.base_score}</span>
                  </div>

                  {currentScore.score_breakdown.signal_penalties.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Signal Penalties</p>
                      <div className="space-y-1.5 pl-4">
                        {currentScore.score_breakdown.signal_penalties.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {p.severity}
                              </Badge>
                              <span className="text-gray-700 dark:text-gray-300">
                                {p.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-red-600 font-medium">-{p.penalty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      Integration Coverage ({currentScore.score_breakdown.integration_coverage} connected)
                    </span>
                    <span className="text-green-600 font-medium">
                      +{Math.min(currentScore.score_breakdown.integration_coverage * 2, 5)}
                    </span>
                  </div>

                  {currentScore.score_breakdown.data_freshness_bonus !== 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Data Freshness</span>
                      <span className={`font-medium ${currentScore.score_breakdown.data_freshness_bonus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentScore.score_breakdown.data_freshness_bonus >= 0 ? '+' : ''}{currentScore.score_breakdown.data_freshness_bonus}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Score History */}
          {history.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Score History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div
                      key={h.id}
                      className={`flex items-center justify-between py-2 px-3 rounded ${i === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold w-8 text-center ${getScoreColor(h.score)}`}>
                          {h.score}
                        </span>
                        <Badge variant="outline" className="text-xs">{h.label}</Badge>
                        <span className="text-xs text-gray-500">
                          {h.signal_count} signal{h.signal_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(h.calculated_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
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
