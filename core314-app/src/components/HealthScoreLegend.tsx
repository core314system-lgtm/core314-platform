import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const SCORE_RANGES = [
  { min: 90, max: 100, label: 'Excellent', description: 'Stable operations', color: 'bg-green-500', textColor: 'text-green-400', bgColor: 'bg-green-500/10' },
  { min: 70, max: 89, label: 'Good', description: 'Minor risks detected', color: 'bg-emerald-500', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { min: 50, max: 69, label: 'Moderate', description: 'Action recommended', color: 'bg-amber-500', textColor: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  { min: 30, max: 49, label: 'At Risk', description: 'Immediate attention required', color: 'bg-orange-500', textColor: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { min: 10, max: 29, label: 'Critical', description: 'Severe operational degradation', color: 'bg-red-500', textColor: 'text-red-400', bgColor: 'bg-red-500/10' },
  { min: 0, max: 9, label: 'System Failure', description: 'Operations at risk of breakdown', color: 'bg-red-700', textColor: 'text-red-500', bgColor: 'bg-red-700/10' },
];

interface HealthScoreLegendProps {
  currentScore?: number | null;
}

export function HealthScoreLegend({ currentScore }: HealthScoreLegendProps) {
  const [expanded, setExpanded] = useState(false);

  const activeRange = currentScore !== null && currentScore !== undefined
    ? SCORE_RANGES.find(r => currentScore >= r.min && currentScore <= r.max)
    : null;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Health Score Legend</span>
          {activeRange && (
            <span className={`text-xs font-semibold ${activeRange.textColor}`}>
              — {activeRange.label}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          {SCORE_RANGES.map((range) => {
            const isActive = activeRange === range;
            return (
              <div
                key={range.label}
                className={`flex items-center gap-3 rounded-md px-3 py-1.5 transition-colors ${
                  isActive ? range.bgColor + ' ring-1 ring-slate-600' : ''
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${range.color}`} />
                <div className="flex items-baseline gap-2 flex-1 min-w-0">
                  <span className={`text-xs font-semibold ${isActive ? range.textColor : 'text-slate-300'} whitespace-nowrap`}>
                    {range.min}–{range.max}
                  </span>
                  <span className={`text-xs font-medium ${isActive ? range.textColor : 'text-slate-400'}`}>
                    {range.label}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                    {range.description}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed border-t border-slate-700/50 pt-2">
            Your health score reflects aggregated signals across revenue, cash flow, operations, communication, and scheduling systems.
          </p>
        </div>
      )}
    </div>
  );
}
