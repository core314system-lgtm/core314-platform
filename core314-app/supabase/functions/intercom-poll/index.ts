import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface IntercomMetrics {
  conversationCount: number;
  openConversations: number;
  closedConversations: number;
  snoozedConversations: number;
  lastActivityTimestamp: string | null;
}

async function fetchIntercomMetrics(apiKey: string): Promise<IntercomMetrics> {
  const metrics: IntercomMetrics = {
    conversationCount: 0,
    openConversations: 0,
    closedConversations: 0,
    snoozedConversations: 0,
    lastActivityTimestamp: null,
  };

  try {
    const conversationsUrl = 'https://api.intercom.io/conversations';
    
    const response = await fetch(conversationsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const conversations = data.conversations || [];
      
      metrics.conversationCount = conversations.length;
      
      for (const conv of conversations) {
        if (conv.state === 'open') {
          metrics.openConversations++;
        } else if (conv.state === 'closed') {
          metrics.closedConversations++;
        } else if (conv.state === 'snoozed') {
          metrics.snoozedConversations++;
        }
      }
      
      if (conversations.length > 0 && conversations[0].updated_at) {
        metrics.lastActivityTimestamp = new Date(conversations[0].updated_at * 1000).toISOString();
      }
    } else {
      console.log('[intercom-poll] Failed to fetch conversations:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[intercom-poll] Error fetching Intercom metrics:', error);
  }

  return metrics;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        config,
        provider_id,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'intercom')
      .eq('status', 'active');

    if (intError) {
      console.error('[intercom-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Intercom integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.id)
          .eq('service_name', 'intercom')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[intercom-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const config = integration.config as { api_key?: string } | null;
        if (!config?.api_key) {
          console.error('[intercom-poll] Missing credentials for user:', integration.user_id);
          errors.push(`Missing credentials for user ${integration.user_id}`);
          continue;
        }

        const metrics = await fetchIntercomMetrics(config.api_key);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        if (metrics.conversationCount > 0) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.id,
            integration_registry_id: integration.provider_id,
            service_name: 'intercom',
            event_type: 'intercom.conversation_activity',
            occurred_at: eventTime,
            source: 'intercom_api_poll',
            metadata: {
              conversation_count: metrics.conversationCount,
              open_conversations: metrics.openConversations,
              closed_conversations: metrics.closedConversations,
              snoozed_conversations: metrics.snoozedConversations,
              poll_timestamp: now.toISOString(),
            },
          });
        }

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.id,
          service_name: 'intercom',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[intercom-poll] Processed user:', integration.user_id, metrics);
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[intercom-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[intercom-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
