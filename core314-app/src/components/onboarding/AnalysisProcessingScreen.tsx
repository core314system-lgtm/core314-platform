import { useState, useEffect } from 'react';
import { Zap, Database, Activity, FileText, CheckCircle } from 'lucide-react';

interface ProcessingStep {
  label: string;
  icon: typeof Zap;
  duration: number; // ms to stay on this step
}

const PROCESSING_STEPS: ProcessingStep[] = [
  { label: 'Connecting data...', icon: Database, duration: 1200 },
  { label: 'Analyzing activity...', icon: Activity, duration: 1500 },
  { label: 'Detecting operational signals...', icon: Zap, duration: 1800 },
  { label: 'Generating your first Operational Brief...', icon: FileText, duration: 2000 },
];

interface AnalysisProcessingScreenProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export function AnalysisProcessingScreen({ isVisible, onComplete }: AnalysisProcessingScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState<boolean[]>(new Array(PROCESSING_STEPS.length).fill(false));

  useEffect(() => {
    if (!isVisible) {
      setCurrentStepIndex(0);
      setStepComplete(new Array(PROCESSING_STEPS.length).fill(false));
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const advanceStep = (index: number) => {
      if (index >= PROCESSING_STEPS.length) {
        // All steps complete
        onComplete?.();
        return;
      }

      setCurrentStepIndex(index);

      timeoutId = setTimeout(() => {
        setStepComplete(prev => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
        // Small delay before moving to next step
        timeoutId = setTimeout(() => advanceStep(index + 1), 300);
      }, PROCESSING_STEPS[index].duration);
    };

    advanceStep(0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Animated logo/icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Zap className="h-10 w-10 text-white" />
            </div>
            {/* Animated pulse ring */}
            <div className="absolute inset-0 rounded-2xl bg-sky-500/20 animate-ping" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Core314 is analyzing your data
        </h2>
        <p className="text-sm text-slate-400 text-center mb-10">
          This will only take a moment
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {PROCESSING_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStepIndex;
            const isDone = stepComplete[index];

            return (
              <div
                key={step.label}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-500 ${
                  isActive
                    ? 'bg-white/10 scale-[1.02]'
                    : isDone
                    ? 'bg-white/5 opacity-60'
                    : 'opacity-30'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isDone
                    ? 'bg-green-500/20'
                    : isActive
                    ? 'bg-sky-500/20'
                    : 'bg-white/5'
                }`}>
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <StepIcon className={`h-5 w-5 ${
                      isActive ? 'text-sky-400 animate-pulse' : 'text-slate-500'
                    }`} />
                  )}
                </div>

                {/* Label */}
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  isDone
                    ? 'text-green-300'
                    : isActive
                    ? 'text-white'
                    : 'text-slate-500'
                }`}>
                  {step.label}
                </span>

                {/* Active indicator */}
                {isActive && !isDone && (
                  <div className="ml-auto flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${((stepComplete.filter(Boolean).length) / PROCESSING_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
