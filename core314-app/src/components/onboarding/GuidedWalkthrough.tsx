import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { ArrowRight, X, Layers, Zap } from 'lucide-react';

interface WalkthroughStep {
  title: string;
  description: string;
  targetSelector: string;
  icon: typeof Zap;
  action?: { label: string; route: string };
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: 'Welcome to Core314',
    description: 'Core314 analyzes your connected business tools to generate operational intelligence. Let\'s get you set up in just a few steps.',
    targetSelector: '',
    icon: Zap,
  },
  {
    title: 'Connect Your Integrations',
    description: 'Start by connecting at least one integration like Slack, HubSpot, or QuickBooks. This enables Core314 to collect operational signals from your tools.',
    targetSelector: 'a[href="/integration-manager"]',
    icon: Layers,
    action: { label: 'Go to Integrations', route: '/integration-manager' },
  },
];

interface GuidedWalkthroughProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function GuidedWalkthrough({ isVisible, onDismiss }: GuidedWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const step = WALKTHROUGH_STEPS[currentStep];
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpotlightRect(rect);
        // Scroll element into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setSpotlightRect(null);
      }
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, isVisible]);

  if (!isVisible) return null;

  const step = WALKTHROUGH_STEPS[currentStep];
  const isLastStep = currentStep === WALKTHROUGH_STEPS.length - 1;
  const StepIcon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      if (step.action) {
        navigate(step.action.route);
      }
      onDismiss();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onDismiss();
  };

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      // Center on screen for welcome step
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10002,
      };
    }

    // Position to the right of the spotlight element
    const tooltipLeft = spotlightRect.right + 16;
    const tooltipTop = spotlightRect.top;

    return {
      position: 'fixed',
      top: `${tooltipTop}px`,
      left: `${tooltipLeft}px`,
      zIndex: 10002,
    };
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[10000] transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          // SVG-based mask for spotlight cutout
          ...(spotlightRect ? {
            maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${spotlightRect.left - 6}' y='${spotlightRect.top - 6}' width='${spotlightRect.width + 12}' height='${spotlightRect.height + 12}' rx='8' fill='black'/%3E%3C/svg%3E")`,
            WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${spotlightRect.left - 6}' y='${spotlightRect.top - 6}' width='${spotlightRect.width + 12}' height='${spotlightRect.height + 12}' rx='8' fill='black'/%3E%3C/svg%3E")`,
          } : {}),
        }}
        onClick={handleSkip}
      />

      {/* Spotlight ring highlight */}
      {spotlightRect && (
        <div
          className="fixed z-[10001] rounded-lg ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent pointer-events-none animate-pulse"
          style={{
            top: spotlightRect.top - 6,
            left: spotlightRect.left - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={getTooltipStyle()} className="max-w-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Skip walkthrough"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {WALKTHROUGH_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-sky-500'
                    : i < currentStep
                    ? 'w-3 bg-sky-300'
                    : 'w-3 bg-slate-200 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Icon + Title */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <StepIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              {step.title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip tour
            </button>
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isLastStep ? (step.action?.label || 'Get Started') : 'Next'}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
