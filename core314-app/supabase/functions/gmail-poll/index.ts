import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Cold start: Log credential presence (never log values)
const googleClientIdPresent = !!Deno.env.get('GOOGLE_CLIENT_ID');
const googleClientSecretPresent = !!Deno.env.get('GOOGLE_CLIENT_SECRET');
console.log('[gmail-poll] Cold start - Credentials check:', {
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

    console.log('[gmail-poll] Starting poll run');

    const { data: integrations, error: intError } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, user_integration_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .eq('integration_registry.service_name', 'gmail');

    if (intError) {
      console.error('[gmail-poll] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!integrations || integrations.length === 0) {
      console.log('[gmail-poll] No integrations found');
      return new Response(JSON.stringify({ message: 'No Gmail integrations found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[gmail-poll] Found', integrations.length, 'integration(s)');

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
          .eq('service_name', 'gmail')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) {
          console.log('[gmail-poll] Skipping user (rate limited):', integration.user_id);
          continue;
        }

        const { data: accessToken, error: tokenError } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (tokenError || !accessToken) {
          console.error('[gmail-poll] No access token for user:', integration.user_id, tokenError);
          errors.push(`No token for user ${integration.user_id}`);
          continue;
        }

        let currentToken = accessToken;

        // Token refresh if expired
        if (integration.expires_at && new Date(integration.expires_at) < now && integration.refresh_token_secret_id) {
          console.log('[gmail-poll] Token expired, attempting refresh for user:', integration.user_id);
          const { data: refreshToken, error: rtError } = await supabase
            .rpc('get_decrypted_secret', { secret_id: integration.refresh_token_secret_id });

          if (rtError || !refreshToken) {
            const errMsg = `Token refresh failed: no refresh token for user ${integration.user_id}`;
            console.error('[gmail-poll]', errMsg);
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

              console.log('[gmail-poll] Token refreshed successfully, new expiry:', newExpiry);
            } else {
              const errText = await tokenResponse.text();
              const errMsg = `Token refresh HTTP ${tokenResponse.status}: ${errText.slice(0, 200)}`;
              console.error('[gmail-poll]', errMsg);
              apiErrors.push(errMsg);
              errors.push(`Token refresh failed for user ${integration.user_id}: ${tokenResponse.status}`);
              continue;
            }
          } catch (refreshErr) {
            const errMsg = `Token refresh exception: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`;
            console.error('[gmail-poll]', errMsg);
            apiErrors.push(errMsg);
            errors.push(errMsg);
            continue;
          }
        }

        // Get email profile stats
        console.log('[gmail-poll] Fetching profile and messages for user:', integration.user_id);

        const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });

        if (!profileResponse.ok) {
          const errBody = await profileResponse.text();
          const errMsg = `Gmail Profile API error ${profileResponse.status}: ${errBody.slice(0, 200)}`;
          console.error('[gmail-poll]', errMsg);
          apiErrors.push(errMsg);

          if (profileResponse.status === 403) {
            scopeWarning = 'Gmail API returned 403 Forbidden. The gmail.readonly scope may not be granted.';
          } else if (profileResponse.status === 401) {
            scopeWarning = 'Gmail API returned 401 Unauthorized. Token may be invalid or revoked.';
          }

          errors.push(`API error for user ${integration.user_id}: ${profileResponse.status}`);

          // Store error state in config for transparency
          try {
            const { data: existingInt } = await supabase
              .from('user_integrations').select('config')
              .eq('id', integration.user_integration_id).single();
            const existingCfg = (existingInt?.config as Record<string, unknown>) || {};
            await supabase.from('user_integrations').update({
              config: { ...existingCfg, gmail_synced_at: now.toISOString(), scope_warning: scopeWarning, last_api_errors: apiErrors.slice(0, 10) },
            }).eq('id', integration.user_integration_id);
          } catch (_) { /* best effort */ }
          continue;
        }

        const profile = await profileResponse.json();

        // Get recent messages (last 7 days, metadata only)
        const weekAgo = Math.floor((now.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000);
        const messagesResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
          new URLSearchParams({
            q: `after:${weekAgo}`,
            maxResults: '100',
          }),
          { headers: { 'Authorization': `Bearer ${currentToken}` } }
        );

        let totalMessages = 0;
        let sentCount = 0;
        let receivedCount = 0;
        let threadCount = 0;

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          totalMessages = messagesData.resultSizeEstimate || 0;

          // Get sent messages count
          const sentResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
            new URLSearchParams({ q: `after:${weekAgo} in:sent`, maxResults: '100' }),
            { headers: { 'Authorization': `Bearer ${currentToken}` } }
          );
          if (sentResponse.ok) {
            const sentData = await sentResponse.json();
            sentCount = sentData.resultSizeEstimate || 0;
          } else {
            const errMsg = `Gmail sent query failed: ${sentResponse.status}`;
            console.warn('[gmail-poll]', errMsg);
            apiErrors.push(errMsg);
          }

          receivedCount = Math.max(0, totalMessages - sentCount);

          // Get thread count
          const threadsResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads?` +
            new URLSearchParams({ q: `after:${weekAgo}`, maxResults: '100' }),
            { headers: { 'Authorization': `Bearer ${currentToken}` } }
          );
          if (threadsResponse.ok) {
            const threadsData = await threadsResponse.json();
            threadCount = threadsData.resultSizeEstimate || 0;
          } else {
            const errMsg = `Gmail threads query failed: ${threadsResponse.status}`;
            console.warn('[gmail-poll]', errMsg);
            apiErrors.push(errMsg);
          }
        } else {
          const errBody = await messagesResponse.text();
          const errMsg = `Gmail messages query failed ${messagesResponse.status}: ${errBody.slice(0, 200)}`;
          console.error('[gmail-poll]', errMsg);
          apiErrors.push(errMsg);
        }

        // DATA COMPLETENESS LOG
        console.log('[gmail-poll] Email stats fetched:', {
          email: profile.emailAddress,
          total_messages: totalMessages,
          sent: sentCount,
          received: receivedCount,
          threads: threadCount,
          api_errors: apiErrors.length,
        });

        const { error: eventError } = await supabase.from('integration_events').insert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          integration_registry_id: integration.integration_registry_id,
          service_name: 'gmail',
          event_type: 'gmail.weekly_summary',
          occurred_at: now.toISOString(),
          source: 'gmail_api_poll',
          metadata: {
            email_address: profile.emailAddress,
            total_messages: totalMessages,
            sent_count: sentCount,
            received_count: receivedCount,
            thread_count: threadCount,
            messages_total_all_time: profile.messagesTotal,
            threads_total_all_time: profile.threadsTotal,
            poll_timestamp: now.toISOString(),
            period: '7_days',
          },
        });

        if (eventError) {
          console.error('[gmail-poll] Error inserting event:', eventError);
          apiErrors.push(`DB insert error: ${eventError.message}`);
        }

        const { error: stateError } = await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'gmail',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_messages: totalMessages, sent: sentCount, received: receivedCount, threads: threadCount },
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,user_integration_id,service_name' });

        if (stateError) {
          console.error('[gmail-poll] Error updating state:', stateError);
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
              email_address: profile.emailAddress,
              total_messages: totalMessages,
              sent_count: sentCount,
              received_count: receivedCount,
              thread_count: threadCount,
              messages_total_all_time: profile.messagesTotal,
              threads_total_all_time: profile.threadsTotal,
              gmail_synced_at: now.toISOString(),
              scope_warning: scopeWarning,
              last_api_errors: apiErrors.slice(0, 10),
              data_completeness: {
                messages_fetched: totalMessages,
                sent_fetched: sentCount,
                threads_fetched: threadCount,
                period: '7_days',
                coverage_pct: totalMessages > 0 ? 100 : 0,
              },
            },
          }).eq('id', integration.user_integration_id);

          console.log('[gmail-poll] Stored transparency data in config');
        } catch (storeError) {
          console.error('[gmail-poll] Error storing config:', storeError);
        }

        processedCount++;
      } catch (userError) {
        const errMsg = `Error for user ${integration.user_id}: ${(userError as Error).message}`;
        console.error('[gmail-poll]', errMsg);
        errors.push(errMsg);
      }
    }

    console.log('[gmail-poll] Poll complete:', { processed: processedCount, total: integrations.length, errors: errors.length });

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[gmail-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
