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
  'zoom': 'ZOOM',
  'google_calendar': 'GOOGLE',
  'quickbooks': 'QUICKBOOKS',
  'xero': 'XERO',
  'salesforce': 'SALESFORCE',
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

    // Phase 16B: Check connection_type for UI-level connection flow control
    // connection_type determines how users connect in the UI, separate from auth_type
    // If connection_type is missing, default to 'manual' unless auth_type is 'oauth2'
    const rawConnectionType = (integration as any).connection_type as string | null | undefined;
    const effectiveConnectionType: 'oauth2' | 'api_key' | 'manual' | 'observational' =
      rawConnectionType === 'oauth2' ||
      rawConnectionType === 'api_key' ||
      rawConnectionType === 'manual' ||
      rawConnectionType === 'observational'
        ? rawConnectionType
        : (integration.auth_type === 'oauth2' ? 'oauth2' : 'manual');

    // Phase 16B: Block OAuth initiation for non-oauth2 connection types
    // Return 200 OK with skipped=true for silent no-op (no red error in UI)
    if (effectiveConnectionType !== 'oauth2') {
      console.log('[oauth-initiate] Non-oauth2 connection_type, returning silent no-op', {
        service_name,
        connection_type: rawConnectionType,
        effective_connection_type: effectiveConnectionType,
        auth_type: integration.auth_type,
      });

      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'integration_not_oauth2',
          connection_type: effectiveConnectionType,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Legacy guard: also check auth_type for backwards compatibility
    // This should rarely trigger now that connection_type is checked first
    if (integration.auth_type !== 'oauth2') {
      console.log('[oauth-initiate] auth_type mismatch, returning silent no-op', {
        service_name,
        auth_type: integration.auth_type,
      });

      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'auth_type_not_oauth2',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
    
    // Provider-specific scope delimiter and parameters
    // Microsoft Teams: space-delimited scopes
    // Google: space-delimited scopes + access_type=offline for refresh tokens
    // Slack: comma-delimited scopes
    // Zoom: space-delimited scopes
    const useSpaceDelimiter = ['microsoft_teams', 'google_calendar', 'zoom'].includes(normalizedServiceName);
    const scopeDelimiter = useSpaceDelimiter ? ' ' : ',';
    authUrl.searchParams.set('scope', integration.oauth_scopes.join(scopeDelimiter));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`);
    
    // Google-specific: request offline access for refresh tokens
    if (normalizedServiceName === 'google_calendar') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
    }

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
