
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
 * Check if user has any of the allowed roles
 */
export function checkAnyRole(context: AuthContext, allowedRoles: string[]): boolean {
  return allowedRoles.some(role => checkRole(context, role));
}

/**
 * Safely decode JWT payload without verification (for logging only)
 */
function decodeJwtSafely(token: string): { sub?: string; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded);
    
    return {
      sub: parsed.sub,
      role: parsed.user_metadata?.role || parsed.role,
    };
  } catch {
    return null;
  }
}

/**
 * Log unauthorized access attempt
 */
async function logUnauthorizedAttempt(
  supabase: SupabaseClient,
  actionType: string,
  reason: string,
  token?: string
): Promise<void> {
  try {
    let userId: string | null = null;
    let userRole: string | null = null;

    if (token) {
      const decoded = decodeJwtSafely(token);
      if (decoded) {
        userId = decoded.sub || null;
        userRole = decoded.role || null;
      }
    }

    await supabase.from('fusion_audit_log').insert({
      user_id: userId,
      user_role: userRole,
      action_type: actionType,
      decision_summary: `Unauthorized access attempt: ${reason}`,
      system_context: { reason, timestamp: new Date().toISOString() },
      triggered_by: 'Edge Function',
      confidence_level: 0,
      decision_impact: 'unauthorized_access_attempt',
      anomaly_detected: true,
    });
  } catch (error) {
    console.error('Failed to log unauthorized attempt:', error);
  }
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

/**
 * Verify authentication and authorize request
 * Returns either success with context or a Response to return immediately
 */
export async function verifyAndAuthorize(
  req: Request,
  supabase: SupabaseClient,
  allowedRoles: string[],
  actionType: string
): Promise<
  | { ok: true; context: AuthContext; token: string }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logUnauthorizedAttempt(supabase, actionType, 'Missing or invalid authorization header');
    return {
      ok: false,
      response: createUnauthorizedResponse({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
        detail: 'Authorization header must be in format: Bearer <token>',
      }),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const authResult = await verifyAuth(authHeader, supabase);

  if (!authResult.success) {
    await logUnauthorizedAttempt(supabase, actionType, authResult.error.message, token);
    return {
      ok: false,
      response: createUnauthorizedResponse(authResult.error),
    };
  }

  const { context } = authResult;

  if (!checkAnyRole(context, allowedRoles)) {
    await logUnauthorizedAttempt(
      supabase,
      actionType,
      `Insufficient permissions. Required: ${allowedRoles.join(' or ')}. User role: ${context.userRole}`,
      token
    );
    return {
      ok: false,
      response: createForbiddenResponse(allowedRoles.join(' or ')),
    };
  }

  await logAuditEvent(
    supabase,
    context,
    actionType,
    `User ${context.userRole} authorized to access ${actionType}`,
    {
      decision_impact: 'authorized_function_access',
      anomaly_detected: false,
      confidence_level: 1.0,
    }
  );

  return {
    ok: true,
    context,
    token,
  };
}
