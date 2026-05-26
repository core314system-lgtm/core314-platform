import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * token-refresh-all — Universal proactive token refresh for ALL OAuth integrations.
 *
 * Runs BEFORE every poll cycle (called by integration-scheduler).
 * Finds all OAuth tokens that are expired or expiring within 15 minutes
 * and refreshes them proactively so poll functions never encounter expired tokens.
 *
 * Supported providers:
 * - Google (Calendar, Gmail, Sheets) — form-urlencoded, uses GOOGLE_CLIENT_ID/SECRET
 * - HubSpot — form-urlencoded, uses HUBSPOT_CLIENT_ID/SECRET
 * - QuickBooks — form-urlencoded, uses QUICKBOOKS_CLIENT_ID/SECRET
 * - Microsoft Teams — form-urlencoded, uses TEAMS_CLIENT_ID/SECRET
 * - Jira (Atlassian) — JSON body, uses JIRA_CLIENT_ID/SECRET
 * - Slack — form-urlencoded, uses SLACK_CLIENT_ID/SECRET
 * - Xero — form-urlencoded, uses XERO_CLIENT_ID/SECRET
 * - Salesforce — form-urlencoded, uses SALESFORCE_CLIENT_ID/SECRET
 *
 * On failure: logs error, sends Slack webhook alert, updates integration health status.
 * On success: stores new access token in vault, updates oauth_tokens row.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Map service_name → { envPrefix, tokenUrl, contentType }
const SERVICE_TOKEN_CONFIG: Record<string, {
  envPrefix: string;
  tokenUrl: string;
  contentType: 'form' | 'json';
}> = {
  google_calendar: {
    envPrefix: 'GOOGLE',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    contentType: 'form',
  },
  gmail: {
    envPrefix: 'GOOGLE',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    contentType: 'form',
  },
  google_sheets: {
    envPrefix: 'GOOGLE',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    contentType: 'form',
  },
  hubspot: {
    envPrefix: 'HUBSPOT',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    contentType: 'form',
  },
  quickbooks: {
    envPrefix: 'QUICKBOOKS',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    contentType: 'form',
  },
  microsoft_teams: {
    envPrefix: 'TEAMS',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    contentType: 'form',
  },
  jira: {
    envPrefix: 'JIRA',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    contentType: 'json',
  },
  slack: {
    envPrefix: 'SLACK',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    contentType: 'form',
  },
  xero: {
    envPrefix: 'XERO',
    tokenUrl: 'https://identity.xero.com/connect/token',
    contentType: 'form',
  },
  salesforce: {
    envPrefix: 'SALESFORCE',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    contentType: 'form',
  },
  asana: {
    envPrefix: 'ASANA',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    contentType: 'form',
  },
  zoom: {
    envPrefix: 'ZOOM',
    tokenUrl: 'https://zoom.us/oauth/token',
    contentType: 'form',
  },
  github: {
    envPrefix: 'GITHUB',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    contentType: 'form',
  },
  zendesk: {
    envPrefix: 'ZENDESK',
    tokenUrl: 'https://YOUR_SUBDOMAIN.zendesk.com/oauth/tokens',
    contentType: 'form',
  },
};

interface TokenRow {
  id: string;
  user_id: string;
  integration_registry_id: string;
  access_token_secret_id: string;
  refresh_token_secret_id: string | null;
  expires_at: string | null;
  service_name: string; // joined from integration_registry
}

interface RefreshResult {
  service: string;
  userId: string;
  success: boolean;
  error?: string;
  newExpiresAt?: string;
  wasExpired: boolean;
}

