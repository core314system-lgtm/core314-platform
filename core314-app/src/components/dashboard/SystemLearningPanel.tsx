import { Eye, TrendingUp, TrendingDown, Minus, Activity, Gauge, BarChart3, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LearningState, GlobalLearningSummary, MaturityStage, VarianceTrend, LearningVelocity } from '../../hooks/useLearningState';

/**
 * System Learning Panel
 * 
 * Displays the current learning state of Core314's intelligence system.
 * Read-only, factual, deterministic - no recommendations or prescriptive language.
 * 
 * Location: Dashboard, below System Explainability Panel
 * Visible: For ALL logged-in users (baseline and computed)
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - Content must be deterministic
 * - No recommendations, CTAs, or "you should"
 * - Labeled as "Learning Evidence (Non-Actionable)"
 */

interface SystemLearningPanelProps {
  learningStates: LearningState[];
  globalSummary: GlobalLearningSummary;
  loading: boolean;
}

// Maturity stage display configuration
const MATURITY_CONFIG: Record<MaturityStage, { label: string; color: string; bgColor: string; description: string }> = {
  observe: {
    label: 'Observing',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    description: 'Collecting baseline behavioral data',
  },
  analyze: {
    label: 'Analyzing',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    description: 'Patterns established, analysis active',
  },
  predict: {
    label: 'Prediction Ready',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
    description: 'Sufficient data for predictive insights',
  },
};

// Variance trend display configuration
const VARIANCE_TREND_CONFIG: Record<VarianceTrend, { icon: React.ReactNode; label: string; color: string }> = {
  decreasing: {
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    label: 'Decreasing',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  stable: {
    icon: <Minus className="h-3.5 w-3.5" />,
    label: 'Stable',
    color: 'text-slate-600 dark:text-slate-400',
  },
  increasing: {
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    label: 'Increasing',
    color: 'text-amber-600 dark:text-amber-400',
  },
};

// Learning velocity display configuration
const VELOCITY_CONFIG: Record<LearningVelocity, { label: string; color: string; bgColor: string }> = {
  low: {
    label: 'Low',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
  },
  high: {
    label: 'High',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
  },
};

export function SystemLearningPanel({
  learningStates,
  globalSummary,
  loading,
}: SystemLearningPanelProps) {
  if (loading) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Loading learning state...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No integrations connected
  if (globalSummary.total_integrations === 0) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" />
              System Learning
            </CardTitle>
            <span className="text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              Learning Evidence (Non-Actionable)
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No integrations connected. System learning begins when integrations are added.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maturityConfig = MATURITY_CONFIG[globalSummary.overall_maturity_stage];
  const confidencePercent = Math.round(globalSummary.average_confidence * 100);

  // Calculate aggregate variance trend
  const varianceTrends = learningStates.map(s => s.variance_trend);
  const decreasingCount = varianceTrends.filter(t => t === 'decreasing').length;
  const increasingCount = varianceTrends.filter(t => t === 'increasing').length;
  const aggregateVarianceTrend: VarianceTrend = 
    decreasingCount > increasingCount ? 'decreasing' :
    increasingCount > decreasingCount ? 'increasing' : 'stable';
  const varianceTrendConfig = VARIANCE_TREND_CONFIG[aggregateVarianceTrend];

  // Calculate aggregate learning velocity
  const velocities = learningStates.map(s => s.learning_velocity);
  const highCount = velocities.filter(v => v === 'high').length;
  const mediumCount = velocities.filter(v => v === 'medium').length;
  const aggregateVelocity: LearningVelocity =
    highCount > learningStates.length / 2 ? 'high' :
    highCount + mediumCount > learningStates.length / 2 ? 'medium' : 'low';
  const velocityConfig = VELOCITY_CONFIG[aggregateVelocity];

  return (
    <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-500" />
            System Learning
          </CardTitle>
          <span className="text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            Learning Evidence (Non-Actionable)
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4 space-y-4">
        {/* Global Learning Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Maturity Stage */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Gauge className="h-3 w-3" />
              <span>Maturity Stage</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium ${maturityConfig.bgColor} ${maturityConfig.color}`}>
              {maturityConfig.label}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {maturityConfig.description}
            </p>
          </div>

          {/* Confidence Score */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-3 w-3" />
              <span>Confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                {confidencePercent}%
              </span>
              {/* Confidence trend indicator */}
              {learningStates.some(s => s.confidence_delta_30 > 0.05) && (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              )}
              {learningStates.some(s => s.confidence_delta_30 < -0.05) && (
                <TrendingDown className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Based on {globalSummary.total_snapshot_count} observations
            </p>
          </div>

          {/* Variance Trend */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Activity className="h-3 w-3" />
              <span>Variance Trend</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 text-sm font-medium ${varianceTrendConfig.color}`}>
              {varianceTrendConfig.icon}
              {varianceTrendConfig.label}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Across {globalSummary.total_integrations} integration{globalSummary.total_integrations !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Learning Velocity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3" />
              <span>Learning Velocity</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium ${velocityConfig.bgColor} ${velocityConfig.color}`}>
              {velocityConfig.label}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signal accumulation rate
            </p>
          </div>
        </div>

        {/* Snapshot Count Summary */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {globalSummary.confidence_explanation}
            </p>
          </div>
        </div>

        {/* Learning in Progress Indicator */}
        {globalSummary.learning_in_progress && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md px-3 py-2">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span>Learning in progress. Confidence increases as stable patterns emerge.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
