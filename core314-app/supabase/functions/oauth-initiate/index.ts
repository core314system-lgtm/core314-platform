import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

// Cold start: Log credential presence for key OAuth providers (never log values)
console.log('[oauth-initiate] Cold start - Credentials check:', {
  SLACK_CLIENT_ID_present: !!Deno.env.get('SLACK_CLIENT_ID'),
  SLACK_CLIENT_SECRET_present: !!Deno.env.get('SLACK_CLIENT_SECRET'),
  SALESFORCE_CLIENT_ID_present: !!Deno.env.get('SALESFORCE_CLIENT_ID'),
  TEAMS_CLIENT_ID_present: !!Deno.env.get('TEAMS_CLIENT_ID'),
});

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
    
    // Filter for service-specific env var keys
    const serviceRelatedKeys = allEnvKeys.filter(k => 
      k.includes('TEAMS') || k.includes('CORE314') || k.includes('SALESFORCE') || 
      k.includes('SLACK') || k.includes('ZOOM') || k.includes('GOOGLE') ||
      k.includes('QUICKBOOKS') || k.includes('XERO')
    );
    console.log('[oauth-initiate] OAuth-related ENV VAR KEYS:', serviceRelatedKeys);
    
    // SALESFORCE-SPECIFIC DIAGNOSTIC LOGGING (REQUIRED FOR PRODUCTION DEBUGGING)
    if (normalizedServiceName === 'salesforce') {
      const sfClientId = Deno.env.get('SALESFORCE_CLIENT_ID');
      const sfClientSecret = Deno.env.get('SALESFORCE_CLIENT_SECRET');
      const sfRedirectUri = Deno.env.get('SALESFORCE_REDIRECT_URI');
      const core314SfClientId = Deno.env.get('CORE314_SALESFORCE_CLIENT_ID');
      const core314SfClientSecret = Deno.env.get('CORE314_SALESFORCE_CLIENT_SECRET');
      
      console.log('[oauth-initiate] SALESFORCE OAUTH TRACE:', {
        SALESFORCE_CLIENT_ID_present: sfClientId !== undefined && sfClientId !== '',
        SALESFORCE_CLIENT_ID_length: sfClientId?.length ?? 0,
        SALESFORCE_CLIENT_SECRET_present: sfClientSecret !== undefined && sfClientSecret !== '',
        SALESFORCE_CLIENT_SECRET_length: sfClientSecret?.length ?? 0,
        SALESFORCE_REDIRECT_URI_present: sfRedirectUri !== undefined && sfRedirectUri !== '',
        SALESFORCE_REDIRECT_URI_value: sfRedirectUri ?? 'NOT SET',
        CORE314_SALESFORCE_CLIENT_ID_present: core314SfClientId !== undefined && core314SfClientId !== '',
        CORE314_SALESFORCE_CLIENT_SECRET_present: core314SfClientSecret !== undefined && core314SfClientSecret !== '',
        authorize_url: 'https://login.salesforce.com/services/oauth2/authorize',
        scopes: integration.oauth_scopes?.join(' ') ?? 'NOT SET',
        redirect_uri_to_use: redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`,
      });
      
      // HARD FAIL with specific Salesforce error if credentials missing
      if ((!sfClientId || sfClientId === '') && (!core314SfClientId || core314SfClientId === '')) {
        console.error('[oauth-initiate] SALESFORCE HARD FAIL: Missing SALESFORCE_CLIENT_ID');
        console.error('[oauth-initiate] Required env vars: SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET');
        return new Response(JSON.stringify({ 
          error: 'Salesforce OAuth not configured',
          message: 'SALESFORCE_CLIENT_ID is not set in the deployed environment. This is a Core314 configuration issue - no action required by the user.',
          missing_env_vars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
          tried_prefixes: ['SALESFORCE', 'CORE314_SALESFORCE'],
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
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

    // Salesforce-specific: ALWAYS use login.salesforce.com for production OAuth
    // This ensures Core314 owns the OAuth flow and users never need to configure anything
    let oauthAuthorizeUrl = integration.oauth_authorize_url;
    if (normalizedServiceName === 'salesforce') {
      // Enforce production login domain - never sandbox unless explicitly configured
      oauthAuthorizeUrl = 'https://login.salesforce.com/services/oauth2/authorize';
      console.log('[oauth-initiate] Salesforce: Using production login domain:', oauthAuthorizeUrl);
    }

    const authUrl = new URL(oauthAuthorizeUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    
    // Provider-specific scope delimiter and parameters
    // Microsoft Teams: space-delimited scopes
    // Google: space-delimited scopes + access_type=offline for refresh tokens
    // Slack: comma-delimited scopes
    // Zoom: space-delimited scopes
    // Salesforce: space-delimited scopes
    const useSpaceDelimiter = ['microsoft_teams', 'google_calendar', 'zoom', 'salesforce'].includes(normalizedServiceName);
    const scopeDelimiter = useSpaceDelimiter ? ' ' : ',';
    
    // Salesforce-specific: Use hardcoded scopes to ensure they match Connected App configuration
    // This prevents issues with database scopes not matching what's enabled in the Salesforce app
    let scopeString: string;
    if (normalizedServiceName === 'salesforce') {
      // These scopes must match exactly what's enabled in the Core314 Salesforce Connected App:
      // - api: Access and manage your data
      // - refresh_token: Perform requests at any time (offline access)
      scopeString = 'api refresh_token';
      console.log('[oauth-initiate] Salesforce: Using hardcoded scopes:', scopeString);
    } else {
      scopeString = integration.oauth_scopes.join(scopeDelimiter);
    }
    authUrl.searchParams.set('scope', scopeString);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`);
    
    // Google-specific: request offline access for refresh tokens
    if (normalizedServiceName === 'google_calendar') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
    }
    
    // Salesforce-specific: request refresh token
    if (normalizedServiceName === 'salesforce') {
      // Salesforce requires 'refresh_token' scope for offline access
      // Also add prompt=consent to ensure user sees the consent screen
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
