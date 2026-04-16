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
const STALLED_THRESHOLD_DAYS = 6;
const MAX_PAGES = 10; // Safety limit: 10 pages * 100 = 1000 deals max

interface HubSpotMetrics {
  totalDeals: number;
  dealsAnalyzed: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalPipelineValue: number;
  openPipelineValue: number;
  stalledDeals: number;
  stalledDealNames: string[];
  avgDealAge: number;
  dealsByStage: Record<string, number>;
  dealsByStageLabel: Record<string, number>;
  recentDeals7d: number;
  maxStageDays: number;
  dealsStuckOver14d: number;
  totalContacts: number;
  recentContacts7d: number;
  totalCompanies: number;
  pipelineCount: number;
  pipelineNames: string[];
  lastDealActivity: string | null;
  lastActivityTimestamp: string | null;
  portalName: string | null;
  portalId: string | null;
  apiErrors: string[];
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    pipeline?: string;
    amount?: string;
    closedate?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    hs_deal_stage_probability?: string;
    notes_last_updated?: string;
    num_notes?: string;
  };
}

interface PipelineStage { stageId: string; label: string; displayOrder: number; }
interface Pipeline { id: string; label: string; stages: PipelineStage[]; }

async function refreshHubSpotToken(
  supabase: ReturnType<typeof createClient>,
  oauthTokenId: string,
  refreshTokenSecretId: string | null,
  accessTokenSecretId: string,
): Promise<string | null> {
  if (!refreshTokenSecretId) { console.error('[hubspot-poll] No refresh token secret ID'); return null; }
  try {
    const { data: refreshToken, error: rtError } = await supabase.rpc('get_decrypted_secret', { secret_id: refreshTokenSecretId });
    if (rtError || !refreshToken) { console.error('[hubspot-poll] Failed to get refresh token:', rtError); return null; }
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET') ?? '';
    if (!clientId || !clientSecret) { console.error('[hubspot-poll] Missing HUBSPOT_CLIENT_ID or HUBSPOT_CLIENT_SECRET'); return null; }
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    });
    if (!response.ok) { const errText = await response.text(); console.error('[hubspot-poll] Token refresh failed:', response.status, errText); return null; }
    const tokenData = await response.json();
    const newAccessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 1800;
    const newRefreshToken = tokenData.refresh_token;
    await supabase.rpc('update_secret', { secret_id: accessTokenSecretId, new_secret: newAccessToken });
    if (newRefreshToken && newRefreshToken !== refreshToken) {
      await supabase.rpc('update_secret', { secret_id: refreshTokenSecretId, new_secret: newRefreshToken });
    }
    const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
    await supabase.from('oauth_tokens').update({ expires_at: newExpiry, updated_at: new Date().toISOString() }).eq('id', oauthTokenId);
    console.log('[hubspot-poll] Token refreshed, new expiry:', newExpiry);
    return newAccessToken;
  } catch (err) { console.error('[hubspot-poll] Token refresh error:', err); return null; }
}

