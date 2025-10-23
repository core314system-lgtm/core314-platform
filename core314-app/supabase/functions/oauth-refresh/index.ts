import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { service_name } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integration } = await supabase
      .from('integration_registry')
      .select('*')
      .eq('service_name', service_name)
      .single();

    const { data: tokenRecord } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_registry_id', integration.id)
      .single();

    if (!tokenRecord || !tokenRecord.refresh_token_secret_id) {
      return new Response(JSON.stringify({ error: 'No refresh token available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: refreshTokenData } = await supabase
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('id', tokenRecord.refresh_token_secret_id)
      .single();

    const refreshToken = refreshTokenData?.decrypted_secret;

    const clientId = Deno.env.get(`${service_name.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${service_name.toUpperCase()}_CLIENT_SECRET`);

    const tokenResponse = await fetch(integration.oauth_token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: newAccessTokenSecretId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.access_token
    });

    await supabase.from('oauth_tokens')
      .update({
        access_token_secret_id: newAccessTokenSecretId,
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenRecord.id);

    return new Response(JSON.stringify({
      success: true,
      expires_at: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OAuth refresh error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
