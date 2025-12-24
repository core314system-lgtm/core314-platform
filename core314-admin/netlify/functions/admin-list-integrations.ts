import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin-only Netlify Function to list ALL user integrations across the platform.
 * 
 * This function uses the SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies,
 * allowing admin users to see integrations from all users (not just their own).
 * 
 * Security:
 * - Requires valid Authorization header
 * - Verifies caller is a platform admin (is_platform_admin = true OR role = 'admin')
 * - Service role key is never exposed to the client
 * 
 * INTENTIONAL: Beta integrations are included for admin observability.
 * This is a read-only global view for platform monitoring, not a user-facing feature.
 */

interface IntegrationResponse {
  id: string;
  user_id: string;
  provider_id: string;
  status: string;
  created_at: string;
  last_verified_at?: string;
  error_message?: string;
  environment: 'beta' | 'production';
  registry?: {
    id: string;
    service_name: string;
    display_name: string;
    category?: string;
  };
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
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
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Missing authorization header" }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing Supabase configuration" }),
      };
    }

    // Verify the caller is an admin using the anon key (respects RLS)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid authentication" }),
      };
    }

    // Check if user is a platform admin
    const { data: profile, error: profileError } = await anonClient
      .from("profiles")
      .select("role, is_platform_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Profile not found" }),
      };
    }

    const isAdmin = profile.is_platform_admin === true || profile.role === "admin";
    if (!isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Admin access required" }),
      };
    }

    // Use service role client to bypass RLS and fetch ALL integrations
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch all user_integrations (no user filter - admin global view)
    // INTENTIONAL: Include ALL integrations including beta/test for admin observability
    const { data: userIntegrations, error: integrationsError } = await serviceClient
      .from("user_integrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (integrationsError) {
      console.error("Error fetching integrations:", integrationsError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch integrations" }),
      };
    }

    if (!userIntegrations || userIntegrations.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ integrations: [], stats: { total: 0, active: 0, inactive: 0, error: 0 } }),
      };
    }

    // Get provider IDs to fetch registry data
    const providerIds = userIntegrations
      .map((ui: { provider_id?: string; integration_id?: string }) => ui.provider_id || ui.integration_id)
      .filter(Boolean);

    // Fetch integration registry for display names
    const { data: registryData } = await serviceClient
      .from("integration_registry")
      .select("id, service_name, display_name, category")
      .in("id", providerIds);

    // Fetch user profiles for user reference
    const userIds = [...new Set(userIntegrations.map((ui: { user_id: string }) => ui.user_id))];
    const { data: profilesData } = await serviceClient
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    // Merge data with registry and user info
    const integrations: IntegrationResponse[] = userIntegrations
      .map((ui: { 
        id: string; 
        user_id: string; 
        provider_id?: string; 
        integration_id?: string;
        status?: string;
        created_at: string;
        last_verified_at?: string;
        error_message?: string;
      }) => {
        const registry = registryData?.find((r: { id: string }) =>
          r.id === ui.provider_id || r.id === ui.integration_id
        );
        const userProfile = profilesData?.find((p: { id: string }) => p.id === ui.user_id);

        return {
          id: ui.id,
          user_id: ui.user_id,
          provider_id: ui.provider_id || ui.integration_id || "",
          status: ui.status || "active",
          created_at: ui.created_at,
          last_verified_at: ui.last_verified_at,
          error_message: ui.error_message,
          // INTENTIONAL: All current integrations are labeled as beta for admin observability
          // This is a read-only label for monitoring purposes, not a filter
          environment: "beta" as const,
          registry: registry
            ? {
                id: registry.id,
                service_name: registry.service_name,
                display_name: registry.display_name,
                category: registry.category,
              }
            : undefined,
          user: userProfile
            ? {
                id: userProfile.id,
                email: userProfile.email,
                full_name: userProfile.full_name,
              }
            : undefined,
        };
      })
      .filter((integration: IntegrationResponse) => integration.registry !== undefined);

    const stats = {
      total: integrations.length,
      active: integrations.filter((i: IntegrationResponse) => i.status === "active").length,
      inactive: integrations.filter((i: IntegrationResponse) => i.status === "inactive").length,
      error: integrations.filter((i: IntegrationResponse) => i.status === "error").length,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ integrations, stats }),
    };
  } catch (error) {
    console.error("Unexpected error in admin-list-integrations:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
    };
  }
};

export { handler };
