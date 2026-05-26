import { useState } from 'react';
import { X, Heart, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';

interface HighlightCallout {
  id: string;
  icon: typeof Heart;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const HIGHLIGHT_CALLOUTS: HighlightCallout[] = [
  {
    id: 'health-score',
    icon: Heart,
    title: 'Operational Health Score',
    description: 'This is your Operational Health Score — a real-time measure of how well your business operations are running based on signals from your connected tools.',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-200 dark:border-sky-800',
  },
  {
    id: 'detected-signals',
    icon: AlertTriangle,
    title: 'Detected Signals',
    description: "We've identified patterns and issues affecting your operations. These signals are automatically detected from your connected integrations.",
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    id: 'business-impact',
    icon: TrendingUp,
    title: 'Business Impact',
    description: 'This explains what these signals mean for your business — helping you understand the real-world consequences and prioritize actions.',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
];

const BRIEF_HIGHLIGHTS_DISMISSED_KEY = 'core314_brief_highlights_dismissed';

interface BriefHighlightsProps {
  show: boolean;
}

export function BriefHighlights({ show }: BriefHighlightsProps) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(BRIEF_HIGHLIGHTS_DISMISSED_KEY) === 'true';
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!show || dismissed) return null;

  const current = HIGHLIGHT_CALLOUTS[currentIndex];
  const isLast = currentIndex === HIGHLIGHT_CALLOUTS.length - 1;
  const Icon = current.icon;

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(BRIEF_HIGHLIGHTS_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className={`rounded-xl border ${current.borderColor} ${current.bgColor} p-5 relative animate-in fade-in slide-in-from-top-2 duration-300`}>
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Dismiss highlights"
      >
        <X className="h-4 w-4 text-slate-400" />
      </button>

      {/* Step indicators */}
      <div className="flex items-center gap-1.5 mb-3">
        {HIGHLIGHT_CALLOUTS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex
                ? `w-6 ${current.color.includes('sky') ? 'bg-sky-500' : current.color.includes('amber') ? 'bg-amber-500' : 'bg-blue-500'}`
                : i < currentIndex
                ? 'w-3 bg-slate-300 dark:bg-slate-600'
                : 'w-3 bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
        <span className="text-xs text-slate-400 ml-2">
          Understanding your brief
        </span>
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 pr-8">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${current.bgColor} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${current.color}`} />
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${current.color} mb-1`}>
            {current.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {current.description}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={handleDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Skip guide
        </button>
        <Button
          size="sm"
          onClick={handleNext}
          className={`${
            current.color.includes('sky')
              ? 'bg-sky-600 hover:bg-sky-700'
              : current.color.includes('amber')
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {isLast ? 'Got it!' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
