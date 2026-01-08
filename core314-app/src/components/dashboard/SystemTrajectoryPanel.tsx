import { TrendingUp, TrendingDown, Minus, Activity, BarChart3, Shield } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { IntegrationWithScore } from '../../types';

/**
 * System Trajectory Panel
 * 
 * Displays early, directional system signals showing where the system is trending.
 * This is NOT prediction and NOT advice - signal framing only.
 * 
 * Location: Directly BELOW the System Explainability panel
 * Visible: ONLY when score_origin === 'computed'
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - No recommendations, actions, or automation
 * - Content must be deterministic
 * - Uses only existing dashboard state (trendSnapshot, variance, confidence)
 */

interface SystemTrajectoryPanelProps {
  isComputed: boolean;
  integrations: IntegrationWithScore[];
  trendSnapshot: { date: string; score: number }[];
  globalTrend: 'up' | 'down' | 'stable';
  /** 
   * When true, enables forward-framing language (Predict tier).
   * When false or undefined, uses present-state only language (Analyze tier).
   */
  isPredictTier?: boolean;
}

interface TrajectorySignalProps {
  icon: React.ReactNode;
  title: string;
  status: string;
  statusColor: string;
  secondaryText: string;
  /** When true, applies emerald accent emphasis (Predict tier only) */
  isPredictTier?: boolean;
}

