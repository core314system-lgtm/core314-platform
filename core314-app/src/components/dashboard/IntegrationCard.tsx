import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Minus, Info, Lightbulb } from 'lucide-react';
import { IntegrationWithScore, FusionScoreHistory } from '../../types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { ScoreSparkline } from './ScoreSparkline';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { 
  useIntegrationIntelligence, 
  getIntegrationValueSummary,
  formatSignals,
} from '../../hooks/useIntegrationIntelligence';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface IntegrationCardProps {
  integration: IntegrationWithScore;
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
  const [history, setHistory] = useState<FusionScoreHistory[]>([]);
  const [lastAdjusted, setLastAdjusted] = useState<string | null>(null);
  
  // Get service_name from integration (normalize to match database format)
  const serviceName = integration.integration_name?.toLowerCase().replace(/\s+/g, '_') || '';
  
  // Fetch intelligence data for this integration
  const { intelligence, insights } = useIntegrationIntelligence(serviceName);
  const valueSummary = getIntegrationValueSummary(intelligence, insights);

  useEffect(() => {
    fetchHistory();
  }, [integration.id]);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('fusion_score_history')
      .select('*')
      .eq('integration_id', integration.id)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (data) {
      setHistory(data);
    }

    const { data: scoreData } = await supabase
      .from('fusion_scores')
      .select('last_adjusted')
      .eq('integration_id', integration.id)
      .single();

    if (scoreData?.last_adjusted) {
      setLastAdjusted(scoreData.last_adjusted);
    }
  };
  const getTrendIcon = () => {
    switch (integration.trend_direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {integration.logo_url && (
              <img
                src={integration.logo_url}
                alt={integration.integration_name}
                className="w-10 h-10 object-contain"
              />
            )}
            <div>
              <CardTitle className="text-lg">{integration.integration_name}</CardTitle>
              <p className="text-sm text-gray-600">{integration.metrics_count} metrics tracked</p>
            </div>
          </div>
          <Badge variant={integration.is_core_integration ? 'default' : 'secondary'}>
            {integration.is_core_integration ? 'Core' : 'Custom'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Fusion Score</div>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className={`text-3xl font-bold cursor-pointer ${getScoreColor(integration.fusion_score)}`}>
                    {integration.fusion_score ? integration.fusion_score.toFixed(0) : '--'}
                  </div>
                </HoverCardTrigger>
                {lastAdjusted && (
                  <HoverCardContent className="w-auto">
                    <p className="text-sm">
                      Last adjusted: {format(new Date(lastAdjusted), 'MMM dd, yyyy h:mm a')}
                    </p>
                  </HoverCardContent>
                )}
              </HoverCard>
            </div>
            {getTrendIcon()}
          </div>
          
          <ScoreSparkline history={history} />
        </div>
        
        {/* UIIC: Integration Intelligence Section */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3 space-y-2">
          {/* Case 1: Has insights - show the latest insight */}
          {insights.length > 0 ? (
            <>
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {insights[0].insight_text}
                </p>
              </div>
              
              {/* Signals & Value Summary */}
              {intelligence && (
                <TooltipProvider>
                  <div className="flex items-center justify-between text-xs">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-gray-500 dark:text-gray-400 cursor-help flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {formatSignals(intelligence.signals_used)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs font-medium mb-1">Why this integration matters:</p>
                        <p className="text-xs">{valueSummary.whyItMatters}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {intelligence.fusion_contribution > 0 && (
                      <span className="text-gray-400 dark:text-gray-500">
                        {Math.round(intelligence.fusion_contribution)}% Fusion
                      </span>
                    )}
                  </div>
                </TooltipProvider>
              )}
            </>
          ) : intelligence?.activity_volume === 0 ? (
            /* Case 2: Zero Activity Override */
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Intelligence Status
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                No recent activity has been detected for this integration.
                Intelligence appears automatically as activity occurs.
              </p>
            </div>
          ) : (
            /* Case 3: No Insights State (but integration is connected) */
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Intelligence Status
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Core314 is actively analyzing signals from this integration.
                Insights appear once meaningful activity is detected.
                This integration is fully connected and operating normally.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Insights are generated from real usage patterns such as messages, updates, meetings, or activity changes.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
