import { Link } from 'react-router-dom';
import { CheckCircle, Circle, Zap, FileText, Activity, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/button';
import { OnboardingStep } from '../../hooks/useOnboardingStatus';

interface OnboardingPanelProps {
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  isComplete: boolean;
  onDismiss?: () => void;
}

const STEP_ICONS: Record<string, typeof Zap> = {
  'connect-integration': Zap,
  'generate-brief': FileText,
  'review-signals': Activity,
};

export function OnboardingPanel({
  steps,
  completedCount,
  totalSteps,
  isComplete,
  onDismiss,
}: OnboardingPanelProps) {
  if (isComplete) return null;

  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800/50 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-indigo-950/20 p-6 relative shadow-sm">
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-sky-100 dark:hover:bg-sky-800/50 transition-colors"
          aria-label="Dismiss onboarding panel"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pr-8">
        <div className="flex-shrink-0 w-10 h-10 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center">
          <Zap className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            Get Started with Core314
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complete these steps to unlock your first operational insights
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {completedCount} of {totalSteps} complete
          </span>
          <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => {
          const StepIcon = STEP_ICONS[step.id] || Circle;
          const isNextStep = !step.isComplete && steps.findIndex(s => !s.isComplete) === steps.indexOf(step);

          return (
            <Link
              key={step.id}
              to={step.route}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all group ${
                step.isComplete
                  ? 'bg-green-50/60 dark:bg-green-900/10 border border-green-200/50 dark:border-green-800/30'
                  : isNextStep
                  ? 'bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-sky-700/50 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-600'
                  : 'bg-white/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30 hover:bg-white dark:hover:bg-slate-800/50'
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {step.isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isNextStep
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    <StepIcon className={`h-3 w-3 ${
                      isNextStep ? 'text-sky-500' : 'text-slate-400'
                    }`} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  step.isComplete
                    ? 'text-green-700 dark:text-green-300 line-through'
                    : isNextStep
                    ? 'text-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {step.label}
                </p>
                {!step.isComplete && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Arrow for next step */}
              {isNextStep && !step.isComplete && (
                <ArrowRight className="h-4 w-4 text-sky-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </div>

      {/* CTA for next step */}
      {completedCount < totalSteps && (
        <div className="mt-4 flex items-center gap-3">
          {(() => {
            const nextStep = steps.find(s => !s.isComplete);
            if (!nextStep) return null;
            return (
              <Link to={nextStep.route}>
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white">
                  {nextStep.id === 'connect-integration' && 'Connect Integration'}
                  {nextStep.id === 'generate-brief' && 'Generate Brief'}
                  {nextStep.id === 'review-signals' && 'View Signals'}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            );
          })()}
        </div>
      )}
    </div>
  );
}
