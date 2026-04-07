import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOnboardingStatus } from '../hooks/useOnboardingStatus';
import { BriefHighlights } from '../components/onboarding/BriefHighlights';
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
  AlertCircle,
  ArrowUpCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseFunctionUrl, getSupabaseAnonKey } from '../lib/supabase';
import { authenticatedFetch, SessionExpiredError } from '../utils/authenticatedFetch';
import { generateBriefPdf } from '../utils/generateBriefPdf';

interface BriefUsage {
  plan: string;
  used: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
}

interface MomentumData {
  classification: string;
  delta: number;
  label: string;
  current_score?: number | null;
  historical_average?: number | null;
  scores_used?: number;
}

interface SignalEntity {
  name: string;
  last_activity_type?: string;
  last_activity_date?: string;
  metric_value?: number;
}

interface SignalEvidence {
  signal_type: string;
  source: string;
  severity: string;
  category: string;
  description: string;
  confidence: number;
  affected_entities: SignalEntity[];
  summary_metrics: Record<string, unknown>;
}

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
  data_context?: {
    momentum?: MomentumData;
    signal_evidence?: SignalEvidence[];
    [key: string]: unknown;
  } | null;
}

// Safely parse JSONB fields that may be double-encoded as JSON strings
function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON, return as single-element array
      return [value];
    }
  }
  return [];
}

function normalizeBrief(raw: Record<string, unknown>): OperationalBriefData {
  return {
    ...raw,
    detected_signals: parseJsonArray(raw.detected_signals),
    recommended_actions: parseJsonArray(raw.recommended_actions),
  } as OperationalBriefData;
}

