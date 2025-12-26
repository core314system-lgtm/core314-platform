import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TrendingUp, TrendingDown, Activity, Gauge, Zap, Shield, Info, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCommunicationHealthScore } from '../../hooks/useCommunicationHealthScore';
import { FusionScoreInfluencersLink } from './FusionScoreInfluencers';

// Storage key for first Fusion Score explanation dismissal
const FUSION_SCORE_EXPLAINED_KEY = 'core314_fusion_score_explained';

// First Fusion Score Explainability Component
function FirstFusionScoreExplainer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
            <Info className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Understanding Your Fusion Score
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Your Fusion Score reflects the overall operational health of your connected systems based on activity patterns, latency, and consistency. It provides a unified view of how well your tools are working together.
            </p>
            
            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">What this score is:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>An operational signal showing system coordination</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>A trend indicator to track over time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>A way to prioritize attention across your operations</span>
                </li>
              </ul>
            </div>

            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">How to use this score:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Track trends over time rather than focusing on a single number</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Look for changes after system or process updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Use it to guide attention, not as a KPI to optimize blindly</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-500 italic">
              Note: This is not a performance grade or compliance score — it's an operational signal to help you understand your systems better.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4 mr-1" />
          Got it
        </Button>
      </div>
    </div>
  );
}

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
  
  // Communication Health score integration (Phase 3)
  // Only active when feature flag VITE_ENABLE_INTELLIGENCE_DASHBOARD is ON
  const { score: communicationHealthScore, isEnabled: isIntelligenceEnabled } = useCommunicationHealthScore();
  
  // State for first Fusion Score explainer visibility
  const [showExplainer, setShowExplainer] = useState(() => {
    // Check if user has already dismissed the explainer
    return !localStorage.getItem(FUSION_SCORE_EXPLAINED_KEY);
  });

  useEffect(() => {
    if (profile?.id) {
      fetchMetrics();
    }
  }, [profile?.id]);

  const handleDismissExplainer = () => {
    localStorage.setItem(FUSION_SCORE_EXPLAINED_KEY, 'true');
    setShowExplainer(false);
  };

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
        {/* First Fusion Score explainer - shows only once per user */}
        {showExplainer && <FirstFusionScoreExplainer onDismiss={handleDismissExplainer} />}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Fusion Score - Enhanced with Communication Health when feature flag is ON */}
          {(() => {
            /**
             * FUSION SCORE INTEGRATION (Phase 3)
             * 
             * When feature flag is ON:
             * - Communication Health contributes up to 20 points (out of 100)
             * - The contribution is ADDED to the base fusion_score
             * - Missing data has NEUTRAL impact (0 contribution, not penalty)
             * - Score is capped at 100 to prevent overflow
             * 
             * When feature flag is OFF:
             * - Fusion Score remains EXACTLY as before (no change)
             * 
             * DAILY AGGREGATION:
             * - Communication Health metrics are pre-computed/cached
             * - No real-time recalculation on page load
             * - Updates happen daily via background jobs
             */
            const baseScore = metrics.fusion_score;
            const communicationContribution = isIntelligenceEnabled ? communicationHealthScore.totalContribution : 0;
            // Cap the enhanced score at 100 to prevent overflow
            const enhancedScore = Math.min(baseScore + communicationContribution, 100);
            // Use enhanced score when flag is ON, otherwise use base score unchanged
            const displayScore = isIntelligenceEnabled ? enhancedScore : baseScore;
            
            return (
              <div className={`p-4 rounded-lg ${getScoreBgColor(displayScore)} relative`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fusion Score
                  </span>
                  <Gauge className={`w-4 h-4 ${getScoreColor(displayScore)}`} />
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(displayScore)}`}>
                  {displayScore.toFixed(1)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  0-100 scale
                </p>
                {/* "What's influencing this score?" link - only visible when flag is ON */}
                <div className="mt-2">
                  <FusionScoreInfluencersLink />
                </div>
              </div>
            );
          })()}

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
