import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  FileText,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  ArrowUpCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseFunctionUrl, getSupabaseAnonKey } from '../lib/supabase';

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
  const navigate = useNavigate();
  const [brief, setBrief] = useState<OperationalBriefData | null>(null);
  const [pastBriefs, setPastBriefs] = useState<OperationalBriefData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<BriefUsage | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);

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
    }
    setLoading(false);
  };

  const handleGenerateBrief = async () => {
    if (!profile?.id) return;
    setGenerating(true);
    setError(null);
    setLimitReached(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('operational-brief-generate');
      const anonKey = await getSupabaseAnonKey();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
        setError(result.error || 'Failed to generate brief. Please try again.');
      }
    } catch (err) {
      console.error('Error generating brief:', err);
      setError('Failed to connect to the brief generator. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getHealthDescription = (score: number | null) => {
    if (score === null) return 'Insufficient Data';
    if (score >= 80) return 'On Track — No Action Required';
    if (score >= 60) return 'Moderate Risk — Attention Recommended';
    if (score >= 40) return 'At Risk — Immediate Review Needed';
    return 'Critical — Urgent Intervention Required';
  };

  const getSignalSeverityLabel = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'HIGH RISK';
      case 'medium': return 'MEDIUM RISK';
      case 'low': return 'LOW RISK';
    }
  };

  const getSignalLabelColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/15';
      case 'medium': return 'text-yellow-400 bg-yellow-500/15';
      case 'low': return 'text-emerald-400 bg-emerald-500/15';
    }
  };

  const getActionUrgency = (index: number, total: number): { label: string; color: string } => {
    if (index === 0) return { label: 'Immediate', color: 'text-red-400 bg-red-500/15' };
    if (index <= Math.floor(total * 0.5)) return { label: 'High Priority', color: 'text-amber-400 bg-amber-500/15' };
    return { label: 'Monitor', color: 'text-slate-400 bg-slate-500/15' };
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

  const getMomentumDisplayLabel = (classification: string, delta: number) => {
    const labels: Record<string, string> = {
      'strong_improvement': 'Strong Improvement',
      'improving': 'Improving',
      'stable': 'No change in recent briefs',
      'declining': 'Declining',
      'critical_decline': 'Critical Decline',
    };
    const base = labels[classification] || classification;
    if (classification === 'stable' && delta === 0) return base;
    return base;
  };

  const getSignalSeverity = (signal: string): 'high' | 'medium' | 'low' => {
    const lower = signal.toLowerCase();
    if (lower.includes('critical') || lower.includes('no ') || lower.includes('inactivity') || lower.includes('stagnation') || lower.includes('overdue') || lower.includes('past due')) return 'high';
    if (lower.includes('drop') || lower.includes('decrease') || lower.includes('issue') || lower.includes('delay') || lower.includes('limited')) return 'medium';
    return 'low';
  };

  const getSignalDotColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-400';
      case 'low': return 'bg-emerald-400';
    }
  };

  const getSignalTextColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'text-red-300';
      case 'medium': return 'text-yellow-200';
      case 'low': return 'text-emerald-300';
    }
  };

  const getSignalBgColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'bg-red-500/5 border-red-500/20';
      case 'medium': return 'bg-yellow-500/5 border-yellow-500/20';
      case 'low': return 'bg-emerald-500/5 border-emerald-500/20';
    }
  };

  const getScoreRingColor = (score: number | null) => {
    if (score === null) return 'border-slate-600 text-slate-400';
    if (score >= 80) return 'border-emerald-400 text-emerald-400';
    if (score >= 60) return 'border-amber-400 text-amber-400';
    if (score >= 40) return 'border-orange-400 text-orange-400';
    return 'border-red-400 text-red-400';
  };

  const getScoreGlowColor = (score: number | null) => {
    if (score === null) return '';
    if (score >= 80) return 'shadow-emerald-500/20';
    if (score >= 60) return 'shadow-amber-500/20';
    if (score >= 40) return 'shadow-orange-500/20';
    return 'shadow-red-500/20';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-sky-500" />
            Operational Brief
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-generated analysis of your business operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usage && usage.limit !== -1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {usage.remaining === -1 ? 'Unlimited' : `${usage.remaining} of ${usage.limit} briefs remaining`}
            </span>
          )}
          {usage && usage.limit === -1 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Unlimited briefs ({usage.plan})
            </span>
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
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>
      )}

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
                <div className="flex flex-col items-center gap-2 ml-6">
                  {/* Prominent Score Circle — primary KPI */}
                  <div className={`w-20 h-20 rounded-full border-[3px] flex flex-col items-center justify-center shadow-lg ${getScoreRingColor(brief.health_score)} ${getScoreGlowColor(brief.health_score)}`}>
                    <span className="text-2xl font-extrabold leading-none">
                      {brief.health_score}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">/ 100</span>
                  </div>
                  <span className={`${getRiskBadgeStyle(brief.health_score)} px-3 py-1 rounded-full text-[10px] font-semibold text-center leading-tight max-w-[140px]`}>
                    {getHealthDescription(brief.health_score)}
                  </span>
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
                        {getMomentumDisplayLabel(momentum.classification, momentum.delta)}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Detected Signals */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Detected Signals
              </h4>
              {brief.detected_signals && brief.detected_signals.length > 0 ? (
                <div className="space-y-2.5">
                  {brief.detected_signals.map((signal, i) => {
                    const severity = getSignalSeverity(signal);
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${getSignalBgColor(severity)}`}>
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${getSignalDotColor(severity)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getSignalLabelColor(severity)}`}>
                              {getSignalSeverityLabel(severity)}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed ${getSignalTextColor(severity)}`}>{signal}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No signals detected.</p>
              )}
            </div>

            {/* Business Impact */}
            <div className="mb-8 rounded-xl bg-sky-500/5 border border-sky-500/20 p-5">
              <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Business Impact
              </h4>
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                {brief.business_impact}
              </p>
            </div>

            {/* Recommended Actions */}
            <div className="mb-8">
              <h4 className="text-sky-400 font-semibold mb-4 uppercase tracking-wider text-xs">
                Recommended Actions
              </h4>
              {brief.recommended_actions && brief.recommended_actions.length > 0 ? (
                <div className="space-y-2.5">
                  {brief.recommended_actions.map((action, i) => {
                    const urgency = getActionUrgency(i, brief.recommended_actions.length);
                    return (
                      <div key={i} className="flex items-start gap-4 rounded-lg border border-slate-700/40 bg-slate-800/40 px-4 py-3.5 hover:bg-slate-800/60 transition-colors">
                        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${urgency.color}`}>
                              {urgency.label}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">{action}</p>
                        </div>
                      </div>
                    );
                  })}
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
