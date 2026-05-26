import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";
import { sendIntegrationConnectedEmail } from '../_shared/integration-notifications.ts';
import { checkIntegrationLimit } from '../_shared/integration-limits.ts';

// Cold start: Log credential presence for key OAuth providers (never log values)
console.log('[oauth-callback] Cold start - Credentials check:', {
  GOOGLE_CLIENT_ID_present: !!Deno.env.get('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET_present: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
  SLACK_CLIENT_ID_present: !!Deno.env.get('SLACK_CLIENT_ID'),
  SLACK_CLIENT_SECRET_present: !!Deno.env.get('SLACK_CLIENT_SECRET'),
  SALESFORCE_CLIENT_ID_present: !!Deno.env.get('SALESFORCE_CLIENT_ID'),
  TEAMS_CLIENT_ID_present: !!Deno.env.get('TEAMS_CLIENT_ID'),
  JIRA_CLIENT_ID_present: !!Deno.env.get('JIRA_CLIENT_ID'),
});

// Google services that use direct OAuth flow
const GOOGLE_SERVICES = ['google_calendar', 'google_meet', 'gmail', 'google_sheets'];

// Canonical Google token endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// QuickBooks sandbox token endpoint
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

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
  'google_meet': 'GOOGLE',
  'gmail': 'GOOGLE',           // Gmail uses same Google OAuth credentials
  'google_sheets': 'GOOGLE',  // Google Sheets uses same Google OAuth credentials
  'quickbooks': 'QUICKBOOKS',
  'xero': 'XERO',
  'salesforce': 'SALESFORCE',
  'hubspot': 'HUBSPOT',
  'planner': 'TEAMS',
  'jira': 'JIRA',
  'asana': 'ASANA',
  'github': 'GITHUB',
  'zendesk': 'ZENDESK',
  'notion': 'NOTION',
  'monday': 'MONDAY',
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
  // First line: confirm function is executing (not blocked by gateway)
  console.log('[oauth-callback] oauth-callback invoked', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  });

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

    // === STEP 1: Callback received — log all params ===
    console.log('[oauth-callback] STEP 1: Callback received', {
      has_code: !!code,
      code_length: code?.length ?? 0,
      has_state: !!state,
      has_error: !!error,
      has_realmId: !!realmId,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[oauth-callback] Provider returned error:', error);
      return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!code || !state) {
      console.error('[oauth-callback] Missing code or state', { code: !!code, state: !!state });
      return new Response(JSON.stringify({ error: 'Missing code or state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === STEP 2: Look up oauth_states — the ONLY source of user identity ===
    // No Authorization header, no JWT, no frontend session required.
    // The state parameter was generated during oauth-initiate and bound to the user_id.
    // This makes OAuth work regardless of browser session state.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[oauth-callback] STEP 2: Looking up oauth_states for state:', state);
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error('[oauth-callback] STEP 2: State lookup FAILED:', {
        error: stateError?.message,
        state_param: state,
      });
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired OAuth state',
        detail: 'OAuth state not found or expired. Please try connecting again.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that the state maps to a valid user_id
    const userId = stateData.user_id;
    if (!userId) {
      console.error('[oauth-callback] STEP 2: State has no user_id:', {
        state_param: state,
        state_data: { ...stateData, state: '[redacted]' },
      });
      return new Response(JSON.stringify({
        error: 'Invalid OAuth state',
        detail: 'OAuth state does not contain a valid user identity. Please try connecting again.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[oauth-callback] STEP 2: State validated — user resolved from state', {
      user_id: userId,
      integration_registry_id: stateData.integration_registry_id,
      redirect_uri: stateData.redirect_uri,
      state_created_at: stateData.created_at,
      state_expires_at: stateData.expires_at,
    });

    // === STEP 3: Look up integration registry ===
    const { data: integration, error: integrationError } = await supabase
      .from('integration_registry')
      .select('*')
      .eq('id', stateData.integration_registry_id)
      .single();

    if (integrationError || !integration) {
      console.error('[oauth-callback] STEP 3: Integration not found:', {
        integration_registry_id: stateData.integration_registry_id,
        error: integrationError?.message,
      });
      return new Response(JSON.stringify({ 
        error: 'Integration not found',
        detail: `No integration found for registry ID ${stateData.integration_registry_id}`,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[oauth-callback] STEP 3: Integration found:', {
      service_name: integration.service_name,
      auth_type: integration.auth_type,
    });

    // === Integration Plan Limit Check (safety net — also checked in oauth-initiate) ===
    const limitResult = await checkIntegrationLimit(supabase, stateData.user_id);
    if (!limitResult.allowed) {
      console.log('[oauth-callback] Integration limit reached:', limitResult);
      const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${appUrl}/integration-manager?error=integration_limit_reached&limit=${limitResult.limit}&plan=${limitResult.plan}`
        }
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

    // Google services: always use the canonical Google token endpoint
    // The integration_registry.oauth_token_url may be missing or outdated
    const normalizedService = normalizeServiceName(integration.service_name);
    let tokenUrl: string;
    if (GOOGLE_SERVICES.includes(normalizedService)) {
      tokenUrl = GOOGLE_TOKEN_URL;
    } else if (normalizedService === 'quickbooks') {
      // QuickBooks: always use the canonical Intuit token endpoint
      tokenUrl = QUICKBOOKS_TOKEN_URL;
      console.log('[oauth-callback] QuickBooks: Using Intuit token endpoint:', tokenUrl);
    } else {
      tokenUrl = integration.oauth_token_url;
    }

    // Diagnostic logging before token exchange (temporary)
    console.log('[oauth-callback] Token exchange request:', {
      service_name: integration.service_name,
      token_url: tokenUrl,
      db_token_url: integration.oauth_token_url,
      redirect_uri: stateData.redirect_uri,
      code_length: code.length,
      client_id_length: clientId.length,
      client_secret_present: !!clientSecret,
      grant_type: 'authorization_code',
    });

    // Provider-specific token exchange handling
    const isGitHub = normalizedService === 'github';
    const isNotion = normalizedService === 'notion';

    const tokenHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // GitHub requires Accept: application/json header
    if (isGitHub) {
      tokenHeaders['Accept'] = 'application/json';
    }

    // Notion requires Basic Auth (base64 of client_id:client_secret)
    // instead of passing credentials in the body
    if (isNotion) {
      const basicAuth = btoa(`${clientId}:${clientSecret}`);
      tokenHeaders['Authorization'] = `Basic ${basicAuth}`;
      tokenHeaders['Content-Type'] = 'application/json';
    }

    let tokenResponse: Response;

    if (isNotion) {
      // Notion expects JSON body with code, grant_type, and redirect_uri
      tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: JSON.stringify({
          code,
          grant_type: 'authorization_code',
          redirect_uri: stateData.redirect_uri,
        }),
      });
    } else {
      const tokenBody: Record<string, string> = {
        code,
        client_id: clientId,
        client_secret: clientSecret!,
        redirect_uri: stateData.redirect_uri,
      };
      if (!isGitHub) {
        tokenBody.grant_type = 'authorization_code';
      }

      // PKCE: Include code_verifier in token exchange if it was stored during oauth-initiate
      if (stateData.code_verifier) {
        tokenBody.code_verifier = stateData.code_verifier;
        console.log('[oauth-callback] PKCE: Including code_verifier in token exchange for', normalizedService);
      }

      tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: new URLSearchParams(tokenBody),
      });
    }

    const tokenData = await tokenResponse.json();

    // GitHub tokens don't expire and have no refresh_token
    if (isGitHub && tokenData.access_token) {
      tokenData.token_type = tokenData.token_type || 'bearer';
      console.log('[oauth-callback] GitHub: Token received, scope:', tokenData.scope);
    }

    // Notion returns workspace info alongside the token
    if (isNotion && tokenData.access_token) {
      tokenData.token_type = tokenData.token_type || 'bearer';
      console.log('[oauth-callback] Notion: Token received, workspace:', tokenData.workspace_name);
    }

    // Log full token exchange response for debugging
    console.log('[oauth-callback] Token exchange response:', {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      has_access_token: !!tokenData.access_token,
      has_refresh_token: !!tokenData.refresh_token,
      has_id_token: !!tokenData.id_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      error: tokenData.error,
      error_description: tokenData.error_description,
    });

    // === STEP 4: Token exchange result ===
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[oauth-callback] STEP 4: TOKEN EXCHANGE FAILED:', {
        service: integration.service_name,
        user_id: userId,
        token_url: tokenUrl,
        redirect_uri: stateData.redirect_uri,
        response_status: tokenResponse.status,
        error: tokenData.error,
        error_description: tokenData.error_description,
        full_response: tokenData,
      });
      const googleError = tokenData.error_description || tokenData.error || 'Unknown error';
      return new Response(JSON.stringify({ 
        error: `Token exchange failed: ${googleError}`, 
        reason: googleError,
        user_id: userId,
        service: integration.service_name,
        details: tokenData 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[oauth-callback] STEP 4: Token exchange SUCCESS', {
      service: integration.service_name,
      user_id: userId,
      has_access_token: true,
      has_refresh_token: !!tokenData.refresh_token,
      scope: tokenData.scope,
    });

    // === STEP 5: Store tokens in vault WITH user_id binding ===
    console.log('[oauth-callback] STEP 5: Storing tokens in vault for user:', userId);
    const { data: accessTokenSecretId, error: vaultAccessErr } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.access_token
    });
    if (vaultAccessErr || !accessTokenSecretId) {
      console.error('[oauth-callback] STEP 5: FAILED to store access token in vault:', {
        user_id: userId,
        error: vaultAccessErr?.message,
      });
      return new Response(JSON.stringify({
        error: 'Failed to store access token',
        detail: 'Vault write failed for access token',
        user_id: userId,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[oauth-callback] STEP 5: Access token stored in vault:', { secret_id: accessTokenSecretId });

    let refreshTokenSecretId = null;
    if (tokenData.refresh_token) {
      const { data: refreshSecretId, error: vaultRefreshErr } = await supabase.rpc('vault_create_secret', {
        secret: tokenData.refresh_token
      });
      if (vaultRefreshErr || !refreshSecretId) {
        console.error('[oauth-callback] STEP 5: FAILED to store refresh token in vault:', {
          user_id: userId,
          error: vaultRefreshErr?.message,
        });
        // Non-fatal: continue without refresh token but log warning
        console.warn('[oauth-callback] WARNING: Refresh token not stored. Token refresh will fail.');
      } else {
        refreshTokenSecretId = refreshSecretId;
        console.log('[oauth-callback] STEP 5: Refresh token stored in vault:', { secret_id: refreshSecretId });
      }
    } else {
      console.warn('[oauth-callback] STEP 5: No refresh token received from provider (token refresh will not be possible)');
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
      // Verify this is a Bot OAuth token (xoxb-)
      const tokenPrefix = tokenData.access_token.substring(0, 5);
      console.log('[oauth-callback] Slack: Token type check:', {
        token_prefix: tokenPrefix,
        is_bot_token: tokenPrefix === 'xoxb-',
        is_user_token: tokenPrefix === 'xoxp-',
      });
      if (tokenPrefix !== 'xoxb-') {
        console.warn('[oauth-callback] WARNING: Slack token is NOT a bot token (prefix:', tokenPrefix + '). Bot tokens (xoxb-) are required for conversations.list to discover channels.');
      }
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
              'Location': `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/integration-manager?oauth_error=true&service=${integration.service_name}&error=verification_failed`
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
        
        // Immediately sync channels after OAuth installation
        // This ensures Core314 knows available channels right away
        console.log('[oauth-callback] Slack: Running post-install channel sync...');
        try {
          const channelSyncHeaders = {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          };
          const channelsResponse = await fetch('https://slack.com/api/conversations.list?' + new URLSearchParams({
            types: 'public_channel,private_channel',
            exclude_archived: 'true',
            limit: '1000',
          }).toString(), {
            method: 'GET',
            headers: channelSyncHeaders,
          });
          
          const channelsData = await channelsResponse.json();
          if (channelsData.ok && channelsData.channels) {
            console.log('Slack channels detected:', channelsData.channels.length);
            const memberChannels = channelsData.channels.filter((ch: { is_member: boolean }) => ch.is_member);
            console.log('[oauth-callback] Slack: Member channels:', memberChannels.length);
            
            integrationConfig.channels_total = channelsData.channels.length;
            integrationConfig.channels_member = memberChannels.length;
            integrationConfig.channel_names = memberChannels.slice(0, 50).map((ch: { name: string }) => ch.name);
            integrationConfig.channels_synced_at = new Date().toISOString();
          } else {
            console.log('[oauth-callback] Slack: Channel sync returned ok=false:', channelsData.error);
          }
        } catch (channelSyncError) {
          console.error('[oauth-callback] Slack: Channel sync error (non-fatal):', channelSyncError);
        }
      } catch (verifyError) {
        console.error('[oauth-callback] Slack: auth.test verification error:', verifyError);
        integrationConfig.verification_status = 'error';
        integrationConfig.error_message = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      }
    }
    
    // Jira (Atlassian): fetch accessible resources (cloud_id) and perform post-auth verification
    if (normalizeServiceName(integration.service_name) === 'jira') {
      console.log('[oauth-callback] Jira: Performing post-auth verification...');
      try {
        // Step 1: Get accessible Atlassian cloud resources to find the cloud_id
        const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
          },
        });

        if (!resourcesResponse.ok) {
          console.error('[oauth-callback] Jira: Failed to fetch accessible resources', {
            status: resourcesResponse.status,
          });
          integrationConfig.verification_status = 'error';
          integrationConfig.error_message = 'Failed to retrieve Jira cloud resources';
        } else {
          const resources = await resourcesResponse.json();
          console.log('[oauth-callback] Jira: Accessible resources:', resources.length);

          if (resources.length === 0) {
            integrationConfig.verification_status = 'error';
            integrationConfig.error_message = 'No Jira sites found for this Atlassian account';
          } else {
            // Use the first accessible resource (most common case: single Jira site)
            const primaryResource = resources[0];
            integrationConfig.cloud_id = primaryResource.id;
            integrationConfig.site_name = primaryResource.name;
            integrationConfig.site_url = primaryResource.url;
            integrationConfig.scopes = primaryResource.scopes;
            integrationConfig.avatar_url = primaryResource.avatarUrl;

            // Step 2: Verify token with a lightweight API call (/rest/api/3/myself)
            const myselfResponse = await fetch(
              `https://api.atlassian.com/ex/jira/${primaryResource.id}/rest/api/3/myself`,
              {
                headers: {
                  'Authorization': `Bearer ${tokenData.access_token}`,
                  'Accept': 'application/json',
                },
              }
            );

            if (myselfResponse.ok) {
              const myselfData = await myselfResponse.json();
              console.log('[oauth-callback] Jira: Post-auth verification SUCCESS', {
                accountId: myselfData.accountId,
                displayName: myselfData.displayName,
              });
              integrationConfig.jira_account_id = myselfData.accountId;
              integrationConfig.jira_display_name = myselfData.displayName;
              integrationConfig.jira_email = myselfData.emailAddress;
              integrationConfig.verified_at = new Date().toISOString();
              integrationConfig.verification_status = 'verified';
            } else {
              console.error('[oauth-callback] Jira: /myself verification failed', {
                status: myselfResponse.status,
              });
              integrationConfig.verification_status = 'partial';
              integrationConfig.error_message = 'Token valid but user verification failed';
            }

            // If multiple Jira sites, store the full list for future selection
            if (resources.length > 1) {
              integrationConfig.all_sites = resources.map((r: { id: string; name: string; url: string }) => ({
                cloud_id: r.id,
                name: r.name,
                url: r.url,
              }));
            }
          }
        }
      } catch (verifyError) {
        console.error('[oauth-callback] Jira: Post-auth verification error:', verifyError);
        integrationConfig.verification_status = 'error';
        integrationConfig.error_message = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      }
    }

    // QuickBooks: store realmId (company ID) and environment flag
    if (realmId) {
      integrationConfig.realm_id = realmId;
      integrationConfig.environment = 'sandbox';
      console.log('[oauth-callback] QuickBooks: Stored realmId and sandbox environment:', { realm_id: realmId });
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

    // === STEP 6: Upsert user_integration with user_id ===
    console.log('[oauth-callback] STEP 6: Upserting user_integration for user:', userId);
    const { data: userIntegration, error: upsertIntError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
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

    if (upsertIntError) {
      console.error('[oauth-callback] STEP 6: user_integration upsert FAILED:', {
        user_id: userId,
        error: upsertIntError.message,
        code: upsertIntError.code,
      });
      return new Response(JSON.stringify({
        error: 'Failed to save integration',
        detail: upsertIntError.message,
        user_id: userId,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[oauth-callback] STEP 6: user_integration upsert SUCCESS:', {
      user_integration_id: userIntegration?.id,
      user_id: userId,
      status: 'active',
    });

    // === STEP 7: Upsert oauth_tokens with user_id ===
    console.log('[oauth-callback] STEP 7: Upserting oauth_tokens for user:', userId);
    const { error: upsertTokenError } = await supabase.from('oauth_tokens').upsert({
      user_id: userId,
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

    if (upsertTokenError) {
      console.error('[oauth-callback] STEP 7: oauth_tokens upsert FAILED:', {
        user_id: userId,
        error: upsertTokenError.message,
        code: upsertTokenError.code,
      });
      return new Response(JSON.stringify({
        error: 'Failed to store OAuth tokens',
        detail: upsertTokenError.message,
        user_id: userId,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[oauth-callback] STEP 7: oauth_tokens upsert SUCCESS:', {
      user_id: userId,
      has_access_token: !!accessTokenSecretId,
      has_refresh_token: !!refreshTokenSecretId,
      expires_at: expiresAt,
    });

    // Clean up used state
    await supabase.from('oauth_states').delete().eq('state', state);
    console.log('[oauth-callback] State cleaned up for:', state);

    // === STEP 8: Send connection confirmation email (non-blocking) ===
    console.log('[oauth-callback] STEP 8: Sending connection email for user:', userId);
    const { data: { user: connectedUser } } = await supabase.auth.admin.getUserById(userId);
    if (connectedUser?.email) {
      sendIntegrationConnectedEmail(integration.service_name, {
        recipientEmail: connectedUser.email,
        recipientName: connectedUser.user_metadata?.full_name as string,
      }).catch(err => console.error('[oauth-callback] Email notification failed:', err));
    }

    // Requirement 5: Immediate poll on integration connect
    // Trigger the service-specific poller immediately after successful OAuth connection
    // This ensures data flows into the system right away without waiting for the 15-min scheduler
    const normalizedServiceForPoll = normalizeServiceName(integration.service_name);
    console.log(`[oauth-callback] Triggering immediate poll for ${normalizedServiceForPoll} (poll-on-connect)`);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const pollResponse = await fetch(`${supabaseUrl}/functions/v1/manual-poll-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: normalizedServiceForPoll,
          triggered_by: 'oauth-callback:poll-on-connect',
        }),
      });
      const pollData = await pollResponse.json();
      console.log(`[oauth-callback] Immediate poll result for ${normalizedServiceForPoll}:`, {
        ok: pollResponse.ok,
        status: pollResponse.status,
        processed: pollData.records_processed ?? 0,
        duration_ms: pollData.duration_ms ?? 0,
      });
    } catch (pollError) {
      // Non-blocking: don't fail the OAuth flow if the immediate poll fails
      console.error(`[oauth-callback] Immediate poll failed for ${normalizedServiceForPoll} (non-fatal):`, pollError);
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/integration-manager?oauth_success=true&service=${integration.service_name}`
      }
    });
  } catch (error) {
    console.error('[oauth-callback] UNHANDLED ERROR:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
    });
    return new Response(JSON.stringify({ 
      error: error.message,
      detail: 'Unhandled exception in oauth-callback. Check edge function logs.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "oauth-callback" }));
