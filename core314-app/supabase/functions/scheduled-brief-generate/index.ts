import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// SCHEDULED BRIEF GENERATION
// Runs on a cron schedule (e.g., daily at 6 AM UTC) to auto-generate briefs
// for all active users who have at least one connected integration.
// This ensures users always have fresh operational intelligence without
// needing to manually click "Generate Brief".
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find all active users with at least one connected integration
    const { data: activeUsers, error: usersError } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('status', 'active');

    if (usersError) {
      console.error('Error fetching active users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch active users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set((activeUsers || []).map(u => u.user_id))];

    console.log(`[ScheduledBriefGenerate] Found ${uniqueUserIds.length} active users with integrations`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Check if user already has a brief generated today
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const { data: todayBriefs } = await supabase
          .from('operational_briefs')
          .select('id')
          .eq('user_id', userId)
          .gte('created_at', todayStart.toISOString())
          .limit(1);

        if (todayBriefs && todayBriefs.length > 0) {
          skipped++;
          continue;
        }

        // Trigger brief generation via the existing edge function
        const briefGenerateUrl = `${supabaseUrl}/functions/v1/operational-brief-generate`;

        const response = await fetch(briefGenerateUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'x-scheduled-user-id': userId,
          },
          body: JSON.stringify({ scheduled: true, user_id: userId }),
        });

        if (response.ok) {
          generated++;
          console.log(`[ScheduledBriefGenerate] Generated brief for user ${userId}`);
        } else {
          const errorText = await response.text();
          console.warn(`[ScheduledBriefGenerate] Failed for user ${userId}: ${errorText}`);
          failed++;
        }
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : String(userError);
        console.warn(`[ScheduledBriefGenerate] Error for user ${userId}: ${msg}`);
        failed++;
      }
    }

    const summary = {
      total_users: uniqueUserIds.length,
      generated,
      skipped,
      failed,
      timestamp: new Date().toISOString(),
    };

    console.log('[ScheduledBriefGenerate] Complete:', JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ScheduledBriefGenerate] Fatal error:', msg);
    return new Response(
      JSON.stringify({ error: 'Scheduled generation failed', details: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
