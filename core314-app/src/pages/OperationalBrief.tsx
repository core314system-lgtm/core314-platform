import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Shield,
  CheckCircle,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { getSupabaseFunctionUrl } from '../lib/supabase';

interface OperationalBriefData {
  id: string;
  title: string;
  detected_signals: string[];
  business_impact: string;
  recommended_actions: string[];
  risk_assessment: string;
  confidence: number;
  health_score: number | null;
  created_at: string;
}

export function OperationalBrief() {
  const { profile } = useAuth();
  const [brief, setBrief] = useState<OperationalBriefData | null>(null);
  const [pastBriefs, setPastBriefs] = useState<OperationalBriefData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchLatestBrief();
    }
  }, [profile?.id]);

  const fetchLatestBrief = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('operational_briefs')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!error && data && data.length > 0) {
      setBrief(data[0] as OperationalBriefData);
      setPastBriefs(data.slice(1) as OperationalBriefData[]);
    }
    setLoading(false);
  };

  const handleGenerateBrief = async () => {
    if (!profile?.id) return;
    setGenerating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('operational-brief-generate');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        await fetchLatestBrief();
      }
    } catch (err) {
      console.error('Error generating brief:', err);
    } finally {
      setGenerating(false);
    }
  };

  const getHealthColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthLabel = (score: number | null) => {
    if (score === null) return 'Unknown';
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Moderate';
    if (score >= 40) return 'At Risk';
    return 'Critical';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return { label: 'High Confidence', variant: 'default' as const };
    if (confidence >= 60) return { label: 'Moderate Confidence', variant: 'secondary' as const };
    return { label: 'Low Confidence', variant: 'outline' as const };
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Operational Brief
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-generated analysis of your business operations
          </p>
        </div>
        <Button onClick={handleGenerateBrief} disabled={generating}>
          {generating ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {generating ? 'Generating...' : 'Generate New Brief'}
        </Button>
      </div>

      {!brief ? (
        /* Empty State */
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Operational Brief Yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Connect your integrations (Slack, HubSpot, QuickBooks) and generate your first
              AI-powered operational brief to understand what&apos;s happening in your business.
            </p>
            <Button onClick={handleGenerateBrief} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate First Brief
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Brief Header Card */}
          <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {brief.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(brief.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant={getConfidenceBadge(brief.confidence).variant}>
                      {getConfidenceBadge(brief.confidence).label}
                    </Badge>
                  </div>
                </div>
                {brief.health_score !== null && (
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getHealthColor(brief.health_score)}`}>
                      {brief.health_score}
                    </div>
                    <div className={`text-xs font-medium ${getHealthColor(brief.health_score)}`}>
                      {getHealthLabel(brief.health_score)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detected Signals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Detected Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brief.detected_signals && brief.detected_signals.length > 0 ? (
                <ul className="space-y-2">
                  {brief.detected_signals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No signals detected.</p>
              )}
            </CardContent>
          </Card>

          {/* Business Impact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Business Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {brief.business_impact}
              </p>
            </CardContent>
          </Card>

          {/* Recommended Actions */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recommended Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brief.recommended_actions && brief.recommended_actions.length > 0 ? (
                <ol className="space-y-2">
                  {brief.recommended_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-500">No actions recommended.</p>
              )}
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-500" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {brief.risk_assessment}
              </p>
            </CardContent>
          </Card>

          {/* Past Briefs */}
          {pastBriefs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Previous Briefs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pastBriefs.map((pb) => (
                    <button
                      key={pb.id}
                      className="w-full py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 -mx-2"
                      onClick={() => {
                        setBrief(pb);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{pb.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(pb.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {pb.health_score !== null && (
                        <span className={`text-sm font-bold ${getHealthColor(pb.health_score)}`}>
                          {pb.health_score}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
