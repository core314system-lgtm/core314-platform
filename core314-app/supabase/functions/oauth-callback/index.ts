import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

// Cold start: Log credential presence for key OAuth providers (never log values)
console.log('[oauth-callback] Cold start - Credentials check:', {
  SLACK_CLIENT_ID_present: !!Deno.env.get('SLACK_CLIENT_ID'),
  SLACK_CLIENT_SECRET_present: !!Deno.env.get('SLACK_CLIENT_SECRET'),
  SALESFORCE_CLIENT_ID_present: !!Deno.env.get('SALESFORCE_CLIENT_ID'),
  TEAMS_CLIENT_ID_present: !!Deno.env.get('TEAMS_CLIENT_ID'),
});

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
    // Provider-specific callback parameters
    const realmId = url.searchParams.get('realmId'); // QuickBooks company ID

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

    // Build token exchange parameters
    const tokenParams: Record<string, string> = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: stateData.redirect_uri,
      grant_type: 'authorization_code'
    };
    
    // PKCE: Add code_verifier for providers that require it
    const normalizedServiceName = normalizeServiceName(integration.service_name);
    const pkceProviders = ['salesforce'];
    if (pkceProviders.includes(normalizedServiceName) && stateData.code_verifier) {
      tokenParams.code_verifier = stateData.code_verifier;
      console.log('[oauth-callback] PKCE: Including code_verifier in token exchange');
    }

    const tokenResponse = await fetch(integration.oauth_token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams)
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

    // Build provider-specific config
    const integrationConfig: Record<string, unknown> = {
      oauth_connected: true,
      scope: tokenData.scope,
      team: tokenData.team,
    };
    
    // Slack: Perform post-auth verification using auth.test API
    if (normalizeServiceName(integration.service_name) === 'slack') {
      console.log('[oauth-callback] Slack: Performing post-auth verification via auth.test...');
      try {
        const authTestResponse = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const authTestData = await authTestResponse.json();
        
        if (!authTestData.ok) {
          console.error('[oauth-callback] Slack: auth.test verification FAILED', {
            error: authTestData.error,
            error_description: authTestData.error_description,
          });
          
          // Mark integration as error state
          integrationConfig.verification_status = 'error';
          integrationConfig.error_code = authTestData.error;
          integrationConfig.error_message = authTestData.error_description || authTestData.error;
          
          // Still save the integration but with error status
          const { data: errorUserIntegration } = await supabase
            .from('user_integrations')
            .upsert({
              user_id: stateData.user_id,
              integration_id: (await supabase.from('integrations_master').select('id').eq('integration_type', integration.service_name).single()).data?.id,
              provider_id: integration.id,
              added_by_user: true,
              status: 'error',
              config: integrationConfig
            }, {
              onConflict: 'user_id,integration_id'
            })
            .select()
            .single();
          
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              'Location': `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/integrations?oauth_error=true&service=${integration.service_name}&error=verification_failed`
            }
          });
        }
        
        console.log('[oauth-callback] Slack: auth.test verification SUCCESS', {
          team_id: authTestData.team_id,
          team: authTestData.team,
          bot_user_id: authTestData.bot_user_id,
          user_id: authTestData.user_id,
        });
        
        // Store verified workspace info in config
        integrationConfig.workspace_id = authTestData.team_id;
        integrationConfig.workspace_name = authTestData.team;
        integrationConfig.bot_user_id = authTestData.bot_user_id;
        integrationConfig.slack_user_id = authTestData.user_id;
        integrationConfig.verified_at = new Date().toISOString();
        integrationConfig.verification_status = 'verified';
      } catch (verifyError) {
        console.error('[oauth-callback] Slack: auth.test verification error:', verifyError);
        integrationConfig.verification_status = 'error';
        integrationConfig.error_message = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      }
    }
    
    // QuickBooks: store realmId (company ID)
    if (realmId) {
      integrationConfig.realm_id = realmId;
    }
    
    // Salesforce: store instance_url from token response and perform post-auth verification
    if (tokenData.instance_url) {
      integrationConfig.instance_url = tokenData.instance_url;
      
      // Salesforce post-auth verification: validate token with a lightweight API call
      if (normalizeServiceName(integration.service_name) === 'salesforce') {
        console.log('[oauth-callback] Salesforce: Performing post-auth verification...');
        try {
          // Call the identity endpoint to verify the token and get org info
          const identityResponse = await fetch(`${tokenData.instance_url}/services/oauth2/userinfo`, {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!identityResponse.ok) {
            console.error('[oauth-callback] Salesforce: Post-auth verification FAILED', {
              status: identityResponse.status,
              statusText: identityResponse.statusText,
            });
            return new Response(JSON.stringify({ 
              error: 'Salesforce verification failed',
              message: 'Unable to verify Salesforce connection. Please try again.',
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const identityData = await identityResponse.json();
          console.log('[oauth-callback] Salesforce: Post-auth verification SUCCESS', {
            organization_id: identityData.organization_id,
            user_id: identityData.user_id,
          });
          
          // Store verified org info in config
          integrationConfig.org_id = identityData.organization_id;
          integrationConfig.salesforce_user_id = identityData.user_id;
          integrationConfig.verified_at = new Date().toISOString();
        } catch (verifyError) {
          console.error('[oauth-callback] Salesforce: Post-auth verification error:', verifyError);
          // Don't fail the entire flow, but log the issue
          integrationConfig.verification_status = 'failed';
          integrationConfig.verification_error = verifyError instanceof Error ? verifyError.message : 'Unknown error';
        }
      }
    }

    const { data: userIntegration } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: stateData.user_id,
        integration_id: integrationMaster?.id,
        provider_id: integration.id,
        added_by_user: true,
        status: 'active',
        config: integrationConfig
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
}, { name: "oauth-callback" }));
