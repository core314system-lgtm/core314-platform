import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Missing code or state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: integration, error: integrationError } = await supabase
      .from('integration_registry')
      .select('*')
      .eq('id', stateData.integration_registry_id)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get(`${integration.service_name.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${integration.service_name.toUpperCase()}_CLIENT_SECRET`);

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'OAuth client not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenResponse = await fetch(integration.oauth_token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: stateData.redirect_uri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: encryptedAccessToken } = await supabase.rpc('encrypt_secret', {
      secret: tokenData.access_token
    });

    let encryptedRefreshToken = null;
    if (tokenData.refresh_token) {
      const { data: encryptedRefresh } = await supabase.rpc('encrypt_secret', {
        secret: tokenData.refresh_token
      });
      encryptedRefreshToken = encryptedRefresh;
    }

    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { data: integrationMaster } = await supabase
      .from('integrations_master')
      .select('id')
      .eq('integration_type', integration.service_name)
      .single();

    const { data: userIntegration } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: stateData.user_id,
        integration_id: integrationMaster?.id,
        status: 'active',
        config: {
          oauth_connected: true,
          scope: tokenData.scope,
          team: tokenData.team
        }
      }, {
        onConflict: 'user_id,integration_id'
      })
      .select()
      .single();

    await supabase.from('oauth_tokens').upsert({
      user_id: stateData.user_id,
      integration_registry_id: integration.id,
      user_integration_id: userIntegration?.id,
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      token_type: tokenData.token_type || 'bearer',
      scope: tokenData.scope,
      expires_at: expiresAt,
      metadata: {
        team: tokenData.team,
        bot_user_id: tokenData.bot_user_id
      }
    }, {
      onConflict: 'user_id,integration_registry_id'
    });

    await supabase.from('oauth_states').delete().eq('state', state);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/integrations?oauth_success=true&service=${integration.service_name}`
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
