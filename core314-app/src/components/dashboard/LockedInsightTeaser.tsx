import { Lock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

/**
 * Locked Insight Teaser - Observe Tier Only
 * 
 * A small inline label shown wherever Observe-tier users see:
 * - Global Fusion Score
 * - Integration dashboards
 * - Metrics tables
 * 
 * This is a UX + copy + frontend-only component.
 * NO backend changes. NO AI calls. NO execution-mode logic touched.
 */

interface LockedInsightTeaserProps {
  className?: string;
}

export function LockedInsightTeaser({ className = '' }: LockedInsightTeaserProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-help ${className}`}>
            <Lock className="h-3 w-3" />
            <span>Intelligence unlocks after calibration completes</span>
            <Info className="h-3 w-3 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            Core314 does not generate intelligence until sufficient system context is learned.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
