import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Sparkles, Send } from 'lucide-react';
import { chatWithCore314 } from '../../services/aiGateway';
import { IntegrationWithScore, FusionMetric, FusionInsight } from '../../types';

interface IntegrationScopedAIQueryProps {
  integration: IntegrationWithScore;
  recentMetrics?: FusionMetric[];
  recentInsights?: FusionInsight[];
}

export function IntegrationScopedAIQuery({ 
  integration, 
  recentMetrics = [],
  recentInsights = []
}: IntegrationScopedAIQueryProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setLoading(true);
    const currentQuery = query;
    setQuery('');

    try {
      // Build integration-specific context
      const metricSummary = recentMetrics.length > 0 
        ? recentMetrics.slice(0, 5).map(m => `${m.metric_name}: ${m.raw_value}`).join(', ')
        : 'No recent metrics available';
      
      const insightSummary = recentInsights.length > 0
        ? recentInsights.slice(0, 3).map(i => i.message).join('; ')
        : 'No recent insights available';

      // Construct a scoped prompt that instructs AI to focus only on this integration
      const scopedPrompt = `[INTEGRATION CONTEXT: ${integration.integration_name}]
Current Fusion Score: ${integration.fusion_score?.toFixed(0) || 'N/A'}
Trend: ${integration.trend_direction || 'stable'}
Recent Metrics: ${metricSummary}
Recent Insights: ${insightSummary}

Please answer the following question ONLY using information about ${integration.integration_name}. Do not reference other integrations or global metrics.

User Question: ${currentQuery}`;

      const result = await chatWithCore314(
        [{ role: 'user', content: scopedPrompt }],
        { 
          integration_name: integration.integration_name,
          metric_data: {
            fusion_score: integration.fusion_score,
            trend_direction: integration.trend_direction,
            metrics_count: integration.metrics_count,
          }
        }
      );

      if (result.success && result.reply) {
        setResponse(result.reply);
      } else {
        setResponse(result.error || 'Failed to get response. Please try again.');
      }
    } catch (error) {
      console.error('Integration-scoped query error:', error);
      setResponse('Failed to get response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
        <Sparkles className="h-4 w-4" />
        <span>Ask AI about {integration.integration_name}</span>
      </div>
      
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Ask about ${integration.integration_name}...`}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          size="icon"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {response && (
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                AI Response for {integration.integration_name}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {response}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
