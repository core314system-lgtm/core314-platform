import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withSentry, handleSentryTest } from "../_shared/sentry.ts";
import { sendIntegrationConnectedEmail } from '../_shared/integration-notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * google-oauth-exchange
 * 
 * Secure backend-only token exchange for Google OAuth.
 * 
 * Flow:
 * 1. Frontend redirects user to Google OAuth with redirect_uri = app.core314.com/auth/callback
 * 2. Google redirects back to frontend with ?code=...&state=...
 * 3. Frontend extracts code + state, POSTs to this function
 * 4. This function exchanges code for tokens with Google
 * 5. Tokens stored securely in Supabase Vault + oauth_tokens table
 * 6. Returns success/error to frontend
 * 
 * Security:
 * - Client secret NEVER leaves server
 * - Tokens stored encrypted in Supabase Vault
 * - State parameter validated against oauth_states table
 * - User authenticated via Supabase JWT
 */

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body
    const { code, state, redirect_uri } = await req.json();
    console.log('[google-oauth-exchange] Request received', {
      hasCode: !!code,
      hasState: !!state,
      redirect_uri,
      timestamp: new Date().toISOString(),
    });

    if (!code || !state) {
      return new Response(JSON.stringify({ 
        error: 'missing_params',
        message: 'Both code and state are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate state against oauth_states table
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error('[google-oauth-exchange] Invalid or expired state:', stateError?.message);
      return new Response(JSON.stringify({ 
        error: 'invalid_state',
        message: 'OAuth state is invalid or expired. Please try connecting again.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[google-oauth-exchange] State validated', {
      user_id: stateData.user_id,
      integration_registry_id: stateData.integration_registry_id,
      stored_redirect_uri: stateData.redirect_uri,
    });

    // Look up integration registry for this service
    const { data: integration, error: integrationError } = await supabase
      .from('integration_registry')
      .select('*')
      .eq('id', stateData.integration_registry_id)
      .single();

    if (integrationError || !integration) {
      console.error('[google-oauth-exchange] Integration not found:', integrationError?.message);
      return new Response(JSON.stringify({ 
        error: 'integration_not_found',
        message: 'Integration configuration not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve Google OAuth credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      // Fallback: try CORE314_ prefix
      const fallbackClientId = Deno.env.get('CORE314_GOOGLE_CLIENT_ID');
      const fallbackClientSecret = Deno.env.get('CORE314_GOOGLE_CLIENT_SECRET');
      
      if (!fallbackClientId || !fallbackClientSecret) {
        console.error('[google-oauth-exchange] FATAL: No Google OAuth credentials found');
        return new Response(JSON.stringify({ 
          error: 'oauth_not_configured',
          message: 'Google OAuth credentials are not configured on the server' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const effectiveClientId = clientId || Deno.env.get('CORE314_GOOGLE_CLIENT_ID') || '';
    const effectiveClientSecret = clientSecret || Deno.env.get('CORE314_GOOGLE_CLIENT_SECRET') || '';

    // Use the redirect_uri from the request (must match what was sent to Google)
    // Fall back to the stored redirect_uri from oauth_states
    const effectiveRedirectUri = redirect_uri || stateData.redirect_uri;

    console.log('[google-oauth-exchange] Exchanging code for tokens', {
      service_name: integration.service_name,
      token_url: 'https://oauth2.googleapis.com/token',
      redirect_uri: effectiveRedirectUri,
    });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: effectiveClientId,
        client_secret: effectiveClientSecret,
        redirect_uri: effectiveRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[google-oauth-exchange] Token exchange failed:', {
        status: tokenResponse.status,
        error: tokenData.error,
        error_description: tokenData.error_description,
      });
      return new Response(JSON.stringify({ 
        error: 'token_exchange_failed',
        message: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code for tokens',
        details: {
          google_error: tokenData.error,
          google_error_description: tokenData.error_description,
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[google-oauth-exchange] Token exchange successful', {
      has_access_token: !!tokenData.access_token,
      has_refresh_token: !!tokenData.refresh_token,
      scope: tokenData.scope,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });

    // Store tokens securely in Supabase Vault
    const { data: accessTokenSecretId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.access_token,
    });

    let refreshTokenSecretId = null;
    if (tokenData.refresh_token) {
      const { data: refreshSecretId } = await supabase.rpc('vault_create_secret', {
        secret: tokenData.refresh_token,
      });
      refreshTokenSecretId = refreshSecretId;
    }

    // Calculate token expiration
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Look up integrations_master for FK
    const { data: integrationMaster } = await supabase
      .from('integrations_master')
      .select('id')
      .eq('integration_type', integration.service_name)
      .single();

    // Build integration config
    const integrationConfig: Record<string, unknown> = {
      oauth_connected: true,
      scope: tokenData.scope,
      connected_at: new Date().toISOString(),
    };

    // Fetch Google user profile info if openid/profile scopes were granted
    if (tokenData.scope && (tokenData.scope.includes('userinfo') || tokenData.scope.includes('openid'))) {
      try {
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          integrationConfig.google_email = profileData.email;
          integrationConfig.google_name = profileData.name;
          integrationConfig.google_picture = profileData.picture;
          console.log('[google-oauth-exchange] Google profile fetched:', {
            email: profileData.email,
            name: profileData.name,
          });
        }
      } catch (profileError) {
        console.warn('[google-oauth-exchange] Failed to fetch Google profile (non-fatal):', profileError);
      }
    }

    // Upsert user_integrations record
    const { data: userIntegration } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: stateData.user_id,
        integration_id: integrationMaster?.id,
        provider_id: integration.id,
        added_by_user: true,
        status: 'active',
        config: integrationConfig,
      }, {
        onConflict: 'user_id,integration_id',
      })
      .select()
      .single();

    // Store tokens in oauth_tokens table
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
        connected_via: 'google-oauth-exchange',
        connected_at: new Date().toISOString(),
      },
    }, {
      onConflict: 'user_id,integration_registry_id',
    });

    // Clean up used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Send connection confirmation email (non-blocking)
    const { data: { user: connectedUser } } = await supabase.auth.admin.getUserById(stateData.user_id);
    if (connectedUser?.email) {
      sendIntegrationConnectedEmail(integration.service_name, {
        recipientEmail: connectedUser.email,
        recipientName: connectedUser.user_metadata?.full_name as string,
      }).catch(err => console.error('[google-oauth-exchange] Email notification failed:', err));
    }

    console.log('[google-oauth-exchange] SUCCESS: Integration connected', {
      user_id: stateData.user_id,
      service_name: integration.service_name,
      user_integration_id: userIntegration?.id,
      has_refresh_token: !!refreshTokenSecretId,
    });

    return new Response(JSON.stringify({
      success: true,
      service_name: integration.service_name,
      connected: true,
      has_refresh_token: !!tokenData.refresh_token,
      scope: tokenData.scope,
      expires_at: expiresAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[google-oauth-exchange] Unhandled error:', error);
    return new Response(JSON.stringify({ 
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, { name: "google-oauth-exchange" }));