function TrajectorySignal({ icon, title, status, statusColor, secondaryText, isPredictTier = false }: TrajectorySignalProps) {
  // Predict tier: emerald accent emphasis
  // Analyze tier: neutral styling (no accent emphasis)
  const cardClassName = isPredictTier
    ? "h-full bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-200/40 dark:border-emerald-800/40"
    : "h-full bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700";
  
  const iconBgClassName = isPredictTier
    ? "flex-shrink-0 p-2 rounded-lg bg-emerald-100/30 dark:bg-emerald-800/20"
    : "flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50";

  return (
    <Card className={cardClassName}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={iconBgClassName}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {title}
            </h4>
            <p className={`text-sm font-medium ${statusColor} mb-1`}>
              {status}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {secondaryText}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemTrajectoryPanel({
  isComputed,
  integrations,
  trendSnapshot,
  globalTrend,
  isPredictTier = false,
}: SystemTrajectoryPanelProps) {
  // Show locked/preview state for baseline users
  if (!isComputed) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            System Trajectory
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Early directional signals detected by Core314
          </p>
        </div>
        <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <CardContent className="pt-6 pb-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700">
                  <Activity className="h-6 w-6 text-slate-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Calibration in progress
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Behavioral patterns are still stabilizing across your connected integrations.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Unlocks automatically after calibration completes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derive Score Momentum signal
  // Analyze tier: present-state only (improving / declining / stable)
  // Predict tier: may add conditional framing ("If current patterns persist...")
  const deriveScoreMomentum = (): { status: string; statusColor: string; icon: React.ReactNode; secondaryText: string } => {
    // Use globalTrend as primary indicator, with trendSnapshot as secondary
    if (globalTrend === 'up') {
      return {
        status: "System efficiency trend is improving",
        statusColor: "text-emerald-600 dark:text-emerald-400",
        icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
        secondaryText: isPredictTier 
          ? "If current patterns persist, efficiency gains may continue"
          : "Based on recent signal variance across integrations"
      };
    }
    
    if (globalTrend === 'down') {
      return {
        status: "System efficiency trend is declining",
        statusColor: "text-amber-600 dark:text-amber-400",
        icon: <TrendingDown className="h-4 w-4 text-amber-600" />,
        secondaryText: isPredictTier 
          ? "If current patterns persist, efficiency may continue to decrease"
          : "Based on recent signal variance across integrations"
      };
    }

    // Check trendSnapshot for more granular trend detection
    if (trendSnapshot.length >= 2) {
      const scores = trendSnapshot.map(t => t.score);
      const recentScores = scores.slice(-3);
      
      if (recentScores.length >= 2) {
        const first = recentScores[0];
        const last = recentScores[recentScores.length - 1];
        
        if (last > first + 2) {
          return {
            status: "System efficiency trend is improving",
            statusColor: "text-emerald-600 dark:text-emerald-400",
            icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
            secondaryText: isPredictTier 
              ? "If current patterns persist, efficiency gains may continue"
              : "Based on recent signal variance across integrations"
          };
        }
        
        if (last < first - 2) {
          return {
            status: "System efficiency trend is declining",
            statusColor: "text-amber-600 dark:text-amber-400",
            icon: <TrendingDown className="h-4 w-4 text-amber-600" />,
            secondaryText: isPredictTier 
              ? "If current patterns persist, efficiency may continue to decrease"
              : "Based on recent signal variance across integrations"
          };
        }
      }
    }

    return {
      status: "System efficiency trend is stable",
      statusColor: "text-slate-600 dark:text-slate-400",
      icon: <Minus className="h-4 w-4 text-slate-500" />,
      secondaryText: isPredictTier 
        ? "System trajectory indicates sustained stability"
        : "Based on recent signal variance across integrations"
    };
  };

  // Derive Variance Pressure signal
  // Analyze tier: controlled / moderate / elevated (present-state only)
  // Predict tier: may reference stabilization direction
  const deriveVariancePressure = (): { status: string; statusColor: string; level: 'high' | 'medium' | 'low'; secondaryText: string } => {
    if (trendSnapshot.length < 2) {
      return {
        status: "System variance is controlled",
        statusColor: "text-emerald-600 dark:text-emerald-400",
        level: 'low',
        secondaryText: isPredictTier 
          ? "Trajectory suggests increasing stability"
          : "Higher variance reduces system confidence over time"
      };
    }

    // Calculate variance from trend data
    const scores = trendSnapshot.map(t => t.score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Also check integration score variance
    const integrationScores = integrations
      .filter(i => i.fusion_score !== undefined)
      .map(i => i.fusion_score || 0);
    
    let integrationVariance = 0;
    if (integrationScores.length >= 2) {
      const avgIntScore = integrationScores.reduce((sum, s) => sum + s, 0) / integrationScores.length;
      integrationVariance = integrationScores.reduce((sum, s) => sum + Math.pow(s - avgIntScore, 2), 0) / integrationScores.length;
    }

    // Combine both variance signals
    const combinedVariance = (stdDev + Math.sqrt(integrationVariance)) / 2;

    if (combinedVariance >= 15 || stdDev >= 15) {
      return {
        status: "System variance is elevated",
        statusColor: "text-amber-600 dark:text-amber-400",
        level: 'high',
        secondaryText: isPredictTier 
          ? "If current conditions persist, variance may impact confidence"
          : "Higher variance reduces system confidence over time"
      };
    }

    if (combinedVariance >= 5 || stdDev >= 5) {
      return {
        status: "System variance is moderate",
        statusColor: "text-slate-600 dark:text-slate-400",
        level: 'medium',
        secondaryText: isPredictTier 
          ? "Trajectory suggests variance is stabilizing"
          : "Higher variance reduces system confidence over time"
      };
    }

    return {
      status: "System variance is controlled",
      statusColor: "text-emerald-600 dark:text-emerald-400",
      level: 'low',
      secondaryText: isPredictTier 
        ? "Trajectory suggests increasing stability"
        : "Higher variance reduces system confidence over time"
    };
  };

  // Derive Confidence Trajectory signal (optional - only if sufficient data)
  // Analyze tier: strengthening / steady / weakening (present-state only)
  // Predict tier: may reference stabilization direction
  const deriveConfidenceTrajectory = (): { status: string; statusColor: string; show: boolean; secondaryText: string } => {
    const totalMetrics = integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0);
    const integrationsWithScores = integrations.filter(i => i.fusion_score !== undefined).length;
    
    // Only show if we have enough data to make a meaningful statement
    if (integrations.length < 1 || trendSnapshot.length < 2) {
      return { status: "", statusColor: "", show: false, secondaryText: "" };
    }

    // Calculate current confidence score
    let confidenceScore = 0;
    
    if (integrations.length >= 3) confidenceScore += 3;
    else if (integrations.length >= 2) confidenceScore += 2;
    else if (integrations.length >= 1) confidenceScore += 1;
    
    if (totalMetrics >= 50) confidenceScore += 3;
    else if (totalMetrics >= 20) confidenceScore += 2;
    else if (totalMetrics >= 5) confidenceScore += 1;
    
    if (trendSnapshot.length >= 7) confidenceScore += 2;
    else if (trendSnapshot.length >= 3) confidenceScore += 1;
    
    if (integrationsWithScores === integrations.length && integrations.length > 0) confidenceScore += 2;
    else if (integrationsWithScores > 0) confidenceScore += 1;

    // Determine trajectory based on trend direction and variance
    const varianceSignal = deriveVariancePressure();
    const momentumSignal = deriveScoreMomentum();

    // If variance is low and trend is up, confidence is strengthening
    if (varianceSignal.level === 'low' && momentumSignal.status.includes('improving')) {
      return {
        status: "System confidence is strengthening",
        statusColor: "text-emerald-600 dark:text-emerald-400",
        show: true,
        secondaryText: isPredictTier 
          ? "If current conditions persist, confidence may continue to increase"
          : "Confidence reflects consistency across integrations"
      };
    }

    // If variance is high or trend is down, confidence is weakening
    if (varianceSignal.level === 'high' || momentumSignal.status.includes('declining')) {
      return {
        status: "System confidence is weakening",
        statusColor: "text-amber-600 dark:text-amber-400",
        show: true,
        secondaryText: isPredictTier 
          ? "If current conditions persist, confidence may continue to decrease"
          : "Confidence reflects consistency across integrations"
      };
    }

    // Otherwise, confidence is steady
    return {
      status: "System confidence remains steady",
      statusColor: "text-slate-600 dark:text-slate-400",
      show: true,
      secondaryText: isPredictTier 
        ? "Trajectory suggests sustained confidence levels"
        : "Confidence reflects consistency across integrations"
    };
  };

  const scoreMomentum = deriveScoreMomentum();
  const variancePressure = deriveVariancePressure();
  const confidenceTrajectory = deriveConfidenceTrajectory();

  // Build signal cards array (2-3 depending on data availability)
  // Uses tier-specific secondaryText from each derive function
  const signals: TrajectorySignalProps[] = [
    {
      icon: scoreMomentum.icon,
      title: "Score Momentum",
      status: scoreMomentum.status,
      statusColor: scoreMomentum.statusColor,
      secondaryText: scoreMomentum.secondaryText,
      isPredictTier
    },
    {
      icon: <BarChart3 className="h-4 w-4 text-blue-600" />,
      title: "Variance Pressure",
      status: variancePressure.status,
      statusColor: variancePressure.statusColor,
      secondaryText: variancePressure.secondaryText,
      isPredictTier
    }
  ];

  // Add confidence trajectory if data exists
  if (confidenceTrajectory.show) {
    signals.push({
      icon: <Shield className="h-4 w-4 text-purple-600" />,
      title: "Confidence Trajectory",
      status: confidenceTrajectory.status,
      statusColor: confidenceTrajectory.statusColor,
      secondaryText: confidenceTrajectory.secondaryText,
      isPredictTier
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          System Trajectory
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Early directional signals detected by Core314
        </p>
      </div>
      <div className={`grid grid-cols-1 ${signals.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {signals.map((signal, index) => (
          <TrajectorySignal
            key={index}
            icon={signal.icon}
            title={signal.title}
            status={signal.status}
            statusColor={signal.statusColor}
            secondaryText={signal.secondaryText}
            isPredictTier={signal.isPredictTier}
          />
        ))}
      </div>
    </div>
  );
}