async function refreshSingleToken(
  supabase: ReturnType<typeof createClient>,
  token: TokenRow,
  config: { envPrefix: string; tokenUrl: string; contentType: 'form' | 'json' }
): Promise<RefreshResult> {
  const now = new Date();
  const wasExpired = token.expires_at ? new Date(token.expires_at) < now : false;

  if (!token.refresh_token_secret_id) {
    return {
      service: token.service_name,
      userId: token.user_id,
      success: false,
      error: 'No refresh token stored — user must re-authorize',
      wasExpired,
    };
  }

  // Get refresh token from vault
  const { data: refreshTokenData, error: rtError } = await supabase
    .rpc('get_decrypted_secret', { secret_id: token.refresh_token_secret_id });

  if (rtError || !refreshTokenData) {
    return {
      service: token.service_name,
      userId: token.user_id,
      success: false,
      error: `Failed to decrypt refresh token: ${rtError?.message || 'no data'}`,
      wasExpired,
    };
  }

  // Get OAuth credentials from environment (try standard prefix, then CORE314_ fallback)
  const clientId = Deno.env.get(`${config.envPrefix}_CLIENT_ID`)
    || Deno.env.get(`CORE314_${config.envPrefix}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${config.envPrefix}_CLIENT_SECRET`)
    || Deno.env.get(`CORE314_${config.envPrefix}_CLIENT_SECRET`);

  if (!clientId || !clientSecret) {
    return {
      service: token.service_name,
      userId: token.user_id,
      success: false,
      error: `Missing ${config.envPrefix}_CLIENT_ID or ${config.envPrefix}_CLIENT_SECRET`,
      wasExpired,
    };
  }

  console.log(`[token-refresh-all] Refreshing ${token.service_name} token for user ${token.user_id} (${wasExpired ? 'EXPIRED' : 'expiring soon'})`);

  // Build request based on provider's content type
  let tokenResponse: Response;

  if (config.contentType === 'json') {
    // Jira/Atlassian uses JSON body
    tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenData,
      }),
    });
  } else {
    // Most providers use form-urlencoded
    tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenData,
      }),
    });
  }

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    const errorDetail = tokenData.error_description || tokenData.error || JSON.stringify(tokenData);
    console.error(`[token-refresh-all] FAILED ${token.service_name} for user ${token.user_id}: ${errorDetail}`);
    return {
      service: token.service_name,
      userId: token.user_id,
      success: false,
      error: `Token refresh failed (${tokenResponse.status}): ${errorDetail}`,
      wasExpired,
    };
  }

  // Store new access token in vault
  const { data: newAccessSecretId } = await supabase.rpc('vault_create_secret', {
    secret: tokenData.access_token,
  });

  // Store new refresh token if provider rotated it
  let newRefreshSecretId = token.refresh_token_secret_id;
  if (tokenData.refresh_token && tokenData.refresh_token !== refreshTokenData) {
    const { data: refreshSecretId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.refresh_token,
    });
    if (refreshSecretId) {
      newRefreshSecretId = refreshSecretId;
    }
  }

  const newExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Update oauth_tokens row
  await supabase
    .from('oauth_tokens')
    .update({
      access_token_secret_id: newAccessSecretId,
      refresh_token_secret_id: newRefreshSecretId,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', token.id);

  console.log(`[token-refresh-all] SUCCESS ${token.service_name} for user ${token.user_id} — new expiry: ${newExpiresAt}`);

  return {
    service: token.service_name,
    userId: token.user_id,
    success: true,
    newExpiresAt: newExpiresAt ?? undefined,
    wasExpired,
  };
}

async function sendSlackAlert(
  message: string,
  failures: RefreshResult[]
): Promise<void> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!webhookUrl) return;

  const failureDetails = failures.map(f =>
    `• *${f.service}* (user: ${f.userId.substring(0, 8)}...): ${f.error}`
  ).join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: *Token Refresh Alert*\n${message}\n\n${failureDetails}`,
      }),
    });
  } catch (err) {
    console.error('[token-refresh-all] Slack alert failed:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    // Refresh tokens that expire within 15 minutes (proactive) or are already expired
    const refreshWindow = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    console.log(`[token-refresh-all] ========== TOKEN REFRESH START ==========`);
    console.log(`[token-refresh-all] Timestamp: ${now.toISOString()}`);
    console.log(`[token-refresh-all] Refresh window: tokens expiring before ${refreshWindow}`);

    // Find all OAuth tokens that need refresh:
    // 1. Have a refresh_token_secret_id (can be refreshed)
    // 2. Have an expires_at that is before the refresh window
    const { data: expiringTokens, error: queryError } = await supabase
      .from('oauth_tokens')
      .select(`
        id, user_id, integration_registry_id,
        access_token_secret_id, refresh_token_secret_id, expires_at,
        integration_registry!inner ( service_name )
      `)
      .not('refresh_token_secret_id', 'is', null)
      .not('expires_at', 'is', null)
      .lt('expires_at', refreshWindow);

    if (queryError) {
      console.error('[token-refresh-all] Query error:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query expiring tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!expiringTokens || expiringTokens.length === 0) {
      console.log('[token-refresh-all] No tokens need refresh');
      console.log('[token-refresh-all] ========== TOKEN REFRESH COMPLETE (0 tokens) ==========');
      return new Response(JSON.stringify({
        success: true,
        refreshed: 0,
        failed: 0,
        total: 0,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[token-refresh-all] Found ${expiringTokens.length} tokens to refresh`);

    const results: RefreshResult[] = [];

    for (const token of expiringTokens) {
      const registry = token.integration_registry as unknown as { service_name: string };
      const serviceName = registry?.service_name;

      if (!serviceName) {
        console.warn('[token-refresh-all] Token missing service_name, skipping:', token.id);
        continue;
      }

      const config = SERVICE_TOKEN_CONFIG[serviceName];
      if (!config) {
        console.log(`[token-refresh-all] No refresh config for service: ${serviceName}, skipping`);
        continue;
      }

      const tokenRow: TokenRow = {
        ...token,
        service_name: serviceName,
      };

      try {
        const result = await refreshSingleToken(supabase, tokenRow, config);
        results.push(result);

        // Update integration health status based on result
        if (!result.success) {
          // Update user_integrations to reflect auth issue
          const { data: userIntegration } = await supabase
            .from('user_integrations')
            .select('id, consecutive_failures, config')
            .eq('user_id', token.user_id)
            .eq('provider_id', token.integration_registry_id)
            .single();

          if (userIntegration) {
            const failures = (userIntegration.consecutive_failures || 0) + 1;
            await supabase
              .from('user_integrations')
              .update({
                last_error_at: now.toISOString(),
                error_message: `Token refresh failed: ${result.error}`,
                consecutive_failures: failures,
                config: {
                  ...(userIntegration.config as Record<string, unknown> || {}),
                  token_refresh_failed_at: now.toISOString(),
                  token_refresh_error: result.error,
                },
              })
              .eq('id', userIntegration.id);
          }
        } else {
          // Clear any previous token refresh errors
          const { data: userIntegration } = await supabase
            .from('user_integrations')
            .select('id, config')
            .eq('user_id', token.user_id)
            .eq('provider_id', token.integration_registry_id)
            .single();

          if (userIntegration) {
            const config = (userIntegration.config as Record<string, unknown>) || {};
            // Remove token refresh error fields
            const { token_refresh_failed_at: _a, token_refresh_error: _b, ...cleanConfig } = config;
            await supabase
              .from('user_integrations')
              .update({
                config: {
                  ...cleanConfig,
                  last_token_refresh: now.toISOString(),
                },
              })
              .eq('id', userIntegration.id);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[token-refresh-all] Exception refreshing ${serviceName}:`, err);
        results.push({
          service: serviceName,
          userId: token.user_id,
          success: false,
          error: `Exception: ${errorMsg}`,
          wasExpired: token.expires_at ? new Date(token.expires_at) < now : false,
        });
      }

      // Small delay between refreshes to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const refreshed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const failures = results.filter(r => !r.success);

    // Send Slack alert if any refresh failed
    if (failures.length > 0) {
      await sendSlackAlert(
        `${failures.length} of ${results.length} token refresh(es) failed`,
        failures
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[token-refresh-all] ========== TOKEN REFRESH COMPLETE ==========`);
    console.log(`[token-refresh-all] Refreshed: ${refreshed}, Failed: ${failed}, Duration: ${duration}ms`);

    return new Response(JSON.stringify({
      success: failed === 0,
      refreshed,
      failed,
      total: results.length,
      duration_ms: duration,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[token-refresh-all] Fatal error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
