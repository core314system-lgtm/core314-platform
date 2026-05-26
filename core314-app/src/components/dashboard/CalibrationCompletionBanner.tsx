import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sparkles } from 'lucide-react';

/**
 * Calibration Completion Banner - Observe Tier Only
 * 
 * Shows a non-blocking banner for Observe-tier users when they are
 * approaching full calibration (based on existing timestamps).
 * 
 * Trigger conditions (deterministic, using existing data):
 * - X days since first integration OR
 * - X integration events observed
 * 
 * This is a UX + copy + frontend-only component.
 * NO backend changes. NO AI calls. NO execution-mode logic touched.
 * NO forced modal. NO countdown timers.
 */

interface CalibrationCompletionBannerProps {
  firstIntegrationDate?: string | null;
  integrationCount: number;
}

// Threshold: Show banner after 7 days since first integration
const DAYS_THRESHOLD = 7;
// Threshold: Show banner if user has 2+ integrations
const INTEGRATION_COUNT_THRESHOLD = 2;

export function CalibrationCompletionBanner({ 
  firstIntegrationDate, 
  integrationCount 
}: CalibrationCompletionBannerProps) {
  // Determine if banner should show based on deterministic conditions
  let shouldShow = false;

  // Condition 1: Days since first integration
  if (firstIntegrationDate) {
    const firstDate = new Date(firstIntegrationDate);
    const now = new Date();
    const daysSinceFirst = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceFirst >= DAYS_THRESHOLD) {
      shouldShow = true;
    }
  }

  // Condition 2: Integration count threshold
  if (integrationCount >= INTEGRATION_COUNT_THRESHOLD) {
    shouldShow = true;
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">
              Your system is approaching full calibration.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Activate Analyze to begin real-time intelligence.
            </p>
          </div>
        </div>
        <Link to="/account/plan">
          <Button variant="default" size="sm" className="bg-sky-600 hover:bg-sky-700">
            Activate Analyze
          </Button>
        </Link>
      </div>
    </div>
  );
}
