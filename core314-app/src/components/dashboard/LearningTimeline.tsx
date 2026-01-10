import { Clock, CheckCircle, TrendingUp, TrendingDown, Activity, Shield, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LearningEvent, LearningEventType } from '../../hooks/useLearningState';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Learning Timeline - "What Core314 Has Learned"
 * 
 * Chronological list of learning events - factual, timestamped, immutable.
 * Read-only event stream from historical data.
 * 
 * Location: Dashboard, below System Learning Panel
 * Visible: For ALL logged-in users (baseline and computed)
 * 
 * HARD CONSTRAINTS:
 * - No new API calls
 * - No AI calls
 * - Content must be deterministic
 * - No probabilistic language
 * - No recommendations
 * - Labeled as "Learning Evidence (Non-Actionable)"
 */

interface LearningTimelineProps {
  events: LearningEvent[];
  loading: boolean;
  maxEvents?: number;
}

// Event type display configuration
const EVENT_CONFIG: Record<LearningEventType, { 
  icon: React.ReactNode; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  BASELINE_ESTABLISHED: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    label: 'Baseline Established',
  },
  CONFIDENCE_INCREASED: {
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
    label: 'Confidence Increased',
  },
  CONFIDENCE_DECREASED: {
    icon: <TrendingDown className="h-4 w-4" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/50',
    label: 'Confidence Decreased',
  },
  VARIANCE_STABILIZED: {
    icon: <Activity className="h-4 w-4" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
    label: 'Variance Stabilized',
  },
  MATURITY_PROMOTED: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    label: 'Maturity Promoted',
  },
  ANOMALY_PATTERN_LEARNED: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    label: 'Anomaly Pattern Learned',
  },
};

function formatEventTime(dateString: string): { relative: string; absolute: string } {
  const date = new Date(dateString);
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, 'MMM d, yyyy HH:mm'),
  };
}

export function LearningTimeline({
  events,
  loading,
  maxEvents = 10,
}: LearningTimelineProps) {
  if (loading) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Loading learning history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No events yet
  if (events.length === 0) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              What Core314 Has Learned
            </CardTitle>
            <span className="text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              Learning Evidence (Non-Actionable)
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Learning events appear here as Core314 observes patterns in your connected integrations.
              Events are recorded automatically as the system accumulates behavioral data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayEvents = events.slice(0, maxEvents);

  return (
    <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            What Core314 Has Learned
          </CardTitle>
          <span className="text-xs text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            Learning Evidence (Non-Actionable)
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Events */}
          <div className="space-y-4">
            {displayEvents.map((event) => {
              const config = EVENT_CONFIG[event.event_type];
              const time = formatEventTime(event.occurred_at);

              return (
                <div key={event.id} className="relative pl-10">
                  {/* Event icon */}
                  <div className={`absolute left-0 p-1.5 rounded-full ${config.bgColor} ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Event content */}
                  <div className="space-y-1">
                    {/* Event type badge and time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {event.integration_name && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {event.integration_name}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 dark:text-slate-500" title={time.absolute}>
                        {time.relative}
                      </span>
                    </div>

                    {/* Event explanation */}
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {event.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Show more indicator */}
        {events.length > maxEvents && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Showing {maxEvents} of {events.length} learning events
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Events are derived from observed system behavior. This timeline reflects what Core314 has learned, not recommendations for action.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
