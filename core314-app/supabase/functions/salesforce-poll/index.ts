import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Salesforce Poll Function
 * 
 * Fetches real CRM data from Salesforce API (Core Objects):
 * - Accounts (counts by type)
 * - Contacts (total count)
 * - Opportunities (counts by stage, open vs closed, pipeline value)
 * - Tasks (total and open counts)
 * - Events (total count)
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
  otherAccounts: number;
  contactCount: number;
  opportunityCount: number;
  openOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  opportunityValue: number;
  openOpportunityValue: number;
  taskCount: number;
  openTasks: number;
  eventCount: number;
  caseCount: number;
  newCases: number;
  openCases: number;
  closedCases: number;
  escalatedCases: number;
  lastActivityTimestamp: string | null;
  orgName: string | null;
  // Debug info
  apiErrors: string[];
  rawCounts: Record<string, number>;
}

// Helper to execute SOQL query with detailed error logging
async function executeSoqlQuery(
  apiBase: string, 
  headers: Record<string, string>, 
  query: string, 
  objectName: string
): Promise<{ records: unknown[]; totalSize: number; error?: string }> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `${apiBase}/query?q=${encodedQuery}`;
    console.log(`[salesforce-poll] Executing SOQL for ${objectName}: ${query}`);
    
    const response = await fetch(url, { headers });
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[salesforce-poll] ${objectName} query failed:`, {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500),
      });
      return { records: [], totalSize: 0, error: `${response.status}: ${responseText.substring(0, 200)}` };
    }
    
    const data = JSON.parse(responseText);
    console.log(`[salesforce-poll] ${objectName} query success: ${data.totalSize} records`);
    return { records: data.records || [], totalSize: data.totalSize || 0 };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[salesforce-poll] ${objectName} query exception:`, errorMsg);
    return { records: [], totalSize: 0, error: errorMsg };
  }
}

