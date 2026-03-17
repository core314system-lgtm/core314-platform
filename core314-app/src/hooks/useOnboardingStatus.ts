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
}

const WALKTHROUGH_DISMISSED_KEY = 'core314_walkthrough_dismissed';
const SIGNALS_REVIEWED_KEY = 'core314_signals_reviewed';
const BRIEF_VIEWED_KEY = 'core314_brief_viewed';
const FIRST_LOGIN_KEY = 'core314_first_login_seen';
const ONBOARDING_STARTED_KEY = 'core314_onboarding_started';
const BRIEF_HIGHLIGHTS_DISMISSED_KEY = 'core314_brief_highlights_dismissed';

export function useOnboardingStatus(): OnboardingStatus {
  const { user, profile } = useAuth();
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  const [hasGeneratedBrief, setHasGeneratedBrief] = useState(false);
  const [hasReviewedSignals, setHasReviewedSignals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isWalkthroughDismissed, setIsWalkthroughDismissed] = useState(() => {
    return localStorage.getItem(WALKTHROUGH_DISMISSED_KEY) === 'true';
  });
  const [onboardingStarted, setOnboardingStarted] = useState(() => {
    return localStorage.getItem(ONBOARDING_STARTED_KEY) === 'true';
  });
  const [isBriefHighlightsDismissed, setIsBriefHighlightsDismissed] = useState(() => {
    return localStorage.getItem(BRIEF_HIGHLIGHTS_DISMISSED_KEY) === 'true';
  });

  // First login detection: true if user has never seen the walkthrough before
  const isFirstLogin = !isWalkthroughDismissed && !localStorage.getItem(FIRST_LOGIN_KEY);

  const checkStatus = useCallback(async () => {
    if (!user || !profile?.id) {
      setLoading(false);
      return;
    }

    try {
      // Check for connected integrations (real connections only)
      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('id')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .eq('added_by_user', true)
        .limit(1);

      const hasIntegrations = (integrations?.length ?? 0) > 0;
      setHasConnectedIntegration(hasIntegrations);

      // Check for generated briefs
      const { data: briefs } = await supabase
        .from('operational_briefs')
        .select('id')
        .eq('user_id', profile.id)
        .limit(1);

      const hasBriefs = (briefs?.length ?? 0) > 0;
      setHasGeneratedBrief(hasBriefs);

      // Check signals reviewed (localStorage — set when user visits signals page)
      const signalsReviewed = localStorage.getItem(SIGNALS_REVIEWED_KEY) === 'true';
      // Only count as reviewed if they actually have briefs/signals to review
      setHasReviewedSignals(signalsReviewed && hasBriefs);

      // If brief was viewed in localStorage and briefs exist, mark it
      const briefViewed = localStorage.getItem(BRIEF_VIEWED_KEY) === 'true';
      if (briefViewed && hasBriefs) {
        setHasGeneratedBrief(true);
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

  const markSignalsReviewed = useCallback(() => {
    localStorage.setItem(SIGNALS_REVIEWED_KEY, 'true');
    setHasReviewedSignals(true);
  }, []);

  const markBriefViewed = useCallback(() => {
    localStorage.setItem(BRIEF_VIEWED_KEY, 'true');
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
  const isComplete = completedCount === steps.length;

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
  };
}
