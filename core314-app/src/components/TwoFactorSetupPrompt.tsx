import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Shield, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// =============================================================================
// TWO-FACTOR AUTHENTICATION SETUP PROMPT
// Shows a dismissible banner prompting users to enable 2FA for account security.
// Appears after 7 days of account creation, dismissible via localStorage.
// =============================================================================

const TWO_FA_STORAGE_KEY = 'core314-2fa-prompt-dismissed';
const TWO_FA_MIN_DAYS = 7;

export function TwoFactorSetupPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Don't show if already dismissed
    const dismissed = localStorage.getItem(TWO_FA_STORAGE_KEY);
    if (dismissed) return;

    // Check if user account is old enough
    const createdAt = new Date(user.created_at);
    const daysSinceCreation = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation >= TWO_FA_MIN_DAYS) {
      setVisible(true);
    }
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(
      TWO_FA_STORAGE_KEY,
      JSON.stringify({ dismissed_at: new Date().toISOString() })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-6 mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Secure your account with two-factor authentication
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Add an extra layer of protection to prevent unauthorized access to your operational intelligence.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
          asChild
        >
          <Link to="/settings/security">
            <ExternalLink className="h-3 w-3 mr-1" />
            Enable 2FA
          </Link>
        </Button>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
