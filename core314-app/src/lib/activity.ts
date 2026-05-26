import { supabase } from './supabase';

/**
 * Lightweight user activity logger.
 * Records login events, feature interactions, and integration actions.
 * All events are stored in the `user_activity` table.
 */

export type ActivityEvent =
  | 'login'
  | 'logout'
  | 'brief_generated'
  | 'brief_viewed'
  | 'signal_viewed'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'health_check_viewed'
  | 'dashboard_viewed'
  | 'settings_updated'
  | 'page_viewed';

export async function logActivity(
  eventType: ActivityEvent,
  metadata?: Record<string, unknown>,
  eventSource?: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_activity').insert({
      user_id: user.id,
      event_type: eventType,
      event_source: eventSource || 'app',
      metadata: metadata || {},
    });
  } catch (error) {
    // Non-blocking — never let activity logging break the app
    console.error('[activity] Failed to log event:', eventType, error);
  }
}

/**
 * Track page views automatically.
 * Call this in your route components or layout.
 */
export function trackPageView(pageName: string): void {
  logActivity('page_viewed', { page: pageName });
}
