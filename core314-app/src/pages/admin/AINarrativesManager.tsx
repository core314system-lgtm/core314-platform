import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import type { EventNarrative } from '../../types';

export function AINarrativesManager() {
  const { currentOrganization } = useOrganization();
  const supabase = useSupabaseClient();
  const [narratives, setNarratives] = useState<EventNarrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedNarrative, setExpandedNarrative] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchNarratives();
    }
  }, [currentOrganization?.id]);

  const fetchNarratives = async () => {
    if (!currentOrganization) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const baseUrl = await getSupabaseFunctionUrl('narrative-list');
      const response = await fetch(
        `${baseUrl}?organization_id=${currentOrganization.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setNarratives(data.narratives || []);
      }
    } catch (error) {
      console.error('Error fetching narratives:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNarrative = async () => {
    if (!currentOrganization) return;

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = await getSupabaseFunctionUrl('narrative-generate');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
          }),
        }
      );

      if (response.ok) {
        await fetchNarratives();
      } else {
        const error = await response.json();
        alert(`Failed to generate narrative: ${error.error}`);
      }
    } catch (error) {
      console.error('Error generating narrative:', error);
      alert('Failed to generate narrative. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return 'text-green-600 dark:text-green-400';
    if (confidence >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return <div className="p-6">Loading narratives...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Insight Narratives</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered executive summaries of your operations
          </p>
        </div>
        <Button onClick={handleGenerateNarrative} disabled={generating}>
          {generating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Narrative
            </>
          )}
        </Button>
      </div>

      {narratives.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No narratives generated yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Click "Generate Narrative" to create an AI-powered summary of your operations data.
            </p>
            <Button onClick={handleGenerateNarrative} disabled={generating}>
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Your First Narrative
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {narratives.map((narrative) => (
            <Card key={narrative.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {narrative.title}
                      <Badge variant="secondary" className={getConfidenceColor(narrative.ai_confidence)}>
                        {narrative.ai_confidence}% confidence
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(narrative.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedNarrative(
                      expandedNarrative === narrative.id ? null : narrative.id
                    )}
                  >
                    {expandedNarrative === narrative.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              
              {expandedNarrative === narrative.id && (
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Summary</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {narrative.summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recommendations</h4>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {narrative.recommendations}
                    </div>
                  </div>

                  {narrative.data_context && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Data Context</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {narrative.data_context.fusion_score !== undefined && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Fusion Score:</span>
                            <p className="text-gray-600 dark:text-gray-400">
                              {narrative.data_context.fusion_score.toFixed(1)}
                            </p>
                          </div>
                        )}
                        {narrative.data_context.automation_activity && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Automation:</span>
                            <p className="text-gray-600 dark:text-gray-400">
                              {narrative.data_context.automation_activity.total_rules} rules, {' '}
                              {narrative.data_context.automation_activity.total_executions} executions
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
