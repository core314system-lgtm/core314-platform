import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Enterprise Email Send Utility
 * 
 * Routes outbound emails through the organization's custom domain when configured.
 * Falls back to platform default (procuvex.com) when no custom domain is set up.
 * 
 * All existing workflows (RFQ, notifications, outreach) call this function
 * instead of sending directly, ensuring tenant branding is applied automatically.
 */

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || ""
const PLATFORM_DOMAIN = process.env.MAILGUN_OUTREACH_DOMAIN || "outreach.procuvex.com"
const PLATFORM_FROM_NAME = "Procuvex"
const PLATFORM_FROM_EMAIL = `team@${PLATFORM_DOMAIN}`
const PLATFORM_REPLY_TO = "admin@core314.com"

interface SendRequest {
  action: "send" | "send-branded" | "get-config"
  org_id: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  reply_to?: string
  tags?: string[]
  // Optional overrides (if not provided, uses org domain config)
  from_name?: string
  from_email?: string
}

interface OrgEmailConfig {
  domain: string
  from_name: string
  from_email: string
  reply_to_email: string | null
  logo_url: string | null
  brand_color: string
  footer_text: string | null
  status: string
}

// Get the org's verified email domain config
async function getOrgEmailConfig(orgId: string): Promise<OrgEmailConfig | null> {
  const { data } = await supabase
    .from("org_email_domains")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "verified")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  if (!data) return null

  return {
    domain: data.domain,
    from_name: data.from_name,
    from_email: data.from_email,
    reply_to_email: data.reply_to_email,
    logo_url: data.logo_url,
    brand_color: data.brand_color || "#4F46E5",
    footer_text: data.footer_text,
    status: data.status,
  }
}

// Wrap HTML content with org branding
function applyBranding(html: string, config: OrgEmailConfig): string {
  const logoHtml = config.logo_url
    ? `<img src="${config.logo_url}" alt="${config.from_name}" style="max-height:48px;margin-bottom:16px;" />`
    : ""

  const footerHtml = config.footer_text
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">${config.footer_text}</div>`
    : ""

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      ${logoHtml}
      ${html}
      ${footerHtml}
    </div>
  `
}

// Send via Mailgun using a specific domain
async function sendViaMailgun(params: {
  domain: string
  to: string
  from: string
  replyTo: string
  subject: string
  html: string
  text: string
  tags?: string[]
}) {
  const baseUrl = process.env.MAILGUN_API_URL || "https://api.mailgun.net"

  const form = new FormData()
  form.append("from", params.from)
  form.append("to", params.to)
  form.append("h:Reply-To", params.replyTo)
  form.append("subject", params.subject)
  form.append("html", params.html)
  form.append("text", params.text)

  if (params.tags) {
    params.tags.forEach(tag => form.append("o:tag", tag))
  }

  const resp = await fetch(`${baseUrl}/v3/${params.domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
    body: form,
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Email send failed (${resp.status}): ${body}`)
  }

  return await resp.json()
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-api-key",
      },
    })
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 })
  }

  // Auth: either x-user-id (internal) or x-api-key (external API)
  const userId = req.headers.get("x-user-id")
  const apiKey = req.headers.get("x-api-key")

  if (!userId && !apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: SendRequest = await req.json()

  if (!body.org_id) {
    return Response.json({ error: "org_id is required" }, { status: 400 })
  }

  // Action: get-config just returns the org's email config
  if (body.action === "get-config") {
    const config = await getOrgEmailConfig(body.org_id)
    return Response.json({
      has_custom_domain: !!config,
      config: config || {
        domain: PLATFORM_DOMAIN,
        from_name: PLATFORM_FROM_NAME,
        from_email: PLATFORM_FROM_EMAIL,
        reply_to_email: PLATFORM_REPLY_TO,
        logo_url: null,
        brand_color: "#4F46E5",
        footer_text: null,
        status: "platform_default",
      },
    }, { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  // Validate send params
  if (!body.to || !body.subject || !body.html) {
    return Response.json({ error: "to, subject, and html are required" }, { status: 400 })
  }

  // Get org email config (custom domain or platform default)
  const orgConfig = await getOrgEmailConfig(body.org_id)

  const sendDomain = orgConfig?.domain || PLATFORM_DOMAIN
  const fromName = body.from_name || orgConfig?.from_name || PLATFORM_FROM_NAME
  const fromEmail = body.from_email || orgConfig?.from_email || PLATFORM_FROM_EMAIL
  const replyTo = body.reply_to || orgConfig?.reply_to_email || PLATFORM_REPLY_TO

  // Apply branding if org has custom config
  let finalHtml = body.html
  if (orgConfig && body.action === "send-branded") {
    finalHtml = applyBranding(body.html, orgConfig)
  }

  const recipients = Array.isArray(body.to) ? body.to : [body.to]
  const results: { to: string; success: boolean; error?: string }[] = []

  for (const recipient of recipients) {
    try {
      await sendViaMailgun({
        domain: sendDomain,
        to: recipient,
        from: `${fromName} <${fromEmail}>`,
        replyTo,
        subject: body.subject,
        html: finalHtml,
        text: body.text || body.subject,
        tags: body.tags,
      })
      results.push({ to: recipient, success: true })
    } catch (err: any) {
      results.push({ to: recipient, success: false, error: err.message })
    }
  }

  const sent = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return Response.json({
    sent,
    failed,
    total: recipients.length,
    domain_used: sendDomain,
    branded: !!orgConfig && body.action === "send-branded",
    results,
  }, { headers: { "Access-Control-Allow-Origin": "*" } })
}
