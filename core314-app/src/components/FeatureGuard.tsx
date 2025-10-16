import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from './UpgradeModal';
import { useState } from 'react';

interface FeatureGuardProps {
  children: React.ReactNode;
  feature: string;
  fallback?: React.ReactNode;
}

export function FeatureGuard({ children, feature, fallback }: FeatureGuardProps) {
  const { user } = useAuth();
  const { hasFeature } = useSubscription(user?.id);
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!hasFeature(feature)) {
    return fallback || (
      <>
        <div className="p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This feature is not available in your current plan.
          </p>
          <button 
            onClick={() => setShowUpgrade(true)}
            className="text-blue-600 hover:underline"
          >
            Upgrade to unlock
          </button>
        </div>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  return <>{children}</>;
}
