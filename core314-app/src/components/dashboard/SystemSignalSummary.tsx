import { Activity, Clock, Shield, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { IntegrationWithScore } from '../../types';

/**
 * System Signal Summary
 * 
 * Displays three derived system signals for computed users only.
 * These are NOT recommendations and NOT AI-generated.
 * Uses only existing dashboard data - no new API calls.
 * 
 * Visibility: Only renders when score_origin === 'computed'
 */

interface SystemSignalSummaryProps {
  isComputed: boolean;
  integrations: IntegrationWithScore[];
  globalScore: number;
  trendSnapshot: { date: string; score: number }[];
}

interface SignalCardProps {
  icon: React.ReactNode;
  title: string;
  explanation: string;
  whyItMatters: string;
}

function SignalCard({ icon, title, explanation, whyItMatters }: SignalCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{whyItMatters}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {explanation}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemSignalSummary({ 
  isComputed, 
  integrations, 
  globalScore,
  trendSnapshot 
}: SystemSignalSummaryProps) {
  // Only render for computed users
  if (!isComputed) {
    return null;
  }

  // Derive Communication Load Distribution signal
  const deriveCommunicationLoadSignal = (): { explanation: string; whyItMatters: string } => {
    const totalMetrics = integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0);
    
    if (totalMetrics === 0 || integrations.length === 0) {
      return {
        explanation: "Core314 is establishing baseline communication patterns.",
        whyItMatters: "Understanding how activity distributes across your connected systems helps identify where collaboration is concentrated."
      };
    }

    if (integrations.length === 1) {
      const integration = integrations[0];
      return {
        explanation: `Activity is currently concentrated in ${integration.integration_name} with ${integration.metrics_count || 0} observed signals.`,
        whyItMatters: "Single-integration patterns provide a foundation. Additional integrations will reveal cross-system dynamics."
      };
    }

    // Calculate distribution across integrations
    const sortedByMetrics = [...integrations]
      .filter(i => i.metrics_count && i.metrics_count > 0)
      .sort((a, b) => (b.metrics_count || 0) - (a.metrics_count || 0));

    if (sortedByMetrics.length === 0) {
      return {
        explanation: "Core314 is establishing baseline communication patterns.",
        whyItMatters: "Understanding how activity distributes across your connected systems helps identify where collaboration is concentrated."
      };
    }

    const topIntegration = sortedByMetrics[0];
    const topPercentage = Math.round(((topIntegration.metrics_count || 0) / totalMetrics) * 100);

    if (sortedByMetrics.length === 1) {
      return {
        explanation: `${topIntegration.integration_name} accounts for all observed activity signals.`,
        whyItMatters: "Understanding how activity distributes across your connected systems helps identify where collaboration is concentrated."
      };
    }

    const secondIntegration = sortedByMetrics[1];
    
    return {
      explanation: `${topIntegration.integration_name} shows the highest activity concentration (${topPercentage}%), followed by ${secondIntegration.integration_name}.`,
      whyItMatters: "Understanding how activity distributes across your connected systems helps identify where collaboration is concentrated."
    };
  };

  // Derive Response Timing Variance signal
  const deriveTimingVarianceSignal = (): { explanation: string; whyItMatters: string } => {
    if (trendSnapshot.length < 2) {
      return {
        explanation: "Response timing signals are stabilizing as activity is observed.",
        whyItMatters: "Timing patterns reveal operational rhythms and help distinguish normal variance from anomalies."
      };
    }

    // Analyze trend data for variance
    const scores = trendSnapshot.map(t => t.score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Categorize variance level
    const varianceLevel = stdDev < 5 ? 'low' : stdDev < 15 ? 'moderate' : 'notable';
    
    // Check for recent trend direction
    const recentScores = scores.slice(-3);
    const isIncreasing = recentScores.length >= 2 && recentScores[recentScores.length - 1] > recentScores[0];
    const isDecreasing = recentScores.length >= 2 && recentScores[recentScores.length - 1] < recentScores[0];
    
    let trendDescription = 'stable';
    if (isIncreasing) trendDescription = 'trending upward';
    else if (isDecreasing) trendDescription = 'trending downward';

    if (varianceLevel === 'low') {
      return {
        explanation: `System activity shows consistent patterns with ${trendDescription} efficiency signals over the observed period.`,
        whyItMatters: "Timing patterns reveal operational rhythms and help distinguish normal variance from anomalies."
      };
    }

    return {
      explanation: `${varianceLevel.charAt(0).toUpperCase() + varianceLevel.slice(1)} variance detected in system timing patterns, currently ${trendDescription}.`,
      whyItMatters: "Timing patterns reveal operational rhythms and help distinguish normal variance from anomalies."
    };
  };

  // Derive System Confidence Level signal
  const deriveConfidenceSignal = (): { explanation: string; whyItMatters: string; level: 'Low' | 'Medium' | 'High' } => {
    const totalMetrics = integrations.reduce((sum, i) => sum + (i.metrics_count || 0), 0);
    const integrationsWithScores = integrations.filter(i => i.fusion_score !== undefined).length;
    const hasMultipleIntegrations = integrations.length >= 2;
    const hasTrendData = trendSnapshot.length >= 3;
    
    // Calculate confidence based on data sufficiency
    let confidenceScore = 0;
    
    // Integration count contributes to confidence
    if (integrations.length >= 3) confidenceScore += 3;
    else if (integrations.length >= 2) confidenceScore += 2;
    else if (integrations.length >= 1) confidenceScore += 1;
    
    // Metrics count contributes to confidence
    if (totalMetrics >= 50) confidenceScore += 3;
    else if (totalMetrics >= 20) confidenceScore += 2;
    else if (totalMetrics >= 5) confidenceScore += 1;
    
    // Trend data contributes to confidence
    if (trendSnapshot.length >= 7) confidenceScore += 2;
    else if (trendSnapshot.length >= 3) confidenceScore += 1;
    
    // Scored integrations contribute to confidence
    if (integrationsWithScores === integrations.length && integrations.length > 0) confidenceScore += 2;
    else if (integrationsWithScores > 0) confidenceScore += 1;

    let level: 'Low' | 'Medium' | 'High';
    let explanation: string;

    if (confidenceScore >= 8) {
      level = 'High';
      explanation = `System confidence is high based on ${integrations.length} connected integration${integrations.length !== 1 ? 's' : ''} and ${totalMetrics} observed signals.`;
    } else if (confidenceScore >= 4) {
      level = 'Medium';
      explanation = `System confidence is building with ${integrations.length} integration${integrations.length !== 1 ? 's' : ''} and ${totalMetrics} signals observed.`;
    } else {
      level = 'Low';
      explanation = `System confidence is establishing as Core314 accumulates behavioral data from ${integrations.length} integration${integrations.length !== 1 ? 's' : ''}.`;
    }

    return {
      level,
      explanation,
      whyItMatters: "Confidence reflects data sufficiency, not prediction accuracy. Higher confidence means more context for pattern recognition."
    };
  };

  const communicationSignal = deriveCommunicationLoadSignal();
  const timingSignal = deriveTimingVarianceSignal();
  const confidenceSignal = deriveConfidenceSignal();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
        System Signal Summary
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SignalCard
          icon={<Activity className="h-4 w-4 text-blue-600" />}
          title="Communication Load Distribution"
          explanation={communicationSignal.explanation}
          whyItMatters={communicationSignal.whyItMatters}
        />
        <SignalCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          title="Response Timing Variance"
          explanation={timingSignal.explanation}
          whyItMatters={timingSignal.whyItMatters}
        />
        <SignalCard
          icon={<Shield className="h-4 w-4 text-emerald-600" />}
          title={`System Confidence: ${confidenceSignal.level}`}
          explanation={confidenceSignal.explanation}
          whyItMatters={confidenceSignal.whyItMatters}
        />
      </div>
    </div>
  );
}
