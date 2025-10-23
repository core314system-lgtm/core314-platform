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
    console.log('QuickBooks webhook received:', payload);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const events = payload.eventNotifications || [];

    for (const event of events) {
      const eventType = event.dataChangeEvent?.entities?.[0]?.name || 'quickbooks_event';
      const action = determineQuickBooksAction(event);

      await supabase
        .from('automation_hooks')
        .insert({
          event_type: `quickbooks_${eventType}`,
          trigger_source: 'quickbooks',
          action: action,
          metadata: {
            quickbooks_event: event,
            realm_id: event.realmId
          }
        });

      console.log(`✅ QuickBooks automation hook created: ${eventType}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'QuickBooks events processed',
      events_processed: events.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('QuickBooks webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function determineQuickBooksAction(event: any): any {
  const entityName = event.dataChangeEvent?.entities?.[0]?.name;
  const operation = event.dataChangeEvent?.entities?.[0]?.operation;

  if (entityName === 'Invoice' && operation === 'Create') {
    return {
      type: 'createSupabaseEntry',
      table: 'fusion_audit_log',
      data: {
        event_type: 'quickbooks_invoice_created',
        event_data: event
      }
    };
  }

  if (entityName === 'Payment' && operation === 'Create') {
    return {
      type: 'sendSlackMessage',
      message: `💰 New payment received in QuickBooks`,
      channel: '#finance-alerts'
    };
  }

  return {
    type: 'createSupabaseEntry',
    table: 'fusion_audit_log',
    data: {
      event_type: 'quickbooks_webhook_received',
      event_data: event
    }
  };
}