async function fetchPipelines(headers: Record<string, string>): Promise<Pipeline[]> {
  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`, { headers });
    if (!response.ok) { console.warn('[hubspot-poll] Failed to fetch pipelines:', response.status); return []; }
    const data = await response.json();
    return (data.results || []).map((p: Record<string, unknown>) => ({
      id: p.id as string, label: p.label as string,
      stages: ((p.stages as Record<string, unknown>[]) || []).map((s: Record<string, unknown>) => ({
        stageId: (s.stageId as string) || (s.id as string), label: s.label as string, displayOrder: (s.displayOrder as number) || 0,
      })),
    }));
  } catch (err) { console.error('[hubspot-poll] Error fetching pipelines:', err); return []; }
}

function buildStageLabelMap(pipelines: Pipeline[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of pipelines) { for (const s of p.stages) { map[s.stageId] = s.label; } }
  return map;
}

async function fetchHubSpotMetrics(accessToken: string): Promise<HubSpotMetrics> {
  const metrics: HubSpotMetrics = {
    totalDeals: 0, dealsAnalyzed: 0, openDeals: 0, wonDeals: 0, lostDeals: 0,
    totalPipelineValue: 0, openPipelineValue: 0, stalledDeals: 0, stalledDealNames: [],
    avgDealAge: 0, dealsByStage: {}, dealsByStageLabel: {}, recentDeals7d: 0,
    maxStageDays: 0, dealsStuckOver14d: 0,
    totalContacts: 0, recentContacts7d: 0, totalCompanies: 0,
    pipelineCount: 0, pipelineNames: [],
    lastDealActivity: null, lastActivityTimestamp: null,
    portalName: null, portalId: null, apiErrors: [],
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Fetch pipelines for stage label resolution
  console.log('[hubspot-poll] Fetching pipelines...');
  const pipelines = await fetchPipelines(headers);
  metrics.pipelineCount = pipelines.length;
  metrics.pipelineNames = pipelines.map(p => p.label);
  const stageLabelMap = buildStageLabelMap(pipelines);
  console.log('[hubspot-poll] Pipelines:', metrics.pipelineCount, 'Stage labels:', Object.keys(stageLabelMap).length);

  await new Promise(resolve => setTimeout(resolve, 100));

  // 2. Fetch ALL deals with pagination
  console.log('[hubspot-poll] Fetching deals with pagination...');
  const allDeals: HubSpotDeal[] = [];
  let dealsAfter: string | undefined;
  let pageCount = 0;

  try {
    do {
      const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/deals`);
      url.searchParams.set('limit', '100');
      url.searchParams.set('properties', 'dealname,dealstage,pipeline,amount,closedate,createdate,hs_lastmodifieddate,notes_last_updated,num_notes');
      if (dealsAfter) url.searchParams.set('after', dealsAfter);

      const dealsResponse = await fetch(url.toString(), { headers });
      pageCount++;

      if (!dealsResponse.ok) {
        const errText = await dealsResponse.text();
        console.error('[hubspot-poll] Failed to fetch deals page', pageCount, ':', dealsResponse.status, errText);
        metrics.apiErrors.push(`deals_fetch_page${pageCount}: ${dealsResponse.status}`);
        break;
      }

      const dealsData = await dealsResponse.json();
      const pageDeals: HubSpotDeal[] = dealsData.results || [];
      allDeals.push(...pageDeals);

      if (dealsData.total !== undefined) { metrics.totalDeals = dealsData.total; }
      dealsAfter = dealsData.paging?.next?.after;

      if (dealsAfter && pageCount < MAX_PAGES) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } while (dealsAfter && pageCount < MAX_PAGES);

    if (metrics.totalDeals === 0) { metrics.totalDeals = allDeals.length; }
    metrics.dealsAnalyzed = allDeals.length;
    console.log('[hubspot-poll] Fetched', allDeals.length, 'deals across', pageCount, 'pages (total:', metrics.totalDeals, ')');

    const now = Date.now();
    const stalledThresholdMs = STALLED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let totalAge = 0;

    for (const deal of allDeals) {
      const amount = parseFloat(deal.properties.amount || '0');
      const stage = deal.properties.dealstage || 'unknown';
      const stageLabel = stageLabelMap[stage] || stage;
      const lastModified = deal.properties.hs_lastmodifieddate;
      const createDate = deal.properties.createdate;
      const dealName = deal.properties.dealname || `Deal ${deal.id}`;

      metrics.dealsByStage[stage] = (metrics.dealsByStage[stage] || 0) + 1;
      metrics.dealsByStageLabel[stageLabel] = (metrics.dealsByStageLabel[stageLabel] || 0) + 1;

      if (createDate && (now - new Date(createDate).getTime()) < sevenDaysMs) { metrics.recentDeals7d++; }

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

        if (lastModified) {
          const lastModifiedTime = new Date(lastModified).getTime();
          const daysSinceModified = (now - lastModifiedTime) / (24 * 60 * 60 * 1000);

          if (now - lastModifiedTime > stalledThresholdMs) {
            metrics.stalledDeals++;
            if (metrics.stalledDealNames.length < 10) { metrics.stalledDealNames.push(dealName); }
          }
          if (now - lastModifiedTime > fourteenDaysMs) { metrics.dealsStuckOver14d++; }
          if (daysSinceModified > metrics.maxStageDays) { metrics.maxStageDays = Math.round(daysSinceModified); }
        }

        if (createDate) {
          const ageMs = now - new Date(createDate).getTime();
          totalAge += ageMs / (24 * 60 * 60 * 1000);
        }
      }

      if (lastModified) {
        if (!metrics.lastDealActivity || lastModified > metrics.lastDealActivity) { metrics.lastDealActivity = lastModified; }
        if (!metrics.lastActivityTimestamp || lastModified > metrics.lastActivityTimestamp) { metrics.lastActivityTimestamp = lastModified; }
      }
    }

    if (metrics.openDeals > 0) { metrics.avgDealAge = Math.round(totalAge / metrics.openDeals); }
  } catch (error) {
    console.error('[hubspot-poll] Error fetching deals:', error);
    metrics.apiErrors.push(`deals_error: ${error instanceof Error ? error.message : String(error)}`);
  }

  await new Promise(resolve => setTimeout(resolve, 150));

  // 3. Fetch contacts count
  console.log('[hubspot-poll] Fetching contacts...');
  try {
    const contactsResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`, { headers });
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      metrics.totalContacts = contactsData.total || 0;
    } else {
      const errText = await contactsResponse.text();
      console.error('[hubspot-poll] Failed to fetch contacts:', contactsResponse.status, errText);
      metrics.apiErrors.push(`contacts_fetch: ${contactsResponse.status}`);
    }
  } catch (error) {
    console.error('[hubspot-poll] Error fetching contacts:', error);
    metrics.apiErrors.push(`contacts_error: ${error instanceof Error ? error.message : String(error)}`);
  }

  await new Promise(resolve => setTimeout(resolve, 150));

  // 4. Fetch recently created contacts (last 7 days)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentContactsResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST', headers,
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: sevenDaysAgo }] }], limit: 1 }),
    });
    if (recentContactsResponse.ok) {
      const recentData = await recentContactsResponse.json();
      metrics.recentContacts7d = recentData.total || 0;
    } else { console.warn('[hubspot-poll] Recent contacts search failed:', recentContactsResponse.status); }
  } catch (error) { console.warn('[hubspot-poll] Error fetching recent contacts:', error); }

  await new Promise(resolve => setTimeout(resolve, 150));

  // 5. Fetch companies count
  console.log('[hubspot-poll] Fetching companies...');
  try {
    const companiesResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/companies?limit=1`, { headers });
    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      metrics.totalCompanies = companiesData.total || 0;
    } else {
      console.warn('[hubspot-poll] Failed to fetch companies:', companiesResponse.status);
      metrics.apiErrors.push(`companies_fetch: ${companiesResponse.status}`);
    }
  } catch (error) { console.warn('[hubspot-poll] Error fetching companies:', error); }

  await new Promise(resolve => setTimeout(resolve, 150));

  // 6. Get account info
  console.log('[hubspot-poll] Fetching account info...');
  try {
    const accountResponse = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, { headers });
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      metrics.portalName = accountData.companyName || accountData.portalId?.toString() || null;
      metrics.portalId = accountData.portalId?.toString() || null;
    } else { console.warn('[hubspot-poll] Failed to fetch account info:', accountResponse.status); }
  } catch (error) { console.warn('[hubspot-poll] Error fetching account info:', error); }

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

    console.log('[hubspot-poll] Starting HubSpot poll run');

    const { data: hubspotIntegrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id,
        user_id,
        user_integration_id,
        integration_registry_id,
        access_token_secret_id,
        refresh_token_secret_id,
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
      console.log('[hubspot-poll] No HubSpot integrations found');
      return new Response(JSON.stringify({ message: 'No HubSpot integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[hubspot-poll] Found', hubspotIntegrations.length, 'HubSpot integration(s)');

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

        const tokenStr = String(accessToken);
        console.log('[hubspot-poll] Token retrieved for user:', integration.user_id, { token_length: tokenStr.length });

        // Check token expiration and attempt refresh if needed
        let currentToken = tokenStr;
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[hubspot-poll] Token expired, attempting refresh for user:', integration.user_id);
          const refreshedToken = await refreshHubSpotToken(
            supabase, integration.id,
            (integration as Record<string, unknown>).refresh_token_secret_id as string | null,
            integration.access_token_secret_id,
          );
          if (refreshedToken) {
            currentToken = refreshedToken;
            console.log('[hubspot-poll] Token refreshed successfully for user:', integration.user_id);
          } else {
            console.error('[hubspot-poll] Token refresh failed for user:', integration.user_id);
            errors.push(`Token expired and refresh failed for user ${integration.user_id}`);
            if (integration.user_integration_id) {
              await supabase.from('user_integrations').update({
                error_message: 'HubSpot token expired and could not be refreshed. Please reconnect.',
                last_error_at: now.toISOString(),
                consecutive_failures: 1,
              }).eq('id', integration.user_integration_id);
            }
            continue;
          }
        }

        // Fetch metrics from HubSpot API
        console.log('[hubspot-poll] Fetching HubSpot metrics for user:', integration.user_id);
        const metrics = await fetchHubSpotMetrics(currentToken);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();

        // Structured logging: API response status + records retrieved
        console.log('[hubspot-poll] Records retrieved', {
          user_id: integration.user_id,
          total_deals: metrics.totalDeals,
          deals_analyzed: metrics.dealsAnalyzed,
          open_deals: metrics.openDeals,
          stalled_deals: metrics.stalledDeals,
          total_contacts: metrics.totalContacts,
          total_companies: metrics.totalCompanies,
          pipeline_count: metrics.pipelineCount,
          api_errors: metrics.apiErrors.length,
        });

        // Insert integration event with comprehensive CRM metrics
        const { error: eventError } = await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'hubspot',
          event_type: 'hubspot.crm_activity',
          occurred_at: eventTime,
          source: 'hubspot_api_poll',
          metadata: {
            total_deals: metrics.totalDeals,
            deals_analyzed: metrics.dealsAnalyzed,
            open_deals: metrics.openDeals,
            won_deals: metrics.wonDeals,
            lost_deals: metrics.lostDeals,
            stalled_deals: metrics.stalledDeals,
            stalled_deal_names: metrics.stalledDealNames,
            recent_deals_7d: metrics.recentDeals7d,
            deals_stuck_over_14d: metrics.dealsStuckOver14d,
            max_stage_days: metrics.maxStageDays,
            total_pipeline_value: metrics.totalPipelineValue,
            open_pipeline_value: metrics.openPipelineValue,
            avg_deal_age_days: metrics.avgDealAge,
            deals_by_stage: metrics.dealsByStage,
            deals_by_stage_label: metrics.dealsByStageLabel,
            total_contacts: metrics.totalContacts,
            recent_contacts_7d: metrics.recentContacts7d,
            total_companies: metrics.totalCompanies,
            pipeline_count: metrics.pipelineCount,
            pipeline_names: metrics.pipelineNames,
            last_deal_activity: metrics.lastDealActivity,
            portal_name: metrics.portalName,
            portal_id: metrics.portalId,
            poll_timestamp: now.toISOString(),
            api_errors: metrics.apiErrors.length > 0 ? metrics.apiErrors.slice(0, 10) : undefined,
          },
        });

        // Structured logging: write success/failure
        if (eventError) {
          console.error('[hubspot-poll] Event write FAILED', {
            user_id: integration.user_id, error: eventError.message,
          });
          errors.push(`Event insert error for user ${integration.user_id}: ${eventError.message}`);
        } else {
          console.log('[hubspot-poll] Event write SUCCESS', {
            user_id: integration.user_id,
            records_written: 1,
            deals: metrics.totalDeals,
            contacts: metrics.totalContacts,
            companies: metrics.totalCompanies,
          });
        }

        // Update ingestion state with 15-minute rate limiting
        const { error: stateError } = await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'hubspot',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        if (stateError) { console.error('[hubspot-poll] Error updating ingestion state:', stateError); }

        // Update user_integrations config with CRM transparency data
        if (integration.user_integration_id) {
          const configUpdate: Record<string, unknown> = {
            total_deals: metrics.totalDeals, deals_analyzed: metrics.dealsAnalyzed,
            open_deals: metrics.openDeals, won_deals: metrics.wonDeals, lost_deals: metrics.lostDeals,
            stalled_deals: metrics.stalledDeals, total_contacts: metrics.totalContacts,
            recent_contacts_7d: metrics.recentContacts7d, total_companies: metrics.totalCompanies,
            pipeline_count: metrics.pipelineCount, pipeline_names: metrics.pipelineNames,
            avg_deal_age_days: metrics.avgDealAge, open_pipeline_value: metrics.openPipelineValue,
            total_pipeline_value: metrics.totalPipelineValue,
            deals_by_stage_label: metrics.dealsByStageLabel,
            crm_synced_at: now.toISOString(),
            portal_name: metrics.portalName, portal_id: metrics.portalId,
            last_api_errors: metrics.apiErrors.length > 0 ? metrics.apiErrors.slice(0, 5) : [],
            data_completeness: {
              deals_analyzed: metrics.dealsAnalyzed, deals_total: metrics.totalDeals,
              coverage_pct: metrics.totalDeals > 0 ? Math.round((metrics.dealsAnalyzed / metrics.totalDeals) * 100) : 100,
            },
          };

          const { data: existingIntegration } = await supabase
            .from('user_integrations').select('config')
            .eq('id', integration.user_integration_id).single();

          const existingConfig = (existingIntegration?.config as Record<string, unknown>) || {};
          const mergedConfig = { ...existingConfig, ...configUpdate };

          await supabase.from('user_integrations').update({
            config: mergedConfig, error_message: null,
            consecutive_failures: 0, updated_at: now.toISOString(),
          }).eq('id', integration.user_integration_id);
        }

        processedCount++;
        console.log('[hubspot-poll] Poll complete for user', {
          user_id: integration.user_id,
          deals: metrics.totalDeals,
          contacts: metrics.totalContacts,
          companies: metrics.totalCompanies,
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
    console.error('[hubspot-poll] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
