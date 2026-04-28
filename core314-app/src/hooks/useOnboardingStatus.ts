import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  isComplete: boolean;
  route: string;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  isComplete: boolean;
  hasConnectedIntegration: boolean;
  hasGeneratedBrief: boolean;
  hasReviewedSignals: boolean;
  isFirstLogin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  markSignalsReviewed: () => void;
  markBriefViewed: () => void;
  dismissWalkthrough: () => void;
  isWalkthroughDismissed: boolean;
  // Stricter state flags
  onboardingStarted: boolean;
  currentStep: number; // 0=not started, 1=connect, 2=brief, 3=signals
  onboardingComplete: boolean;
  isBriefHighlightsDismissed: boolean;
  markBriefHighlightsDismissed: () => void;
  // Server-side activation state
  activationStatus: 'signed_up' | 'integrating' | 'activated' | 'fully_onboarded' | null;
  userType: 'beta_tester' | 'trial_user' | 'paid' | null;
  integrationCount: number;
}

// localStorage keys — retained for UI-only state (dismissals)
const WALKTHROUGH_DISMISSED_KEY = 'core314_walkthrough_dismissed';
const FIRST_LOGIN_KEY = 'core314_first_login_seen';
const ONBOARDING_STARTED_KEY = 'core314_onboarding_started';
const BRIEF_HIGHLIGHTS_DISMISSED_KEY = 'core314_brief_highlights_dismissed';

