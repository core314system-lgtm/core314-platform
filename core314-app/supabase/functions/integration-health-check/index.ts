import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Integration Health Check
 * 
 * Validates OAuth tokens for all connected integrations:
 * - Slack: calls auth.test API
 * - HubSpot: calls account-info API
 * - QuickBooks: calls companyinfo API
 * 
 * Updates user_integrations.last_verified_at on success,
 * increments consecutive_failures and sets error info on failure.
 * 
 * Also handles token refresh for integrations with expiring tokens
 * (QuickBooks, HubSpot) before attempting health check.
 * 
 * Designed to be called by pg_cron or Supabase scheduled invocation.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface HealthCheckResult {
  service: string;
  userId: string;
  userIntegrationId: string;
  healthy: boolean;
  message: string;
  tokenRefreshed?: boolean;
  tokenRefreshError?: string;
  tokenExpired?: boolean;
}

interface TokenRefreshResult {
  accessToken: string | null;
  error?: string;
}

/**
 * Refresh an expired OAuth token using the stored refresh token.
 * Returns the new access token and any error details.
 */
async function refreshToken(
  supabase: ReturnType<typeof createClient>,
  tokenRecord: {
    id: string;
    access_token_secret_id: string;
    refresh_token_secret_id: string | null;
    expires_at: string | null;
    integration_registry_id: string;
  },
  serviceName: string,
  tokenUrl: string
): Promise<TokenRefreshResult> {
  if (!tokenRecord.refresh_token_secret_id) {
    console.log(`[health-check] No refresh token for ${serviceName}`);
    return { accessToken: null, error: 'No refresh token stored' };
  }

  // Get refresh token from vault
  const { data: refreshTokenData, error: refreshError } = await supabase
    .rpc('get_decrypted_secret', { secret_id: tokenRecord.refresh_token_secret_id });

  if (refreshError || !refreshTokenData) {
    console.error(`[health-check] Failed to get refresh token for ${serviceName}:`, refreshError);
    return { accessToken: null, error: `Failed to decrypt refresh token: ${refreshError?.message || 'no data returned'}` };
  }

  const envPrefix = serviceName.toUpperCase();
  const clientId = Deno.env.get(`${envPrefix}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${envPrefix}_CLIENT_SECRET`);

  if (!clientId || !clientSecret) {
    console.error(`[health-check] Missing OAuth credentials for ${serviceName}`);
    return { accessToken: null, error: `Missing ${envPrefix}_CLIENT_ID or ${envPrefix}_CLIENT_SECRET env vars` };
  }

  console.log(`[health-check] Refreshing token for ${serviceName} using client ${clientId.substring(0, 8)}...`);

  const refreshResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenData,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokenData = await refreshResponse.json();

  if (!refreshResponse.ok || !tokenData.access_token) {
    const errorDetail = tokenData.error_description || tokenData.error || JSON.stringify(tokenData);
    console.error(`[health-check] Token refresh failed for ${serviceName} (${refreshResponse.status}):`, tokenData);
    return { accessToken: null, error: `Token refresh failed (${refreshResponse.status}): ${errorDetail}. This usually means the user needs to re-connect the integration.` };
  }

  // Store new access token in vault
  const { data: newAccessTokenSecretId } = await supabase.rpc('vault_create_secret', {
    secret: tokenData.access_token,
  });

  // Update new refresh token if provided (QuickBooks rotates refresh tokens)
  let newRefreshTokenSecretId = tokenRecord.refresh_token_secret_id;
  if (tokenData.refresh_token) {
    const { data: newRefreshId } = await supabase.rpc('vault_create_secret', {
      secret: tokenData.refresh_token,
    });
    if (newRefreshId) {
      newRefreshTokenSecretId = newRefreshId;
    }
  }

  // Update oauth_tokens record
  await supabase
    .from('oauth_tokens')
    .update({
      access_token_secret_id: newAccessTokenSecretId,
      refresh_token_secret_id: newRefreshTokenSecretId,
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenRecord.id);

  console.log(`[health-check] Token refreshed successfully for ${serviceName}`);
  return { accessToken: tokenData.access_token };
}

/**
 * Verify a Slack token by calling auth.test
 */
async function verifySlack(accessToken: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (data.ok) {
    return { ok: true, message: `Workspace: ${data.team} (${data.team_id})` };
  }
  return { ok: false, message: `Slack auth.test failed: ${data.error}` };
}

/**
 * Verify a HubSpot token by calling account-info
 */
async function verifyHubSpot(accessToken: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('https://api.hubapi.com/account-info/v3/details', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (response.ok) {
    const data = await response.json();
    return { ok: true, message: `Portal: ${data.companyName || data.portalId}` };
  }
  const errorText = await response.text();
  return { ok: false, message: `HubSpot API failed (${response.status}): ${errorText.slice(0, 200)}` };
}

/**
 * Verify a QuickBooks token by calling companyinfo
 */
async function verifyQuickBooks(
  accessToken: string,
  realmId: string
): Promise<{ ok: boolean; message: string }> {
  // Use sandbox API base URL (matching quickbooks-poll)
  const response = await fetch(
    `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );
  if (response.ok) {
    const data = await response.json();
    return { ok: true, message: `Company: ${data.CompanyInfo?.CompanyName || realmId}` };
  }
  const errorText = await response.text();
  return { ok: false, message: `QuickBooks API failed (${response.status}): ${errorText.slice(0, 200)}` };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Phase 1 services only
    const phase1Services = ['slack', 'hubspot', 'quickbooks'];

    // Fetch all active user integrations for Phase 1 services
    const { data: activeIntegrations, error: intError } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        provider_id,
        status,
        config,
        consecutive_failures,
        integration_registry:provider_id (
          id,
          service_name,
          oauth_token_url
        )
      `)
      .eq('status', 'active');

    if (intError) {
      console.error('[health-check] Error fetching integrations:', intError);
      return new Response(JSON.stringify({ error: 'Failed to fetch integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!activeIntegrations || activeIntegrations.length === 0) {
      return new Response(JSON.stringify({ message: 'No active integrations', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: HealthCheckResult[] = [];
    const now = new Date();

    for (const integration of activeIntegrations) {
      const registry = integration.integration_registry as unknown as {
        id: string;
        service_name: string;
        oauth_token_url: string;
      };

      if (!registry || !phase1Services.includes(registry.service_name)) {
        continue; // Skip non-Phase 1 integrations
      }

      const serviceName = registry.service_name;
      console.log(`[health-check] Checking ${serviceName} for user ${integration.user_id}...`);

      try {
        // Fetch OAuth token record
        const { data: tokenRecord } = await supabase
          .from('oauth_tokens')
          .select('id, access_token_secret_id, refresh_token_secret_id, expires_at, integration_registry_id')
          .eq('user_id', integration.user_id)
          .eq('integration_registry_id', registry.id)
          .single();

        if (!tokenRecord) {
          results.push({
            service: serviceName,
            userId: integration.user_id,
            userIntegrationId: integration.id,
            healthy: false,
            message: 'No OAuth token record found',
          });

          await supabase
            .from('user_integrations')
            .update({
              last_error_at: now.toISOString(),
              error_message: 'No OAuth token record found',
              consecutive_failures: (integration.consecutive_failures || 0) + 1,
            })
            .eq('id', integration.id);

          continue;
        }

        // Check if token needs refresh (already expired OR expires within 10 minutes)
        let accessToken: string | null = null;
        let tokenRefreshed = false;
        const tokenExpiresAt = tokenRecord.expires_at ? new Date(tokenRecord.expires_at) : null;
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
        const isExpiredOrExpiringSoon = tokenExpiresAt && tokenExpiresAt < tenMinutesFromNow;

        let tokenRefreshError: string | undefined;
        const isAlreadyExpired = tokenExpiresAt ? tokenExpiresAt < now : false;

        if (isExpiredOrExpiringSoon) {
          console.log(`[health-check] Token for ${serviceName} ${isAlreadyExpired ? 'EXPIRED at' : 'expires at'} ${tokenExpiresAt!.toISOString()}, refreshing...`);
          const refreshResult = await refreshToken(
            supabase,
            tokenRecord,
            serviceName,
            registry.oauth_token_url
          );
          accessToken = refreshResult.accessToken;
          tokenRefreshed = !!accessToken;
          tokenRefreshError = refreshResult.error;
          if (tokenRefreshError) {
            console.error(`[health-check] Token refresh error for ${serviceName}: ${tokenRefreshError}`);
          }
        }

        // If we didn't refresh (or refresh failed), get current token
        if (!accessToken) {
          const { data: tokenData, error: tokenError } = await supabase
            .rpc('get_decrypted_secret', { secret_id: tokenRecord.access_token_secret_id });

          if (tokenError || !tokenData) {
            results.push({
              service: serviceName,
              userId: integration.user_id,
              userIntegrationId: integration.id,
              healthy: false,
              message: 'Failed to decrypt access token',
            });
            continue;
          }
          accessToken = tokenData;
        }

        // Perform service-specific health check
        let checkResult: { ok: boolean; message: string };

        switch (serviceName) {
          case 'slack':
            checkResult = await verifySlack(accessToken);
            break;
          case 'hubspot':
            checkResult = await verifyHubSpot(accessToken);
            break;
          case 'quickbooks': {
            const config = integration.config as { realm_id?: string };
            const realmId = config?.realm_id;
            if (!realmId) {
              checkResult = { ok: false, message: 'No realm_id in integration config' };
              break;
            }
            checkResult = await verifyQuickBooks(accessToken, realmId);
            break;
          }
          default:
            checkResult = { ok: false, message: `Unknown service: ${serviceName}` };
        }

        // Update user_integrations based on result
        if (checkResult.ok) {
          await supabase
            .from('user_integrations')
            .update({
              last_verified_at: now.toISOString(),
              last_error_at: null,
              error_message: null,
              consecutive_failures: 0,
              config: {
                ...integration.config as Record<string, unknown>,
                last_health_check: now.toISOString(),
                health_status: 'healthy',
                health_message: checkResult.message,
              },
            })
            .eq('id', integration.id);

          console.log(`[health-check] ${serviceName} HEALTHY: ${checkResult.message}`);
        } else {
          const failures = (integration.consecutive_failures || 0) + 1;
          await supabase
            .from('user_integrations')
            .update({
              last_error_at: now.toISOString(),
              error_message: checkResult.message,
              consecutive_failures: failures,
              // Mark as error only after 3 consecutive failures
              ...(failures >= 3 ? { status: 'error' } : {}),
              config: {
                ...integration.config as Record<string, unknown>,
                last_health_check: now.toISOString(),
                health_status: failures >= 3 ? 'error' : 'degraded',
                health_message: checkResult.message,
              },
            })
            .eq('id', integration.id);

          console.error(`[health-check] ${serviceName} UNHEALTHY (failure ${failures}): ${checkResult.message}`);
        }

        results.push({
          service: serviceName,
          userId: integration.user_id,
          userIntegrationId: integration.id,
          healthy: checkResult.ok,
          message: checkResult.message,
          tokenRefreshed,
          ...(tokenRefreshError ? { tokenRefreshError } : {}),
          ...(isAlreadyExpired ? { tokenExpired: true } : {}),
        });

        // Small delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (checkError: unknown) {
        const errorMessage = checkError instanceof Error ? checkError.message : String(checkError);
        console.error(`[health-check] Error checking ${serviceName}:`, checkError);
        results.push({
          service: serviceName,
          userId: integration.user_id,
          userIntegrationId: integration.id,
          healthy: false,
          message: `Check error: ${errorMessage}`,
        });
      }
    }

    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).length;
    const refreshed = results.filter(r => r.tokenRefreshed).length;

    console.log(`[health-check] Complete: ${healthy} healthy, ${unhealthy} unhealthy, ${refreshed} tokens refreshed`);

    return new Response(JSON.stringify({
      success: true,
      timestamp: now.toISOString(),
      summary: { healthy, unhealthy, refreshed, total: results.length },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[health-check] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
