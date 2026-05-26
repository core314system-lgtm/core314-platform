import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Sparkles, Send } from 'lucide-react';
import { chatWithCore314 } from '../../services/aiGateway';
import { IntegrationWithScore, FusionMetric, FusionInsight } from '../../types';
import { 
  PromptChips, 
  getIntegrationPromptChips, 
  isVagueQuery, 
  VagueQueryWarning,
  ContextLabel 
} from './AIInteractionHelpers';

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
  const [showVagueWarning, setShowVagueWarning] = useState(false);

  // Get integration-specific prompt chips
  const promptChips = getIntegrationPromptChips(integration.integration_name);

  const handleChipClick = (prompt: string) => {
    setQuery(prompt);
    setShowVagueWarning(false);
  };

  // Helper to ensure provenance line is present
  const ensureProvenanceLine = (response: string, integrationName: string): string => {
    const provenancePattern = /Based on Core314 data from/i;
    if (provenancePattern.test(response)) {
      return response;
    }
    return `${response}\n\n_Based on Core314 data from your ${integrationName} integration._`;
  };

  const handleSubmit = async () => {
    if (!query.trim()) return;

    // Soft guardrail: intercept vague queries
    if (isVagueQuery(query)) {
      setShowVagueWarning(true);
      return;
    }
    setShowVagueWarning(false);

    setLoading(true);
    const currentQuery = query;
    setQuery('');

    try {
      // FAIL-SAFE: If integration has no metrics and no insights, return early with appropriate message
      const hasData = recentMetrics.length > 0 || recentInsights.length > 0 || integration.fusion_score !== undefined;
      if (!hasData) {
        setResponse(`Core314 is connected to ${integration.integration_name}, but sufficient activity has not yet been observed to generate insights. Once more data is collected, you'll be able to ask questions about this integration's performance.\n\n_Based on Core314 data from your ${integration.integration_name} integration._`);
        setLoading(false);
        return;
      }

      // Build integration-specific context with explicit metric names
      const metricNames = [...new Set(recentMetrics.map(m => m.metric_name))];
      const metricSummary = recentMetrics.length > 0 
        ? recentMetrics.slice(0, 5).map(m => `${m.metric_name}: ${m.raw_value}`).join(', ')
        : 'No recent metrics available';
      
      const insightSummary = recentInsights.length > 0
        ? recentInsights.slice(0, 3).map(i => i.message).join('; ')
        : 'No recent insights available';

      // Construct a scoped prompt with strict grounding instructions
      const scopedPrompt = `[INTEGRATION CONTEXT: ${integration.integration_name}]
Current Fusion Score: ${integration.fusion_score?.toFixed(0) || 'N/A'}
Trend: ${integration.trend_direction || 'stable'}
Metrics Being Tracked: [${metricNames.join(', ') || 'none yet'}]
Recent Metric Values: ${metricSummary}
Recent Insights: ${insightSummary}

IMPORTANT: Answer ONLY using the data provided above for ${integration.integration_name}. If the requested information is not in the data above, say "This is not currently tracked in Core314 for ${integration.integration_name}."

User Question: ${currentQuery}`;

      const result = await chatWithCore314(
        [{ role: 'user', content: scopedPrompt }],
        { 
          integration_name: integration.integration_name,
          metric_data: {
            fusion_score: integration.fusion_score,
            trend_direction: integration.trend_direction,
            metrics_count: integration.metrics_count,
            metrics_tracked: metricNames,
          }
        }
      );

      if (result.success && result.reply) {
        // Ensure provenance line is present (client-side guardrail)
        setResponse(ensureProvenanceLine(result.reply, integration.integration_name));
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

      {/* Prompt suggestion chips - Integration-scoped context */}
      <PromptChips 
        chips={promptChips} 
        onChipClick={handleChipClick} 
        disabled={loading} 
      />

      {/* Vague query warning */}
      {showVagueWarning && (
        <VagueQueryWarning onDismiss={() => setShowVagueWarning(false)} />
      )}
      
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (showVagueWarning) setShowVagueWarning(false);
          }}
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
          {/* Context label above response */}
          <ContextLabel integrationName={integration.integration_name} />
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
