import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useCommunicationHealthScore, MetricContribution } from '../../hooks/useCommunicationHealthScore';

/**
 * FusionScoreInfluencers - Phase 3
 * 
 * Displays a lightweight panel showing what's influencing the Fusion Score.
 * Only visible when feature flag VITE_ENABLE_INTELLIGENCE_DASHBOARD is ON.
 * 
 * Shows:
 * - Domain: Communication Health
 * - Metrics contributing with directional indicators (up/down/stable)
 * 
 * NO charts required.
 * NO redesign.
 * Directional indicators only.
 */

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable' | null;
  hasData: boolean;
}

function TrendIndicator({ trend, hasData }: TrendIndicatorProps) {
  if (!hasData) {
    return <span className="text-xs text-gray-400">No data</span>;
  }
  
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-gray-400" />;
    default:
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
}

interface MetricRowProps {
  metric: MetricContribution;
  source: 'Slack' | 'Teams';
}

function MetricRow({ metric, source }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{source}</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{metric.displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        {metric.hasData && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            +{metric.pointContribution.toFixed(1)}/{metric.maxPoints}
          </span>
        )}
        <TrendIndicator trend={metric.trend} hasData={metric.hasData} />
      </div>
    </div>
  );
}

interface FusionScoreInfluencersPanelProps {
  onClose: () => void;
}

function FusionScoreInfluencersPanel({ onClose }: FusionScoreInfluencersPanelProps) {
  const { score, loading } = useCommunicationHealthScore();

  if (loading) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Score Influencers
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Communication Health Domain */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
            Communication Health
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {score.totalContribution.toFixed(1)} / {score.maxPossible} pts
          </span>
        </div>

        {!score.hasAnyData ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
            No communication data available yet. Connect Slack or Teams to see metrics.
          </p>
        ) : (
          <div className="space-y-0.5">
            {/* Slack Metrics */}
            {score.breakdown.slack.map((metric) => (
              <MetricRow key={metric.metricName} metric={metric} source="Slack" />
            ))}
            
            {/* Teams Metrics */}
            {score.breakdown.teams.map((metric) => (
              <MetricRow key={metric.metricName} metric={metric} source="Teams" />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Updated daily. Missing data has neutral impact.
        </p>
      </div>
    </div>
  );
}

/**
 * FusionScoreInfluencersLink - The clickable link that opens the panel
 * Only renders when feature flag is ON
 */
export function FusionScoreInfluencersLink() {
  const [isOpen, setIsOpen] = useState(false);
  const { isEnabled } = useCommunicationHealthScore();

  // Don't render anything if feature flag is OFF
  if (!isEnabled) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
      >
        <HelpCircle className="h-3 w-3" />
        What's influencing this score?
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <FusionScoreInfluencersPanel onClose={() => setIsOpen(false)} />
        </>
      )}
    </div>
  );
}

export default FusionScoreInfluencersLink;
