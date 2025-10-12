import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IntegrationWithScore } from '../../types';

interface IntegrationCardProps {
  integration: IntegrationWithScore;
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
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
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">Fusion Score</div>
            <div className={`text-3xl font-bold ${getScoreColor(integration.fusion_score)}`}>
              {integration.fusion_score ? integration.fusion_score.toFixed(0) : '--'}
            </div>
          </div>
          {getTrendIcon()}
        </div>
      </CardContent>
    </Card>
  );
}
