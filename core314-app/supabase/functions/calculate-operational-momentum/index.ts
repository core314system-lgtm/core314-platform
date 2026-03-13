import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Calculate Operational Momentum
 *
 * Computes a directional indicator showing whether operational health is
 * improving, stable, or declining — based on historical health score data.
 *
 * Formula:
 *   momentum_delta = current_score − average(previous N scores)
 *   where N = up to 3 most recent prior scores (uses whatever history exists)
 *
 * Classification:
 *   delta ≥ +8   → strong_improvement
 *   +3 to +7     → improving
 *   −2 to +2     → stable
 *   −3 to −7     → declining
 *   ≤ −8         → critical_decline
 *
 * Input:  { organization_id } (optional — falls back to user's primary org)
 * Output: { current_score, historical_average, delta, momentum, scores_used }
 *
 * Can be invoked standalone or called internally by operational-brief-generate.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Classify a momentum delta into a human-readable category */
function classifyMomentum(delta: number): string {
  if (delta >= 8) return 'strong_improvement';
  if (delta >= 3) return 'improving';
  if (delta >= -2) return 'stable';
  if (delta >= -7) return 'declining';
  return 'critical_decline';
}

/** Format momentum classification as a display label */
function momentumLabel(classification: string, delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  const labels: Record<string, string> = {
    'strong_improvement': 'Strong Improvement',
    'improving': 'Improving',
    'stable': 'Stable',
    'declining': 'Declining',
    'critical_decline': 'Critical Decline',
  };
  return `${labels[classification] || classification} (${sign}${delta})`;
}

/**
 * Core momentum calculation logic — exported so operational-brief-generate
 * can call it directly without an HTTP round-trip.
 */
export async function calculateMomentum(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  current_score: number | null;
  historical_average: number | null;
  delta: number;
  momentum: string;
  momentum_label: string;
  scores_used: number;
  history: { score: number; calculated_at: string }[];
}> {
  // Fetch the 4 most recent health scores (1 current + up to 3 historical)
  const { data: scores, error } = await supabase
    .from('operational_health_scores')
    .select('score, calculated_at')
    .eq('user_id', userId)
    .order('calculated_at', { ascending: false })
    .limit(4);

  if (error) {
    console.error('[momentum] Error fetching health scores:', error);
    throw error;
  }

  const scoreRows = scores || [];

  // Not enough data for momentum calculation
  if (scoreRows.length === 0) {
    return {
      current_score: null,
      historical_average: null,
      delta: 0,
      momentum: 'stable',
      momentum_label: 'Stable (no history)',
      scores_used: 0,
      history: [],
    };
  }

  const currentScore = scoreRows[0].score;

  // If only one score exists, momentum is stable (no prior comparison)
  if (scoreRows.length === 1) {
    return {
      current_score: currentScore,
      historical_average: null,
      delta: 0,
      momentum: 'stable',
      momentum_label: 'Stable (initial score)',
      scores_used: 1,
      history: scoreRows,
    };
  }

  // Use up to 3 previous scores (indices 1-3)
  const previousScores = scoreRows.slice(1);
  const historicalAverage = Math.round(
    previousScores.reduce((sum, s) => sum + s.score, 0) / previousScores.length
  );

  const delta = currentScore - historicalAverage;
  const momentum = classifyMomentum(delta);

  return {
    current_score: currentScore,
    historical_average: historicalAverage,
    delta,
    momentum,
    momentum_label: momentumLabel(momentum, delta),
    scores_used: scoreRows.length,
    history: scoreRows,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both authenticated user calls and service-role calls
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Try to identify user from the auth header
    let userId: string | null = null;

    // Check if this is a service-role call with user_id in body
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    let body: Record<string, string> = {};
    try {
      body = await req.json();
    } catch {
      // No body
    }

    if (isServiceRole && body.user_id) {
      userId = body.user_id;
    } else {
      // Authenticated user call
      const supabaseClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No user identified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const result = await calculateMomentum(supabase, userId);

    console.log(`[momentum] User ${userId}: score=${result.current_score}, delta=${result.delta}, momentum=${result.momentum}`);

    return new Response(JSON.stringify({
      success: true,
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[momentum] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
