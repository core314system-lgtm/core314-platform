import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || ""
const MAILGUN_BASE = "https://api.mailgun.net/v3"

interface DomainRequest {
  action: "add-domain" | "check-dns" | "verify-domain" | "remove-domain" | "list-domains" | "update-branding"
  org_id?: string
  domain?: string
  domain_id?: string
  from_name?: string
  from_email?: string
  reply_to_email?: string
  logo_url?: string
  brand_color?: string
  footer_text?: string
}

// Add a new sending domain to Mailgun and store config
async function addDomain(orgId: string, domain: string, fromName: string, fromEmail: string, replyTo: string | null, userId: string) {
  // Check if domain already exists for this org
  const { data: existing } = await supabase
    .from("org_email_domains")
    .select("id")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .single()

  if (existing) {
    return { error: "Domain already configured for this organization" }
  }

  // Add domain to Mailgun
  const mgResponse = await fetch(`${MAILGUN_BASE}/domains`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      name: domain,
      spam_action: "disabled",
      web_scheme: "https",
    }),
  })

  let mgData: any = {}
  let dnsRecords: any = {}

  if (mgResponse.ok) {
    mgData = await mgResponse.json()
    dnsRecords = mgData
  } else {
    // Domain might already exist in Mailgun (shared across orgs) — fetch its DNS records
    const verifyResponse = await fetch(`${MAILGUN_BASE}/domains/${domain}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
      },
    })
    if (verifyResponse.ok) {
      dnsRecords = await verifyResponse.json()
    } else {
      const errText = await mgResponse.text()
      return { error: `Failed to add domain to email provider: ${errText}` }
    }
  }

  // Extract DNS records for verification
  const sendingRecords = dnsRecords.sending_dns_records || []
  const receivingRecords = dnsRecords.receiving_dns_records || []

  const spfRecord = sendingRecords.find((r: any) => r.record_type === "TXT" && r.value?.includes("spf"))
  const dkimRecord = sendingRecords.find((r: any) => r.record_type === "TXT" && r.name?.includes("domainkey"))
  const cnameRecord = sendingRecords.find((r: any) => r.record_type === "CNAME")

  // Store in database
  const { data: domainRow, error: insertError } = await supabase
    .from("org_email_domains")
    .insert({
      org_id: orgId,
      domain,
      from_name: fromName,
      from_email: fromEmail,
      reply_to_email: replyTo,
      status: "verifying",
      spf_record: spfRecord?.value || null,
      dkim_selector: dkimRecord?.name?.split(".")[0] || null,
      dkim_record: dkimRecord?.value || null,
      tracking_cname: cnameRecord?.value || null,
      mailgun_domain_id: domain,
      provider: "mailgun",
      created_by: userId,
    })
    .select()
    .single()

  if (insertError) {
    return { error: `Database error: ${insertError.message}` }
  }

  return {
    domain: domainRow,
    dns_records: {
      spf: spfRecord || null,
      dkim: dkimRecord || null,
      cname: cnameRecord || null,
      mx: receivingRecords,
    },
    instructions: "Add the DNS records shown below to your domain registrar, then click 'Verify DNS' to confirm.",
  }
}

// Check DNS verification status
async function checkDns(domainId: string) {
  const { data: domainRow, error } = await supabase
    .from("org_email_domains")
    .select("*")
    .eq("id", domainId)
    .single()

  if (error || !domainRow) {
    return { error: "Domain not found" }
  }

  // Check with Mailgun
  const verifyResponse = await fetch(`${MAILGUN_BASE}/domains/${domainRow.domain}/verify`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
  })

  if (!verifyResponse.ok) {
    return { error: "Failed to verify domain with email provider" }
  }

  const verifyData = await verifyResponse.json()
  const sendingRecords = verifyData.sending_dns_records || []

  const spfVerified = sendingRecords.some((r: any) => r.record_type === "TXT" && r.value?.includes("spf") && r.valid === "valid")
  const dkimVerified = sendingRecords.some((r: any) => r.record_type === "TXT" && r.name?.includes("domainkey") && r.valid === "valid")
  const trackingVerified = sendingRecords.some((r: any) => r.record_type === "CNAME" && r.valid === "valid")

  const allVerified = spfVerified && dkimVerified
  const newStatus = allVerified ? "verified" : "verifying"

  // Update domain status
  await supabase
    .from("org_email_domains")
    .update({
      spf_verified: spfVerified,
      dkim_verified: dkimVerified,
      tracking_verified: trackingVerified,
      status: newStatus,
      verified_at: allVerified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", domainId)

  return {
    domain: domainRow.domain,
    status: newStatus,
    verification: {
      spf: spfVerified,
      dkim: dkimVerified,
      tracking: trackingVerified,
    },
    dns_records: sendingRecords,
  }
}

// Verify domain (final confirmation)
async function verifyDomain(domainId: string) {
  return checkDns(domainId)
}

// Remove a domain
async function removeDomain(domainId: string, orgId: string) {
  const { data: domainRow } = await supabase
    .from("org_email_domains")
    .select("*")
    .eq("id", domainId)
    .eq("org_id", orgId)
    .single()

  if (!domainRow) {
    return { error: "Domain not found" }
  }

  // Remove from Mailgun
  await fetch(`${MAILGUN_BASE}/domains/${domainRow.domain}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
  })

  // Remove from database
  await supabase
    .from("org_email_domains")
    .delete()
    .eq("id", domainId)

  return { success: true, message: `Domain ${domainRow.domain} removed` }
}

