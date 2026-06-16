import { supabase } from './supabase'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'mfa_enrolled'
  | 'mfa_removed'
  | 'password_changed'
  | 'data_export'
  | 'sub_connection_created'
  | 'sub_connection_removed'
  | 'profile_viewed'
  | 'settings_changed'
  | 'permission_changed'
  | 'member_invited'
  | 'member_removed'
  | 'project_created'
  | 'project_deleted'
  | 'document_uploaded'
  | 'rfq_sent'
  | 'account_deleted'

interface AuditEventInput {
  action: AuditAction
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event. Falls back silently on error — audit logging
 * should never block user actions.
 */
export async function logAuditEvent({ action, resourceType, resourceId, metadata }: AuditEventInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's org from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single()

    await supabase.from('audit_events').insert({
      user_id: user.id,
      org_id: profile?.current_org_id || null,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      metadata: metadata || {},
    })
  } catch {
    // Silently fail — audit logging should never block user actions
  }
}
