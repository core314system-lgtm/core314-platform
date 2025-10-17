import { supabase } from './supabase';

export interface AutomationEvent {
  organization_id: string;
  event_type: string;
  metric?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function dispatchEvent(event: AutomationEvent): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No session available for event dispatch');
      return false;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-evaluate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      console.error('Event dispatch failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error dispatching event:', error);
    return false;
  }
}

export function dispatchFusionScoreUpdate(organizationId: string, score: number) {
  return dispatchEvent({
    organization_id: organizationId,
    event_type: 'fusion_score_updated',
    metric: 'FusionConfidence',
    value: score,
  });
}

export function dispatchMetricThreshold(organizationId: string, metric: string, value: number) {
  return dispatchEvent({
    organization_id: organizationId,
    event_type: 'metric_threshold',
    metric,
    value,
  });
}

export function dispatchSystemEvent(organizationId: string, data: Record<string, unknown>) {
  return dispatchEvent({
    organization_id: organizationId,
    event_type: 'system_event',
    ...data,
  });
}
