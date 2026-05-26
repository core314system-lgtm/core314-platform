/**
 * promote-integration-maturity
 * 
 * PURPOSE:
 * Admin-only manual promotion of integrations from 'connected' to 'observing' state.
 * This is a controlled, intentional promotion gate - NOT automated.
 * 
 * BEHAVIOR:
 * - Accepts POST with JSON body: { "integration_key": "slack" }
 * - Checks integration_readiness for latest eligible row
 * - Promotes integration_maturity from 'connected' to 'observing'
 * - Idempotent: if already 'observing', returns success without changes
 * - If not eligible, returns clear error
 * 
 * SAFETY:
 * - Service-role only (validates Authorization header)
 * - One integration at a time
 * - No automation, no cron, no triggers
 * - No UI changes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate service-role authorization
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Admin authorization required',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body: { integration_key?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid JSON body',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const integrationKey = body.integration_key;
    if (!integrationKey || typeof integrationKey !== 'string' || integrationKey.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        code: 'BAD_REQUEST',
        message: 'integration_key is required and must be a non-empty string',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? ''
    );

    console.log('[promote-maturity] Processing promotion request for:', integrationKey);

    // Step 1: Fetch latest readiness evaluation
    const { data: readiness, error: readinessError } = await supabase
      .from('integration_readiness')
      .select('id, eligible, reason, evaluated_at')
      .eq('integration_key', integrationKey)
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readinessError) {
      console.error('[promote-maturity] Error fetching readiness:', readinessError);
      return new Response(JSON.stringify({
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch readiness evaluation',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!readiness) {
      return new Response(JSON.stringify({
        success: false,
        code: 'NO_READINESS',
        message: 'No readiness evaluation found for this integration. Run evaluate-integration-readiness first.',
        integration_key: integrationKey,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!readiness.eligible) {
      return new Response(JSON.stringify({
        success: false,
        code: 'NOT_ELIGIBLE',
        message: 'Latest readiness evaluation is not eligible for promotion.',
        integration_key: integrationKey,
        readiness_reason: readiness.reason,
        evaluated_at: readiness.evaluated_at,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch current maturity state
    const { data: maturity, error: maturityError } = await supabase
      .from('integration_maturity')
      .select('id, integration_key, maturity_state, reason, updated_at')
      .eq('integration_key', integrationKey)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maturityError) {
      console.error('[promote-maturity] Error fetching maturity:', maturityError);
      return new Response(JSON.stringify({
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch maturity state',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Check current state and handle idempotency
    if (maturity && maturity.maturity_state === 'observing') {
      console.log('[promote-maturity] Already in observing state:', integrationKey);
      return new Response(JSON.stringify({
        success: true,
        status: 'ALREADY_OBSERVING',
        message: 'Integration is already in observing state. No changes made.',
        integration_key: integrationKey,
        current_state: 'observing',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!maturity) {
      return new Response(JSON.stringify({
        success: false,
        code: 'NO_MATURITY',
        message: 'No maturity record found for this integration. Integration must be in connected state first.',
        integration_key: integrationKey,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (maturity.maturity_state !== 'connected') {
      return new Response(JSON.stringify({
        success: false,
        code: 'INVALID_STATE',
        message: `Cannot promote integration from '${maturity.maturity_state}' state. Must be in 'connected' state.`,
        integration_key: integrationKey,
        current_state: maturity.maturity_state,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Perform the promotion (connected → observing)
    const now = new Date().toISOString();
    const promotionReason = `Manual promotion to observing at ${now}. Readiness: ${readiness.reason ?? 'eligible'}`;

    const { data: updatedRows, error: updateError } = await supabase
      .from('integration_maturity')
      .update({
        maturity_state: 'observing',
        reason: promotionReason,
        updated_at: now,
      })
      .eq('integration_key', integrationKey)
      .eq('maturity_state', 'connected')
      .select('id, integration_key, maturity_state, reason, updated_at');

    if (updateError) {
      console.error('[promote-maturity] Error updating maturity:', updateError);
      return new Response(JSON.stringify({
        success: false,
        code: 'DATABASE_ERROR',
        message: 'Failed to update maturity state',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        code: 'PROMOTION_CONFLICT',
        message: 'Maturity record was no longer in connected state during promotion. Possible race condition.',
        integration_key: integrationKey,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[promote-maturity] Successfully promoted:', integrationKey);

    return new Response(JSON.stringify({
      success: true,
      status: 'PROMOTED',
      message: 'Integration successfully promoted from connected to observing.',
      integration_key: integrationKey,
      previous_state: 'connected',
      new_state: 'observing',
      promotion_reason: promotionReason,
      promoted_at: now,
      readiness: {
        id: readiness.id,
        reason: readiness.reason,
        evaluated_at: readiness.evaluated_at,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[promote-maturity] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
