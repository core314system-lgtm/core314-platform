import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cold start: Log credential presence (never log values)
const googleClientIdPresent = !!Deno.env.get('GOOGLE_CLIENT_ID');
const googleClientSecretPresent = !!Deno.env.get('GOOGLE_CLIENT_SECRET');
console.log('[sheets-poll] Cold start - Credentials check:', {
  GOOGLE_CLIENT_ID_present: googleClientIdPresent,
  GOOGLE_CLIENT_SECRET_present: googleClientSecretPresent,
});

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

    console.log('[sheets-poll] Starting poll run');

    const { data: integrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'google_sheets');

    if (intError) {
      console.error('[sheets-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      console.log('[sheets-poll] No integrations found');
      return new Response(JSON.stringify({ message: 'No Google Sheets integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[sheets-poll] Found', integrations.length, 'integration(s)');

    let processedCount = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      // Production hardening: per-user error and scope tracking
      const apiErrors: string[] = [];
      let scopeWarning: string | null = null;

      try {
        const { data: state } = await supabase
          .from('integration_ingestion_state')
          .select('*')
          .eq('user_id', integration.user_id)
          .eq('user_integration_id', integration.user_integration_id)
          .eq('service_name', 'google_sheets')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[sheets-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[sheets-poll] No access token for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        let currentToken = accessToken;

        // Token refresh if expired
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          console.log('[sheets-poll] Token expired, attempting refresh for user:', integration.user_id);
          const { data: refreshToken, error: rtError } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });

          if (rtError || !refreshToken) {
            const errMsg = `Token refresh failed: no refresh token for user ${integration.user_id}`;
            console.error('[sheets-poll]', errMsg);
            apiErrors.push(errMsg);
            errors.push(errMsg);
            continue;
          }

          try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
              }),
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              currentToken = tokenData.access_token;

              await supabase.rpc('update_secret', {
                secret_id: integration.access_token_secret_id,
                new_secret: tokenData.access_token,
              });

              const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
              await supabase.from('oauth_tokens').update({
                expires_at: newExpiry,
                updated_at: new Date().toISOString(),
              }).eq('id', integration.id);

              console.log('[sheets-poll] Token refreshed successfully, new expiry:', newExpiry);
            } else {
              const errText = await tokenResponse.text();
              const errMsg = `Token refresh HTTP ${tokenResponse.status}: ${errText.slice(0, 200)}`;
              console.error('[sheets-poll]', errMsg);
              apiErrors.push(errMsg);
              errors.push(`Token refresh failed for user ${integration.user_id}: ${tokenResponse.status}`);
              continue;
            }
          } catch (refreshErr) {
            const errMsg = `Token refresh exception: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`;
            console.error('[sheets-poll]', errMsg);
            apiErrors.push(errMsg);
            errors.push(errMsg);
            continue;
          }
        }

        // List recent spreadsheet files via Google Drive API
        console.log('[sheets-poll] Fetching spreadsheets for user:', integration.user_id);

        const driveResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?` +
          new URLSearchParams({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            orderBy: 'modifiedTime desc',
            pageSize: '50',
            fields: 'files(id,name,modifiedTime,createdTime,owners)',
          }),
          { headers: { 'Authorization': `Bearer ${currentToken}` } }
        );

        if (!driveResponse.ok) {
          const errBody = await driveResponse.text();
          const errMsg = `Drive API error ${driveResponse.status}: ${errBody.slice(0, 200)}`;
          console.error('[sheets-poll]', errMsg);
          apiErrors.push(errMsg);

          if (driveResponse.status === 403) {
            scopeWarning = 'Drive API returned 403 Forbidden. The drive.metadata.readonly scope may not be granted.';
          } else if (driveResponse.status === 401) {
            scopeWarning = 'Drive API returned 401 Unauthorized. Token may be invalid or revoked.';
          }

          errors.push(`API error for user ${integration.user_id}: ${driveResponse.status}`);

          // Store error state in config for transparency
          try {
            const { data: existingInt } = await supabase
              .from('user_integrations').select('config')
              .eq('id', integration.user_integration_id).single();
            const existingCfg = (existingInt?.config as Record<string, unknown>) || {};
            await supabase.from('user_integrations').update({
              config: { ...existingCfg, sheets_synced_at: now.toISOString(), scope_warning: scopeWarning, last_api_errors: apiErrors.slice(0, 10) },
            }).eq('id', integration.user_integration_id);
          } catch { /* best effort */ }
          continue;
        }

        const driveData = await driveResponse.json();
        const files = driveData.files || [];

        // Count recently modified (last 7 days)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentlyModified = files.filter((f: Record<string, string>) =>
          new Date(f.modifiedTime) > weekAgo
        );

        // Detect stale spreadsheets (not modified in 30+ days)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const staleSheets = files.filter((f: Record<string, string>) =>
          new Date(f.modifiedTime) < thirtyDaysAgo
        );

        const sheetSummary = files.slice(0, 10).map((f: Record<string, string>) => ({
          name: f.name,
          last_modified: f.modifiedTime,
        }));

        // DATA COMPLETENESS LOG
        console.log('[sheets-poll] Spreadsheets fetched:', {
          total: files.length,
          recently_modified: recentlyModified.length,
          stale_count: staleSheets.length,
          api_errors: apiErrors.length,
        });

        const { error: eventError } = await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'google_sheets',
          event_type: 'sheets.file_summary',
          occurred_at: now.toISOString(),
          source: 'sheets_api_poll',
          metadata: {
            total_spreadsheets: files.length,
            recently_modified_count: recentlyModified.length,
            stale_spreadsheets_count: staleSheets.length,
            sheet_summary: sheetSummary,
            poll_timestamp: now.toISOString(),
            period: '7_days',
          },
        });

        if (eventError) {
          console.error('[sheets-poll] Error inserting event:', eventError);
          apiErrors.push(`DB insert error: ${eventError.message}`);
        }

        const { error: stateError } = await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'google_sheets',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_sheets: files.length, recently_modified: recentlyModified.length, stale_count: staleSheets.length },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        if (stateError) {
          console.error('[sheets-poll] Error updating state:', stateError);
          apiErrors.push(`State update error: ${stateError.message}`);
        }

        // Store transparency data in user_integrations config (matches Slack/HubSpot pattern)
        try {
          const { data: existingIntegration } = await supabase
            .from('user_integrations').select('config')
            .eq('id', integration.user_integration_id).single();

          const existingConfig = (existingIntegration?.config as Record<string, unknown>) || {};
          await supabase.from('user_integrations').update({
            config: {
              ...existingConfig,
              total_spreadsheets: files.length,
              recently_modified_count: recentlyModified.length,
              stale_spreadsheets_count: staleSheets.length,
              sheet_summary: sheetSummary,
              sheets_synced_at: now.toISOString(),
              scope_warning: scopeWarning,
              last_api_errors: apiErrors.slice(0, 10),
              data_completeness: {
                sheets_fetched: files.length,
                recently_modified: recentlyModified.length,
                stale_count: staleSheets.length,
                period: '7_days',
                coverage_pct: 100,
              },
            },
          }).eq('id', integration.user_integration_id);

          console.log('[sheets-poll] Stored transparency data in config');
        } catch (storeError) {
          console.error('[sheets-poll] Error storing config:', storeError);
        }

        processedCount++;
      } catch (userError) {
        const errMsg = `Error for user ${integration.user_id}: ${(userError as Error).message}`;
        console.error('[sheets-poll]', errMsg);
        errors.push(errMsg);
      }
    }

    console.log('[sheets-poll] Poll complete:', { processed: processedCount, total: integrations.length, errors: errors.length });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sheets-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
