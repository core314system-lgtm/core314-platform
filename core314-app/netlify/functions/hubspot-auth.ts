import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * HubSpot OAuth Authorization Endpoint
 * Redirects user to HubSpot OAuth authorization screen.
 *
 * Query params:
 *   - access_token: The user's Supabase session token (validated server-side)
 *
 * Environment variables:
 *   - HUBSPOT_CLIENT_ID
 *   - HUBSPOT_REDIRECT_URI (default: https://core314.com/auth/hubspot/callback)
 */
export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const redirectUri =
      process.env.HUBSPOT_REDIRECT_URI ||
      "https://core314.com/auth/hubspot/callback";

    if (!clientId) {
      console.error("[hubspot-auth] Missing HUBSPOT_CLIENT_ID env var");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "HubSpot integration not configured",
          hint: "HUBSPOT_CLIENT_ID environment variable is not set",
        }),
      };
    }

    // Extract user_id securely: prefer access_token validation over raw user_id
    const params = event.queryStringParameters || {};
    let userId: string | null = null;

    // Priority 1: Validate access_token query param (passed from frontend redirect)
    const accessToken = params.access_token;
    if (accessToken) {
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const {
          data: { user },
        } = await supabase.auth.getUser(accessToken);
        if (user) userId = user.id;
      }
    }

    // Priority 2: Check Authorization header (for API calls)
    if (!userId) {
      const authHeader =
        event.headers.authorization || event.headers.Authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const supabaseUrl =
          process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey =
          process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const {
            data: { user },
          } = await supabase.auth.getUser(token);
          if (user) userId = user.id;
        }
      }
    }

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error:
            "Authentication required. Provide a valid access_token or Bearer token.",
        }),
      };
    }

    // Scopes required for CRM data access (must match HubSpot app's required scopes)
    const scopes = [
      "oauth",
      "crm.objects.contacts.read",
      "crm.objects.deals.read",
      "crm.objects.companies.read",
    ];

    // Build state parameter to pass user_id through OAuth flow
    const state = Buffer.from(JSON.stringify({ user_id: userId })).toString(
      "base64"
    );

    // Construct HubSpot OAuth authorization URL
    const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    console.log(
      `[hubspot-auth] Redirecting user ${userId} to HubSpot OAuth`
    );

    // Redirect to HubSpot
    return {
      statusCode: 302,
      headers: {
        ...headers,
        Location: authUrl.toString(),
      },
      body: "",
    };
  } catch (err) {
    console.error("[hubspot-auth] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
