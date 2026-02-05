import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Salesforce Poll Function
 * 
 * Fetches real CRM data from Salesforce API (Core Objects ONLY):
 * - Accounts (counts by type)
 * - Opportunities (counts by stage, open vs closed)
 * - Cases (counts by status, backlog volume)
 * 
 * SCOPE LIMITATION: Does NOT touch marketing automation or custom objects.
 * 
 * Data is persisted to integration_events table and feeds into
 * universal-intelligence-aggregator for Fusion Score contribution.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SalesforceMetrics {
  accountCount: number;
  customerAccounts: number;
  prospectAccounts: number;
  opportunityCount: number;
  openOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  opportunityValue: number;
  caseCount: number;
  newCases: number;
  openCases: number;
  closedCases: number;
  escalatedCases: number;
  lastActivityTimestamp: string | null;
  orgName: string | null;
}

async function fetchSalesforceMetrics(accessToken: string, instanceUrl: string): Promise<SalesforceMetrics> {
  const metrics: SalesforceMetrics = {
    accountCount: 0,
    customerAccounts: 0,
    prospectAccounts: 0,
    opportunityCount: 0,
    openOpportunities: 0,
    wonOpportunities: 0,
    lostOpportunities: 0,
    opportunityValue: 0,
    caseCount: 0,
    newCases: 0,
    openCases: 0,
    closedCases: 0,
    escalatedCases: 0,
    lastActivityTimestamp: null,
    orgName: null,
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const apiBase = `${instanceUrl}/services/data/v58.0`;

  try {
    // 1. Fetch Organization Info
    const orgResponse = await fetch(`${apiBase}/sobjects/Organization/describe`, { headers });
    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      metrics.orgName = orgData.name || null;
    }

    // 2. Fetch Accounts (last 90 days modified)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const accountQuery = encodeURIComponent(
      `SELECT Id, Type, LastModifiedDate FROM Account WHERE LastModifiedDate >= ${ninetyDaysAgo} LIMIT 1000`
    );
    
    const accountResponse = await fetch(`${apiBase}/query?q=${accountQuery}`, { headers });
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      const accounts = accountData.records || [];
      
      metrics.accountCount = accounts.length;
      for (const account of accounts) {
        if (account.Type === 'Customer' || account.Type === 'Customer - Direct' || account.Type === 'Customer - Channel') {
          metrics.customerAccounts++;
        } else if (account.Type === 'Prospect') {
          metrics.prospectAccounts++;
        }
        
        if (account.LastModifiedDate) {
          if (!metrics.lastActivityTimestamp || account.LastModifiedDate > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = account.LastModifiedDate;
          }
        }
      }
    } else {
      console.log('[salesforce-poll] Failed to fetch accounts:', accountResponse.status);
    }

    // 3. Fetch Opportunities (last 90 days)
    const oppQuery = encodeURIComponent(
      `SELECT Id, StageName, IsClosed, IsWon, Amount, LastModifiedDate FROM Opportunity WHERE LastModifiedDate >= ${ninetyDaysAgo} LIMIT 1000`
    );
    
    const oppResponse = await fetch(`${apiBase}/query?q=${oppQuery}`, { headers });
    if (oppResponse.ok) {
      const oppData = await oppResponse.json();
      const opportunities = oppData.records || [];
      
      metrics.opportunityCount = opportunities.length;
      for (const opp of opportunities) {
        if (opp.IsClosed) {
          if (opp.IsWon) {
            metrics.wonOpportunities++;
          } else {
            metrics.lostOpportunities++;
          }
        } else {
          metrics.openOpportunities++;
        }
        
        metrics.opportunityValue += opp.Amount || 0;
        
        if (opp.LastModifiedDate) {
          if (!metrics.lastActivityTimestamp || opp.LastModifiedDate > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = opp.LastModifiedDate;
          }
        }
      }
    } else {
      console.log('[salesforce-poll] Failed to fetch opportunities:', oppResponse.status);
    }

    // 4. Fetch Cases (last 90 days) - if Cases are enabled
    const caseQuery = encodeURIComponent(
      `SELECT Id, Status, IsClosed, IsEscalated, LastModifiedDate FROM Case WHERE LastModifiedDate >= ${ninetyDaysAgo} LIMIT 1000`
    );
    
    const caseResponse = await fetch(`${apiBase}/query?q=${caseQuery}`, { headers });
    if (caseResponse.ok) {
      const caseData = await caseResponse.json();
      const cases = caseData.records || [];
      
      metrics.caseCount = cases.length;
      for (const c of cases) {
        if (c.Status === 'New') {
          metrics.newCases++;
        }
        
        if (c.IsClosed) {
          metrics.closedCases++;
        } else {
          metrics.openCases++;
        }
        
        if (c.IsEscalated) {
          metrics.escalatedCases++;
        }
        
        if (c.LastModifiedDate) {
          if (!metrics.lastActivityTimestamp || c.LastModifiedDate > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = c.LastModifiedDate;
          }
        }
      }
    } else {
      // Cases might not be enabled - this is OK
      console.log('[salesforce-poll] Cases not available or error:', caseResponse.status);
    }

  } catch (error) {
    console.error('[salesforce-poll] Error fetching Salesforce metrics:', error);
  }

  return metrics;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runStartTime = Date.now();
  const runTimestamp = new Date().toISOString();
  let recordsFetched = 0;
  let recordsWritten = 0;
  let usersProcessed = 0;
  let usersSkipped = 0;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all active Salesforce integrations with OAuth tokens
    const { data: sfIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'salesforce');

    if (intError) {
      console.error('[salesforce-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!sfIntegrations || sfIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Salesforce integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of sfIntegrations) {
      try {
        // Check rate limiting
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'salesforce')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[salesforce-poll] Skipping user (rate limited):', integration.user_id);
          usersSkipped++;
          continue;
        }

        // Get access token from vault
        const { data: tokenData } = await supabase
          .from('vault.decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', integration.access_token_secret_id)
          .single();

        if (!tokenData?.decrypted_secret) {
          console.error('[salesforce-poll] No access token found for user:', integration.user_id);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = tokenData.decrypted_secret;

        // Check token expiration
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[salesforce-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // Get instance_url from user_integrations config
        const { data: userIntegration } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('id', integration.user_integration_id)
          .single();

        const instanceUrl = (userIntegration?.config as { instance_url?: string })?.instance_url;
        
        if (!instanceUrl) {
          console.error('[salesforce-poll] No instance_url found for user:', integration.user_id);
          errors.push(`No instance_url for user ${integration.user_id}`);
          continue;
        }

        // Fetch metrics from Salesforce API
        const metrics = await fetchSalesforceMetrics(accessToken, instanceUrl);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();
        
        // Track records fetched
        recordsFetched += metrics.accountCount + metrics.opportunityCount + metrics.caseCount;

        // Insert integration event with CRM metrics
        const hasData = metrics.accountCount > 0 || metrics.opportunityCount > 0 || metrics.caseCount > 0;

        if (hasData) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'salesforce',
            event_type: 'salesforce.crm_activity',
            occurred_at: eventTime,
            source: 'salesforce_api_poll',
            payload: {
              // Accounts
              account_count: metrics.accountCount,
              customer_accounts: metrics.customerAccounts,
              prospect_accounts: metrics.prospectAccounts,
              // Opportunities
              opportunity_count: metrics.opportunityCount,
              open_opportunities: metrics.openOpportunities,
              won_opportunities: metrics.wonOpportunities,
              lost_opportunities: metrics.lostOpportunities,
              opportunity_value: metrics.opportunityValue,
              // Cases
              case_count: metrics.caseCount,
              new_cases: metrics.newCases,
              open_cases: metrics.openCases,
              closed_cases: metrics.closedCases,
              escalated_cases: metrics.escalatedCases,
              // Metadata
              org_name: metrics.orgName,
              data_range_days: 90,
              poll_timestamp: now.toISOString(),
            },
          });
          recordsWritten++;
        }

        // Update ingestion state with rate limiting (15 minute interval)
        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'salesforce',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        usersProcessed++;
        console.log('[salesforce-poll] Processed user:', integration.user_id, {
          accounts: metrics.accountCount,
          opportunities: metrics.opportunityCount,
          cases: metrics.caseCount,
        });
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[salesforce-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    // Log run metadata
    const runDurationMs = Date.now() - runStartTime;
    await supabase.from('poll_run_logs').insert({
      integration_name: 'salesforce',
      run_timestamp: runTimestamp,
      run_duration_ms: runDurationMs,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: true,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      metadata: { total_integrations: sfIntegrations.length, errors_count: errors.length },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: sfIntegrations.length,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      run_duration_ms: runDurationMs,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[salesforce-poll] Error:', error);
    
    // Log failed run
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await supabase.from('poll_run_logs').insert({
      integration_name: 'salesforce',
      run_timestamp: runTimestamp,
      run_duration_ms: Date.now() - runStartTime,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: false,
      error_message: errorMessage,
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
