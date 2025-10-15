import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = Date.now();

    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations_master')
      .select('integration_name');

    if (integrationsError) throw integrationsError;

    let refreshCount = 0;

    for (const integration of (integrations || [])) {
      const visualizeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fusion-visualize?integration=${integration.integration_name}`;
      
      const response = await fetch(visualizeUrl, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      });

      if (response.ok) {
        refreshCount++;
      }
    }

    const visualizeAllUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fusion-visualize`;
    await fetch(visualizeAllUrl, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });
    refreshCount++;

    await supabase.from('fusion_audit_log').insert({
      user_id: null,
      integration_id: null,
      event_type: 'visualization_refresh',
      metrics_count: refreshCount,
      triggered_by: 'scheduled',
      execution_time_ms: Date.now() - startTime,
      status: 'success'
    });

    return new Response(JSON.stringify({
      success: true,
      refreshCount,
      executionTimeMs: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
