import { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { user } = useAuth();
  const { subscription, hasFeature } = useSubscription(user?.id);
  const navigate = useNavigate();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
      <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Upgrade Required
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
        This feature is not available in your current {subscription.tier} plan.
      </p>
      <Button onClick={() => navigate('/pricing')}>
        View Pricing Plans
      </Button>
    </div>
  );
}
