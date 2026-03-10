import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * HubSpot Token Refresh Function
 * Automatically refreshes expired HubSpot OAuth tokens.
 *
 * Can be called:
 *   - On schedule (via Netlify scheduled functions or external cron)
 *   - Before any HubSpot API call when token is expired
 *   - Manually via POST with { user_id } body
 *
 * Environment variables:
 *   - HUBSPOT_CLIENT_ID
 *   - HUBSPOT_CLIENT_SECRET
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
export const handler: Handler = async (event: HandlerEvent) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Authentication: require either internal API key or valid user JWT
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    const internalApiKey = process.env.HUBSPOT_INTERNAL_API_KEY;

    let isAuthorized = false;

    // Check for internal API key (for cron/scheduled calls)
    if (internalApiKey && authHeader === `Bearer ${internalApiKey}`) {
      isAuthorized = true;
    }

    // Check for valid Supabase user JWT
    if (!isAuthorized && authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const anonClient = createClient(supabaseUrl, supabaseAnonKey);
        const {
          data: { user },
        } = await anonClient.auth.getUser(token);
        if (user) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Authentication required" }),
      };
    }

    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing required configuration" }),
      };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body for optional user_id filter
    let targetUserId: string | null = null;
    try {
      const body = JSON.parse(event.body || "{}");
      targetUserId = body.user_id || null;
    } catch {
      // No body or invalid JSON is fine
    }

    // Find connections with tokens expiring within the next 10 minutes
    const expiryThreshold = new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString();

    let query = supabase
      .from("hubspot_connections")
      .select(
        "id, user_id, refresh_token, token_expires_at, user_integration_id"
      )
      .lt("token_expires_at", expiryThreshold);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: connections, error: fetchError } = await query;

    if (fetchError) {
      console.error(
        "[hubspot-refresh] Error fetching connections:",
        fetchError
      );
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch connections" }),
      };
    }

    if (!connections || connections.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "No tokens need refreshing",
          refreshed: 0,
        }),
      };
    }

    console.log(
      `[hubspot-refresh] Found ${connections.length} token(s) to refresh`
    );

    const results: Array<{
      user_id: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const conn of connections) {
      try {
        // Call HubSpot token refresh endpoint
        const tokenResponse = await fetch(
          "https://api.hubapi.com/oauth/v1/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: conn.refresh_token,
            }).toString(),
          }
        );

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(
            `[hubspot-refresh] Refresh failed for user ${conn.user_id}: ${tokenResponse.status} ${errorText}`
          );
          results.push({
            user_id: conn.user_id,
            success: false,
            error: `Token refresh failed: ${tokenResponse.status}`,
          });

          // Mark connection as error
          await supabase
            .from("hubspot_connections")
            .update({
              sync_status: "error",
              sync_error: `Token refresh failed: ${tokenResponse.status}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conn.id);

          continue;
        }

        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token, expires_in } = tokenData;

        const newExpiresAt = new Date(
          Date.now() + expires_in * 1000
        ).toISOString();

        // Update hubspot_connections
        await supabase
          .from("hubspot_connections")
          .update({
            access_token: access_token,
            refresh_token: refresh_token,
            token_expires_at: newExpiresAt,
            sync_status: "success",
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        // Also update user_integrations token fields
        if (conn.user_integration_id) {
          await supabase
            .from("user_integrations")
            .update({
              access_token: access_token,
              refresh_token: refresh_token,
              token_expires_at: newExpiresAt,
              last_verified_at: new Date().toISOString(),
              error_message: null,
              consecutive_failures: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conn.user_integration_id);
        }

        console.log(
          `[hubspot-refresh] Successfully refreshed token for user ${conn.user_id}`
        );
        results.push({ user_id: conn.user_id, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[hubspot-refresh] Error refreshing for user ${conn.user_id}:`,
          err
        );
        results.push({
          user_id: conn.user_id,
          success: false,
          error: message,
        });
      }
    }

    const refreshedCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Refreshed ${refreshedCount} token(s), ${failedCount} failed`,
        refreshed: refreshedCount,
        failed: failedCount,
        results,
      }),
    };
  } catch (err) {
    console.error("[hubspot-refresh] Unexpected error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
