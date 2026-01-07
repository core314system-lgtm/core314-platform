import { Eye, Zap, Target } from 'lucide-react';
import { IntegrationWithScore } from '../../types';

/**
 * Intelligence Readiness Panel
 * 
 * Makes Core314's intelligence readiness explicit.
 * Users see WHEN the system is ready for prediction or optimization
 * — without Core314 taking action or telling the user what to do.
 * 
 * Location: Directly BELOW the System Trajectory panel
 * Visible: For BOTH baseline and computed users (with different states)
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - No recommendations, CTAs, or "you should"
 * - No upsell language or automation hints
 * - Content must be deterministic
 * - Panel must always render with a valid state
 */

type ReadinessState = 'observing' | 'analysis_ready' | 'prediction_ready';

interface IntelligenceReadinessPanelProps {
  scoreOrigin: 'baseline' | 'computed' | undefined;
  hasEfficiencyMetrics: boolean;
  integrations: IntegrationWithScore[];
  trendSnapshot: { date: string; score: number }[];
  globalTrend: 'up' | 'down' | 'stable';
}

interface ReadinessConfig {
  state: ReadinessState;
  badge: string;
  badgeColor: string;
  badgeBgColor: string;
  icon: React.ReactNode;
  primaryLine: string;
  secondaryLine: string;
}

export function IntelligenceReadinessPanel({
  scoreOrigin,
  hasEfficiencyMetrics,
  integrations,
  trendSnapshot,
  globalTrend,
}: IntelligenceReadinessPanelProps) {
  // Don't render if score_origin is not available (user not logged in)
  if (!scoreOrigin) {
    return null;
  }

  // Derive variance level from trend data and integration scores
  const deriveVarianceLevel = (): 'high' | 'medium' | 'low' => {
    if (trendSnapshot.length < 2) {
      return 'low';
    }

    const scores = trendSnapshot.map(t => t.score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Also check integration score variance
    const integrationScores = integrations
      .filter(i => i.fusion_score !== undefined)
      .map(i => i.fusion_score || 0);
    
    let integrationStdDev = 0;
    if (integrationScores.length >= 2) {
      const avgIntScore = integrationScores.reduce((sum, s) => sum + s, 0) / integrationScores.length;
      const intVariance = integrationScores.reduce((sum, s) => sum + Math.pow(s - avgIntScore, 2), 0) / integrationScores.length;
      integrationStdDev = Math.sqrt(intVariance);
    }

    const combinedStdDev = (stdDev + integrationStdDev) / 2;

    if (combinedStdDev >= 15 || stdDev >= 15) {
      return 'high';
    }
    if (combinedStdDev >= 5 || stdDev >= 5) {
      return 'medium';
    }
    return 'low';
  };

  // Derive confidence level
  const deriveConfidenceLevel = (): 'high' | 'medium' | 'low' => {
    const totalMetrics = integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0);
    const integrationsWithScores = integrations.filter(i => i.fusion_score !== undefined).length;
    
    let confidenceScore = 0;
    
    // Integration count contribution
    if (integrations.length >= 3) confidenceScore += 3;
    else if (integrations.length >= 2) confidenceScore += 2;
    else if (integrations.length >= 1) confidenceScore += 1;
    
    // Metrics count contribution
    if (totalMetrics >= 50) confidenceScore += 3;
    else if (totalMetrics >= 20) confidenceScore += 2;
    else if (totalMetrics >= 5) confidenceScore += 1;
    
    // Trend data contribution
    if (trendSnapshot.length >= 7) confidenceScore += 2;
    else if (trendSnapshot.length >= 3) confidenceScore += 1;
    
    // Scored integrations contribution
    if (integrationsWithScores === integrations.length && integrations.length > 0) confidenceScore += 2;
    else if (integrationsWithScores > 0) confidenceScore += 1;

    if (confidenceScore >= 8) return 'high';
    if (confidenceScore >= 4) return 'medium';
    return 'low';
  };

  // Determine readiness state based on conditions
  const determineReadinessState = (): ReadinessConfig => {
    const isComputed = scoreOrigin === 'computed';
    const varianceLevel = deriveVarianceLevel();
    const confidenceLevel = deriveConfidenceLevel();
    
    // Observation Phase: baseline OR no efficiency metrics
    if (!isComputed || !hasEfficiencyMetrics) {
      return {
        state: 'observing',
        badge: 'Observing',
        badgeColor: 'text-slate-700 dark:text-slate-300',
        badgeBgColor: 'bg-slate-100 dark:bg-slate-800',
        icon: <Eye className="h-4 w-4 text-slate-500" />,
        primaryLine: "Core314 is still accumulating stable system intelligence.",
        secondaryLine: "Readiness increases as consistent activity patterns are observed."
      };
    }

    // Prediction Ready: computed + variance low + confidence high + sufficient trend data
    if (
      varianceLevel === 'low' &&
      confidenceLevel === 'high' &&
      trendSnapshot.length >= 7
    ) {
      return {
        state: 'prediction_ready',
        badge: 'Prediction Ready',
        badgeColor: 'text-emerald-700 dark:text-emerald-300',
        badgeBgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
        icon: <Target className="h-4 w-4 text-emerald-600" />,
        primaryLine: "System intelligence has reached predictive reliability.",
        secondaryLine: "Future-oriented insights are now statistically meaningful."
      };
    }

    // Analysis Ready: computed + (variance controlled OR improving) + confidence !== low
    if (
      (varianceLevel === 'low' || varianceLevel === 'medium' || globalTrend === 'up') &&
      confidenceLevel !== 'low'
    ) {
      return {
        state: 'analysis_ready',
        badge: 'Analysis Ready',
        badgeColor: 'text-blue-700 dark:text-blue-300',
        badgeBgColor: 'bg-blue-100 dark:bg-blue-900/50',
        icon: <Zap className="h-4 w-4 text-blue-600" />,
        primaryLine: "Core314 has accumulated sufficient data for reliable analysis.",
        secondaryLine: "System intelligence is stable enough to support deeper insights."
      };
    }

    // Default to Observing if conditions don't match other states
    return {
      state: 'observing',
      badge: 'Observing',
      badgeColor: 'text-slate-700 dark:text-slate-300',
      badgeBgColor: 'bg-slate-100 dark:bg-slate-800',
      icon: <Eye className="h-4 w-4 text-slate-500" />,
      primaryLine: "Core314 is still accumulating stable system intelligence.",
      secondaryLine: "Readiness increases as consistent activity patterns are observed."
    };
  };

  const readiness = determineReadinessState();

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4">
        {/* Status Badge with Icon */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${readiness.badgeBgColor}`}>
          {readiness.icon}
          <span className={`text-sm font-semibold ${readiness.badgeColor}`}>
            {readiness.badge}
          </span>
        </div>
        
        {/* Explanation Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {readiness.primaryLine}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {readiness.secondaryLine}
          </p>
        </div>
      </div>
    </div>
  );
}
