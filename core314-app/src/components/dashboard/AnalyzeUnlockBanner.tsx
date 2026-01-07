import { useState } from 'react';
import { Button } from '../ui/button';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Analyze Unlock Orientation Banner
 * 
 * Shows when score_origin transitions from "baseline" to "computed".
 * UI + copy ONLY - no backend, AI, execution-mode, or pricing logic changes.
 * 
 * Behavior:
 * - Not dismissible on first view
 * - After acknowledgment, collapses into a small persistent status chip
 * - Uses localStorage to persist acknowledgment state
 */

const ANALYZE_UNLOCK_ACKNOWLEDGED_KEY = 'core314_analyze_unlock_acknowledged';

interface AnalyzeUnlockBannerProps {
  isComputed: boolean;
}

export function AnalyzeUnlockBanner({ isComputed }: AnalyzeUnlockBannerProps) {
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    return localStorage.getItem(ANALYZE_UNLOCK_ACKNOWLEDGED_KEY) === 'true';
  });
  const [isExpanded, setIsExpanded] = useState(false);

  // Only render for computed users
  if (!isComputed) {
    return null;
  }

  const handleAcknowledge = () => {
    localStorage.setItem(ANALYZE_UNLOCK_ACKNOWLEDGED_KEY, 'true');
    setHasAcknowledged(true);
  };

  // Collapsed status chip after acknowledgment
  if (hasAcknowledged) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              System Status: Analyze Mode Active
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-emerald-600" />
          )}
        </button>
        
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-700">
            <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
              <p>
                Core314 has completed initial system calibration.
              </p>
              <p>
                Your connected integrations have produced sufficient behavioral signals for Core314 to begin computing real efficiency scores and system relationships.
              </p>
              <p>
                At this stage, intelligence is directional and confidence-weighted — not final. Core314 will continue observing and refining understanding as activity increases.
              </p>
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-700">
                <p className="font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Core314 will now explain what it sees, not what you should do.
                </p>
                <p>
                  Predictive insights and optimization actions unlock only after sustained observation confirms system stability. This prevents premature recommendations and preserves decision integrity.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full banner on first view (dismissible)
  return (
    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6">
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          System Intelligence Activated
        </h3>
      </div>
      
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mb-6">
        <p>
          Core314 has accumulated sufficient stable data to begin reliable analysis. Intelligence panels now reflect real system behavior rather than baseline observation.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleAcknowledge}
          className="text-slate-600 hover:text-slate-800"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
