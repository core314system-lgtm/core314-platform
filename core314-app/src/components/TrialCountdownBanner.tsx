import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Clock, X } from 'lucide-react';

/**
 * TrialCountdownBanner
 * Shows a persistent banner at the top of the app for trial users,
 * counting down the days remaining in their 14-day trial.
 * Hidden for: paid users, beta testers, and users who dismiss it.
 */
export function TrialCountdownBanner() {
  const { profile } = useAuth();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchTrialInfo = async () => {
      // Check if user has active paid subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (sub) {
        setIsPaid(true);
        return;
      }

      // Get activation state to determine user type and signup date
      const { data: activation } = await supabase
        .from('user_activation_state')
        .select('user_type, signed_up_at')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!activation || activation.user_type !== 'trial_user') {
        // Beta testers and paid users don't see the countdown
        return;
      }

      const signupDate = new Date(activation.signed_up_at);
      const trialEndDate = new Date(signupDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const remaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      setDaysRemaining(remaining);
    };

    // Check local storage for dismissal
    const dismissKey = `trial-banner-dismissed-${profile.id}`;
    const dismissedAt = localStorage.getItem(dismissKey);
    if (dismissedAt) {
      // Re-show if dismissed more than 24 hours ago
      const dismissedTime = new Date(dismissedAt).getTime();
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    fetchTrialInfo();
  }, [profile?.id]);

  const handleDismiss = () => {
    setDismissed(true);
    if (profile?.id) {
      localStorage.setItem(`trial-banner-dismissed-${profile.id}`, new Date().toISOString());
    }
  };

  // Don't show if: no data yet, paid user, dismissed, or beta tester
  if (daysRemaining === null || isPaid || dismissed) return null;

  // Trial expired
  if (daysRemaining <= 0) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Clock className="h-4 w-4" />
          <span>
            Your trial has ended.{' '}
            <Link to="/billing" className="font-semibold underline hover:no-underline">
              Subscribe now
            </Link>{' '}
            to continue using Core314.
          </span>
        </div>
        <button onClick={handleDismiss} className="ml-4 hover:opacity-80">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Last 3 days — urgent
  if (daysRemaining <= 3) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Clock className="h-4 w-4" />
          <span>
            <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong> left in your trial.{' '}
            <Link to="/billing" className="font-semibold underline hover:no-underline">
              Subscribe now
            </Link>{' '}
            to keep your data and insights.
          </span>
        </div>
        <button onClick={handleDismiss} className="ml-4 hover:opacity-80">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Normal countdown (days 1-11)
  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 flex-1 justify-center">
        <Clock className="h-4 w-4" />
        <span>
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left in your free trial.{' '}
          <Link to="/billing" className="font-semibold underline hover:no-underline">
            View plans
          </Link>
        </span>
      </div>
      <button onClick={handleDismiss} className="ml-4 hover:opacity-80">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
