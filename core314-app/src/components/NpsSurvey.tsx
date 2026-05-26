import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { X, Star } from 'lucide-react';

// =============================================================================
// NPS SURVEY
// Shows an in-app Net Promoter Score survey after the user has been active
// for 14+ days. Appears once, results stored in nps_responses table.
// =============================================================================

const NPS_STORAGE_KEY = 'core314-nps-dismissed';
const NPS_MIN_DAYS = 14;

export function NpsSurvey() {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;

    // Don't show if already dismissed or submitted
    const dismissed = localStorage.getItem(NPS_STORAGE_KEY);
    if (dismissed) return;

    // Check if user account is old enough
    const createdAt = new Date(user.created_at);
    const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreation >= NPS_MIN_DAYS) {
      // Delay appearance by 30 seconds to not interrupt workflow
      const timer = setTimeout(() => setVisible(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  const handleDismiss = () => {
    localStorage.setItem(NPS_STORAGE_KEY, JSON.stringify({
      dismissed_at: new Date().toISOString(),
      action: 'dismissed',
    }));
    setVisible(false);
  };

  const handleSubmit = async () => {
    if (score === null || !user) return;
    setSubmitting(true);

    try {
      // Store NPS response
      await supabase.from('nps_responses').insert({
        user_id: user.id,
        score,
        feedback: feedback.trim() || null,
        created_at: new Date().toISOString(),
      });

      localStorage.setItem(NPS_STORAGE_KEY, JSON.stringify({
        dismissed_at: new Date().toISOString(),
        action: 'submitted',
        score,
      }));

      setSubmitted(true);
      setTimeout(() => setVisible(false), 3000);
    } catch (err) {
      console.error('NPS submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-6 animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>

      {submitted ? (
        <div className="text-center py-4">
          <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Thank you!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your feedback helps us improve Core314.
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            How likely are you to recommend Core314?
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            On a scale of 0-10, how likely are you to recommend Core314 to a colleague?
          </p>

          {/* Score selector */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  score === i
                    ? i <= 6
                      ? 'bg-red-500 text-white'
                      : i <= 8
                        ? 'bg-yellow-500 text-white'
                        : 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>

          {/* Optional feedback */}
          {score !== null && (
            <div className="mb-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  score <= 6
                    ? "What could we do better?"
                    : score <= 8
                      ? "What would make Core314 a 10?"
                      : "What do you love most about Core314?"
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 resize-none"
                rows={3}
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={score === null || submitting}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </>
      )}
    </div>
  );
}
