import { BetaEvent } from '../types/beta';
import { getSupabaseFunctionUrl } from '../lib/supabase';

class BetaTrackingService {
  private accessToken: string | null = null;
  private enabled: boolean = true;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async trackEvent(event: BetaEvent): Promise<void> {
    if (!this.enabled || !this.accessToken) {
      console.debug('[BetaTracking] Tracking disabled or no access token');
      return;
    }

    try {
      const url = await getSupabaseFunctionUrl('log-beta-event');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[BetaTracking] Failed to log event:', error);
      } else {
        console.debug('[BetaTracking] Event logged:', event.event_name);
      }
    } catch (error) {
      console.error('[BetaTracking] Error logging event:', error);
    }
  }
}

export const betaTrackingService = new BetaTrackingService();