export function useOnboardingStatus(): OnboardingStatus {
  const { user, profile } = useAuth();
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  const [hasGeneratedBrief, setHasGeneratedBrief] = useState(false);
  const [hasReviewedSignals, setHasReviewedSignals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activationStatus, setActivationStatus] = useState<'signed_up' | 'integrating' | 'activated' | 'fully_onboarded' | null>(null);
  const [userType, setUserType] = useState<'beta_tester' | 'trial_user' | 'paid' | null>(null);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [isWalkthroughDismissed, setIsWalkthroughDismissed] = useState(() => {
    return localStorage.getItem(WALKTHROUGH_DISMISSED_KEY) === 'true';
  });
  const [onboardingStarted, setOnboardingStarted] = useState(() => {
    return localStorage.getItem(ONBOARDING_STARTED_KEY) === 'true';
  });
  const [isBriefHighlightsDismissed, setIsBriefHighlightsDismissed] = useState(() => {
    return localStorage.getItem(BRIEF_HIGHLIGHTS_DISMISSED_KEY) === 'true';
  });

  // First login detection: true only if user has no briefs AND has never seen the walkthrough
  // This is primarily driven by real data (hasGeneratedBrief), not localStorage alone
  const isFirstLogin = !isWalkthroughDismissed && !localStorage.getItem(FIRST_LOGIN_KEY);

  const checkStatus = useCallback(async () => {
    if (!user || !profile?.id) {
      setLoading(false);
      return;
    }

    try {
      // Primary source: server-side activation state
      const { data: serverState, error: serverError } = await supabase
        .rpc('get_activation_state', { p_user_id: profile.id });

      if (!serverError && serverState && serverState.found) {
        // Use server-side activation state as source of truth
        const hasIntegrations = (serverState.integration_count ?? 0) > 0;
        const hasBriefs = serverState.first_brief_at !== null;
        const hasSignals = serverState.first_signal_review_at !== null;

        setHasConnectedIntegration(hasIntegrations);
        setHasGeneratedBrief(hasBriefs);
        setHasReviewedSignals(hasSignals && hasBriefs);
        setActivationStatus(serverState.activation_status);
        setUserType(serverState.user_type);
        setIntegrationCount(serverState.integration_count ?? 0);
      } else {
        // Fallback: query tables directly (activation state row may not exist yet)
        console.debug('[useOnboardingStatus] Server state not found, falling back to direct queries');

        const { data: integrations } = await supabase
          .from('user_integrations')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .eq('added_by_user', true)
          .limit(1);

        const hasIntegrations = (integrations?.length ?? 0) > 0;
        setHasConnectedIntegration(hasIntegrations);

        const { data: briefs } = await supabase
          .from('operational_briefs')
          .select('id')
          .eq('user_id', profile.id)
          .limit(1);

        const hasBriefs = (briefs?.length ?? 0) > 0;
        setHasGeneratedBrief(hasBriefs);
        setHasReviewedSignals(false);
        setActivationStatus(
          hasBriefs ? 'activated' : hasIntegrations ? 'integrating' : 'signed_up'
        );
        setUserType(null);
        setIntegrationCount(hasIntegrations ? 1 : 0);
      }

      // Mark first login as seen
      if (!localStorage.getItem(FIRST_LOGIN_KEY)) {
        localStorage.setItem(FIRST_LOGIN_KEY, 'true');
      }

      // Mark onboarding as started on first page load
      if (!localStorage.getItem(ONBOARDING_STARTED_KEY)) {
        localStorage.setItem(ONBOARDING_STARTED_KEY, 'true');
        setOnboardingStarted(true);
      }
    } catch (err) {
      console.error('[useOnboardingStatus] Error checking status:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const markSignalsReviewed = useCallback(async () => {
    setHasReviewedSignals(true);
    // Persist to server via RPC
    if (profile?.id) {
      try {
        await supabase.rpc('mark_signals_reviewed', { p_user_id: profile.id });
      } catch (err) {
        console.debug('[useOnboardingStatus] Failed to persist signal review:', err);
      }
    }
  }, [profile?.id]);

  const markBriefViewed = useCallback(() => {
    // Brief generation is tracked by the DB trigger on operational_briefs insert.
    // This function is kept for backward compatibility but now just refreshes state.
    setHasGeneratedBrief(true);
  }, []);

  const dismissWalkthrough = useCallback(() => {
    localStorage.setItem(WALKTHROUGH_DISMISSED_KEY, 'true');
    setIsWalkthroughDismissed(true);
  }, []);

  const markBriefHighlightsDismissed = useCallback(() => {
    localStorage.setItem(BRIEF_HIGHLIGHTS_DISMISSED_KEY, 'true');
    setIsBriefHighlightsDismissed(true);
  }, []);

  const steps: OnboardingStep[] = [
    {
      id: 'connect-integration',
      label: 'Connect your first integration',
      description: 'Link Slack, HubSpot, or QuickBooks to start collecting signals',
      isComplete: hasConnectedIntegration,
      route: '/integration-manager',
    },
    {
      id: 'generate-brief',
      label: 'Generate your first Operational Brief',
      description: 'AI-powered analysis of your business operations',
      isComplete: hasGeneratedBrief,
      route: '/brief',
    },
    {
      id: 'review-signals',
      label: 'Review detected signals',
      description: 'See operational patterns detected across your integrations',
      isComplete: hasReviewedSignals,
      route: '/signals',
    },
  ];

  const completedCount = steps.filter(s => s.isComplete).length;
  // Onboarding is complete once user has at least one brief (real data, not localStorage)
  // This ensures onboarding NEVER reappears once a brief exists
  const isComplete = hasGeneratedBrief || completedCount === steps.length;

  // Derive current step number: 0=not started, 1=connect, 2=brief, 3=signals
  const currentStep = !hasConnectedIntegration ? 1 : !hasGeneratedBrief ? 2 : !hasReviewedSignals ? 3 : 3;
  const onboardingComplete = isComplete;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isComplete,
    hasConnectedIntegration,
    hasGeneratedBrief,
    hasReviewedSignals,
    isFirstLogin,
    loading,
    refresh: checkStatus,
    markSignalsReviewed,
    markBriefViewed,
    dismissWalkthrough,
    isWalkthroughDismissed,
    onboardingStarted,
    currentStep,
    onboardingComplete,
    isBriefHighlightsDismissed,
    markBriefHighlightsDismissed,
    // Server-side activation state
    activationStatus,
    userType,
    integrationCount,
  };
}
