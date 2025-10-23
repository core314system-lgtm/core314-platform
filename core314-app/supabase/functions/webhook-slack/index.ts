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
    const payload = await req.json();
    console.log('Slack webhook received:', payload);

    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = payload.event?.type || 'slack_event';
    const action = determineSlackAction(payload);

    const { error } = await supabase
      .from('automation_hooks')
      .insert({
        event_type: eventType,
        trigger_source: 'slack',
        action: action,
        metadata: {
          slack_event: payload.event,
          slack_team: payload.team_id,
          slack_user: payload.event?.user
        }
      });

    if (error) throw error;

    console.log(`✅ Slack automation hook created: ${eventType}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Slack event processed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function determineSlackAction(payload: any): any {
  const event = payload.event || {};
  
  if (event.type === 'message' && event.text?.includes('alert')) {
    return {
      type: 'sendSlackMessage',
      message: `Alert detected: ${event.text}`,
      channel: '#admin-alerts'
    };
  }

  return {
    type: 'createSupabaseEntry',
    table: 'fusion_audit_log',
    data: {
      event_type: 'slack_webhook_received',
      event_data: event
    }
  };
}
