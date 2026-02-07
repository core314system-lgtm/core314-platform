import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Minus, Info, Activity, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Link } from 'react-router-dom';

interface FusionGaugeProps {
  score: number;
  trend: 'up' | 'down' | 'stable';
  showIntelligenceLabel?: boolean;
  // Optional props for integration-scoped view
  integrationName?: string;
  globalScore?: number;
  fusionContribution?: number;
  // Props for early signal / low activity detection
  metricsCount?: number;
  activeIntegrationCount?: number;
}

export function FusionGauge({ 
  score, 
  trend, 
  showIntelligenceLabel = false,
  integrationName,
  globalScore,
  fusionContribution,
  metricsCount = 0,
  activeIntegrationCount = 0,
}: FusionGaugeProps) {
  const isIntegrationScoped = !!integrationName;
  
  // Determine if this is an early signal / low activity state
  // Early signal: few metrics OR low score with limited data
  const isEarlySignal = metricsCount < 5 || (score < 40 && metricsCount < 10);
  const isLimitedActivity = metricsCount > 0 && metricsCount < 10;
  const hasNoData = metricsCount === 0 && score === 0;
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span>{isIntegrationScoped ? `${integrationName} Fusion Score` : 'Global Fusion Score'}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      type="button" 
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                      aria-label="Learn more about Fusion Score"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs p-3">
                    <p className="text-sm font-semibold">
                      What is the Fusion Score?
                    </p>
                    <p className="text-xs mt-1.5 text-gray-600 dark:text-gray-300">
                      The Fusion Score reflects observed operational activity from your connected integrations. 
                      It is calculated from verified system signals, not estimates.
                    </p>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <strong>Low score?</strong> This indicates limited activity, not failure. 
                        The score increases as your systems generate more data.
                      </p>
                    </div>
                    <p className="text-xs mt-2 text-blue-600 dark:text-blue-400">
                      View Integration Dashboards to see contributing metrics.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {showIntelligenceLabel && !isIntegrationScoped && (
              <span className="text-xs font-normal text-purple-600 dark:text-purple-400">
                Powered by Cross-Integration Intelligence
              </span>
            )}
            {isIntegrationScoped && fusionContribution !== undefined && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                Contributes {fusionContribution.toFixed(0)}% to Global Score ({globalScore?.toFixed(0) || '--'})
              </span>
            )}
          </div>
          {getTrendIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Early Signal / Low Activity Indicator */}
          {isEarlySignal && !isIntegrationScoped && (
            <div className="mb-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {hasNoData ? 'Awaiting Data' : isLimitedActivity ? 'Limited Activity Observed' : 'Early Signal Detected'}
              </span>
            </div>
          )}
          
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-48 h-48">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-gray-200"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${(score / 100) * 553} 553`}
                className={getScoreColor()}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor()}`}>
                  {score.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">/ 100</div>
              </div>
            </div>
          </div>
          
          {/* Contextual message for early/low activity states */}
          {isEarlySignal && !isIntegrationScoped && (
            <div className="mt-4 text-center max-w-xs">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasNoData 
                  ? 'System is working and ready to ingest data from your integrations.'
                  : 'Score will evolve as more activity is observed from your connected systems.'}
              </p>
              <Link 
                to="/integration-hub" 
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Zap className="h-3 w-3" />
                {activeIntegrationCount < 2 
                  ? 'Connect more integrations to strengthen signal'
                  : 'View Integration Dashboards'}
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
