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

    const { service_name, redirect_uri } = await req.json();

    if (!service_name) {
      return new Response(JSON.stringify({ error: 'service_name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integration, error: integrationError } = await supabase
      .from('integration_registry')
      .select('*')
      .eq('service_name', service_name)
      .eq('is_enabled', true)
      .single();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found or disabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (integration.auth_type !== 'oauth2') {
      return new Response(JSON.stringify({ error: 'Integration does not support OAuth2' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const state = crypto.randomUUID();
    
    await supabase.from('oauth_states').insert({
      state,
      user_id: user.id,
      integration_registry_id: integration.id,
      redirect_uri: redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    const clientId = Deno.env.get(`${service_name.toUpperCase()}_CLIENT_ID`);
    
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'OAuth client not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUrl = new URL(integration.oauth_authorize_url);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', integration.oauth_scopes.join(','));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`);

    return new Response(JSON.stringify({
      authorization_url: authUrl.toString(),
      state
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OAuth initiate error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
