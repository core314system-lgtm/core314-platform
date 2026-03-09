import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * HubSpot Poll Function
 * 
 * Fetches CRM data from HubSpot API:
 * - Deals (pipeline activity, stages, values, stalled deals)
 * - Contacts (total count, recent activity)
 * - Companies (total count)
 * 
 * Detects operational signals:
 * - Stalled deals (no activity > N days)
 * - Pipeline velocity changes
 * - Deal stage distribution shifts
 * 
 * Data is persisted to integration_events table for signal detection.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

interface HubSpotMetrics {
  // Deals
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalPipelineValue: number;
  openPipelineValue: number;
  stalledDeals: number;
  stalledDealIds: string[];
  avgDealAge: number;
  dealsByStage: Record<string, number>;
  // Contacts
  totalContacts: number;
  recentContacts: number;
  // Companies
  totalCompanies: number;
  // Meta
  lastActivityTimestamp: string | null;
  portalName: string | null;
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    closedate?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    hs_deal_stage_probability?: string;
    notes_last_updated?: string;
    num_notes?: string;
  };
}

async function fetchHubSpotMetrics(accessToken: string): Promise<HubSpotMetrics> {
  const metrics: HubSpotMetrics = {
    totalDeals: 0,
    openDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    totalPipelineValue: 0,
    openPipelineValue: 0,
    stalledDeals: 0,
    stalledDealIds: [],
    avgDealAge: 0,
    dealsByStage: {},
    totalContacts: 0,
    recentContacts: 0,
    totalCompanies: 0,
    lastActivityTimestamp: null,
    portalName: null,
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch deals with properties
    console.log('[hubspot-poll] Fetching deals...');
    const dealsResponse = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals?limit=100&properties=dealname,dealstage,amount,closedate,createdate,hs_lastmodifieddate,notes_last_updated,num_notes`,
      { headers }
    );

    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      const deals: HubSpotDeal[] = dealsData.results || [];
      metrics.totalDeals = dealsData.total || deals.length;

      const now = Date.now();
      const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
      let totalAge = 0;

      for (const deal of deals) {
        const amount = parseFloat(deal.properties.amount || '0');
        const stage = deal.properties.dealstage || 'unknown';
        const lastModified = deal.properties.hs_lastmodifieddate;
        const createDate = deal.properties.createdate;

        // Track stage distribution
        metrics.dealsByStage[stage] = (metrics.dealsByStage[stage] || 0) + 1;

        // Determine deal status
        const isClosed = stage.includes('closedwon') || stage.includes('closedlost') || 
                         stage === 'closed won' || stage === 'closed lost';
        const isWon = stage.includes('closedwon') || stage === 'closed won';
        const isLost = stage.includes('closedlost') || stage === 'closed lost';

        if (isWon) {
          metrics.wonDeals++;
          metrics.totalPipelineValue += amount;
        } else if (isLost) {
          metrics.lostDeals++;
          metrics.totalPipelineValue += amount;
        } else {
          metrics.openDeals++;
          metrics.openPipelineValue += amount;
          metrics.totalPipelineValue += amount;

          // Check for stalled deals (no activity in 6+ days)
          if (lastModified) {
            const lastModifiedTime = new Date(lastModified).getTime();
            if (now - lastModifiedTime > sixDaysMs) {
              metrics.stalledDeals++;
              metrics.stalledDealIds.push(deal.id);
            }
          }

          // Calculate deal age
          if (createDate) {
            const ageMs = now - new Date(createDate).getTime();
            totalAge += ageMs / (24 * 60 * 60 * 1000); // Convert to days
          }
        }

        // Track latest activity
        if (lastModified) {
          if (!metrics.lastActivityTimestamp || lastModified > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = lastModified;
          }
        }
      }

      if (metrics.openDeals > 0) {
        metrics.avgDealAge = Math.round(totalAge / metrics.openDeals);
      }

      // Handle pagination if there are more deals
      if (dealsData.paging?.next?.after) {
        // Just get the total count from the first page
        metrics.totalDeals = dealsData.total || metrics.totalDeals;
      }
    } else {
      console.error('[hubspot-poll] Failed to fetch deals:', dealsResponse.status, await dealsResponse.text());
    }

    // Small delay for rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Fetch contacts count
    console.log('[hubspot-poll] Fetching contacts...');
    const contactsResponse = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`,
      { headers }
    );

    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      metrics.totalContacts = contactsData.total || 0;
    } else {
      console.error('[hubspot-poll] Failed to fetch contacts:', contactsResponse.status);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Fetch recently created contacts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentContactsResponse = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'createdate',
              operator: 'GTE',
              value: sevenDaysAgo,
            }],
          }],
          limit: 1,
        }),
      }
    );

    if (recentContactsResponse.ok) {
      const recentData = await recentContactsResponse.json();
      metrics.recentContacts = recentData.total || 0;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // 4. Fetch companies count
    console.log('[hubspot-poll] Fetching companies...');
    const companiesResponse = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/companies?limit=1`,
      { headers }
    );

    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      metrics.totalCompanies = companiesData.total || 0;
    }

    // 5. Get account info
    await new Promise(resolve => setTimeout(resolve, 100));
    const accountResponse = await fetch(
      `${HUBSPOT_API_BASE}/account-info/v3/details`,
      { headers }
    );

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      metrics.portalName = accountData.companyName || accountData.portalId?.toString() || null;
    }

  } catch (error) {
    console.error('[hubspot-poll] Error fetching HubSpot metrics:', error);
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

    // Fetch all active HubSpot integrations with OAuth tokens
    const { data: hubspotIntegrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id,
        user_id,
        user_integration_id,
        integration_registry_id,
        access_token_secret_id,
        expires_at,
        integration_registry!inner (
          service_name
        )
      `)
      .eq('integration_registry.service_name', 'hubspot');

    if (intError) {
      console.error('[hubspot-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!hubspotIntegrations || hubspotIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No HubSpot integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of hubspotIntegrations) {
      try {
        // Check rate limiting
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'hubspot')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[hubspot-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        // Get access token from vault
        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[hubspot-poll] No access token found for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        // Check token expiration
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[hubspot-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // Fetch metrics from HubSpot API
        const metrics = await fetchHubSpotMetrics(accessToken);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        // Insert integration event with CRM metrics
        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'hubspot',
          event_type: 'hubspot.crm_activity',
          occurred_at: eventTime,
          source: 'hubspot_api_poll',
          metadata: {
            // Deal metrics
            total_deals: metrics.totalDeals,
            open_deals: metrics.openDeals,
            won_deals: metrics.wonDeals,
            lost_deals: metrics.lostDeals,
            total_pipeline_value: metrics.totalPipelineValue,
            open_pipeline_value: metrics.openPipelineValue,
            stalled_deals: metrics.stalledDeals,
            stalled_deal_ids: metrics.stalledDealIds.slice(0, 20), // Limit stored IDs
            avg_deal_age_days: metrics.avgDealAge,
            deals_by_stage: metrics.dealsByStage,
            // Contact metrics
            total_contacts: metrics.totalContacts,
            recent_contacts_7d: metrics.recentContacts,
            // Company metrics
            total_companies: metrics.totalCompanies,
            // Meta
            portal_name: metrics.portalName,
            poll_timestamp: now.toISOString(),
          },
        });

        // Update ingestion state with 15-minute rate limiting
        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'hubspot',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        console.log('[hubspot-poll] Processed user:', integration.user_id, {
          deals: metrics.totalDeals,
          openDeals: metrics.openDeals,
          stalledDeals: metrics.stalledDeals,
          pipelineValue: metrics.openPipelineValue,
          contacts: metrics.totalContacts,
        });
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[hubspot-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: hubspotIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[hubspot-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