export function OperationalBrief() {
  const { profile } = useAuth();
  const { markBriefViewed, isBriefHighlightsDismissed } = useOnboardingStatus();
  const navigate = useNavigate();
  const [brief, setBrief] = useState<OperationalBriefData | null>(null);
  const [pastBriefs, setPastBriefs] = useState<OperationalBriefData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<BriefUsage | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Test Scenario Mode state
  const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
  const [selectedScenario, setSelectedScenario] = useState('revenue_slowdown');
  const [injecting, setInjecting] = useState(false);
  const [injectResult, setInjectResult] = useState<{ success: boolean; message: string } | null>(null);

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
      const latestBrief = normalizeBrief(data[0] as Record<string, unknown>);
      setBrief(latestBrief);
      setPastBriefs(data.slice(1).map(d => normalizeBrief(d as Record<string, unknown>)));
      // Extract momentum from data_context
      const ctx = (data[0] as Record<string, unknown>).data_context as Record<string, unknown> | null;
      if (ctx?.momentum) {
        setMomentum(ctx.momentum as MomentumData);
      }
      // Mark brief as viewed for onboarding tracking
      markBriefViewed();
    }
    setLoading(false);
  };

  const handleGenerateBrief = async () => {
    if (!profile?.id) return;
    setGenerating(true);
    setError(null);
    setLimitReached(false);

    try {
      const url = await getSupabaseFunctionUrl('operational-brief-generate');
      const anonKey = await getSupabaseAnonKey();

      const response = await authenticatedFetch(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.usage) {
          setUsage(result.usage);
        }
        // Capture momentum from the generate response
        if (result.momentum) {
          setMomentum(result.momentum as MomentumData);
        }
        await fetchLatestBrief();
      } else if (response.status === 429 && result.error === 'brief_limit_reached') {
        setLimitReached(true);
        setUsage({
          plan: result.plan,
          used: result.used,
          limit: result.limit,
          remaining: 0,
        });
        setError(result.message);
      } else {
        setError(result.error || 'Unable to generate brief. Please try again.');
      }
    } catch (err) {
      console.error('Error generating brief:', err);
      if (err instanceof SessionExpiredError) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Unable to generate brief. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleInjectScenario = async () => {
    if (!profile?.id) return;
    setInjecting(true);
    setInjectResult(null);

    try {
      const url = await getSupabaseFunctionUrl('test-scenario-inject');
      const anonKey = await getSupabaseAnonKey();

      const response = await authenticatedFetch(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scenario: selectedScenario }),
        });
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setInjectResult({
          success: true,
          message: result.message || `Injected ${result.events_injected} events, ${result.signals_created} signals detected.`,
        });
      } else {
        setInjectResult({
          success: false,
          message: result.error || 'Injection failed. Check Edge Function logs.',
        });
      }
    } catch (err) {
      console.error('Error injecting scenario:', err);
      setInjectResult({
        success: false,
        message: err instanceof SessionExpiredError
          ? 'Session expired. Please sign in again.'
          : 'Failed to inject test scenario.',
      });
    } finally {
      setInjecting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!brief) return;
    setPdfError(null);
    try {
      generateBriefPdf({
        title: brief.title,
        created_at: brief.created_at,
        health_score: brief.health_score,
        confidence: brief.confidence,
        detected_signals: brief.detected_signals,
        business_impact: brief.business_impact,
        recommended_actions: brief.recommended_actions,
        risk_assessment: brief.risk_assessment,
        momentum: momentum ?? undefined,
        userName: profile?.full_name,
        signal_evidence: brief.data_context?.signal_evidence,
      });
    } catch {
      setPdfError('Failed to generate PDF. Please try again.');
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

  const getMomentumArrow = (classification: string) => {
    switch (classification) {
      case 'strong_improvement': return { icon: ArrowUp, double: true, color: 'text-green-600' };
      case 'improving': return { icon: ArrowUp, double: false, color: 'text-green-600' };
      case 'stable': return { icon: ArrowRight, double: false, color: 'text-gray-500' };
      case 'declining': return { icon: ArrowDown, double: false, color: 'text-orange-600' };
      case 'critical_decline': return { icon: ArrowDown, double: true, color: 'text-red-600' };
      default: return { icon: ArrowRight, double: false, color: 'text-gray-500' };
    }
  };

  const getMomentumDisplayLabel = (classification: string) => {
    const labels: Record<string, string> = {
      'strong_improvement': 'Strong Improvement',
      'improving': 'Improving',
      'stable': 'Stable',
      'declining': 'Declining',
      'critical_decline': 'Critical Decline',
    };
    return labels[classification] || classification;
  };

  const getSignalSeverity = (signal: string): 'high' | 'medium' | 'low' => {
    const lower = signal.toLowerCase();
    if (lower.includes('critical') || lower.includes('no ') || lower.includes('inactivity') || lower.includes('stagnation') || lower.includes('overdue') || lower.includes('past due')) return 'high';
    if (lower.includes('drop') || lower.includes('decrease') || lower.includes('issue') || lower.includes('delay') || lower.includes('limited')) return 'medium';
    return 'low';
  };

  const getSignalDotColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'bg-red-400';
      case 'medium': return 'bg-amber-400';
      case 'low': return 'bg-green-400';
    }
  };

  const getScoreBadgeStyle = (score: number | null) => {
    if (score === null) return 'bg-slate-500/20 text-slate-300';
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400';
    if (score >= 40) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  const getRiskBadgeStyle = (score: number | null) => {
    if (score === null) return 'bg-slate-500/20 text-slate-300';
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400';
    if (score >= 40) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  const getHealthColorDark = (score: number | null) => {
    if (score === null) return 'text-slate-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="bg-slate-900 rounded-2xl p-8">
          <Skeleton className="h-6 w-48 bg-slate-700" />
          <Skeleton className="h-4 w-72 mt-2 bg-slate-700" />
          <Skeleton className="h-32 w-full mt-6 bg-slate-800" />
          <Skeleton className="h-24 w-full mt-4 bg-slate-800" />
          <Skeleton className="h-24 w-full mt-4 bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-sky-500" />
            Operational Brief
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-generated analysis of your business operations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {usage && usage.limit !== -1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {usage.used} / {usage.limit} briefs used this month
            </span>
          )}
          {usage && usage.limit === -1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Unlimited briefs ({usage.plan})
            </span>
          )}
          {brief && (
            <Button
              onClick={handleDownloadPdf}
              variant="outline"
              className="border-sky-600 text-sky-600 hover:bg-sky-50 dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-950"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Brief
            </Button>
          )}
          <Button
            onClick={handleGenerateBrief}
            disabled={generating || limitReached}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Generating...' : 'Generate New Brief'}
          </Button>
        </div>
      </div>

      {/* Test Scenario Mode Banner */}
      {isTestMode && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-300">Test Scenario Mode Active</p>
                <p className="text-xs text-purple-400/70 mt-0.5">
                  Inject synthetic data through the full intelligence pipeline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="bg-slate-800 border border-purple-500/30 text-purple-200 text-sm rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="revenue_slowdown">Revenue Slowdown</option>
                <option value="cash_flow_risk">Cash Flow Risk</option>
                <option value="operational_breakdown">Operational Breakdown</option>
              </select>
              <Button
                onClick={handleInjectScenario}
                disabled={injecting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {injecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2" />
                )}
                {injecting ? 'Injecting...' : 'Inject Test Data'}
              </Button>
            </div>
          </div>
          {injectResult && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${
              injectResult.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}>
              {injectResult.message}
              {injectResult.success && (
                <span className="block mt-1 text-xs text-green-400/70">
                  Click "Generate New Brief" above to see the full intelligence output.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* PDF Error Banner */}
      {pdfError && (
        <div className="rounded-xl p-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-300">{pdfError}</p>
        </div>
      )}

      {/* Error / Limit Reached Banner */}
      {error && (
        <div className={`rounded-xl p-4 flex items-start gap-3 ${limitReached ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          {limitReached ? (
            <ArrowUpCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${limitReached ? 'text-amber-300' : 'text-red-300'}`}>
              {error}
            </p>
            {limitReached && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={() => navigate('/billing')}
              >
                <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
                Upgrade to Command Center for unlimited briefs
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Aha Moment: Brief Highlights Guide - shown on first brief view */}
      <BriefHighlights show={!!brief && !isBriefHighlightsDismissed} />

      {!brief ? (
        /* Empty State */
        <div className="bg-slate-900 rounded-2xl p-10 sm:p-16 text-center shadow-2xl">
          <FileText className="h-14 w-14 text-slate-600 mx-auto mb-5" />
          <h3 className="text-xl font-bold text-white mb-3">
            No Operational Brief Yet
          </h3>
          <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
            Generate your first AI-powered operational brief to understand what&apos;s happening
            in your business. Core314 will analyze your connected integrations and provide
            reasoning about your current operational state, even with limited data.
          </p>
          <Button
            onClick={handleGenerateBrief}
            disabled={generating}
            className="bg-sky-600 hover:bg-sky-700 text-white px-6"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate First Brief
          </Button>
        </div>
      ) : (
        <>
          {/* Dark-themed Brief Container — matches landing page design */}
          <div className="bg-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl">
            {/* Brief Header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex-1 min-w-0">
                <div className="text-sky-400 text-xs font-medium uppercase tracking-wider mb-1">
                  Core314 Operational Brief
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {brief.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
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
                  <span className="bg-slate-700/60 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {getConfidenceBadge(brief.confidence).label}
                  </span>
                </div>
              </div>
              {brief.health_score !== null && (
                <div className="flex flex-col items-end gap-1.5 ml-4">
                  <div className="flex items-center gap-2">
                    <span className={`${getScoreBadgeStyle(brief.health_score)} px-3 py-1 rounded-full text-xs font-semibold`}>
                      Score: {brief.health_score} / 100
                    </span>
                    <span className={`${getRiskBadgeStyle(brief.health_score)} px-3 py-1 rounded-full text-xs font-semibold`}>
                      {getHealthLabel(brief.health_score)}
                    </span>
                  </div>
                  {momentum && (() => {
                    const arrow = getMomentumArrow(momentum.classification);
                    const ArrowIcon = arrow.icon;
                    return (
                      <div className={`flex items-center gap-1 text-xs font-medium ${arrow.color}`}>
                        {arrow.double ? (
                          <><ArrowIcon className="h-3 w-3" /><ArrowIcon className="h-3 w-3 -ml-1.5" /></>
                        ) : (
                          <ArrowIcon className="h-3 w-3" />
                        )}
                        {getMomentumDisplayLabel(momentum.classification)}
                        <span className="text-slate-500 font-normal ml-1">
                          ({momentum.delta >= 0 ? '+' : ''}{momentum.delta})
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Detected Signals with Evidence */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Detected Signals
              </h4>
              {brief.data_context?.signal_evidence && brief.data_context.signal_evidence.length > 0 ? (
                <div className="space-y-4">
                  {brief.data_context.signal_evidence.map((ev, i) => {
                    const sevColor = ev.severity === 'critical' || ev.severity === 'high' ? 'bg-red-400' : ev.severity === 'medium' ? 'bg-amber-400' : 'bg-green-400';
                    const sevBorder = ev.severity === 'critical' || ev.severity === 'high' ? 'border-red-500/30' : ev.severity === 'medium' ? 'border-amber-500/30' : 'border-green-500/30';
                    const sevBg = ev.severity === 'critical' || ev.severity === 'high' ? 'bg-red-500/5' : ev.severity === 'medium' ? 'bg-amber-500/5' : 'bg-green-500/5';
                    return (
                      <div key={i} className={`rounded-lg border ${sevBorder} ${sevBg} p-4`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${sevColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-400 uppercase">{ev.source.replace(/_/g, ' ')}</span>
                              <span className="text-slate-600">·</span>
                              <span className="text-xs text-slate-500">{ev.category.replace(/_/g, ' ')}</span>
                              <span className="text-slate-600">·</span>
                              <span className={`text-xs font-semibold uppercase ${ev.severity === 'critical' || ev.severity === 'high' ? 'text-red-400' : ev.severity === 'medium' ? 'text-amber-400' : 'text-green-400'}`}>{ev.severity}</span>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">
                              {brief.detected_signals[i] || ev.description}
                            </p>
                            {/* Entity Evidence */}
                            {ev.affected_entities.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Affected Items</span>
                                <ul className="space-y-1">
                                  {ev.affected_entities.slice(0, 10).map((ent, j) => (
                                    <li key={j} className="flex items-center gap-2 text-xs text-slate-400">
                                      <span className="text-slate-600">•</span>
                                      <span className="font-medium text-slate-300">{ent.name}</span>
                                      {ent.last_activity_type && (
                                        <span className="text-slate-500">— {ent.last_activity_type}</span>
                                      )}
                                      {ent.last_activity_date && (
                                        <span className="text-slate-600 text-[10px]">{new Date(ent.last_activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Summary Metrics */}
                            {Object.keys(ev.summary_metrics).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(ev.summary_metrics).slice(0, 5).map(([key, val]) => (
                                  <span key={key} className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                                    <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>
                                    <span className="font-medium text-slate-300">{typeof val === 'number' ? val.toLocaleString() : String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : brief.detected_signals && brief.detected_signals.length > 0 ? (
                /* Fallback: render plain text signals for older briefs without evidence */
                <div className="space-y-3">
                  {brief.detected_signals.map((signal, i) => {
                    const severity = getSignalSeverity(signal);
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getSignalDotColor(severity)}`} />
                        <p className="text-slate-300 text-sm leading-relaxed">{signal}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No signals detected.</p>
              )}
            </div>

            {/* Business Impact */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Business Impact
              </h4>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {brief.business_impact}
              </p>
            </div>

            {/* Recommended Actions */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Recommended Actions
              </h4>
              {brief.recommended_actions && brief.recommended_actions.length > 0 ? (
                <div className="space-y-3">
                  {brief.recommended_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-slate-300 text-sm leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No actions recommended.</p>
              )}
            </div>

            {/* Risk Assessment */}
            <div className="pt-6 border-t border-slate-700/50">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Risk Assessment
              </h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {brief.risk_assessment}
              </p>
            </div>

            {/* Download Brief Button — inside brief container for visibility */}
            <div className="pt-6 mt-6 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Generated {new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <Button
                onClick={handleDownloadPdf}
                variant="outline"
                className="border-sky-500 text-sky-400 hover:bg-sky-950 hover:text-sky-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Brief
              </Button>
            </div>
          </div>

          {/* Past Briefs */}
          {pastBriefs.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h3 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Previous Briefs
              </h3>
              <div className="divide-y divide-slate-700/50">
                {pastBriefs.map((pb) => (
                  <button
                    key={pb.id}
                    className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-800/50 rounded-lg px-3 -mx-3 transition-colors"
                    onClick={() => {
                      setBrief(pb);
                      const pbCtx = pb.data_context;
                      setMomentum(pbCtx?.momentum ?? null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{pb.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(pb.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {pb.health_score !== null && (
                      <span className={`text-sm font-bold ml-3 ${getHealthColorDark(pb.health_score)}`}>
                        {pb.health_score}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
