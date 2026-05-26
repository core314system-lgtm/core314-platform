/**
 * BILLING ENFORCEMENT MIDDLEWARE
 * 
 * Centralized guard for blocking mutations when user's access_state is 'grace' or 'locked'.
 * Uses existing database helpers from PR #344:
 * - is_user_mutation_allowed(user_id) - returns boolean
 * - get_user_access_state(user_id) - returns { access_state, reason, ... }
 * 
 * ENFORCEMENT RULES:
 * - access_state = 'full' -> Allow all operations
 * - access_state = 'grace' -> Block mutations, allow reads
 * - access_state = 'locked' -> Block mutations, allow reads
 * 
 * EXEMPT ENDPOINTS (do NOT enforce):
 * - Stripe webhooks
 * - Billing/portal endpoints (users need these to fix billing)
 * - Read-only endpoints
 * - Public/unauthenticated endpoints
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Feature flag for easy rollback
const BILLING_ENFORCEMENT_ENABLED = process.env.BILLING_ENFORCEMENT_ENABLED !== 'false';

// Standard blocked response
const BILLING_RESTRICTED_RESPONSE = {
  statusCode: 403,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
  body: JSON.stringify({
    error: 'billing_restricted',
    message: 'Your subscription requires attention. Please update billing to restore full access.',
  }),
};

interface BillingEnforcementResult {
  allowed: boolean;
  userId: string | null;
  accessState: string | null;
  reason: string | null;
  blockedResponse: typeof BILLING_RESTRICTED_RESPONSE | null;
}

interface AccessStateResult {
  access_state: string;
  reason: string;
  subscription_status?: string;
  payment_failed_at?: string;
}

/**
 * Create a Supabase client with service role for billing enforcement checks
 */
function getServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration for billing enforcement');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Extract user ID from JWT token
 */
async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const supabase = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Get user's access state from billing_state table
 */
async function getAccessState(userId: string): Promise<AccessStateResult | null> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('get_user_access_state', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[BILLING_ENFORCEMENT] Error getting access state:', error);
      return null;
    }

    return data as AccessStateResult;
  } catch (err) {
    console.error('[BILLING_ENFORCEMENT] Exception getting access state:', err);
    return null;
  }
}

/**
 * Log blocked mutation event
 */
async function logBlockedMutation(
  userId: string,
  accessState: string,
  endpointName: string
): Promise<void> {
  try {
    const supabase = getServiceClient();
    
    // Log to ops_event_log table
    await supabase.from('ops_event_log').insert({
      event_type: 'billing_mutation_blocked',
      source: `netlify:${endpointName}`,
      severity: 'warning',
      user_id: userId,
      metadata: {
        access_state: accessState,
        endpoint: endpointName,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[BILLING_ENFORCEMENT] Blocked mutation: user=${userId}, access_state=${accessState}, endpoint=${endpointName}`);
  } catch (err) {
    // Don't fail the request if logging fails
    console.error('[BILLING_ENFORCEMENT] Failed to log blocked mutation:', err);
  }
}

/**
 * MAIN ENFORCEMENT FUNCTION
 * 
 * Call this at the start of every mutation-capable endpoint.
 * Returns { allowed: true } if mutation is permitted.
 * Returns { allowed: false, blockedResponse } if mutation should be blocked.
 * 
 * @param authHeader - Authorization header from request (Bearer token)
 * @param endpointName - Name of the endpoint for logging
 * @returns BillingEnforcementResult
 */
export async function enforceBillingMutationAllowed(
  authHeader: string | undefined,
  endpointName: string
): Promise<BillingEnforcementResult> {
  // Feature flag check - if disabled, allow all
  if (!BILLING_ENFORCEMENT_ENABLED) {
    console.log(`[BILLING_ENFORCEMENT] Enforcement disabled via feature flag, allowing ${endpointName}`);
    return {
      allowed: true,
      userId: null,
      accessState: null,
      reason: 'enforcement_disabled',
      blockedResponse: null,
    };
  }

  // No auth header = unauthenticated request, skip enforcement
  // (Let the endpoint handle auth errors)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      allowed: true,
      userId: null,
      accessState: null,
      reason: 'no_auth_header',
      blockedResponse: null,
    };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Get user ID from token
  const userId = await getUserIdFromToken(token);
  if (!userId) {
    // Invalid token - let endpoint handle auth error
    return {
      allowed: true,
      userId: null,
      accessState: null,
      reason: 'invalid_token',
      blockedResponse: null,
    };
  }

  // Get access state
  const accessStateResult = await getAccessState(userId);
  if (!accessStateResult) {
    // Could not determine access state - fail open to avoid blocking legitimate users
    console.warn(`[BILLING_ENFORCEMENT] Could not determine access state for user ${userId}, allowing`);
    return {
      allowed: true,
      userId,
      accessState: null,
      reason: 'access_state_unknown',
      blockedResponse: null,
    };
  }

  const { access_state: accessState, reason } = accessStateResult;

  // Check if mutation is allowed
  if (accessState === 'full') {
    return {
      allowed: true,
      userId,
      accessState,
      reason,
      blockedResponse: null,
    };
  }

  // access_state is 'grace' or 'locked' - block mutation
  await logBlockedMutation(userId, accessState, endpointName);

  return {
    allowed: false,
    userId,
    accessState,
    reason,
    blockedResponse: BILLING_RESTRICTED_RESPONSE,
  };
}

/**
 * CONVENIENCE WRAPPER
 * 
 * Returns the blocked response directly if mutation is not allowed.
 * Returns null if mutation is allowed (continue with handler logic).
 * 
 * Usage:
 *   const blocked = await checkBillingEnforcement(event.headers.authorization, 'my-endpoint');
 *   if (blocked) return blocked;
 *   // ... continue with mutation logic
 */
export async function checkBillingEnforcement(
  authHeader: string | undefined,
  endpointName: string
): Promise<typeof BILLING_RESTRICTED_RESPONSE | null> {
  const result = await enforceBillingMutationAllowed(authHeader, endpointName);
  return result.blockedResponse;
}

/**
 * Export the standard blocked response for consistency
 */
export { BILLING_RESTRICTED_RESPONSE };
