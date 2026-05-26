import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Video, Clock, MessageSquare, Moon, TrendingUp, TrendingDown, Minus, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { useTeamsMetrics } from '../../hooks/useTeamsMetrics';
import { 
  TREND_FRAMING, 
  INTELLIGENCE_TOOLTIP_COPY,
  useIntegrationIntelligence,
  getIntelligenceFreshnessLabel,
  FRESHNESS_DISPLAY_TEXT,
} from '../../hooks/useIntegrationIntelligence';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * Microsoft Teams Intelligence Module - Phase 2
 * 
 * Displays REAL KPIs from cached/aggregated telemetry_metrics data.
 * Metrics are pre-computed by background jobs - NOT calculated on page load.
 * 
 * KPIs displayed:
 * 1. Meetings per User - Average meetings per user per week
 * 2. Average Meeting Duration - Average meeting duration in minutes
 * 3. Chat vs Meeting Ratio - Ratio of chat messages to meetings
 * 4. After-Hours Activity Rate - % of activity occurring after business hours
 * 
 * NOTE: Fusion Score is NOT yet influenced by these metrics.
 */

interface MetricKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  unit?: string;
  subtext: string;
  trend?: 'up' | 'down' | 'stable' | null;
  trendPositive?: boolean; // Is "up" trend good or bad for this metric?
}

function MetricKPI({ icon, label, value, unit, subtext, trend, trendPositive = true }: MetricKPIProps) {
  const displayValue = value !== null ? `${value}${unit || ''}` : '--';
  const isPlaceholder = value === null;

  const getTrendIcon = () => {
    if (!trend) return null;
    const isGood = (trend === 'up' && trendPositive) || (trend === 'down' && !trendPositive);
    const isBad = (trend === 'up' && !trendPositive) || (trend === 'down' && trendPositive);
    
    if (trend === 'up') {
      return <TrendingUp className={`h-3 w-3 ${isGood ? 'text-green-500' : isBad ? 'text-red-500' : 'text-gray-400'}`} />;
    }
    if (trend === 'down') {
      return <TrendingDown className={`h-3 w-3 ${isGood ? 'text-green-500' : isBad ? 'text-red-500' : 'text-gray-400'}`} />;
    }
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  // Phase 9.3: Get trend label and framing text
  const getTrendLabel = () => {
    if (!trend) return 'Stable';
    if (trend === 'up') return 'Rising';
    if (trend === 'down') return 'Declining';
    return 'Stable';
  };

  const getTrendFraming = () => {
    if (!trend || trend === 'stable') return TREND_FRAMING.stable;
    return TREND_FRAMING[trend] || TREND_FRAMING.stable;
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-center gap-2">
          <p className={`text-lg font-semibold ${isPlaceholder ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {displayValue}
          </p>
          {/* Phase 9.3: Trend with framing tooltip */}
          {trend && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    {getTrendIcon()}
                    <span className="text-xs text-gray-400">{getTrendLabel()}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{getTrendFraming()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!trend && getTrendIcon()}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{subtext}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 animate-pulse">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 w-8 h-8" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsufficientDataState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Insufficient Data</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[200px]">
        Teams metrics will appear here once enough data has been collected from your workspace.
      </p>
    </div>
  );
}

export function TeamsIntelligenceModule() {
  const { metrics, loading, hasData } = useTeamsMetrics();
  const { intelligence } = useIntegrationIntelligence('microsoft_teams');
  
  // Phase 11A: Get freshness label for subtle indicator
  const freshnessLabel = getIntelligenceFreshnessLabel(intelligence);
  const freshnessText = FRESHNESS_DISPLAY_TEXT[freshnessLabel];

  // Format meetings per user for display
  const formatMeetingsPerUser = (value: number | null): string | null => {
    if (value === null) return null;
    return value.toFixed(1);
  };

  // Format meeting duration for display (in minutes)
  const formatDuration = (minutes: number | null): string | null => {
    if (minutes === null) return null;
    if (minutes < 60) return minutes.toFixed(0);
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format chat/meeting ratio
  const formatRatio = (ratio: number | null): string | null => {
    if (ratio === null) return null;
    return `${ratio.toFixed(1)}:1`;
  };

  // Format after-hours rate
  const formatAfterHoursRate = (rate: number | null): string | null => {
    if (rate === null) return null;
    return `${rate.toFixed(0)}%`;
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <img 
                    src="https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg" 
                    alt="Microsoft Teams" 
                    className="h-5 w-5"
                  />
                  Microsoft Teams Intelligence
                </CardTitle>
                {/* Phase 9.3: Data basis qualifier tooltip */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 cursor-help">
                        <Info className="h-3 w-3" />
                        <span>{INTELLIGENCE_TOOLTIP_COPY.dataBasis}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs">{INTELLIGENCE_TOOLTIP_COPY.aggregatedSignals}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Collaboration patterns from your Teams workspace
              </p>
            </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSkeleton />
        ) : !hasData ? (
          <InsufficientDataState />
        ) : (
          <div className="space-y-3">
            <MetricKPI
              icon={<Video className="h-4 w-4" />}
              label="Meetings per User"
              value={formatMeetingsPerUser(metrics.meetingsPerUser)}
              unit="/week"
              subtext={metrics.totalMeetings !== null 
                ? `${metrics.totalMeetings} total meetings this week`
                : 'Average meetings per user per week'}
              trend={metrics.meetingsPerUserTrend}
            />
            <MetricKPI
              icon={<Clock className="h-4 w-4" />}
              label="Avg Meeting Duration"
              value={formatDuration(metrics.avgMeetingDuration)}
              unit=" min"
              subtext="Average duration per meeting"
              trend={metrics.avgMeetingDurationTrend}
              trendPositive={false} // Shorter meetings are generally better
            />
            <MetricKPI
              icon={<MessageSquare className="h-4 w-4" />}
              label="Chat vs Meeting Ratio"
              value={formatRatio(metrics.chatMeetingRatio)}
              subtext={metrics.totalChats !== null
                ? `${metrics.totalChats} chats this week`
                : 'Chat messages per meeting'}
            />
            <MetricKPI
              icon={<Moon className="h-4 w-4" />}
              label="After-Hours Activity"
              value={formatAfterHoursRate(metrics.afterHoursRate)}
              subtext="Activity outside business hours"
              trend={metrics.afterHoursRateTrend}
              trendPositive={false} // Less after-hours work is better
            />
            {/* Phase 11A: Subtle freshness indicator - no timestamps exposed */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <RefreshCw className="h-3 w-3" />
                <span>{freshnessText}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