// List domains for an org
async function listDomains(orgId: string) {
  const { data, error } = await supabase
    .from("org_email_domains")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { domains: data || [] }
}

// Update branding for a domain
async function updateBranding(domainId: string, orgId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from("org_email_domains")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", domainId)
    .eq("org_id", orgId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { domain: data }
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-user-id",
      },
    })
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  }

  const userId = req.headers.get("x-user-id")
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, org_id, is_global_admin")
    .eq("id", userId)
    .single()

  if (!profile || (profile.role !== "admin" && !profile.is_global_admin)) {
    return Response.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const body: DomainRequest = await req.json()
  const orgId = body.org_id || profile.org_id

  if (!orgId) {
    return Response.json({ error: "Organization ID required" }, { status: 400 })
  }

  let result: any

  switch (body.action) {
    case "add-domain":
      if (!body.domain || !body.from_email) {
        return Response.json({ error: "domain and from_email are required" }, { status: 400 })
      }
      result = await addDomain(orgId, body.domain, body.from_name || "Notifications", body.from_email, body.reply_to_email || null, userId)
      break

    case "check-dns":
      if (!body.domain_id) {
        return Response.json({ error: "domain_id is required" }, { status: 400 })
      }
      result = await checkDns(body.domain_id)
      break

    case "verify-domain":
      if (!body.domain_id) {
        return Response.json({ error: "domain_id is required" }, { status: 400 })
      }
      result = await verifyDomain(body.domain_id)
      break

    case "remove-domain":
      if (!body.domain_id) {
        return Response.json({ error: "domain_id is required" }, { status: 400 })
      }
      result = await removeDomain(body.domain_id, orgId)
      break

    case "list-domains":
      result = await listDomains(orgId)
      break

    case "update-branding":
      if (!body.domain_id) {
        return Response.json({ error: "domain_id is required" }, { status: 400 })
      }
      result = await updateBranding(body.domain_id, orgId, {
        from_name: body.from_name,
        from_email: body.from_email,
        reply_to_email: body.reply_to_email,
        logo_url: body.logo_url,
        brand_color: body.brand_color,
        footer_text: body.footer_text,
      })
      break

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 })
  }

  if (result.error) {
    return Response.json(result, { status: 400 })
  }

  return Response.json(result, {
    headers: { "Access-Control-Allow-Origin": "*" },
  })
}
