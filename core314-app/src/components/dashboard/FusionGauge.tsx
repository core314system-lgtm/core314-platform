import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface FusionGaugeProps {
  score: number;
  trend: 'up' | 'down' | 'stable';
  showIntelligenceLabel?: boolean;
  // Optional props for integration-scoped view
  integrationName?: string;
  globalScore?: number;
  fusionContribution?: number;
}

export function FusionGauge({ 
  score, 
  trend, 
  showIntelligenceLabel = false,
  integrationName,
  globalScore,
  fusionContribution,
}: FusionGaugeProps) {
  const isIntegrationScoped = !!integrationName;
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
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">
                      <strong>What is the Fusion Score?</strong>
                    </p>
                    <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                      The Fusion Score represents your operational health based on signals from connected integrations. 
                      It improves as your integrations provide more data over time. 
                      This score is derived from verified system signals, not estimates.
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
        <div className="flex items-center justify-center">
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
                <div className="text-sm text-gray-600">/ 100</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
