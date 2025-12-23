import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Map service_name to env var prefix for OAuth credentials
// This allows service names like "microsoft_teams" to use "TEAMS_" prefix
const SERVICE_ENV_PREFIX_MAP: Record<string, string> = {
  'microsoft_teams': 'TEAMS',
  'slack': 'SLACK',
};

// Normalize service_name: lowercase, replace hyphens with underscores, trim whitespace
function normalizeServiceName(serviceName: string): string {
  return serviceName.toLowerCase().replace(/-/g, '_').trim();
}

// Try multiple env var patterns to find OAuth credentials
// Returns { clientId, clientSecret, usedPrefix } or null values if not found
function resolveOAuthCredentials(serviceName: string): { 
  clientId: string | undefined; 
  clientSecret: string | undefined; 
  usedPrefix: string;
  triedPrefixes: string[];
} {
  const normalized = normalizeServiceName(serviceName);
  const basePrefix = SERVICE_ENV_PREFIX_MAP[normalized] || normalized.toUpperCase();
  
  // Try these prefixes in order:
  // 1. TEAMS_CLIENT_ID (standard)
  // 2. CORE314_TEAMS_CLIENT_ID (namespaced fallback)
  const prefixesToTry = [
    basePrefix,                    // e.g., "TEAMS"
    `CORE314_${basePrefix}`,       // e.g., "CORE314_TEAMS"
  ];
  
  for (const prefix of prefixesToTry) {
    const clientIdKey = `${prefix}_CLIENT_ID`;
    const clientSecretKey = `${prefix}_CLIENT_SECRET`;
    const clientId = Deno.env.get(clientIdKey);
    const clientSecret = Deno.env.get(clientSecretKey);
    
    // Check if clientId exists and is not empty string
    if (clientId !== undefined && clientId !== '') {
      return { clientId, clientSecret, usedPrefix: prefix, triedPrefixes: prefixesToTry };
    }
  }
  
  return { clientId: undefined, clientSecret: undefined, usedPrefix: '', triedPrefixes: prefixesToTry };
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

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

    // Resolve OAuth credentials with fallback logic (same as oauth-initiate)
    const { clientId, clientSecret, usedPrefix, triedPrefixes } = resolveOAuthCredentials(integration.service_name);

    // Log credential resolution for debugging
    console.log('[oauth-callback] Credential resolution:', {
      service_name: integration.service_name,
      usedPrefix,
      triedPrefixes,
      clientIdFound: clientId !== undefined && clientId !== '',
      clientSecretFound: clientSecret !== undefined && clientSecret !== ''
    });

    if (!clientId || clientId === '' || !clientSecret || clientSecret === '') {
      console.error('[oauth-callback] HARD FAIL: OAuth credentials not configured');
      return new Response(JSON.stringify({ 
        error: 'OAuth client not configured',
        message: 'No OAuth credentials found in environment. Tried prefixes: ' + triedPrefixes.join(', '),
        debug: { service_name: integration.service_name, usedPrefix, triedPrefixes }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[oauth-callback] SUCCESS: Found credentials with prefix:', usedPrefix);

    const tokenResponse = await fetch(integration.oauth_token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: stateData.redirect_uri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: accessTokenSecretId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.access_token
    });

    let refreshTokenSecretId = null;
    if (tokenData.refresh_token) {
      const { data: refreshSecretId } = await supabase.rpc('vault_create_secret', {
        secret: tokenData.refresh_token
      });
      refreshTokenSecretId = refreshSecretId;
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
        provider_id: integration.id,
        added_by_user: true,
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
      access_token_secret_id: accessTokenSecretId,
      refresh_token_secret_id: refreshTokenSecretId,
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
}), { name: "oauth-callback" }));
