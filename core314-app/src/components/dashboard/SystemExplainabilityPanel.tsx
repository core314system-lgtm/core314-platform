import { Info } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { IntegrationWithScore } from '../../types';

/**
 * System Explainability Panel
 * 
 * Makes Core314's system behavior self-explanatory so users understand
 * WHAT the system sees and WHY — without asking the AI.
 * 
 * Location: Directly BELOW the Global Fusion Score on the main dashboard
 * Visible: ONLY when user is logged in (baseline and computed users)
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - Content must be deterministic
 * - Must reflect the same data the dashboard already uses
 * - Tone: factual, neutral, explanatory (no advice)
 */

interface SystemExplainabilityPanelProps {
  scoreOrigin: 'baseline' | 'computed' | undefined;
  integrations: IntegrationWithScore[];
  globalScore: number;
}

export function SystemExplainabilityPanel({
  scoreOrigin,
  integrations,
  globalScore,
}: SystemExplainabilityPanelProps) {
  // Don't render if score_origin is not available (user not logged in or data not loaded)
  if (!scoreOrigin) {
    return null;
  }

  const integrationCount = integrations.length;

  // Derive top contributor and lowest confidence integration for computed mode
  const deriveIntegrationInsights = () => {
    if (integrations.length === 0) {
      return {
        topIntegration: null,
        lowestConfidenceIntegration: null,
      };
    }

    // Sort by fusion_score to find top contributor
    const sortedByScore = [...integrations]
      .filter(i => i.fusion_score !== undefined)
      .sort((a, b) => (b.fusion_score || 0) - (a.fusion_score || 0));

    const topIntegration = sortedByScore.length > 0 ? sortedByScore[0] : null;

    // Find integration with highest variance (declining trend or lowest score)
    // This represents the integration affecting system confidence
    const sortedByVariance = [...integrations]
      .filter(i => i.fusion_score !== undefined)
      .sort((a, b) => {
        // Prioritize declining trends as higher variance
        const aVariance = a.trend_direction === 'down' ? 100 : a.trend_direction === 'stable' ? 50 : 0;
        const bVariance = b.trend_direction === 'down' ? 100 : b.trend_direction === 'stable' ? 50 : 0;
        
        // If same trend, lower score = higher variance
        if (aVariance === bVariance) {
          return (a.fusion_score || 0) - (b.fusion_score || 0);
        }
        return bVariance - aVariance;
      });

    // Only show lowest confidence if different from top and has declining/stable trend
    const lowestConfidenceIntegration = sortedByVariance.length > 0 && 
      sortedByVariance[0].id !== topIntegration?.id &&
      (sortedByVariance[0].trend_direction === 'down' || sortedByVariance[0].trend_direction === 'stable')
        ? sortedByVariance[0] 
        : null;

    return {
      topIntegration,
      lowestConfidenceIntegration,
    };
  };

  const { topIntegration, lowestConfidenceIntegration } = deriveIntegrationInsights();

  // Check if multiple integrations have similar influence (within 5 points)
  const hasMultipleSimilarInfluence = () => {
    const scoredIntegrations = integrations.filter(i => i.fusion_score !== undefined);
    if (scoredIntegrations.length < 2) return false;
    
    const scores = scoredIntegrations.map(i => i.fusion_score || 0);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    return (maxScore - minScore) <= 5;
  };

  // Render baseline mode content
  if (scoreOrigin === 'baseline') {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-1.5 rounded-md bg-slate-100 dark:bg-slate-800">
              <Info className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                System Explanation
              </p>
              <div className="space-y-1">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Core314 is currently observing {integrationCount} connected integration{integrationCount !== 1 ? 's' : ''}.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Efficiency metrics are still stabilizing as activity data accumulates.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Your Global Fusion Score is currently set to a baseline of {Math.round(globalScore)}.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Scoring and intelligence unlock automatically as stable patterns emerge.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render computed mode content
  const topIntegrationText = hasMultipleSimilarInfluence()
    ? "Multiple integrations show similar influence"
    : topIntegration
      ? `${topIntegration.integration_name} currently contributes the strongest efficiency signals`
      : "Core314 is evaluating integration contributions";

  const varianceText = lowestConfidenceIntegration
    ? `${lowestConfidenceIntegration.integration_name} shows higher variance, affecting system confidence`
    : "All integrations show consistent signal patterns";

  return (
    <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-1.5 rounded-md bg-slate-100 dark:bg-slate-800">
            <Info className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              System Explanation
            </p>
            <div className="space-y-1">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Core314 is actively evaluating {integrationCount} integration{integrationCount !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {topIntegrationText}.
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {varianceText}.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Confidence increases as patterns stabilize across integrations.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
