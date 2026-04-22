import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useBetaLifecycleTracker
 *
 * Automatically records the first login (and increments login count) for
 * approved beta testers. Calls the `record_beta_first_login` Postgres function
 * which handles:
 * - First login: sets first_login_at, transitions to 'active', sets total_logins=1
 * - Subsequent logins: increments total_logins and updates last_activity_at
 *
 * This hook should be included in the main authenticated layout so it fires
 * once per session load for every authenticated user.
 */
export function useBetaLifecycleTracker(userId: string | undefined, betaStatus: string | undefined) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!userId || betaStatus !== 'approved' || trackedRef.current) return;
    trackedRef.current = true;

    const trackLogin = async () => {
      try {
        const { data, error } = await supabase.rpc('record_beta_first_login', {
          p_user_id: userId,
        });

        if (error) {
          // Not a critical error — the user might not have a lifecycle record yet
          console.debug('[BETA-LIFECYCLE] Track login skipped:', error.message);
          return;
        }

        if (data?.success) {
          console.log('[BETA-LIFECYCLE] Login tracked:', data.action, data.day !== undefined ? `(Day ${data.day})` : '');
        }
      } catch (err) {
        // Silent fail — this is a background tracking operation
        console.debug('[BETA-LIFECYCLE] Track login error:', err);
      }
    };

    trackLogin();
  }, [userId, betaStatus]);
}
