import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useOnboardingStatus } from '../hooks/useOnboardingStatus';
import { BriefHighlights } from '../components/onboarding/BriefHighlights';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Clock,
  Sparkles,
  AlertCircle,
  ArrowUpCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
  Network,
  DollarSign,
  Target,
  Search,
  Calendar,
  Users,
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

interface CrossSystemPattern {
  pattern_name: string;
  category: string;
  integrations: string[];
  combined_severity: string;
  signal_count: number;
}

interface InterCategoryPattern {
  pattern_name: string;
  categories: string[];
  description: string;
  severity: string;
}

interface FinancialImpactData {
  overdue_total: number | null;
  revenue_at_risk: number | null;
  estimated_shortfall: number | null;
  open_pipeline_value: number | null;
  stalled_pipeline_value: number | null;
  expense_total: number | null;
  details: string[];
  gpt_analysis?: {
    summary?: string;
    revenue_at_risk?: number | null;
    overdue_total?: number | null;
    estimated_shortfall?: number | null;
  } | null;
}

interface ForecastData {
  horizon_7d: { risk_level: string; description: string };
  horizon_14d: { risk_level: string; description: string };
  horizon_30d: { risk_level: string; description: string };
  projected_health_score: number | null;
  trend_direction: string;
  key_risks: string[];
  gpt_analysis?: {
    seven_day?: string;
    fourteen_day?: string;
    thirty_day?: string;
    key_risks?: string[];
  } | null;
}

interface RootCauseItem {
  cause: string;
  evidence: string[];
  affected_systems: string[];
  severity?: string;
}

interface PrescriptiveAction {
  who: string;
  what: string;
  when: string;
  priority: string;
}

