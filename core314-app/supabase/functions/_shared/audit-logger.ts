
interface AuditLogParams {
  user_id?: string;
  event_type: string;
  event_source: string;
  event_payload?: Record<string, any>;
  stability_score?: number;
  reinforcement_delta?: number;
}

/**
 * Log an event to the fusion_audit_log table via the fusion-audit-trail Edge Function
 * @param params - Audit log parameters
 * @returns Promise<boolean> - Success status
 */
export async function logAuditEvent(params: AuditLogParams): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const internalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

    if (!supabaseUrl || !internalToken) {
      console.error('[Audit Logger] Missing environment variables');
      return false;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/fusion-audit-trail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Audit Logger] Failed to log audit event:', error);
      return false;
    }

    const result = await response.json();
    console.log('[Audit Logger] Event logged:', result.audit_log_id);
    return true;

  } catch (error) {
    console.error('[Audit Logger] Error logging audit event:', error);
    return false;
  }
}
