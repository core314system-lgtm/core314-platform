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
    
    // Get ALL env var keys (NOT values) for debugging
    const allEnvKeys = Object.keys(Deno.env.toObject());
    const teamsRelatedKeys = allEnvKeys.filter(k => k.includes('TEAMS') || k.includes('CORE314'));
    
    // Log all env var keys at request time
    console.log('[oauth-initiate] ALL ENV VAR KEYS:', allEnvKeys);
    console.log('[oauth-initiate] TEAMS/CORE314 RELATED KEYS:', teamsRelatedKeys);
    
    // Explicitly check for TEAMS_CLIENT_ID
    const teamsClientIdRaw = Deno.env.get('TEAMS_CLIENT_ID');
    const teamsClientIdExists = teamsClientIdRaw !== undefined;
    const teamsClientIdNotEmpty = teamsClientIdRaw !== undefined && teamsClientIdRaw !== '';
    console.log('[oauth-initiate] TEAMS_CLIENT_ID check:', {
      exists: teamsClientIdExists,
      notEmpty: teamsClientIdNotEmpty,
      length: teamsClientIdRaw?.length ?? 0
    });
    
    // Explicitly check for CORE314_TEAMS_CLIENT_ID (fallback)
    const core314TeamsClientIdRaw = Deno.env.get('CORE314_TEAMS_CLIENT_ID');
    const core314TeamsClientIdExists = core314TeamsClientIdRaw !== undefined;
    const core314TeamsClientIdNotEmpty = core314TeamsClientIdRaw !== undefined && core314TeamsClientIdRaw !== '';
    console.log('[oauth-initiate] CORE314_TEAMS_CLIENT_ID check:', {
      exists: core314TeamsClientIdExists,
      notEmpty: core314TeamsClientIdNotEmpty,
      length: core314TeamsClientIdRaw?.length ?? 0
    });
    
    // Resolve OAuth credentials with fallback logic
    const { clientId, clientSecret, usedPrefix, triedPrefixes } = resolveOAuthCredentials(service_name);
    
    // Extract project ref from SUPABASE_URL for verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : 'unknown';
    
    // Comprehensive runtime diagnostics
    const diagnostics = {
      service_name_raw: service_name,
      service_name_normalized: normalizedServiceName,
      usedPrefix,
      triedPrefixes,
      clientIdFound: clientId !== undefined && clientId !== '',
      clientIdLength: clientId?.length ?? 0,
      clientSecretFound: clientSecret !== undefined && clientSecret !== '',
      teamsClientIdExists,
      teamsClientIdNotEmpty,
      core314TeamsClientIdExists,
      core314TeamsClientIdNotEmpty,
      allEnvKeyCount: allEnvKeys.length,
      teamsRelatedKeys,
      supabaseUrl,
      projectRef,
      timestamp: new Date().toISOString()
    };
    
    // Log comprehensive diagnostics
    console.log('[oauth-initiate] RUNTIME DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));
    
    // Hard-fail with structured diagnostic response if credentials not found
    if (!clientId || clientId === '') {
      console.error('[oauth-initiate] HARD FAIL: OAuth client not configured');
      console.error('[oauth-initiate] FULL DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));
      return new Response(JSON.stringify({ 
        error: 'OAuth client not configured',
        message: 'No OAuth credentials found in environment. Tried prefixes: ' + triedPrefixes.join(', '),
        diagnostics
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[oauth-initiate] SUCCESS: Found credentials with prefix:', usedPrefix);

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
}, { name: "oauth-initiate" }));
