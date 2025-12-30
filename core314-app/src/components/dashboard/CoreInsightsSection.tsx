import { useCoreInsights, CoreInsight } from '../../hooks/useCoreInsights';
import { Card, CardContent } from '../ui/card';
import { Eye, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * CoreInsightsSection - Phase 9.1
 * 
 * Displays "What Core314 is noticing" section on the dashboard.
 * Shows read-only, Tier 0 observational insights based on integration data.
 * 
 * UX Requirements:
 * - Each insight shown as a single sentence card
 * - Small tooltip: "Read-only insight based on observed patterns"
 * - Hide entire section if no insights meet confidence threshold
 * - No charts initially (text-first)
 */

interface InsightCardProps {
  insight: CoreInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  return (
    <Card className="border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-3">
          <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {insight.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoreInsightsSection() {
  const { insights, loading, isEnabled } = useCoreInsights();

  // Don't render if feature flag is off
  if (!isEnabled) {
    return null;
  }

  // Don't render while loading
  if (loading) {
    return null;
  }

  // Don't render if no insights meet confidence threshold
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          What Core314 is noticing
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Read-only insight based on observed patterns
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="grid gap-3">
        {insights.map((insight) => (
          <InsightCard key={insight.key} insight={insight} />
        ))}
      </div>
    </div>
  );
}
