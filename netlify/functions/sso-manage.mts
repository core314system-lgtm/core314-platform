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

// Verify the requesting user is a global admin
async function verifyAdmin(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.replace("Bearer ", "")
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_global_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_global_admin) return null
  return user.id
}

// List all SSO identity providers
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
async function addProvider(metadataUrl: string, domains: string[]) {
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
  return { provider: data }
}

// Remove an SSO identity provider
async function removeProvider(providerId: string) {
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
  return { success: true }
}

// Get Procuvex SP metadata info for IdP configuration
function getSpInfo() {
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "")
  return {
    entity_id: `${supabaseUrl}/auth/v1/sso/saml/metadata`,
    metadata_url: `${supabaseUrl}/auth/v1/sso/saml/metadata`,
    acs_url: `${supabaseUrl}/auth/v1/sso/saml/acs`,
    slo_url: `${supabaseUrl}/auth/v1/sso/slo`,
    name_id_format: "emailAddress",
    project_ref: projectRef,
  }
}

export default async (req: Request, context: Context) => {
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
  const userId = await verifyAdmin(authHeader)
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized — global admin access required" }), { status: 403 })
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
      result = await addProvider(body.metadata_url, body.domains)
      break
    case "remove-provider":
      if (!body.provider_id) {
        return new Response(JSON.stringify({ error: "provider_id is required" }), { status: 400 })
      }
      result = await removeProvider(body.provider_id)
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
