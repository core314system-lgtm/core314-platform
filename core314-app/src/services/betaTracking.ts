
import { BetaEvent } from '../types/beta';

class BetaTrackingService {
  private supabaseUrl: string;
  private accessToken: string | null = null;
  private enabled: boolean = true;

  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  }

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
      const response = await fetch(`${this.supabaseUrl}/functions/v1/log-beta-event`, {
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
