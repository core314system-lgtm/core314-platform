import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../hooks/useAuth';


interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  currentCount?: number;
  maxCount?: number;
}

export function UpgradeModal({ open, onOpenChange, currentTier = 'current', currentCount = 0, maxCount = 0 }: UpgradeModalProps) {
  const { user } = useAuth();

  const handleUpgrade = async () => {
    try {
      await createCheckoutSession({
        priceId: import.meta.env.VITE_STRIPE_PRICE_INTEGRATION_ADDON,
        email: user?.email,
        metadata: { type: 'integration_addon' },
      });
    } catch (error) {
      console.error('Upgrade error:', error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {maxCount > 0 ? 'Integration Limit Reached' : 'Upgrade Required'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {maxCount > 0 ? (
              <>
                You've reached your integration limit ({currentCount}/{maxCount}) for the {currentTier} plan.
                Upgrade your plan or add an integration add-on to connect more services.
              </>
            ) : (
              <>
                This feature is not available in your {currentTier} plan.
                Upgrade your plan to unlock this feature.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade}>
            Upgrade Plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
