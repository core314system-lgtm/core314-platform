import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IntegrationWithScore, FusionScoreHistory } from '../../types';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { ScoreSparkline } from './ScoreSparkline';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface IntegrationCardProps {
  integration: IntegrationWithScore;
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
  const [history, setHistory] = useState<FusionScoreHistory[]>([]);
  const [lastAdjusted, setLastAdjusted] = useState<string | null>(null);

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
      </CardContent>
    </Card>
  );
}
