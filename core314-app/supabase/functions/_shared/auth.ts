
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface AuthContext {
  userId: string;
  userRole: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
}

export interface AuthError {
  code: string;
  message: string;
  detail?: string;
}

/**
 * Verify JWT token and extract user context
 */
export async function verifyAuth(
  authHeader: string | null,
  supabase: SupabaseClient
): Promise<{ success: true; context: AuthContext } | { success: false; error: AuthError }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
        detail: 'Authorization header must be in format: Bearer <token>',
      },
    };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          detail: authError?.message || 'Token verification failed',
        },
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id, is_platform_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          detail: profileError?.message || 'Unable to retrieve user profile',
        },
      };
    }

    return {
      success: true,
      context: {
        userId: user.id,
        userRole: profile.role,
        organizationId: profile.organization_id,
        isPlatformAdmin: profile.is_platform_admin || profile.role === 'platform_admin',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Check if user has required role
 */
export function checkRole(context: AuthContext, requiredRole: string): boolean {
  if (context.isPlatformAdmin) {
    return true;
  }

  if (requiredRole === 'platform_admin') {
    return context.isPlatformAdmin;
  } else if (requiredRole === 'operator') {
    return ['operator', 'admin', 'manager', 'platform_admin'].includes(context.userRole);
  } else if (requiredRole === 'end_user') {
    return ['end_user', 'user', 'operator', 'admin', 'manager', 'platform_admin'].includes(context.userRole);
  } else {
    return context.userRole === requiredRole;
  }
}

/**
 * Create standardized 403 Forbidden response
 */
export function createForbiddenResponse(requiredRole: string): Response {
  return new Response(
    JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
      detail: `This operation requires ${requiredRole} role`,
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Create standardized 401 Unauthorized response
 */
export function createUnauthorizedResponse(error: AuthError): Response {
  return new Response(
    JSON.stringify(error),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Log audit event with user context
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  context: AuthContext,
  actionType: string,
  decisionSummary: string,
  systemContext: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('fusion_audit_log').insert({
      user_id: context.userId,
      user_role: context.userRole,
      action_type: actionType,
      decision_summary: decisionSummary,
      system_context: systemContext,
      triggered_by: 'Edge Function',
      confidence_level: 100,
      decision_impact: 'MODERATE',
      anomaly_detected: false,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
