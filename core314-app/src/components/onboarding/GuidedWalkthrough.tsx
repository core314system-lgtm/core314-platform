import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { ArrowRight, X, Layers, Zap } from 'lucide-react';

interface WalkthroughStep {
  title: string;
  subtitle: string;
  description: string;
  targetSelector: string;
  icon: typeof Zap;
  action?: { label: string; route: string };
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "Let's generate your first Operational Insight",
    subtitle: 'Welcome to Core314',
    description: 'Start by connecting a data source. Core314 will automatically analyze your tools and generate intelligence within minutes.',
    targetSelector: 'a[href="/integration-manager"]',
    icon: Zap,
    action: { label: 'Go to Integrations', route: '/integration-manager' },
  },
  {
    title: 'Connect your first integration to begin analysis',
    subtitle: 'Choose an integration',
    description: 'Connect Slack, HubSpot, or QuickBooks to start collecting operational signals. Core314 will automatically generate your first brief once connected.',
    targetSelector: '[data-onboarding="primary-integration"]',
    icon: Layers,
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
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateSpotlight = useCallback(() => {
    if (!isVisible) return;
    const step = WALKTHROUGH_STEPS[currentStep];
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpotlightRect(rect);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setSpotlightRect(null);
      }
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, isVisible]);

  useEffect(() => {
    updateSpotlight();
    // Re-check after a short delay for elements that render async
    const timer = setTimeout(updateSpotlight, 500);
    return () => clearTimeout(timer);
  }, [updateSpotlight, location.pathname]);

  if (!isVisible) return null;

  const step = WALKTHROUGH_STEPS[currentStep];
  const isLastStep = currentStep === WALKTHROUGH_STEPS.length - 1;
  const StepIcon = step.icon;

  const handleNext = () => {
    if (step.action) {
      navigate(step.action.route);
    }
    if (isLastStep) {
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

    // Position to the right of the spotlight element, or below if not enough space
    const spaceRight = window.innerWidth - spotlightRect.right;
    const tooltipWidth = 360;

    if (spaceRight > tooltipWidth + 24) {
      return {
        position: 'fixed',
        top: `${Math.max(16, spotlightRect.top)}px`,
        left: `${spotlightRect.right + 16}px`,
        zIndex: 10002,
        maxWidth: `${tooltipWidth}px`,
      };
    }
    return {
      position: 'fixed',
      top: `${spotlightRect.bottom + 16}px`,
      left: `${Math.max(16, spotlightRect.left)}px`,
      zIndex: 10002,
      maxWidth: `${tooltipWidth}px`,
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
            maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${spotlightRect.left - 8}' y='${spotlightRect.top - 8}' width='${spotlightRect.width + 16}' height='${spotlightRect.height + 16}' rx='10' fill='black'/%3E%3C/svg%3E")`,
            WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${window.innerWidth}' height='${window.innerHeight}'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${spotlightRect.left - 8}' y='${spotlightRect.top - 8}' width='${spotlightRect.width + 16}' height='${spotlightRect.height + 16}' rx='10' fill='black'/%3E%3C/svg%3E")`,
          } : {}),
        }}
        onClick={handleSkip}
      />

      {/* Spotlight ring highlight */}
      {spotlightRect && (
        <div
          className="fixed z-[10001] rounded-xl ring-2 ring-sky-400 ring-offset-4 ring-offset-transparent pointer-events-none animate-pulse"
          style={{
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={getTooltipStyle()}>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
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
            <span className="text-xs text-slate-400 ml-2">
              Step {currentStep + 1} of {WALKTHROUGH_STEPS.length}
            </span>
          </div>

          {/* Subtitle */}
          <p className="text-xs text-sky-500 font-semibold uppercase tracking-wider mb-1">
            {step.subtitle}
          </p>

          {/* Icon + Title */}
          <div className="flex items-start gap-2.5 mb-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mt-0.5">
              <StepIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white leading-snug pr-6">
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
              {step.action?.label || (isLastStep ? 'Get Started' : 'Next')}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
