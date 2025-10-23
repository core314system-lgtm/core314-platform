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
    console.log('Teams webhook received:', payload);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventType = payload.type || 'teams_event';
    const action = determineTeamsAction(payload);

    const { error } = await supabase
      .from('automation_hooks')
      .insert({
        event_type: eventType,
        trigger_source: 'teams',
        action: action,
        metadata: {
          teams_event: payload,
          teams_activity_id: payload.id
        }
      });

    if (error) throw error;

    console.log(`✅ Teams automation hook created: ${eventType}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Teams event processed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Teams webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function determineTeamsAction(payload: any): any {
  if (payload.type === 'message' && payload.text?.includes('urgent')) {
    return {
      type: 'sendTeamsAlert',
      title: 'Urgent Message Detected',
      message: `Urgent message: ${payload.text}`
    };
  }

  return {
    type: 'createSupabaseEntry',
    table: 'fusion_audit_log',
    data: {
      event_type: 'teams_webhook_received',
      event_data: payload
    }
  };
}
