
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

export interface AdaptivePolicy {
  hasRestriction: boolean;
  policyAction: string | null;
  policyId: string | null;
  policyNotes: string | null;
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

/**
 * Check if user has any active adaptive policies
 * Phase 42: Adaptive Policy Engine integration
 */
export async function checkAdaptivePolicy(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  functionName: string
): Promise<AdaptivePolicy> {
  try {
    const { data, error } = await supabase.rpc('check_adaptive_policy', {
      p_user_id: userId,
      p_user_role: userRole,
      p_function_name: functionName,
    });

    if (error) {
      console.error('Error checking adaptive policy:', error);
      return {
        hasRestriction: false,
        policyAction: null,
        policyId: null,
        policyNotes: null,
      };
    }

    if (!data || data.length === 0) {
      return {
        hasRestriction: false,
        policyAction: null,
        policyId: null,
        policyNotes: null,
      };
    }

    const policy = data[0];
    return {
      hasRestriction: policy.has_restriction || false,
      policyAction: policy.policy_action || null,
      policyId: policy.policy_id || null,
      policyNotes: policy.policy_notes || null,
    };
  } catch (error) {
    console.error('Failed to check adaptive policy:', error);
    return {
      hasRestriction: false,
      policyAction: null,
      policyId: null,
      policyNotes: null,
    };
  }
}

/**
 * Create response for adaptive policy restriction
 */
export function createPolicyRestrictedResponse(
  policyAction: string,
  policyNotes: string | null
): Response {
  const message = policyAction === 'restrict' 
    ? 'Access temporarily restricted due to security policy'
    : policyAction === 'throttle'
    ? 'Request throttled due to security policy'
    : 'Access limited by security policy';

  return new Response(
    JSON.stringify({
      code: 'POLICY_RESTRICTED',
      message,
      detail: policyNotes || 'An adaptive security policy is currently active for your account',
      policyAction,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Policy-State': policyAction,
        'Retry-After': '3600',
      },
    }
  );
}

/**
 * Enhanced verify and authorize with adaptive policy checking
 * Phase 42: Now includes adaptive policy enforcement
 */
export async function verifyAndAuthorizeWithPolicy(
  req: Request,
  supabase: SupabaseClient,
  allowedRoles: string[],
  functionName: string
): Promise<
  | { ok: true; context: AuthContext; token: string; policy: AdaptivePolicy }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    return {
      ok: false,
      response: createUnauthorizedResponse(authResult.error),
    };
  }

  const { context } = authResult;

  const hasRole = allowedRoles.some(role => checkRole(context, role));
  if (!hasRole) {
    return {
      ok: false,
      response: createForbiddenResponse(allowedRoles.join(' or ')),
    };
  }

  const policy = await checkAdaptivePolicy(
    supabase,
    context.userId,
    context.userRole,
    functionName
  );

  if (policy.hasRestriction) {
    await logAuditEvent(
      supabase,
      context,
      'policy_enforcement',
      `Access ${policy.policyAction} by adaptive policy`,
      {
        policy_id: policy.policyId,
        policy_action: policy.policyAction,
        function_name: functionName,
      }
    );

    if (policy.policyAction === 'restrict' || policy.policyAction === 'throttle') {
      return {
        ok: false,
        response: createPolicyRestrictedResponse(policy.policyAction, policy.policyNotes),
      };
    }
  }

  await logAuditEvent(
    supabase,
    context,
    functionName,
    `User ${context.userRole} authorized to access ${functionName}`,
    {
      decision_impact: 'authorized_function_access',
      anomaly_detected: false,
      confidence_level: 1.0,
      adaptive_policy_checked: true,
      policy_active: policy.hasRestriction,
    }
  );

  return {
    ok: true,
    context,
    token,
    policy,
  };
}
