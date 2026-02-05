import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * QuickBooks Online Poll Function
 * 
 * Fetches real financial data from QuickBooks Online API:
 * - Invoices (counts, totals, statuses)
 * - Payments (counts, totals)
 * - Expenses (counts, totals)
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

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

interface QuickBooksMetrics {
  invoiceCount: number;
  invoiceTotal: number;
  openInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  paymentCount: number;
  paymentTotal: number;
  expenseCount: number;
  expenseTotal: number;
  accountCount: number;
  bankAccounts: number;
  creditCardAccounts: number;
  lastActivityTimestamp: string | null;
  companyName: string | null;
}

interface QueryResponse<T> {
  QueryResponse: {
    [key: string]: T[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
}

async function fetchQuickBooksMetrics(accessToken: string, realmId: string): Promise<QuickBooksMetrics> {
  const metrics: QuickBooksMetrics = {
    invoiceCount: 0,
    invoiceTotal: 0,
    openInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    paymentCount: 0,
    paymentTotal: 0,
    expenseCount: 0,
    expenseTotal: 0,
    accountCount: 0,
    bankAccounts: 0,
    creditCardAccounts: 0,
    lastActivityTimestamp: null,
    companyName: null,
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch Company Info
    const companyInfoUrl = `${QBO_API_BASE}/${realmId}/companyinfo/${realmId}`;
    const companyResponse = await fetch(companyInfoUrl, { headers });
    
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      metrics.companyName = companyData.CompanyInfo?.CompanyName || null;
    } else {
      console.log('[quickbooks-poll] Failed to fetch company info:', companyResponse.status);
    }

    // 2. Fetch Invoices (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const invoiceQuery = encodeURIComponent(`SELECT * FROM Invoice WHERE TxnDate >= '${ninetyDaysAgo}' MAXRESULTS 1000`);
    const invoiceUrl = `${QBO_API_BASE}/${realmId}/query?query=${invoiceQuery}`;
    
    const invoiceResponse = await fetch(invoiceUrl, { headers });
    
    if (invoiceResponse.ok) {
      const invoiceData: QueryResponse<{
        Id: string;
        TotalAmt: number;
        Balance: number;
        DueDate?: string;
        MetaData?: { LastUpdatedTime?: string };
      }> = await invoiceResponse.json();
      
      const invoices = invoiceData.QueryResponse?.Invoice || [];
      metrics.invoiceCount = invoices.length;
      
      const now = new Date();
      for (const invoice of invoices) {
        metrics.invoiceTotal += invoice.TotalAmt || 0;
        
        const balance = invoice.Balance || 0;
        if (balance === 0) {
          metrics.paidInvoices++;
        } else {
          metrics.openInvoices++;
          if (invoice.DueDate) {
            const dueDate = new Date(invoice.DueDate);
            if (dueDate < now) {
              metrics.overdueInvoices++;
            }
          }
        }
        
        if (invoice.MetaData?.LastUpdatedTime) {
          if (!metrics.lastActivityTimestamp || invoice.MetaData.LastUpdatedTime > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = invoice.MetaData.LastUpdatedTime;
          }
        }
      }
    } else {
      console.log('[quickbooks-poll] Failed to fetch invoices:', invoiceResponse.status, await invoiceResponse.text());
    }

    // 3. Fetch Payments (last 90 days)
    const paymentQuery = encodeURIComponent(`SELECT * FROM Payment WHERE TxnDate >= '${ninetyDaysAgo}' MAXRESULTS 1000`);
    const paymentUrl = `${QBO_API_BASE}/${realmId}/query?query=${paymentQuery}`;
    
    const paymentResponse = await fetch(paymentUrl, { headers });
    
    if (paymentResponse.ok) {
      const paymentData: QueryResponse<{
        Id: string;
        TotalAmt: number;
        MetaData?: { LastUpdatedTime?: string };
      }> = await paymentResponse.json();
      
      const payments = paymentData.QueryResponse?.Payment || [];
      metrics.paymentCount = payments.length;
      
      for (const payment of payments) {
        metrics.paymentTotal += payment.TotalAmt || 0;
        
        if (payment.MetaData?.LastUpdatedTime) {
          if (!metrics.lastActivityTimestamp || payment.MetaData.LastUpdatedTime > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = payment.MetaData.LastUpdatedTime;
          }
        }
      }
    } else {
      console.log('[quickbooks-poll] Failed to fetch payments:', paymentResponse.status);
    }

    // 4. Fetch Bills (Expenses) - last 90 days
    const billQuery = encodeURIComponent(`SELECT * FROM Bill WHERE TxnDate >= '${ninetyDaysAgo}' MAXRESULTS 1000`);
    const billUrl = `${QBO_API_BASE}/${realmId}/query?query=${billQuery}`;
    
    const billResponse = await fetch(billUrl, { headers });
    
    if (billResponse.ok) {
      const billData: QueryResponse<{
        Id: string;
        TotalAmt: number;
        MetaData?: { LastUpdatedTime?: string };
      }> = await billResponse.json();
      
      const bills = billData.QueryResponse?.Bill || [];
      metrics.expenseCount = bills.length;
      
      for (const bill of bills) {
        metrics.expenseTotal += bill.TotalAmt || 0;
        
        if (bill.MetaData?.LastUpdatedTime) {
          if (!metrics.lastActivityTimestamp || bill.MetaData.LastUpdatedTime > metrics.lastActivityTimestamp) {
            metrics.lastActivityTimestamp = bill.MetaData.LastUpdatedTime;
          }
        }
      }
    } else {
      console.log('[quickbooks-poll] Failed to fetch bills:', billResponse.status);
    }

    // 5. Fetch Accounts (chart of accounts structure)
    const accountQuery = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const accountUrl = `${QBO_API_BASE}/${realmId}/query?query=${accountQuery}`;
    
    const accountResponse = await fetch(accountUrl, { headers });
    
    if (accountResponse.ok) {
      const accountData: QueryResponse<{
        Id: string;
        AccountType: string;
      }> = await accountResponse.json();
      
      const accounts = accountData.QueryResponse?.Account || [];
      metrics.accountCount = accounts.length;
      
      for (const account of accounts) {
        if (account.AccountType === 'Bank') {
          metrics.bankAccounts++;
        } else if (account.AccountType === 'Credit Card') {
          metrics.creditCardAccounts++;
        }
      }
    } else {
      console.log('[quickbooks-poll] Failed to fetch accounts:', accountResponse.status);
    }

  } catch (error) {
    console.error('[quickbooks-poll] Error fetching QuickBooks metrics:', error);
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

    // Fetch all active QuickBooks integrations with OAuth tokens
    const { data: qbIntegrations, error: intError } = await supabase
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
      .eq('integration_registry.service_name', 'quickbooks');

    if (intError) {
      console.error('[quickbooks-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!qbIntegrations || qbIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No QuickBooks integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of qbIntegrations) {
      try {
        // Check rate limiting
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'quickbooks')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[quickbooks-poll] Skipping user (rate limited):', integration.user_id);
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
          console.error('[quickbooks-poll] No access token found for user:', integration.user_id);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        const accessToken = tokenData.decrypted_secret;

        // Check token expiration
        if (integration.expires_at && new Date(integration.expires_at) < now) {
          console.log('[quickbooks-poll] Token expired for user:', integration.user_id);
          errors.push(`Token expired for user ${integration.user_id}`);
          continue;
        }

        // Get realm_id from user_integrations config
        const { data: userIntegration } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('id', integration.user_integration_id)
          .single();

        const realmId = (userIntegration?.config as { realm_id?: string })?.realm_id;
        
        if (!realmId) {
          console.error('[quickbooks-poll] No realm_id found for user:', integration.user_id);
          errors.push(`No realm_id for user ${integration.user_id}`);
          continue;
        }

        // Fetch metrics from QuickBooks API
        const metrics = await fetchQuickBooksMetrics(accessToken, realmId);
        const eventTime = metrics.lastActivityTimestamp || now.toISOString();
        
        // Track records fetched
        recordsFetched += metrics.invoiceCount + metrics.paymentCount + metrics.expenseCount + metrics.accountCount;

        // Insert integration event with financial metrics
        const hasData = metrics.invoiceCount > 0 || metrics.paymentCount > 0 || 
                       metrics.expenseCount > 0 || metrics.accountCount > 0;

        if (hasData) {
          await supabase.from('integration_events').insert({
            user_id: integration.user_id,
            user_integration_id: integration.user_integration_id,
            integration_registry_id: integration.integration_registry_id,
            service_name: 'quickbooks',
            event_type: 'quickbooks.financial_activity',
            occurred_at: eventTime,
            source: 'quickbooks_api_poll',
            payload: {
              invoice_count: metrics.invoiceCount,
              invoice_total: metrics.invoiceTotal,
              open_invoices: metrics.openInvoices,
              paid_invoices: metrics.paidInvoices,
              overdue_invoices: metrics.overdueInvoices,
              payment_count: metrics.paymentCount,
              payment_total: metrics.paymentTotal,
              expense_count: metrics.expenseCount,
              expense_total: metrics.expenseTotal,
              account_count: metrics.accountCount,
              bank_accounts: metrics.bankAccounts,
              credit_card_accounts: metrics.creditCardAccounts,
              company_name: metrics.companyName,
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
          service_name: 'quickbooks',
          last_polled_at: now.toISOString(),
          last_event_timestamp: eventTime,
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { last_metrics: metrics },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        processedCount++;
        usersProcessed++;
        console.log('[quickbooks-poll] Processed user:', integration.user_id, {
          invoices: metrics.invoiceCount,
          payments: metrics.paymentCount,
          expenses: metrics.expenseCount,
          accounts: metrics.accountCount,
        });
      } catch (userError: unknown) {
        const errorMessage = userError instanceof Error ? userError.message : String(userError);
        console.error('[quickbooks-poll] Error processing user:', integration.user_id, userError);
        errors.push(`Error for user ${integration.user_id}: ${errorMessage}`);
      }
    }

    // Log run metadata
    const runDurationMs = Date.now() - runStartTime;
    await supabase.from('poll_run_logs').insert({
      integration_name: 'quickbooks',
      run_timestamp: runTimestamp,
      run_duration_ms: runDurationMs,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      success: true,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      metadata: { total_integrations: qbIntegrations.length, errors_count: errors.length },
    });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: qbIntegrations.length,
      records_fetched: recordsFetched,
      records_written: recordsWritten,
      run_duration_ms: runDurationMs,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[quickbooks-poll] Error:', error);
    
    // Log failed run
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    await supabase.from('poll_run_logs').insert({
      integration_name: 'quickbooks',
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
