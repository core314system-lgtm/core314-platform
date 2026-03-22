import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  currentCount?: number;
  maxCount?: number;
}

export function UpgradeModal({ open, onOpenChange, currentTier = 'current', currentCount = 0, maxCount = 0 }: UpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    // Redirect to pricing page where user can select a plan
    navigate('/pricing');
    onOpenChange(false);
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
