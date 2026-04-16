import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integrations } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'salesforce');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Salesforce integrations found', processed: 0 }), {
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
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'salesforce')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        // Get access token from vault
        const { data: tokenJson } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!tokenJson) { errors.push(`No credentials for user ${integration.user_id}`); continue; }

        let accessToken: string;
        try {
          const parsed = JSON.parse(tokenJson);
          accessToken = parsed.access_token || parsed.api_token || tokenJson;
        } catch {
          accessToken = tokenJson;
        }

        // Get instance URL from user_integrations config
        const { data: userInt } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('user_id', integration.user_id)
          .eq('provider_id', integration.integration_registry_id)
          .single();

        const config = (userInt?.config as Record<string, string>) || {};
        const instanceUrl = config.instance_url || 'https://login.salesforce.com';

        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        };

        // Fetch recent opportunities
        let totalOpportunities = 0;
        let closedWon = 0;
        let closedLost = 0;
        let openDeals = 0;
        let totalPipelineValue = 0;
        const opportunitySummary: { name: string; stage: string; amount: number }[] = [];

        try {
          const oppResponse = await fetch(
            `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent('SELECT Id, Name, StageName, Amount, CloseDate, IsClosed, IsWon FROM Opportunity ORDER BY CloseDate DESC LIMIT 50')}`,
            { headers }
          );

          if (oppResponse.ok) {
            const oppData = await oppResponse.json();
            const records = oppData.records || [];
            totalOpportunities = records.length;

            for (const opp of records) {
              const amount = (opp.Amount as number) || 0;
              if (opp.IsClosed && opp.IsWon) {
                closedWon++;
              } else if (opp.IsClosed && !opp.IsWon) {
                closedLost++;
              } else {
                openDeals++;
                totalPipelineValue += amount;
              }
              opportunitySummary.push({
                name: opp.Name as string,
                stage: opp.StageName as string,
                amount,
              });
            }
          } else {
            const errText = await oppResponse.text();
            console.warn(`[salesforce-poll] Opportunity query failed (${oppResponse.status}): ${errText.slice(0, 200)}`);
          }
        } catch (apiErr) {
          console.warn('[salesforce-poll] Opportunity fetch error:', apiErr);
        }

        // Fetch recent leads
        let totalLeads = 0;
        let convertedLeads = 0;
        try {
          const leadResponse = await fetch(
            `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent('SELECT Id, IsConverted FROM Lead WHERE CreatedDate = LAST_N_DAYS:30 LIMIT 100')}`,
            { headers }
          );

          if (leadResponse.ok) {
            const leadData = await leadResponse.json();
            const leads = leadData.records || [];
            totalLeads = leads.length;
            convertedLeads = leads.filter((l: Record<string, unknown>) => l.IsConverted).length;
          }
        } catch (apiErr) {
          console.warn('[salesforce-poll] Lead fetch error:', apiErr);
        }

        // Fetch recent cases (support tickets)
        let totalCases = 0;
        let openCases = 0;
        try {
          const caseResponse = await fetch(
            `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent('SELECT Id, Status, IsClosed FROM Case WHERE CreatedDate = LAST_N_DAYS:30 LIMIT 100')}`,
            { headers }
          );

          if (caseResponse.ok) {
            const caseData = await caseResponse.json();
            const cases = caseData.records || [];
            totalCases = cases.length;
            openCases = cases.filter((c: Record<string, unknown>) => !c.IsClosed).length;
          }
        } catch (apiErr) {
          console.warn('[salesforce-poll] Case fetch error:', apiErr);
        }

        const winRate = (closedWon + closedLost) > 0 ? Math.round(closedWon / (closedWon + closedLost) * 100) : 0;

        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'salesforce',
          event_type: 'salesforce.crm_activity',
          occurred_at: now.toISOString(),
          source: 'salesforce_api_poll',
          metadata: {
            total_opportunities: totalOpportunities,
            closed_won: closedWon,
            closed_lost: closedLost,
            open_deals: openDeals,
            pipeline_value: totalPipelineValue,
            win_rate: winRate,
            total_leads: totalLeads,
            converted_leads: convertedLeads,
            lead_conversion_rate: totalLeads > 0 ? Math.round(convertedLeads / totalLeads * 100) : 0,
            total_cases: totalCases,
            open_cases: openCases,
            opportunity_summary: opportunitySummary.slice(0, 10),
            poll_timestamp: now.toISOString(),
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'salesforce',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { opportunities: totalOpportunities, pipeline_value: totalPipelineValue, leads: totalLeads, cases: totalCases },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
      } catch (userError) {
        errors.push(`Error for user ${integration.user_id}: ${(userError as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount, total: integrations.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[salesforce-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