async function fetchSalesforceMetrics(accessToken: string, instanceUrl: string): Promise<SalesforceMetrics> {
  const metrics: SalesforceMetrics = {
    accountCount: 0,
    customerAccounts: 0,
    prospectAccounts: 0,
    otherAccounts: 0,
    contactCount: 0,
    opportunityCount: 0,
    openOpportunities: 0,
    wonOpportunities: 0,
    lostOpportunities: 0,
    opportunityValue: 0,
    openOpportunityValue: 0,
    taskCount: 0,
    openTasks: 0,
    eventCount: 0,
    caseCount: 0,
    newCases: 0,
    openCases: 0,
    closedCases: 0,
    escalatedCases: 0,
    lastActivityTimestamp: null,
    orgName: null,
    apiErrors: [],
    rawCounts: {},
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const apiBase = `${instanceUrl}/services/data/v58.0`;
  console.log(`[salesforce-poll] Starting data fetch from: ${instanceUrl}`);

  try {
    // 1. Fetch Organization Info (query the Organization object directly)
    try {
      const orgResponse = await fetch(`${apiBase}/query?q=${encodeURIComponent('SELECT Id, Name FROM Organization LIMIT 1')}`, { headers });
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        if (orgData.records && orgData.records.length > 0) {
          metrics.orgName = orgData.records[0].Name || null;
          console.log(`[salesforce-poll] Organization: ${metrics.orgName}`);
        }
      } else {
        console.log('[salesforce-poll] Could not fetch org name, continuing...');
      }
    } catch (orgError) {
      console.log('[salesforce-poll] Org query error (non-fatal):', orgError);
    }

    // 2. Fetch ALL Accounts (no date filter - get total count)
    // Using COUNT() for efficiency, then a separate query for type breakdown
    const accountCountResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Account',
      'Account (count)'
    );
    
    if (!accountCountResult.error) {
      metrics.accountCount = accountCountResult.totalSize;
      metrics.rawCounts['accounts_total'] = accountCountResult.totalSize;
    } else {
      metrics.apiErrors.push(`Account count: ${accountCountResult.error}`);
    }

    // Get account type breakdown (sample up to 2000 for type analysis)
    const accountTypeResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT Id, Type FROM Account LIMIT 2000',
      'Account (types)'
    );
    
    if (!accountTypeResult.error) {
      const accounts = accountTypeResult.records as Array<{ Id: string; Type: string | null }>;
      for (const account of accounts) {
        const accountType = (account.Type || '').toLowerCase();
        // More flexible type matching
        if (accountType.includes('customer')) {
          metrics.customerAccounts++;
        } else if (accountType.includes('prospect') || accountType.includes('lead')) {
          metrics.prospectAccounts++;
        } else {
          metrics.otherAccounts++;
        }
      }
      // If we got fewer records than total, scale up the type counts proportionally
      if (accounts.length > 0 && accounts.length < metrics.accountCount) {
        const scaleFactor = metrics.accountCount / accounts.length;
        metrics.customerAccounts = Math.round(metrics.customerAccounts * scaleFactor);
        metrics.prospectAccounts = Math.round(metrics.prospectAccounts * scaleFactor);
        metrics.otherAccounts = Math.round(metrics.otherAccounts * scaleFactor);
      }
      metrics.rawCounts['accounts_sampled'] = accounts.length;
      metrics.rawCounts['customer_accounts'] = metrics.customerAccounts;
      metrics.rawCounts['prospect_accounts'] = metrics.prospectAccounts;
    }

    // 3. Fetch ALL Contacts (no date filter)
    const contactResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Contact',
      'Contact'
    );
    
    if (!contactResult.error) {
      metrics.contactCount = contactResult.totalSize;
      metrics.rawCounts['contacts_total'] = contactResult.totalSize;
    } else {
      metrics.apiErrors.push(`Contact count: ${contactResult.error}`);
    }

    // 4. Fetch ALL Opportunities (no date filter for total count)
    const oppCountResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Opportunity',
      'Opportunity (count)'
    );
    
    if (!oppCountResult.error) {
      metrics.opportunityCount = oppCountResult.totalSize;
      metrics.rawCounts['opportunities_total'] = oppCountResult.totalSize;
    } else {
      metrics.apiErrors.push(`Opportunity count: ${oppCountResult.error}`);
    }

    // Get opportunity details for stage/value breakdown
    const oppDetailResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT Id, StageName, IsClosed, IsWon, Amount FROM Opportunity LIMIT 2000',
      'Opportunity (details)'
    );
    
    if (!oppDetailResult.error) {
      const opportunities = oppDetailResult.records as Array<{ 
        Id: string; StageName: string; IsClosed: boolean; IsWon: boolean; Amount: number | null 
      }>;
      
      for (const opp of opportunities) {
        if (opp.IsClosed) {
          if (opp.IsWon) {
            metrics.wonOpportunities++;
          } else {
            metrics.lostOpportunities++;
          }
        } else {
          metrics.openOpportunities++;
          metrics.openOpportunityValue += opp.Amount || 0;
        }
        metrics.opportunityValue += opp.Amount || 0;
      }
      
      // Scale if needed
      if (opportunities.length > 0 && opportunities.length < metrics.opportunityCount) {
        const scaleFactor = metrics.opportunityCount / opportunities.length;
        metrics.openOpportunities = Math.round(metrics.openOpportunities * scaleFactor);
        metrics.wonOpportunities = Math.round(metrics.wonOpportunities * scaleFactor);
        metrics.lostOpportunities = Math.round(metrics.lostOpportunities * scaleFactor);
        metrics.opportunityValue = Math.round(metrics.opportunityValue * scaleFactor);
        metrics.openOpportunityValue = Math.round(metrics.openOpportunityValue * scaleFactor);
      }
      
      metrics.rawCounts['opportunities_sampled'] = opportunities.length;
      metrics.rawCounts['open_opportunities'] = metrics.openOpportunities;
      metrics.rawCounts['pipeline_value'] = metrics.openOpportunityValue;
    }

    // 5. Fetch ALL Tasks
    const taskCountResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Task',
      'Task (count)'
    );
    
    if (!taskCountResult.error) {
      metrics.taskCount = taskCountResult.totalSize;
      metrics.rawCounts['tasks_total'] = taskCountResult.totalSize;
    } else {
      // Tasks might not be accessible - log but don't fail
      console.log('[salesforce-poll] Tasks not accessible:', taskCountResult.error);
    }

    // Get open tasks count
    const openTaskResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Task WHERE IsClosed = false',
      'Task (open)'
    );
    
    if (!openTaskResult.error) {
      metrics.openTasks = openTaskResult.totalSize;
      metrics.rawCounts['open_tasks'] = openTaskResult.totalSize;
    }

    // 6. Fetch ALL Events
    const eventResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Event',
      'Event'
    );
    
    if (!eventResult.error) {
      metrics.eventCount = eventResult.totalSize;
      metrics.rawCounts['events_total'] = eventResult.totalSize;
    } else {
      // Events might not be accessible - log but don't fail
      console.log('[salesforce-poll] Events not accessible:', eventResult.error);
    }

    // 7. Fetch ALL Cases (if Cases are enabled)
    const caseCountResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT COUNT() FROM Case',
      'Case (count)'
    );
    
    if (!caseCountResult.error) {
      metrics.caseCount = caseCountResult.totalSize;
      metrics.rawCounts['cases_total'] = caseCountResult.totalSize;
    } else {
      // Cases might not be enabled - this is OK
      console.log('[salesforce-poll] Cases not available:', caseCountResult.error);
    }

    // Get case details for status breakdown
    if (metrics.caseCount > 0) {
      const caseDetailResult = await executeSoqlQuery(
        apiBase, headers,
        'SELECT Id, Status, IsClosed, IsEscalated FROM Case LIMIT 2000',
        'Case (details)'
      );
      
      if (!caseDetailResult.error) {
        const cases = caseDetailResult.records as Array<{ 
          Id: string; Status: string; IsClosed: boolean; IsEscalated: boolean 
        }>;
        
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
        }
        
        // Scale if needed
        if (cases.length > 0 && cases.length < metrics.caseCount) {
          const scaleFactor = metrics.caseCount / cases.length;
          metrics.newCases = Math.round(metrics.newCases * scaleFactor);
          metrics.openCases = Math.round(metrics.openCases * scaleFactor);
          metrics.closedCases = Math.round(metrics.closedCases * scaleFactor);
          metrics.escalatedCases = Math.round(metrics.escalatedCases * scaleFactor);
        }
        
        metrics.rawCounts['cases_sampled'] = cases.length;
        metrics.rawCounts['open_cases'] = metrics.openCases;
      }
    }

    // 8. Get last activity timestamp from recent records
    const recentActivityResult = await executeSoqlQuery(
      apiBase, headers,
      'SELECT LastModifiedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT 1',
      'Recent Activity'
    );
    
    if (!recentActivityResult.error && recentActivityResult.records.length > 0) {
      const record = recentActivityResult.records[0] as { LastModifiedDate: string };
      metrics.lastActivityTimestamp = record.LastModifiedDate;
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[salesforce-poll] Error fetching Salesforce metrics:', errorMsg);
    metrics.apiErrors.push(`General error: ${errorMsg}`);
  }

  console.log('[salesforce-poll] Final metrics:', {
    accounts: metrics.accountCount,
    contacts: metrics.contactCount,
    opportunities: metrics.opportunityCount,
    openOpportunities: metrics.openOpportunities,
    pipelineValue: metrics.openOpportunityValue,
    tasks: metrics.taskCount,
    events: metrics.eventCount,
    cases: metrics.caseCount,
    errors: metrics.apiErrors.length,
  });

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
          continue;
        }

        // Get access token from vault using RPC function
        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[salesforce-poll] No access token found for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

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

        // Insert integration event with CRM metrics (always write, even with 0 data)
        // This ensures the dashboard can display metrics even for empty/new orgs
        await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'salesforce',
          event_type: 'salesforce.crm_activity',
          occurred_at: eventTime,
          source: 'salesforce_api_poll',
          metadata: {
            // Accounts (matching integration_metric_definitions source_field_path)
            account_count: metrics.accountCount,
            customer_accounts: metrics.customerAccounts,
            prospect_accounts: metrics.prospectAccounts,
            other_accounts: metrics.otherAccounts,
            // Contacts
            contact_count: metrics.contactCount,
            // Opportunities
            opportunity_count: metrics.opportunityCount,
            open_opportunities: metrics.openOpportunities,
            won_opportunities: metrics.wonOpportunities,
            lost_opportunities: metrics.lostOpportunities,
            opportunity_value: metrics.opportunityValue,
            open_opportunity_value: metrics.openOpportunityValue,
            pipeline_value: metrics.openOpportunityValue, // Pipeline = open opportunities value
            // Tasks
            task_count: metrics.taskCount,
            open_tasks: metrics.openTasks,
            // Events
            event_count: metrics.eventCount,
            // Cases
            case_count: metrics.caseCount,
            new_cases: metrics.newCases,
            open_cases: metrics.openCases,
            closed_cases: metrics.closedCases,
            escalated_cases: metrics.escalatedCases,
            // Metadata
            org_name: metrics.orgName,
            poll_timestamp: now.toISOString(),
            // Debug info (will be removed after validation)
            api_errors: metrics.apiErrors,
            raw_counts: metrics.rawCounts,
          },
        });

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

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: sfIntegrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[salesforce-poll] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
