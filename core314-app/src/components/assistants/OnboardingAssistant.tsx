import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Welcome to Core314',
    description: 'Your AI-powered operations control platform',
    content: 'Core314 unifies your workflows across multiple systems, giving you real-time visibility, predictive insights, and operational control. Let\'s get you set up!',
  },
  {
    step: 2,
    title: 'Connect Your Integrations',
    description: 'Link your tools and systems',
    content: 'Connect Slack, Teams, Gmail, or other integrations to start unifying your operations. You can add more integrations anytime from the Integration Hub.',
    action: 'Go to Integration Hub',
    actionLink: '/integration-hub',
  },
  {
    step: 3,
    title: 'Explore Your Dashboard',
    description: 'Visualize your metrics',
    content: 'Your dashboard automatically generates insights as integrations ingest data. Core314 surfaces the metrics that matter most to your team with AI-powered recommendations.',
    action: 'View Dashboard',
    actionLink: '/dashboard',
  },
  {
    step: 4,
    title: 'Set Up Alerts & Notifications',
    description: 'Stay informed automatically',
    content: 'Configure smart alerts to notify you about important events, anomalies, or milestones. Core314 can proactively alert you before issues arise.',
    action: 'Configure Notifications',
    actionLink: '/notifications',
  },
  {
    step: 5,
    title: 'Setup Complete!',
    description: 'You\'re ready to go',
    content: 'Your Core314 platform is configured and ready to help you control your operations. Explore the features and let AI-powered insights guide your decisions.',
  },
];

export function OnboardingAssistant() {
  const { isOpen, currentStep, completeStep, skipOnboarding, closeOnboarding } = useOnboarding();

  const currentStepData = ONBOARDING_STEPS.find(s => s.step === currentStep);
  const progress = ((currentStep - 1) / 5) * 100;

  const handleNext = async () => {
    await completeStep(currentStep);
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  if (!currentStepData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleSkip}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6" />
                  <h2 className="text-2xl font-bold">Core314 Setup</h2>
                </div>
                <button
                  onClick={handleSkip}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Step {currentStep} of 5</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {currentStepData.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {currentStepData.description}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentStepData.content}
                </p>
              </div>

              <div className="flex gap-3">
                {currentStepData.action && currentStepData.actionLink && (
                  <Button
                    onClick={() => {
                      window.location.href = currentStepData.actionLink!;
                      closeOnboarding();
                    }}
                    className="flex-1"
                  >
                    {currentStepData.action}
                  </Button>
                )}
                
                <Button
                  onClick={handleNext}
                  variant={currentStepData.action ? 'outline' : 'default'}
                  className="flex-1"
                >
                  {currentStep === 5 ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {currentStep < 5 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                >
                  Skip setup for now
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
