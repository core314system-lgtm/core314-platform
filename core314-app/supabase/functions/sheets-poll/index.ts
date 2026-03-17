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
      .eq('integration_registry.service_name', 'google_sheets');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Google Sheets integrations found', processed: 0 }), {
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
          .eq('service_name', 'google_sheets')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: accessToken } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!accessToken) { errors.push(`No token for user ${integration.user_id}`); continue; }

        // Token refresh
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          const { data: refreshToken } = await supabase.rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });
          if (refreshToken) {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token', refresh_token: refreshToken,
                client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
              }),
            });
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              const { data: newSecretId } = await supabase.rpc('vault_create_secret', { secret: tokenData.access_token });
              await supabase.from('oauth_tokens').update({
                access_token_secret_id: newSecretId,
                expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
              }).eq('id', integration.id);
            }
          }
        }

        // List recent spreadsheet files via Google Drive API
        const driveResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?` +
          new URLSearchParams({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            orderBy: 'modifiedTime desc',
            pageSize: '20',
            fields: 'files(id,name,modifiedTime,createdTime)',
          }),
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!driveResponse.ok) {
          errors.push(`Google Sheets API error for user ${integration.user_id}: ${driveResponse.status}`);
          continue;
        }

        const driveData = await driveResponse.json();
        const files = driveData.files || [];

        // Count recently modified (last 7 days)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentlyModified = files.filter((f: Record<string, string>) =>
          new Date(f.modifiedTime) > weekAgo
        );

        const sheetSummary = files.slice(0, 10).map((f: Record<string, string>) => ({
          name: f.name,
          last_modified: f.modifiedTime,
        }));

        await supabase.from('integration_events').insert({
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
            sheet_summary: sheetSummary,
            poll_timestamp: now.toISOString(),
            period: '7_days',
          },
        });

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'google_sheets',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_sheets: files.length, recently_modified: recentlyModified.length },
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
    console.error('[sheets-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
