import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Xero Poll Function
 * 
 * Fetches real financial data from Xero API:
 * - Invoices (counts, totals, statuses)
 * - Payments (counts, totals)
 * - Accounts (high-level structure)
 * 
 * Data is persisted to integration_events table and feeds into
 * universal-intelligence-aggregator for Fusion Score contribution.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

interface XeroMetrics {
  invoiceCount: number;
  invoiceTotal: number;
  draftInvoices: number;
  submittedInvoices: number;
  authorisedInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  paymentCount: number;
  paymentTotal: number;
  accountCount: number;
  bankAccounts: number;
  revenueAccounts: number;
  expenseAccounts: number;
  lastActivityTimestamp: string | null;
  organisationName: string | null;
}

async function fetchXeroMetrics(accessToken: string, tenantId: string): Promise<XeroMetrics> {
  const metrics: XeroMetrics = {
    invoiceCount: 0,
    invoiceTotal: 0,
    draftInvoices: 0,
    submittedInvoices: 0,
    authorisedInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    paymentCount: 0,
    paymentTotal: 0,
    accountCount: 0,
    bankAccounts: 0,
    revenueAccounts: 0,
    expenseAccounts: 0,
    lastActivityTimestamp: null,
    organisationName: null,
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Xero-Tenant-Id': tenantId,
    'Accept': 'application/json',
  };

  try {
    // 1. Fetch Organisation Info
    const orgResponse = await fetch(`${XERO_API_BASE}/Organisation`, { headers });
    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      metrics.organisationName = orgData.Organisations?.[0]?.Name || null;
    }

    // 2. Fetch Invoices (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const invoiceUrl = `${XERO_API_BASE}/Invoices?where=Date>DateTime(${ninetyDaysAgo.replace(/-/g, ',')})`;
    
    const invoiceResponse = await fetch(invoiceUrl, { headers });
    if (invoiceResponse.ok) {
      const invoiceData = await invoiceResponse.json();
      const invoices = invoiceData.Invoices || [];
      
      metrics.invoiceCount = invoices.length;
      const now = new Date();
      
      for (const invoice of invoices) {
        metrics.invoiceTotal += invoice.Total || 0;
        
        // Xero statuses: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED
        switch (invoice.Status) {
          case 'DRAFT':
            metrics.draftInvoices++;
            break;
          case 'SUBMITTED':
            metrics.submittedInvoices++;
            break;
          case 'AUTHORISED':
            metrics.authorisedInvoices++;
            // Check if overdue
            if (invoice.DueDate) {
              const dueDate = new Date(invoice.DueDate);
              if (dueDate < now && invoice.AmountDue > 0) {
                metrics.overdueInvoices++;
              }
            }
            break;
          case 'PAID':
            metrics.paidInvoices++;
            break;
        }
        
        if (invoice.UpdatedDateUTC) {
          const updatedDate = invoice.UpdatedDateUTC.replace('/Date(', '').replace('+0000)/', '');
          const timestamp = new Date(parseInt(updatedDate)).toISOString();
          if (!metrics.lastActivityTimestamp || timestamp > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = timestamp;
          }
        }
      }
    } else {
      console.log('[xero-poll] Failed to fetch invoices:', invoiceResponse.status);
    }

    // 3. Fetch Payments (last 90 days)
    const paymentUrl = `${XERO_API_BASE}/Payments?where=Date>DateTime(${ninetyDaysAgo.replace(/-/g, ',')})`;
    
    const paymentResponse = await fetch(paymentUrl, { headers });
    if (paymentResponse.ok) {
      const paymentData = await paymentResponse.json();
      const payments = paymentData.Payments || [];
      
      metrics.paymentCount = payments.length;
      for (const payment of payments) {
        metrics.paymentTotal += payment.Amount || 0;
      }
    } else {
      console.log('[xero-poll] Failed to fetch payments:', paymentResponse.status);
    }

    // 4. Fetch Accounts (chart of accounts)
    const accountResponse = await fetch(`${XERO_API_BASE}/Accounts`, { headers });
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      const accounts = accountData.Accounts || [];
      
      metrics.accountCount = accounts.length;
      for (const account of accounts) {
        if (account.Type === 'BANK') {
          metrics.bankAccounts++;
        } else if (account.Type === 'REVENUE') {
          metrics.revenueAccounts++;
        } else if (account.Type === 'EXPENSE' || account.Type === 'OVERHEADS' || account.Type === 'DIRECTCOSTS') {
          metrics.expenseAccounts++;
        }
      }
    } else {
      console.log('[xero-poll] Failed to fetch accounts:', accountResponse.status);
    }

  } catch (error) {
    console.error('[xero-poll] Error fetching Xero metrics:', error);
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

    // Fetch all active Xero integrations with OAuth tokens
    const { data: xeroIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'xero');

    if (intError) {
      console.error('[xero-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!xeroIntegrations || xeroIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Xero integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of xeroIntegrations) {
      try {
        // Check rate limiting
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'xero')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[xero-poll] Skipping user (rate limited):', integration.user_id);
          usersSkipped++;
          continue;
        }

        // Get access token from vault using RPC
        const { data: decryptedToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !decryptedToken) {
          console.error('[xero-poll] No access token found for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = decryptedToken;

        // Check token expiration
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[xero-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // Get tenant_id from user_integrations config or fetch from connections
        const { data: userIntegration } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('id', integration.user_integration_id)
          .single();

        let tenantId = (userIntegration?.config as { tenant_id?: string })?.tenant_id;
        
        // If no tenant_id stored, fetch from Xero connections endpoint
        if (!tenantId) {
          const connectionsResponse = await fetch('https://api.xero.com/connections', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (connectionsResponse.ok) {
            const connections = await connectionsResponse.json();
            if (connections.length > 0) {
              tenantId = connections[0].tenantId;
              // Store tenant_id for future use
              await supabase
                .from('user_integrations')
                .update({ config: { ...userIntegration?.config, tenant_id: tenantId } })
                .eq('id', integration.user_integration_id);
            }
          }
        }

        if (!tenantId) {
          console.error('[xero-poll] No tenant_id found for user:', integration.user_id);
          errors.push(`No tenant_id for user ${integration.user_id}`);
          continue;
        }

        // Fetch metrics from Xero API
        const metrics = await fetchXeroMetrics(accessToken, tenantId);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();
        
        // Track records fetched
        recordsFetched += metrics.invoiceCount + metrics.paymentCount + metrics.accountCount;

        // Insert integration event with financial metrics
        const hasData = metrics.invoiceCount > 0 || metrics.paymentCount > 0 || metrics.accountCount > 0;

        if (hasData) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'xero',
            event_type: 'xero.financial_activity',
            occurred_at: eventTime,
            source: 'xero_api_poll',
            metadata: {
              invoice_count: metrics.invoiceCount,
              invoice_total: metrics.invoiceTotal,
              draft_invoices: metrics.draftInvoices,
              submitted_invoices: metrics.submittedInvoices,
              authorised_invoices: metrics.authorisedInvoices,
              paid_invoices: metrics.paidInvoices,
              overdue_invoices: metrics.overdueInvoices,
              payment_count: metrics.paymentCount,
              payment_total: metrics.paymentTotal,
              account_count: metrics.accountCount,
              bank_accounts: metrics.bankAccounts,
              revenue_accounts: metrics.revenueAccounts,
              expense_accounts: metrics.expenseAccounts,
              organisation_name: metrics.organisationName,
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
          service_name: 'xero',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        usersProcessed++;
        console.log('[xero-poll] Processed user:', integration.user_id, {
          invoices: metrics.invoiceCount,
          payments: metrics.paymentCount,
          accounts: metrics.accountCount,
        });
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[xero-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    // Log run metadata
    const runDurationMs = Date.now() - runStartTime;
    await supabase.from('poll_run_logs').insert({
      integration_name: 'xero',
      run_timestamp: runTimestamp,
      run_duration_ms: runDurationMs,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: true,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      metadata: { total_integrations: xeroIntegrations.length, errors_count: errors.length },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: xeroIntegrations.length,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      run_duration_ms: runDurationMs,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[xero-poll] Error:', error);
    
    // Log failed run
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await supabase.from('poll_run_logs').insert({
      integration_name: 'xero',
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