interface OperationalBriefData {
  id: string;
  title: string;
  detected_signals: string[];
  business_impact: string;
  recommended_actions: string[] | PrescriptiveAction[];
  risk_assessment: string;
  confidence: number;
  health_score: number | null;
  created_at: string;
  data_context?: {
    momentum?: MomentumData;
    signal_evidence?: SignalEvidence[];
    cross_system_patterns?: CrossSystemPattern[];
    inter_category_patterns?: InterCategoryPattern[];
    gpt_cross_system_patterns?: Array<{ pattern: string; integrations: string[]; description: string }>;
    financial_impact?: FinancialImpactData;
    forecast?: ForecastData;
    root_cause_analysis?: {
      programmatic?: RootCauseItem[];
      gpt_analysis?: RootCauseItem[];
    };
    prescriptive_actions?: string[] | PrescriptiveAction[];
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
        cross_system_patterns: brief.data_context?.cross_system_patterns,
        inter_category_patterns: brief.data_context?.inter_category_patterns,
        financial_impact: brief.data_context?.financial_impact,
        forecast: brief.data_context?.forecast,
        root_cause_analysis: brief.data_context?.root_cause_analysis,
        prescriptive_actions: brief.data_context?.prescriptive_actions,
      });
    } catch {
      setPdfError('Failed to generate PDF. Please try again.');
    }
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

            {/* Cross-System Patterns */}
            {((brief.data_context?.cross_system_patterns && brief.data_context.cross_system_patterns.length > 0) ||
              (brief.data_context?.inter_category_patterns && brief.data_context.inter_category_patterns.length > 0)) && (
              <div className="mb-8">
                <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Network className="h-3.5 w-3.5" />
                  Cross-System Patterns
                </h4>
                <div className="space-y-3">
                  {brief.data_context?.cross_system_patterns?.map((p, i) => {
                    const sevColor = p.combined_severity === 'critical' ? 'border-red-500/40 bg-red-500/5' : p.combined_severity === 'high' ? 'border-orange-500/40 bg-orange-500/5' : 'border-amber-500/40 bg-amber-500/5';
                    return (
                      <div key={`cs-${i}`} className={`rounded-lg border ${sevColor} p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-semibold uppercase ${p.combined_severity === 'critical' ? 'text-red-400' : p.combined_severity === 'high' ? 'text-orange-400' : 'text-amber-400'}`}>
                            {p.combined_severity}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs text-slate-400">{p.category.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-slate-300 text-sm">
                          Detected across <span className="font-medium text-white">{p.integrations.join(', ').replace(/_/g, ' ')}</span> — {p.signal_count} signal{p.signal_count !== 1 ? 's' : ''} correlated
                        </p>
                      </div>
                    );
                  })}
                  {brief.data_context?.inter_category_patterns?.map((p, i) => {
                    const sevColor = p.severity === 'critical' ? 'border-red-500/40 bg-red-500/5' : p.severity === 'high' ? 'border-orange-500/40 bg-orange-500/5' : 'border-amber-500/40 bg-amber-500/5';
                    return (
                      <div key={`ic-${i}`} className={`rounded-lg border ${sevColor} p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-semibold uppercase ${p.severity === 'critical' ? 'text-red-400' : p.severity === 'high' ? 'text-orange-400' : 'text-amber-400'}`}>
                            {p.severity}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-medium text-white">{p.pattern_name}</span>
                        </div>
                        <p className="text-slate-400 text-sm">{p.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.categories.map(c => (
                            <span key={c} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{c.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Financial Impact */}
            {brief.data_context?.financial_impact && brief.data_context.financial_impact.details && brief.data_context.financial_impact.details.length > 0 && (
              <div className="mb-8">
                <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" />
                  Financial Impact
                </h4>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
                  {brief.data_context.financial_impact.gpt_analysis?.summary && (
                    <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                      {brief.data_context.financial_impact.gpt_analysis.summary}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {brief.data_context.financial_impact.revenue_at_risk != null && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Revenue at Risk</div>
                        <div className="text-lg font-bold text-red-400">${brief.data_context.financial_impact.revenue_at_risk.toLocaleString()}</div>
                      </div>
                    )}
                    {brief.data_context.financial_impact.overdue_total != null && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Overdue Total</div>
                        <div className="text-lg font-bold text-orange-400">${brief.data_context.financial_impact.overdue_total.toLocaleString()}</div>
                      </div>
                    )}
                    {brief.data_context.financial_impact.estimated_shortfall != null && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Collection Shortfall</div>
                        <div className="text-lg font-bold text-amber-400">${brief.data_context.financial_impact.estimated_shortfall.toLocaleString()}</div>
                      </div>
                    )}
                    {brief.data_context.financial_impact.open_pipeline_value != null && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Open Pipeline</div>
                        <div className="text-lg font-bold text-sky-400">${brief.data_context.financial_impact.open_pipeline_value.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {brief.data_context.financial_impact.details.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="text-emerald-500 mt-0.5">$</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Forecast */}
            {brief.data_context?.forecast && (
              <div className="mb-8">
                <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Risk Forecast
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: '7-Day', data: brief.data_context.forecast.horizon_7d, gpt: brief.data_context.forecast.gpt_analysis?.seven_day },
                    { label: '14-Day', data: brief.data_context.forecast.horizon_14d, gpt: brief.data_context.forecast.gpt_analysis?.fourteen_day },
                    { label: '30-Day', data: brief.data_context.forecast.horizon_30d, gpt: brief.data_context.forecast.gpt_analysis?.thirty_day },
                  ].map((horizon) => {
                    const riskColor = horizon.data.risk_level === 'critical' ? 'border-red-500/40 bg-red-500/10 text-red-400'
                      : horizon.data.risk_level === 'high' ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                      : horizon.data.risk_level === 'medium' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-green-500/40 bg-green-500/10 text-green-400';
                    return (
                      <div key={horizon.label} className={`rounded-lg border ${riskColor} p-4 text-center`}>
                        <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{horizon.label}</div>
                        <div className="text-sm font-bold uppercase mb-1">{horizon.data.risk_level}</div>
                        <p className="text-[11px] opacity-80 leading-snug">{horizon.gpt || horizon.data.description}</p>
                      </div>
                    );
                  })}
                </div>
                {brief.data_context.forecast.projected_health_score != null && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <Calendar className="h-3 w-3" />
                    <span>Projected health score: <span className="font-medium text-white">{brief.data_context.forecast.projected_health_score}/100</span></span>
                  </div>
                )}
                {brief.data_context.forecast.key_risks && brief.data_context.forecast.key_risks.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Key Projected Risks</span>
                    {brief.data_context.forecast.key_risks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Root Cause Analysis */}
            {brief.data_context?.root_cause_analysis && (
              (brief.data_context.root_cause_analysis.programmatic?.length ?? 0) > 0 ||
              (brief.data_context.root_cause_analysis.gpt_analysis?.length ?? 0) > 0
            ) && (
              <div className="mb-8">
                <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  Root Cause Analysis
                </h4>
                <div className="space-y-3">
                  {(brief.data_context.root_cause_analysis.gpt_analysis && brief.data_context.root_cause_analysis.gpt_analysis.length > 0
                    ? brief.data_context.root_cause_analysis.gpt_analysis
                    : brief.data_context.root_cause_analysis.programmatic || []
                  ).map((rc, i) => {
                    const sevColor = rc.severity === 'critical' ? 'border-red-500/30' : rc.severity === 'high' ? 'border-orange-500/30' : 'border-slate-700/50';
                    return (
                      <div key={i} className={`rounded-lg border ${sevColor} bg-slate-800/40 p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-3.5 w-3.5 text-sky-400" />
                          <span className="text-sm font-medium text-white">{rc.cause}</span>
                          {rc.severity && (
                            <span className={`text-[10px] uppercase font-semibold ${rc.severity === 'critical' ? 'text-red-400' : rc.severity === 'high' ? 'text-orange-400' : 'text-amber-400'}`}>
                              {rc.severity}
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1 mb-2">
                          {rc.evidence.map((ev, j) => (
                            <li key={j} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-slate-600 mt-0.5">-</span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                        {rc.affected_systems.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {rc.affected_systems.map(sys => (
                              <span key={sys} className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full">{sys}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Business Impact */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Business Impact
              </h4>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {brief.business_impact}
              </p>
            </div>

            {/* Prescriptive Actions (WHO/WHAT/WHEN) */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Prescriptive Actions
              </h4>
              {(() => {
                // Try structured prescriptive_actions first, then fall back to recommended_actions
                const actions = brief.data_context?.prescriptive_actions || brief.recommended_actions || [];
                if (!actions || actions.length === 0) {
                  return <p className="text-sm text-slate-500">No actions recommended.</p>;
                }

                // Check if actions are structured (WHO/WHAT/WHEN) or plain strings
                const isStructured = actions.length > 0 && typeof actions[0] === 'object' && actions[0] !== null && 'what' in actions[0];

                if (isStructured) {
                  const structuredActions = actions as PrescriptiveAction[];
                  return (
                    <div className="space-y-3">
                      {structuredActions.map((action, i) => {
                        const priorityColor = action.priority === 'critical' ? 'border-red-500/40 bg-red-500/5'
                          : action.priority === 'high' ? 'border-orange-500/40 bg-orange-500/5'
                          : action.priority === 'medium' ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-slate-700/50 bg-slate-800/40';
                        const priorityText = action.priority === 'critical' ? 'text-red-400'
                          : action.priority === 'high' ? 'text-orange-400'
                          : action.priority === 'medium' ? 'text-amber-400'
                          : 'text-slate-400';
                        return (
                          <div key={i} className={`rounded-lg border ${priorityColor} p-4`}>
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-200 text-sm font-medium mb-2">{action.what}</p>
                                <div className="flex flex-wrap gap-3 text-xs">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Users className="h-3 w-3 text-sky-400" />
                                    <span className="text-slate-500">WHO:</span>
                                    <span className="font-medium text-white">{action.who}</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock className="h-3 w-3 text-sky-400" />
                                    <span className="text-slate-500">WHEN:</span>
                                    <span className="font-medium text-white">{action.when}</span>
                                  </span>
                                  <span className={`font-semibold uppercase ${priorityText}`}>
                                    {action.priority}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Fallback: plain string actions
                const stringActions = actions as string[];
                return (
                  <div className="space-y-3">
                    {stringActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-slate-300 text-sm leading-relaxed">{typeof action === 'string' ? action : JSON.stringify(action)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
