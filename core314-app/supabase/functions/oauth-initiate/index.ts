import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function getEnvVarPrefix(serviceName: string): string {
  const normalized = normalizeServiceName(serviceName);
  return SERVICE_ENV_PREFIX_MAP[normalized] || normalized.toUpperCase();
}

serve(withSentry(async (req) => {
  // VERY TOP: Log that request was received - this MUST appear if function is hit
  console.log('[oauth-initiate] REQUEST RECEIVED', { 
    method: req.method, 
    url: req.url,
    timestamp: new Date().toISOString()
  });

  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    console.log('[oauth-initiate] Handling OPTIONS preflight');
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

    // Normalize service_name for consistent env var lookup
    const normalizedServiceName = normalizeServiceName(service_name);
    const envPrefix = getEnvVarPrefix(service_name);
    const clientIdKey = `${envPrefix}_CLIENT_ID`;
    const clientId = Deno.env.get(clientIdKey);
    
    // Get all env vars containing "TEAMS" for debugging
    const allEnvKeys = Object.keys(Deno.env.toObject());
    const teamsEnvKeys = allEnvKeys.filter(k => k.includes('TEAMS'));
    
    // Extract project ref from SUPABASE_URL for verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : 'unknown';
    
    // Comprehensive runtime diagnostics
    const diagnostics = {
      service_name_raw: service_name,
      service_name_normalized: normalizedServiceName,
      envPrefix,
      envPrefixFromMap: SERVICE_ENV_PREFIX_MAP[normalizedServiceName] || 'NOT_IN_MAP',
      clientIdKey,
      clientIdFound: !!clientId,
      clientIdLength: clientId ? clientId.length : 0,
      teamsEnvKeys,
      totalEnvKeys: allEnvKeys.length,
      supabaseUrl,
      projectRef,
      timestamp: new Date().toISOString()
    };
    
    // Log comprehensive diagnostics
    console.log('[oauth-initiate] RUNTIME DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));
    
    if (!envPrefix || !clientId) {
      console.error('[oauth-initiate] OAuth client not configured - FULL DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));
      return new Response(JSON.stringify({ 
        error: 'OAuth client not configured',
        diagnostics
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUrl = new URL(integration.oauth_authorize_url);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    // Microsoft requires space-delimited scopes, Slack uses comma-delimited
    const scopeDelimiter = normalizedServiceName === 'microsoft_teams' ? ' ' : ',';
    authUrl.searchParams.set('scope', integration.oauth_scopes.join(scopeDelimiter));
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
}), { name: "oauth-initiate" }));
