import {
  AlertTriangle,
  TrendingDown,
  Clock,
  ArrowRight,
  Activity,
  DollarSign,
  MessageSquare,
  CheckCircle2,
  BarChart3,
  Users,
} from 'lucide-react';

interface Signal {
  severity: 'critical' | 'warning' | 'healthy';
  source: string;
  text: string;
}

interface Action {
  who: string;
  what: string;
  when: string;
}

interface BriefData {
  headline: string;
  timestamp: string;
  healthScore: number;
  healthLabel: string;
  revenueAtRisk: string;
  overdueCash: string;
  signals: Signal[];
  correlation: string;
  impact: string;
  rootCause: string;
  forecast: string;
  actions: Action[];
}

const defaultBriefData: BriefData = {
  headline: 'Operational Slowdown Detected',
  timestamp: 'Generated Apr 10, 2026 — 8:00 AM EST',
  healthScore: 20,
  healthLabel: 'Critical',
  revenueAtRisk: '$85,000',
  overdueCash: '$29,000',
  signals: [
    { severity: 'critical', source: 'QuickBooks', text: '4 invoices overdue by 30+ days — total exposure ~$29,000' },
    { severity: 'critical', source: 'HubSpot', text: '3 enterprise deals stalled with no activity in 14+ days' },
    { severity: 'warning', source: 'Slack', text: 'Cross-team escalation messages increased 47% this week' },
    { severity: 'warning', source: 'Trello', text: '6 delivery tasks past due — blocking 2 client projects' },
    { severity: 'healthy', source: 'HubSpot', text: 'New lead volume up 12% — inbound pipeline healthy' },
  ],
  correlation: 'Revenue stall correlates with delivery bottleneck: stalled deals in HubSpot map to overdue Trello tasks assigned to the same team. Slack escalation spike confirms cross-team friction.',
  impact: 'Estimated $85,000 in pipeline revenue at risk this quarter. $29,000 in overdue receivables affecting cash flow. Two client deliverables are behind schedule, increasing churn risk.',
  rootCause: 'Delivery team capacity is the primary constraint. Three enterprise deals require implementation resources that are currently allocated to overdue projects. The resource conflict is creating a cascading delay across both revenue and operations.',
  forecast: 'Without intervention, projected revenue shortfall of $85,000 this quarter. Cash flow gap expected to widen by an additional $15,000 within 30 days if overdue invoices are not escalated.',
  actions: [
    { who: 'Revenue Lead', what: 'Re-engage the 3 stalled enterprise deals with updated timelines', when: 'Within 48 hours' },
    { who: 'Finance', what: 'Escalate 4 overdue invoices — prioritize accounts over 45 days', when: 'Immediate' },
    { who: 'Operations Lead', what: 'Reassign delivery tasks to unblock the 2 client projects', when: 'Within 24 hours' },
    { who: 'Leadership', what: 'Review resource allocation model to prevent recurring bottleneck', when: 'This week' },
  ],
};

const severityConfig = {
  critical: { dot: 'bg-red-400', badge: 'bg-red-500/20 text-red-400', label: 'Critical' },
  warning: { dot: 'bg-amber-400', badge: 'bg-amber-500/20 text-amber-400', label: 'Warning' },
  healthy: { dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400', label: 'Healthy' },
};

interface SampleBriefProps {
  data?: BriefData;
  compact?: boolean;
}

export function SampleBrief({ data = defaultBriefData, compact = false }: SampleBriefProps) {
  const scoreColor = data.healthScore <= 30 ? 'text-red-400' : data.healthScore <= 60 ? 'text-amber-400' : 'text-emerald-400';
  const scoreBg = data.healthScore <= 30 ? 'bg-red-500/20' : data.healthScore <= 60 ? 'bg-amber-500/20' : 'bg-emerald-500/20';

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sky-400 text-xs font-medium uppercase tracking-wider mb-1">Core314 Operational Brief</div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">{data.headline}</h3>
            <p className="text-slate-400 text-xs mt-1">{data.timestamp}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${scoreBg} ${scoreColor} px-3 py-1.5 rounded-full text-sm font-bold`}>
              {data.healthScore} / 100
            </span>
            <span className={`${scoreBg} ${scoreColor} px-2.5 py-1 rounded-full text-xs font-medium`}>
              {data.healthLabel}
            </span>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
            <div className="bg-red-500/20 rounded-lg p-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">Revenue at Risk</p>
              <p className="text-white font-bold text-lg">{data.revenueAtRisk}</p>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
            <div className="bg-amber-500/20 rounded-lg p-2">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">Overdue Cash</p>
              <p className="text-white font-bold text-lg">{data.overdueCash}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signals grouped by severity */}
      <div className="px-6 sm:px-8 py-5 border-b border-slate-700/50">
        <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Detected Signals
        </h4>
        <div className="space-y-2.5">
          {data.signals.map((signal, index) => {
            const config = severityConfig[signal.severity];
            return (
              <div key={index} className="flex items-start gap-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`${config.badge} px-1.5 py-0.5 rounded text-[10px] font-medium`}>{config.label}</span>
                    <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">{signal.source}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{signal.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-System Correlation */}
      <div className="px-6 sm:px-8 py-5 border-b border-slate-700/50">
        <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Cross-System Correlation
        </h4>
        <p className="text-slate-300 text-sm leading-relaxed">{data.correlation}</p>
      </div>

      {/* Business Impact */}
      <div className="px-6 sm:px-8 py-5 border-b border-slate-700/50">
        <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5" />
          Business Impact
        </h4>
        <p className="text-slate-300 text-sm leading-relaxed">{data.impact}</p>
      </div>

      {/* Root Cause Analysis */}
      <div className="px-6 sm:px-8 py-5 border-b border-slate-700/50">
        <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Root Cause Analysis
        </h4>
        <p className="text-slate-300 text-sm leading-relaxed">{data.rootCause}</p>
      </div>

      {/* Forecast Projection */}
      {!compact && (
        <div className="px-6 sm:px-8 py-5 border-b border-slate-700/50">
          <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Forecast Projection
          </h4>
          <p className="text-slate-300 text-sm leading-relaxed">{data.forecast}</p>
        </div>
      )}

      {/* Recommended Actions */}
      <div className="px-6 sm:px-8 py-5">
        <h4 className="text-sky-400 font-semibold mb-3 uppercase tracking-wider text-xs flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Recommended Actions
        </h4>
        <div className="space-y-3">
          {data.actions.map((action, index) => (
            <div key={index} className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
              <ArrowRight className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />
                    {action.who}
                  </span>
                  <span className="text-slate-500 text-[10px]">{action.when}</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{action.what}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
