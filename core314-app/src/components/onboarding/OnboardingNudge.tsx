import { Link } from 'react-router-dom';
import { ArrowRight, Zap, X } from 'lucide-react';
import { useState } from 'react';

interface OnboardingNudgeProps {
  /** Which step to nudge toward */
  type: 'connect-integration' | 'generate-brief' | 'review-signals';
  /** Whether the nudge should be shown */
  show: boolean;
}

const NUDGE_CONFIG = {
  'connect-integration': {
    message: 'Connect your first integration to start generating operational insights',
    cta: 'Connect Integration',
    route: '/integration-manager',
    icon: Zap,
    color: 'border-sky-200 dark:border-sky-800/50 bg-sky-50/80 dark:bg-sky-950/20',
    textColor: 'text-sky-800 dark:text-sky-200',
    ctaColor: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  'generate-brief': {
    message: 'Your integration is connected! Generate your first Operational Brief to see AI-powered insights',
    cta: 'Generate Brief',
    route: '/brief',
    icon: Zap,
    color: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20',
    textColor: 'text-amber-800 dark:text-amber-200',
    ctaColor: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  'review-signals': {
    message: 'Your brief is ready! Review your detected signals to complete onboarding',
    cta: 'View Signals',
    route: '/signals',
    icon: Zap,
    color: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/20',
    textColor: 'text-emerald-800 dark:text-emerald-200',
    ctaColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
};

export function OnboardingNudge({ type, show }: OnboardingNudgeProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  const config = NUDGE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.color} px-4 py-3 flex items-center gap-3`}>
      <div className="flex-shrink-0">
        <Icon className={`h-4 w-4 ${config.textColor}`} />
      </div>
      <p className={`text-sm font-medium flex-1 ${config.textColor}`}>
        {config.message}
      </p>
      <Link to={config.route}>
        <button className={`text-xs font-semibold px-3 py-1.5 rounded-md ${config.ctaColor} flex items-center gap-1 whitespace-nowrap`}>
          {config.cta}
          <ArrowRight className="h-3 w-3" />
        </button>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-slate-400" />
      </button>
    </div>
  );
}
