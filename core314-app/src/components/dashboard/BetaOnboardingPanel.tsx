import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sparkles, X, ArrowRight, ExternalLink } from 'lucide-react';

/**
 * Beta Onboarding Panel
 * 
 * A lightweight, non-blocking welcome panel shown ONLY on first login.
 * Clarifies Core314's purpose and next steps during beta.
 * 
 * Behavior:
 * - Non-modal, dismissible
 * - Remembers dismissal using localStorage
 * - Shows only when user has no connected integrations (first-time users)
 * 
 * NO walkthroughs, NO tours, NO blocking navigation.
 * NO modifications to existing routes or permissions.
 */

const BETA_ONBOARDING_DISMISSED_KEY = 'core314_beta_onboarding_dismissed';

interface BetaOnboardingPanelProps {
  hasConnectedIntegrations: boolean;
}

export function BetaOnboardingPanel({ hasConnectedIntegrations }: BetaOnboardingPanelProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(BETA_ONBOARDING_DISMISSED_KEY) === 'true';
  });

  // Don't show if:
  // 1. Already dismissed
  // 2. User already has connected integrations (not first-time)
  if (isDismissed || hasConnectedIntegrations) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(BETA_ONBOARDING_DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 relative">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
        aria-label="Dismiss welcome panel"
      >
        <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pr-8">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Welcome to Core314 (Beta)
        </h3>
      </div>

      {/* Body content */}
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mb-6">
        <p>
          Core314 continuously observes your connected systems, analyzes operational signals, and—when confidence is high—provides predictive insights to help you act earlier and smarter.
        </p>
        <p>
          During beta, you'll see how your system progresses from <span className="font-medium text-slate-800 dark:text-slate-200">Observe</span> → <span className="font-medium text-slate-800 dark:text-slate-200">Analyze</span> → <span className="font-medium text-slate-800 dark:text-slate-200">Predict</span> as more data is collected.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/integration-hub">
          <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
            Connect your first integration
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
        <Link 
          to="/how-it-works" 
          target="_blank"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          Learn how Core314 works
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Predictions are advisory and improve over time as patterns stabilize.
        </p>
      </div>
    </div>
  );
}
