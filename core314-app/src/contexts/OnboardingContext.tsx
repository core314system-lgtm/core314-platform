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
      if (profile?.onboarding_status === 'not_started') {
        setIsOpen(true);
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      if (profile?.onboarding_status === 'completed') {
        setIsOpen(false);
        setLoading(false);
        return;
      }

      const { data: progressData } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (progressData) {
        setProgress(progressData);
        setCurrentStep(progressData.current_step);
        setIsOpen(profile?.onboarding_status === 'in_progress');
      } else {
        setCurrentStep(1);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepNumber: number) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-complete-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ step_number: stepNumber }),
        }
      );

      const data = await response.json();

      if (data.success) {
        if (stepNumber === 5) {
          setIsOpen(false);
          toast.success('Welcome to Core314! Your setup is complete.');
        } else {
          setCurrentStep(stepNumber + 1);
          toast.success(`Step ${stepNumber} complete!`);
        }
        await checkOnboardingStatus();
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
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
