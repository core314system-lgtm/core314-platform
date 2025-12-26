import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { MessageSquare, Clock, Users, Hash, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { useSlackMetrics } from '../../hooks/useSlackMetrics';

/**
 * Slack Intelligence Module - Phase 2
 * 
 * Displays REAL KPIs from cached/aggregated telemetry_metrics data.
 * Metrics are pre-computed by background jobs - NOT calculated on page load.
 * 
 * KPIs displayed:
 * 1. Message Volume - Messages per day (7-day and 30-day rolling)
 * 2. Response Latency - Median response time in channels
 * 3. Active Participation Rate - % of active users vs total users
 * 4. Channel Activity Distribution - Count of active vs idle channels
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

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-center gap-2">
          <p className={`text-lg font-semibold ${isPlaceholder ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {displayValue}
          </p>
          {getTrendIcon()}
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
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 w-8 h-8" />
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
        Slack metrics will appear here once enough data has been collected from your workspace.
      </p>
    </div>
  );
}

export function SlackIntelligenceModule() {
  const { metrics, loading, hasData } = useSlackMetrics();

  // Format message volume for display
  const formatMessageVolume = (value: number | null): string | null => {
    if (value === null) return null;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  };

  // Format response latency for display (convert minutes to readable format)
  const formatLatency = (minutes: number | null): string | null => {
    if (minutes === null) return null;
    if (minutes < 1) return '<1';
    if (minutes < 60) return minutes.toFixed(0);
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format participation rate
  const formatParticipation = (rate: number | null, active: number | null, total: number | null): string => {
    if (rate !== null) return `${rate.toFixed(0)}%`;
    if (active !== null && total !== null && total > 0) {
      return `${((active / total) * 100).toFixed(0)}%`;
    }
    return '--';
  };

  // Format channel activity
  const formatChannelActivity = (active: number | null, idle: number | null): string => {
    if (active === null && idle === null) return '--';
    const activeStr = active !== null ? active.toString() : '0';
    const idleStr = idle !== null ? idle.toString() : '0';
    return `${activeStr} / ${parseInt(activeStr) + parseInt(idleStr)}`;
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <img 
              src="https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg" 
              alt="Slack" 
              className="h-5 w-5"
            />
            Slack Intelligence
          </CardTitle>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Communication analytics from your Slack workspace
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
              icon={<MessageSquare className="h-4 w-4" />}
              label="Message Volume"
              value={formatMessageVolume(metrics.messageVolumeDaily7d)}
              unit="/day"
              subtext={metrics.messageVolumeDaily30d !== null 
                ? `30-day avg: ${formatMessageVolume(metrics.messageVolumeDaily30d)}/day`
                : '7-day rolling average'}
              trend={metrics.messageVolumeTrend}
              trendPositive={true}
            />
            <MetricKPI
              icon={<Clock className="h-4 w-4" />}
              label="Response Latency"
              value={formatLatency(metrics.responseLatencyMedian)}
              unit=" min"
              subtext="Median response time in channels"
              trend={metrics.responseLatencyTrend}
              trendPositive={false} // Lower latency is better
            />
            <MetricKPI
              icon={<Users className="h-4 w-4" />}
              label="Active Participation"
              value={formatParticipation(metrics.activeParticipationRate, metrics.activeUsers, metrics.totalUsers)}
              subtext={metrics.activeUsers !== null && metrics.totalUsers !== null
                ? `${metrics.activeUsers} of ${metrics.totalUsers} users active`
                : '% of users actively participating'}
            />
            <MetricKPI
              icon={<Hash className="h-4 w-4" />}
              label="Channel Activity"
              value={formatChannelActivity(metrics.activeChannels, metrics.idleChannels)}
              subtext="Active channels / Total channels"
            />
            {metrics.lastUpdated && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Last updated: {metrics.lastUpdated.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
