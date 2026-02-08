import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../hooks/useAuth';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { FusionInsight } from '../../types';
import { useToast } from '../../hooks/use-toast';
import { RefreshCw, TrendingUp, AlertTriangle, TrendingDown, BarChart3, Info, X, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { INTELLIGENCE_TOOLTIP_COPY } from '../../hooks/useIntegrationIntelligence';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { HowToAskGuidance } from './AIInteractionHelpers';

// Storage key for first AI Insight explanation dismissal
const AI_INSIGHT_EXPLAINED_KEY = 'core314_ai_insight_explained';

// First AI Insight Explainability Component
function FirstAIInsightExplainer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
            <Info className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Understanding AI Insights
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              AI Insights are generated after detecting changes in response latency, workflow patterns, and activity signals across your connected tools. They help surface patterns that might otherwise go unnoticed.
            </p>
            
            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">What these insights are:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>Observational — they highlight patterns, not mandates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>Suggestive — they offer context, not prescriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>Not mandatory — you decide if action is needed</span>
                </li>
              </ul>
            </div>

            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">How to use insights:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Review the context and consider if it applies to your situation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Decide if action is needed based on your knowledge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Track how patterns change over time</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="italic">Insights are generated from operational signals only — not message content or files.</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4 mr-1" />
          Got it
        </Button>
      </div>
    </div>
  );
}

interface AIInsightsPanelProps {
  hasAccess: boolean;
  integrationId?: string;
  integrationName?: string;
}

export function AIInsightsPanel({ hasAccess, integrationId, integrationName }: AIInsightsPanelProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  const [insights, setInsights] = useState<FusionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'trend' | 'prediction' | 'anomaly' | 'summary'>('all');
  
  // State for first AI Insight explainer visibility
  const [showExplainer, setShowExplainer] = useState(() => {
    // Check if user has already dismissed the explainer
    return !localStorage.getItem(AI_INSIGHT_EXPLAINED_KEY);
  });

  useEffect(() => {
    if (hasAccess && profile?.id) {
      fetchInsights();
    }
  }, [hasAccess, profile?.id, filter, integrationId]);

  const handleDismissExplainer = () => {
    localStorage.setItem(AI_INSIGHT_EXPLAINED_KEY, 'true');
    setShowExplainer(false);
  };

  const fetchInsights = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('fusion_insights')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (filter !== 'all') {
        query = query.eq('insight_type', filter);
      }

      // Filter by integration_id when viewing a specific integration
      if (integrationId) {
        query = query.eq('integration_id', integrationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInsights(data || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!profile?.id) return;

    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'No active session. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const url = await getSupabaseFunctionUrl('fusion-analyze');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: profile.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '✅ Fusion Intelligence Analysis completed successfully',
          description: `Generated ${result.totalInsights} insights across ${result.integrationsAnalyzed} integrations`,
        });
        await fetchInsights();
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: '❌ Analysis failed',
        description: error instanceof Error ? error.message : 'Check audit log for details.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'anomaly':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'prediction':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'summary':
        return <BarChart3 className="h-4 w-4 text-purple-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI Insights</CardTitle>
            <Badge variant="secondary">Analyze Tier</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Core314 is currently in observation mode for this integration. Dashboards are generated automatically while the system discovers metrics and establishes baselines.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            AI insights activate automatically once sufficient activity is detected, or upgrade to the Analyze tier for immediate access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{integrationName ? `${integrationName} Insights` : 'AI Insights'}</CardTitle>
          {/* Filter and Run Analysis controls removed - AI Insights is now passive until backend pipeline is ready
              Filter dropdown and handleRunAnalysis function preserved in code for future enablement */}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-gray-600">Loading insights...</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AI Insights will become available as more system activity is observed. Core314 is currently learning from your integration patterns.
          </p>
        ) : (
          <div className="space-y-4">
            {/* First AI Insight explainer - shows only once per user when insights are available */}
            {showExplainer && <FirstAIInsightExplainer onDismiss={handleDismissExplainer} />}
            
            {/* How to Ask Core314 guidance - contextual help for asking better questions */}
            <HowToAskGuidance integrationName={integrationName} />
            
                        {insights.map((insight) => (
                          <div key={insight.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getInsightIcon(insight.insight_type)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-sm">{insight.integration_name}</p>
                                  {/* Phase 9.3: Data basis qualifier with tooltip */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 cursor-help flex items-center gap-1">
                                          <Info className="h-3 w-3" />
                                          {INTELLIGENCE_TOOLTIP_COPY.dataBasis}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-xs">{INTELLIGENCE_TOOLTIP_COPY.aggregatedSignals}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {insight.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {format(new Date(insight.created_at), 'MMM dd, h:mm a')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
