import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface SSORequest {
  action: "list-providers" | "add-provider" | "remove-provider" | "get-info"
  metadata_url?: string
  domains?: string[]
  provider_id?: string
}

interface AuthResult {
  userId: string
  orgId: string | null
  isGlobalAdmin: boolean
}

// Verify the requesting user is an org admin or global admin
async function verifyOrgAdmin(authHeader: string | null): Promise<AuthResult | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.replace("Bearer ", "")
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_global_admin, role, current_org_id")
    .eq("id", user.id)
    .single()
  if (!profile) return null
  // Allow global admins or org admins
  if (!profile.is_global_admin && profile.role !== "admin") return null
  return {
    userId: user.id,
    orgId: profile.current_org_id || null,
    isGlobalAdmin: !!profile.is_global_admin,
  }
}

// List all SSO identity providers (global admin sees all; org admin sees own org's providers)
async function listProviders() {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/sso/providers`, {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: `Failed to list providers: ${text}` }
  }
  const data = await res.json()
  return { providers: data.items || [] }
}

// Add a new SAML SSO identity provider
async function addProvider(metadataUrl: string, domains: string[], orgId: string | null) {
  // Register with Supabase Auth
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/sso/providers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "saml",
      metadata_url: metadataUrl,
      domains: domains,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: `Failed to add provider: ${text}` }
  }
  const data = await res.json()

  // Store org-provider mapping for tracking
  if (orgId && data.id) {
    await supabase.from("org_sso_providers").upsert({
      org_id: orgId,
      provider_id: data.id,
      domains: domains,
      metadata_url: metadataUrl,
      status: "active",
    })
  }

  return { provider: data }
}

// Remove an SSO identity provider
async function removeProvider(providerId: string, orgId: string | null, isGlobalAdmin: boolean) {
  // If not global admin, verify this provider belongs to their org
  if (!isGlobalAdmin && orgId) {
    const { data: mapping } = await supabase
      .from("org_sso_providers")
      .select("id")
      .eq("org_id", orgId)
      .eq("provider_id", providerId)
      .single()
    if (!mapping) {
      return { error: "You can only remove SSO providers belonging to your organization" }
    }
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/sso/providers/${providerId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: `Failed to remove provider: ${text}` }
  }

  // Clean up org mapping
  if (orgId) {
    await supabase.from("org_sso_providers").delete().eq("provider_id", providerId)
  }

  return { success: true }
}

// Get Procuvex SP metadata info for IdP configuration
function getSpInfo() {
  return {
    entity_id: `${supabaseUrl}/auth/v1/sso/saml/metadata`,
    metadata_url: `${supabaseUrl}/auth/v1/sso/saml/metadata`,
    acs_url: `${supabaseUrl}/auth/v1/sso/saml/acs`,
    slo_url: `${supabaseUrl}/auth/v1/sso/slo`,
    name_id_format: "emailAddress",
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  const authHeader = req.headers.get("authorization")
  const auth = await verifyOrgAdmin(authHeader)
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized — organization admin access required" }), { status: 403 })
  }

  const body: SSORequest = await req.json()

  let result: Record<string, unknown>

  switch (body.action) {
    case "get-info":
      result = getSpInfo()
      break
    case "list-providers":
      result = await listProviders()
      break
    case "add-provider":
      if (!body.metadata_url || !body.domains?.length) {
        return new Response(JSON.stringify({ error: "metadata_url and domains are required" }), { status: 400 })
      }
      result = await addProvider(body.metadata_url, body.domains, auth.orgId)
      break
    case "remove-provider":
      if (!body.provider_id) {
        return new Response(JSON.stringify({ error: "provider_id is required" }), { status: 400 })
      }
      result = await removeProvider(body.provider_id, auth.orgId, auth.isGlobalAdmin)
      break
    default:
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 })
  }

  if ("error" in result) {
    return new Response(JSON.stringify(result), { status: 400 })
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
