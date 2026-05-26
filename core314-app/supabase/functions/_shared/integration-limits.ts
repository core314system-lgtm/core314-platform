/**
 * Integration Plan Limits
 *
 * Enforces maximum integration connection limits per subscription plan.
 * Used by all connect flows (oauth-initiate, oauth-callback, connect-api-key).
 *
 * Plan limits:
 *   - intelligence:    3 integrations
 *   - command_center: 10 integrations
 *   - enterprise:     unlimited
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const PLAN_INTEGRATION_LIMITS: Record<string, number> = {
  intelligence: 3,
  command_center: 10,
  enterprise: Infinity,
};

/**
 * Resolve the user's current plan from their active subscription.
 * Returns 'intelligence' as the default if no active subscription is found.
 */
export async function resolveUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription?.plan_name) return 'intelligence';

  const planName = subscription.plan_name.toLowerCase();
  if (planName.includes('command') || planName.includes('center')) return 'command_center';
  if (planName.includes('enterprise')) return 'enterprise';
  return 'intelligence';
}

/**
 * Count active integrations for a user.
 */
export async function countActiveIntegrations(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from('user_integrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  return count ?? 0;
}

/**
 * Check if a user can connect a new integration based on their plan.
 *
 * Returns { allowed: true } or { allowed: false, error, currentCount, limit, plan }.
 */
export async function checkIntegrationLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<
  | { allowed: true; currentCount: number; limit: number; plan: string }
  | { allowed: false; error: string; currentCount: number; limit: number; plan: string }
> {
  const plan = await resolveUserPlan(supabase, userId);
  const limit = PLAN_INTEGRATION_LIMITS[plan] ?? PLAN_INTEGRATION_LIMITS['intelligence'];
  const currentCount = await countActiveIntegrations(supabase, userId);

  if (currentCount >= limit) {
    return {
      allowed: false,
      error: 'integration_limit_reached',
      currentCount,
      limit,
      plan,
    };
  }

  return { allowed: true, currentCount, limit, plan };
}

/**
 * Build a standardized JSON error response for integration limit violations.
 */
export function integrationLimitErrorResponse(
  result: { error: string; currentCount: number; limit: number; plan: string },
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: result.error,
      message: `You have reached the maximum of ${result.limit} integrations for your ${result.plan.replace(/_/g, ' ')} plan. Upgrade to connect more integrations.`,
      current_count: result.currentCount,
      limit: result.limit,
      plan: result.plan,
    }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
