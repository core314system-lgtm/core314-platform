import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * HubSpot OAuth Callback Handler
 * Exchanges authorization code for access/refresh tokens and stores them in Supabase.
 *
 * Query params (from HubSpot redirect):
 *   - code: authorization code
 *   - state: base64-encoded JSON with user_id
 *
 * Environment variables:
 *   - HUBSPOT_CLIENT_ID
 *   - HUBSPOT_CLIENT_SECRET
 *   - HUBSPOT_REDIRECT_URI
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
export const handler: Handler = async (event: HandlerEvent) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const { code, state } = params;

    if (!code || !state) {
      console.error("[hubspot-callback] Missing code or state parameter");
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Authorization failed</h2><p>Missing required parameters. Please try connecting again.</p></body></html>",
      };
    }

    // Decode state to get user_id
    let stateData: { user_id?: string };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    } catch {
      console.error("[hubspot-callback] Invalid state parameter");
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Authorization failed</h2><p>Invalid state parameter. Please try connecting again.</p></body></html>",
      };
    }

    const userId = stateData.user_id;
    if (!userId) {
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Authorization failed</h2><p>No user identified. Please log in and try again.</p></body></html>",
      };
    }

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri =
      process.env.HUBSPOT_REDIRECT_URI ||
      "https://app.core314.com/auth/hubspot/callback";

    if (!clientId || !clientSecret) {
      console.error("[hubspot-callback] Missing HubSpot OAuth credentials");
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Configuration error</h2><p>HubSpot integration is not properly configured.</p></body></html>",
      };
    }

    // Exchange authorization code for tokens
    console.log(
      `[hubspot-callback] Exchanging code for tokens, user: ${userId}`
    );

    const tokenResponse = await fetch(
      "https://api.hubapi.com/oauth/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        `[hubspot-callback] Token exchange failed: ${tokenResponse.status} ${errorText}`
      );
      return {
        statusCode: 502,
        headers: { ...headers, "Content-Type": "text/html" },
        body: `<html><body><h2>Authorization failed</h2><p>Could not complete HubSpot authorization. Please try again.</p></body></html>`,
      };
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error("[hubspot-callback] Missing tokens in response");
      return {
        statusCode: 502,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Authorization failed</h2><p>Invalid response from HubSpot. Please try again.</p></body></html>",
      };
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    // Get HubSpot portal ID via access token info
    let portalId: string | null = null;
    try {
      const tokenInfoRes = await fetch(
        `https://api.hubapi.com/oauth/v1/access-tokens/${access_token}`
      );
      if (tokenInfoRes.ok) {
        const tokenInfo = await tokenInfoRes.json();
        portalId = tokenInfo.hub_id ? String(tokenInfo.hub_id) : null;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "[hubspot-callback] Could not fetch portal ID:",
        message
      );
    }

    // Initialize Supabase service client
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[hubspot-callback] Missing Supabase configuration");
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Configuration error</h2><p>Server configuration issue. Please contact support.</p></body></html>",
      };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get HubSpot integration ID from integrations_master
    // user_integrations.integration_id has a foreign key to integrations_master, NOT integration_registry
    const { data: masterData, error: masterError } = await supabase
      .from("integrations_master")
      .select("id")
      .eq("integration_type", "hubspot")
      .single();

    if (masterError || !masterData) {
      console.error(
        "[hubspot-callback] HubSpot not found in integrations_master:",
        masterError
      );
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "text/html" },
        body: "<html><body><h2>Configuration error</h2><p>HubSpot integration not found in system. Please contact support.</p></body></html>",
      };
    }

    const integrationId = masterData.id;
    console.log(`[hubspot-callback] Found HubSpot in integrations_master: ${integrationId}`);

    // Also look up HubSpot in integration_registry for provider_id
    // The frontend's isConnected() matches user_integrations.provider_id against integration_registry.id
    const { data: registryData } = await supabase
      .from("integration_registry")
      .select("id")
      .eq("service_name", "hubspot")
      .maybeSingle();

    const registryId = registryData?.id || null;
    console.log(`[hubspot-callback] Found HubSpot in integration_registry: ${registryId}`);

    // Check if user already has a HubSpot integration
    const { data: existingIntegration } = await supabase
      .from("user_integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("integration_id", integrationId)
      .maybeSingle();

    let userIntegrationId: string;

    if (existingIntegration) {
      // Update existing integration
      const { error: updateError } = await supabase
        .from("user_integrations")
        .update({
          status: "active",
          access_token: access_token,
          refresh_token: refresh_token,
          token_expires_at: tokenExpiresAt,
          provider_id: registryId,
          last_verified_at: new Date().toISOString(),
          error_message: null,
          consecutive_failures: 0,
          updated_at: new Date().toISOString(),
          config: { hubspot_portal_id: portalId, oauth_connected: true },
        })
        .eq("id", existingIntegration.id);

      if (updateError) {
        console.error(
          "[hubspot-callback] Failed to update user_integration:",
          updateError
        );
        return {
          statusCode: 500,
          headers: { ...headers, "Content-Type": "text/html" },
          body: "<html><body><h2>Error</h2><p>Failed to save connection. Please try again.</p></body></html>",
        };
      }
      userIntegrationId = existingIntegration.id;
      console.log(
        `[hubspot-callback] Updated existing integration ${userIntegrationId}`
      );
    } else {
      // Create new integration record
      const { data: newIntegration, error: insertError } = await supabase
        .from("user_integrations")
        .insert({
          user_id: userId,
          integration_id: integrationId,
          added_by_user: true,
          status: "active",
          access_token: access_token,
          refresh_token: refresh_token,
          token_expires_at: tokenExpiresAt,
          provider_id: registryId,
          last_verified_at: new Date().toISOString(),
          date_added: new Date().toISOString(),
          config: { hubspot_portal_id: portalId, oauth_connected: true },
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(
          "[hubspot-callback] Failed to create user_integration:",
          insertError
        );
        return {
          statusCode: 500,
          headers: { ...headers, "Content-Type": "text/html" },
          body: "<html><body><h2>Error</h2><p>Failed to save connection. Please try again.</p></body></html>",
        };
      }
      userIntegrationId = newIntegration.id;
      console.log(
        `[hubspot-callback] Created new integration ${userIntegrationId}`
      );
    }

    // Store tokens in Supabase Vault and create oauth_tokens record
    // This is required for the integration-health-check Edge Function which reads from oauth_tokens
    if (registryId) {
      try {
        // Store access token in vault
        const { data: accessTokenSecretId, error: vaultAccessErr } = await supabase
          .rpc('vault_create_secret', { secret: access_token });

        if (vaultAccessErr) {
          console.warn('[hubspot-callback] Failed to vault access token (non-fatal):', vaultAccessErr);
        }

        // Store refresh token in vault
        let refreshTokenSecretId = null;
        if (refresh_token) {
          const { data: refreshSecretId, error: vaultRefreshErr } = await supabase
            .rpc('vault_create_secret', { secret: refresh_token });
          if (vaultRefreshErr) {
            console.warn('[hubspot-callback] Failed to vault refresh token (non-fatal):', vaultRefreshErr);
          }
          refreshTokenSecretId = refreshSecretId;
        }

        // Upsert into oauth_tokens table (matches what oauth-callback Edge Function does for Slack/QB)
        const { error: oauthTokenErr } = await supabase
          .from('oauth_tokens')
          .upsert({
            user_id: userId,
            integration_registry_id: registryId,
            user_integration_id: userIntegrationId,
            access_token_secret_id: accessTokenSecretId,
            refresh_token_secret_id: refreshTokenSecretId,
            token_type: 'bearer',
            scope: 'crm.objects.contacts.read crm.objects.deals.read crm.objects.companies.read',
            expires_at: tokenExpiresAt,
            metadata: { hubspot_portal_id: portalId },
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,integration_registry_id'
          });

        if (oauthTokenErr) {
          console.warn('[hubspot-callback] Failed to upsert oauth_tokens (non-fatal):', oauthTokenErr);
        } else {
          console.log(`[hubspot-callback] Successfully stored tokens in vault and oauth_tokens table`);
        }
      } catch (vaultErr) {
        console.warn('[hubspot-callback] Vault/oauth_tokens error (non-fatal):', vaultErr);
      }
    }

    // Upsert hubspot_connections for portal-specific tracking
    const { error: connError } = await supabase
      .from("hubspot_connections")
      .upsert(
        {
          user_id: userId,
          user_integration_id: userIntegrationId,
          hubspot_portal_id: portalId,
          access_token: access_token,
          refresh_token: refresh_token,
          token_expires_at: tokenExpiresAt,
          scopes: [
            "crm.objects.contacts.read",
            "crm.objects.deals.read",
            "crm.objects.companies.read",
          ],
          sync_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (connError) {
      console.warn(
        "[hubspot-callback] Failed to upsert hubspot_connections (non-fatal):",
        connError
      );
    }

    console.log(
      `[hubspot-callback] Successfully connected HubSpot for user ${userId}, portal ${portalId}`
    );

    // Redirect user back to Integration Manager with success
    const appUrl =
      process.env.APP_URL || process.env.URL || "https://app.core314.com";
    return {
      statusCode: 302,
      headers: {
        Location: `${appUrl}/integration-manager?hubspot=connected`,
        "Cache-Control": "no-cache",
      },
      body: "",
    };
  } catch (err) {
    console.error("[hubspot-callback] Unexpected error:", err);
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "text/html" },
      body: "<html><body><h2>Unexpected error</h2><p>Something went wrong. Please try again or contact support.</p></body></html>",
    };
  }
};
