import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Enterprise Custom Email Domains
 *
 * Lets an Enterprise org authenticate its own sending domain so outbound mail
 * (RFQs, notifications, digests) is sent *from that domain* with proper SPF/DKIM.
 *
 * Provider: SendGrid Domain Authentication (the platform's email provider).
 *   add-domain  -> POST   /v3/whitelabel/domains        (returns CNAME records to publish)
 *   check-dns   -> POST   /v3/whitelabel/domains/{id}/validate
 *   verify      -> alias of check-dns
 *   remove      -> DELETE /v3/whitelabel/domains/{id}
 * Verification is driven entirely by SendGrid's real DNS validation — a domain
 * only becomes "verified" once SendGrid confirms the published CNAMEs.
 */

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY || ""
const SG_BASE = "https://api.sendgrid.com/v3"

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

interface SgDnsRecord { valid: boolean; type: string; host: string; data: string }
interface SgDomain {
  id: number
  domain: string
  subdomain?: string
  valid: boolean
  dns: { mail_cname?: SgDnsRecord; dkim1?: SgDnsRecord; dkim2?: SgDnsRecord }
}

function sgHeaders() {
  return { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" }
}

// Normalize SendGrid's dns object into the CNAME list the UI renders + stores.
function dnsToRecords(dns: SgDomain["dns"]) {
  const rec = (r?: SgDnsRecord) =>
    r ? { type: "CNAME", host: r.host, data: r.data, valid: r.valid } : null
  return {
    mail_cname: rec(dns.mail_cname),
    dkim1: rec(dns.dkim1),
    dkim2: rec(dns.dkim2),
  }
}

// Add (or link) a sending domain via SendGrid Domain Authentication.
async function addDomain(orgId: string, domain: string, fromName: string, fromEmail: string, replyTo: string | null, userId: string) {
  if (!SENDGRID_API_KEY) return { error: "SENDGRID_API_KEY is not configured" }

  const { data: existing } = await supabase
    .from("org_email_domains")
    .select("id")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .single()

  if (existing) {
    return { error: "Domain already configured for this organization" }
  }

  // Reuse an existing SendGrid authentication for this domain if one is present
  // in the account (e.g. re-adding after removal); otherwise create a new one.
  let sg: SgDomain | null = null
  const lookup = await fetch(`${SG_BASE}/whitelabel/domains?domain=${encodeURIComponent(domain)}&limit=50`, {
    headers: sgHeaders(),
  })
  if (lookup.ok) {
    const list = (await lookup.json()) as SgDomain[]
    if (Array.isArray(list) && list.length > 0) {
      sg = list.find(d => d.valid) || list[0]
    }
  }

  if (!sg) {
    const createResp = await fetch(`${SG_BASE}/whitelabel/domains`, {
      method: "POST",
      headers: sgHeaders(),
      body: JSON.stringify({ domain, automatic_security: true, default: false }),
    })
    if (!createResp.ok) {
      const errText = await createResp.text()
      return { error: `Failed to add domain to email provider: ${errText}` }
    }
    sg = (await createResp.json()) as SgDomain
  }

  const records = dnsToRecords(sg.dns)
  const isValid = !!sg.valid

  const { data: domainRow, error: insertError } = await supabase
    .from("org_email_domains")
    .insert({
      org_id: orgId,
      domain,
      from_name: fromName,
      from_email: fromEmail,
      reply_to_email: replyTo,
      status: isValid ? "verified" : "verifying",
      spf_record: records.dkim2?.data || null,
      spf_verified: isValid,
      dkim_selector: records.dkim1?.host?.split(".")[0] || null,
      dkim_record: records.dkim1?.data || null,
      dkim_verified: isValid,
      tracking_cname: records.mail_cname?.data || null,
      tracking_verified: isValid,
      verified_at: isValid ? new Date().toISOString() : null,
      mailgun_domain_id: String(sg.id),
      provider: "sendgrid",
      created_by: userId,
    })
    .select()
    .single()

  if (insertError) {
    return { error: `Database error: ${insertError.message}` }
  }

  return {
    domain: domainRow,
    dns_records: records,
    already_verified: isValid,
    instructions: isValid
      ? "This domain is already authenticated with the email provider — it is verified and ready to send."
      : "Add the CNAME records below to your DNS provider, then click 'Verify DNS'. Verification can take a few minutes to propagate.",
  }
}

// Validate DNS with SendGrid and update status.
async function checkDns(domainId: string) {
  const { data: domainRow, error } = await supabase
    .from("org_email_domains")
    .select("*")
    .eq("id", domainId)
    .single()

  if (error || !domainRow) {
    return { error: "Domain not found" }
  }

  const sgId = domainRow.mailgun_domain_id
  if (!sgId) {
    return { error: "Domain is not linked to the email provider" }
  }

  const validateResp = await fetch(`${SG_BASE}/whitelabel/domains/${sgId}/validate`, {
    method: "POST",
    headers: sgHeaders(),
  })

  if (!validateResp.ok) {
    return { error: "Failed to verify domain with email provider" }
  }

  const result = await validateResp.json() as {
    id: number
    valid: boolean
    validation_results?: {
      mail_cname?: { valid: boolean; reason: string | null }
      dkim1?: { valid: boolean; reason: string | null }
      dkim2?: { valid: boolean; reason: string | null }
    }
  }

  const vr = result.validation_results || {}
  const mailOk = !!vr.mail_cname?.valid
  const dkimOk = !!vr.dkim1?.valid && !!vr.dkim2?.valid
  const allVerified = !!result.valid
  const newStatus = allVerified ? "verified" : "verifying"

  await supabase
    .from("org_email_domains")
    .update({
      spf_verified: dkimOk,
      dkim_verified: dkimOk,
      tracking_verified: mailOk,
      status: newStatus,
      verified_at: allVerified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", domainId)

  return {
    domain: domainRow.domain,
    status: newStatus,
    verification: {
      mail_cname: mailOk,
      dkim: dkimOk,
    },
    validation_results: vr,
  }
}

async function verifyDomain(domainId: string) {
  return checkDns(domainId)
}

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

  // Remove the authentication from SendGrid (best-effort). Do NOT delete a
  // provider domain that other orgs still reference (e.g. a shared platform domain).
  if (domainRow.mailgun_domain_id) {
    const { count } = await supabase
      .from("org_email_domains")
      .select("id", { count: "exact", head: true })
      .eq("mailgun_domain_id", domainRow.mailgun_domain_id)

    if ((count || 0) <= 1) {
      await fetch(`${SG_BASE}/whitelabel/domains/${domainRow.mailgun_domain_id}`, {
        method: "DELETE",
        headers: sgHeaders(),
      })
    }
  }

  await supabase.from("org_email_domains").delete().eq("id", domainId)

  return { success: true, message: `Domain ${domainRow.domain} removed` }
}

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

async function updateBranding(domainId: string, orgId: string, updates: Record<string, any>) {
  const cleaned = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
  const { data, error } = await supabase
    .from("org_email_domains")
    .update({ ...cleaned, updated_at: new Date().toISOString() })
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
    .select("role, current_org_id, is_global_admin")
    .eq("id", userId)
    .single()

  if (!profile || (profile.role !== "admin" && !profile.is_global_admin)) {
    return Response.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const body: DomainRequest = await req.json()
  const orgId = body.org_id || profile.current_org_id

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
