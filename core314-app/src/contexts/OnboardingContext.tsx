import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserOnboardingProgress } from '../types';
import { toast } from 'sonner';

interface OnboardingContextType {
  isOpen: boolean;
  currentStep: number;
  progress: UserOnboardingProgress | null;
  loading: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  completeStep: (stepNumber: number) => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState<UserOnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      checkOnboardingStatus();
    } else {
      setLoading(false);
    }
  }, [user?.id, profile?.onboarding_status]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      console.log('[OnboardingContext] checkOnboardingStatus started', { userId: user.id });
      
      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[OnboardingContext] Failed to fetch profile:', profileError);
        throw profileError;
      }

      console.log('[OnboardingContext] Fresh profile fetched', { 
        onboarding_status: freshProfile?.onboarding_status 
      });

      if (freshProfile?.onboarding_status === 'not_started') {
        setIsOpen(true);
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      if (freshProfile?.onboarding_status === 'completed') {
        setIsOpen(false);
        setLoading(false);
        return;
      }

      const { data: progressData } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('[OnboardingContext] Progress data fetched', progressData);

      if (progressData) {
        setProgress(progressData);
        setCurrentStep(progressData.current_step);
        setIsOpen(freshProfile?.onboarding_status === 'in_progress');
      } else {
        setCurrentStep(1);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to check onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepNumber: number) => {
    if (!user) {
      console.error('[OnboardingContext] completeStep called without user');
      return;
    }

    console.log('[OnboardingContext] completeStep started', { 
      stepNumber, 
      userId: user.id 
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[OnboardingContext] No session found');
        toast.error('Please log in again to continue.');
        return;
      }

      const requestPayload = { step_number: stepNumber };
      console.log('[OnboardingContext] Sending API request', {
        url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-complete-step`,
        payload: requestPayload,
        userId: user.id,
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-complete-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(requestPayload),
        }
      );

      console.log('[OnboardingContext] API response received', { 
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      const data = await response.json();
      console.log('[OnboardingContext] API response data', data);

      if (data.success) {
        console.log('[OnboardingContext] Step completed successfully, updating state');
        if (stepNumber === 5) {
          setIsOpen(false);
          toast.success('Welcome to Core314! Your setup is complete.');
        } else {
          const nextStep = stepNumber + 1;
          console.log('[OnboardingContext] Moving to next step', { nextStep });
          setCurrentStep(nextStep);
          toast.success(`Step ${stepNumber} complete!`);
        }
        console.log('[OnboardingContext] Refreshing onboarding status');
        await checkOnboardingStatus();
      } else {
        console.error('[OnboardingContext] API returned failure', data);
        toast.error(data.error || 'Failed to save progress. Please try again.');
      }
    } catch (error) {
      console.error('[OnboardingContext] Exception in completeStep:', error);
      toast.error('Failed to save progress. Please try again.');
    }
  };

  const skipOnboarding = async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_status: 'completed' })
        .eq('id', user.id);

      setIsOpen(false);
      toast.info('You can restart onboarding from your profile settings.');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };

  const openOnboarding = () => setIsOpen(true);
  const closeOnboarding = () => setIsOpen(false);

  return (
    <OnboardingContext.Provider
      value={{
        isOpen,
        currentStep,
        progress,
        loading,
        openOnboarding,
        closeOnboarding,
        completeStep,
        skipOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
