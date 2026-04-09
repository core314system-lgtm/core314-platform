import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(withSentry(async (req) => {
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
      .eq('integration_registry.service_name', 'gmail');

    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No Gmail integrations found', processed: 0 }), {
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
          .eq('service_name', 'gmail')
          .single();

        const now = new Date();
        if (state?.next_poll_after && new Date(state.next_poll_after) > now) continue;

        const { data: accessToken } = await supabase
          .rpc('get_decrypted_secret', { secret_id: integration.access_token_secret_id });

        if (!accessToken) { errors.push(`No token for user ${integration.user_id}`); continue; }

        // Token refresh if needed
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

        // Get email profile stats
        const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!profileResponse.ok) {
          errors.push(`Gmail API error for user ${integration.user_id}: ${profileResponse.status}`);
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
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
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
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (sentResponse.ok) {
            const sentData = await sentResponse.json();
            sentCount = sentData.resultSizeEstimate || 0;
          }

          receivedCount = Math.max(0, totalMessages - sentCount);

          // Get thread count
          const threadsResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads?` +
            new URLSearchParams({ q: `after:${weekAgo}`, maxResults: '100' }),
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (threadsResponse.ok) {
            const threadsData = await threadsResponse.json();
            threadCount = threadsData.resultSizeEstimate || 0;
          }
        }

        await supabase.from('integration_events').insert({
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

        await supabase.from('integration_ingestion_state').upsert({
          user_id: integration.user_id,
          user_integration_id: integration.user_integration_id,
          service_name: 'gmail',
          last_polled_at: now.toISOString(),
          next_poll_after: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          metadata: { total_messages: totalMessages, sent: sentCount, received: receivedCount },
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
    console.error('[gmail-poll] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: 'gmail-poll' }));
