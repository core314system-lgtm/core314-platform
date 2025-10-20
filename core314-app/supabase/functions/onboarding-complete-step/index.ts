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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { step_number } = await req.json();

    const { data: progress } = await supabase
      .from('user_onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!progress) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      await supabase.from('user_onboarding_progress').insert({
        user_id: user.id,
        organization_id: member?.organization_id || null,
        current_step: step_number + 1,
        total_steps: 5,
        [`step_${step_number}_completed`]: true,
      });
    } else {
      const updates: Record<string, unknown> = {
        [`step_${step_number}_completed`]: true,
        updated_at: new Date().toISOString(),
      };

      if (step_number < 5) {
        updates.current_step = step_number + 1;
      } else {
        updates.completed_at = new Date().toISOString();
      }

      await supabase
        .from('user_onboarding_progress')
        .update(updates)
        .eq('user_id', user.id);

      if (step_number === 5) {
        await supabase
          .from('profiles')
          .update({ onboarding_status: 'completed' })
          .eq('id', user.id);

        await supabase.from('fusion_audit_log').insert({
          organization_id: progress.organization_id,
          user_id: user.id,
          event_type: 'onboarding_completed',
          event_data: { total_steps: 5 },
        });
      } else {
        await supabase
          .from('profiles')
          .update({ onboarding_status: 'in_progress' })
          .eq('id', user.id);

        await supabase.from('fusion_audit_log').insert({
          organization_id: progress.organization_id,
          user_id: user.id,
          event_type: 'onboarding_step_completed',
          event_data: { step: step_number },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Onboarding complete step error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
