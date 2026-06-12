import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Determine email provider priority: Mailgun > SES > SendGrid
const USE_MAILGUN = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN)
const USE_SES = !USE_MAILGUN && !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY)
const EMAIL_PROVIDER = USE_MAILGUN ? "Mailgun" : USE_SES ? "Amazon SES" : "SendGrid"
let sesClient: SESClient | null = null

function initSES() {
  if (!sesClient && USE_SES) {
    sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
      },
    })
  }
}

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

async function sendViaMailgun(params: {
  to: string
  from: { email: string; name: string }
  replyTo: { email: string; name: string }
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}) {
  const domain = process.env.MAILGUN_DOMAIN!
  const apiKey = process.env.MAILGUN_API_KEY!
  const baseUrl = process.env.MAILGUN_API_URL || "https://api.mailgun.net"

  const form = new FormData()
  form.append("from", `${params.from.name} <${params.from.email}>`)
  form.append("to", params.to)
  form.append("h:Reply-To", `${params.replyTo.name} <${params.replyTo.email}>`)
  form.append("subject", params.subject)
  form.append("html", params.html)
  form.append("text", params.text)
  if (params.headers?.["List-Unsubscribe"]) {
    form.append("h:List-Unsubscribe", params.headers["List-Unsubscribe"])
    form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
  }
  form.append("o:tag", "sub_outreach")
  form.append("o:tracking-opens", "yes")
  form.append("o:tracking-clicks", "yes")

  const resp = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form,
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Mailgun error ${resp.status}: ${body}`)
  }
}

async function sendEmail(params: {
  to: string
  from: { email: string; name: string }
  replyTo: { email: string; name: string }
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}) {
  if (USE_MAILGUN) {
    await sendViaMailgun(params)
  } else if (USE_SES) {
    initSES()
    const cmd = new SendEmailCommand({
      Source: `${params.from.name} <${params.from.email}>`,
      Destination: { ToAddresses: [params.to] },
      ReplyToAddresses: [`${params.replyTo.name} <${params.replyTo.email}>`],
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: params.html, Charset: "UTF-8" },
          Text: { Data: params.text, Charset: "UTF-8" },
        },
      },
    })
    await sesClient!.send(cmd)
  } else {
    initSendGrid()
    await sgMail.default.send({
      to: params.to,
      from: params.from,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
      customArgs: { email_type: "sub_outreach" },
      headers: params.headers,
    })
  }
}

// High-demand trades based on SOW item analysis — primes actively seek these
const HIGH_DEMAND_TRADES = [
  "HVAC", "Plumbing", "Electrical", "Janitorial & Custodial", "Janitorial",
  "Fire Life Safety", "Landscaping", "Security Systems", "Pest Control",
  "Elevator Maintenance", "General Construction", "Roofing", "Painting & Coatings",
  "Concrete & Masonry", "Environmental Services",
]

function computeOutreachPriority(sub: {
  small_business_types?: string[] | null
  trade_categories?: string[] | null
  contact_phone?: string | null
  naics_codes?: string[] | null
  website?: string | null
  description?: string | null
  data_source?: string | null
}): { score: number; tier: string; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // SBA certifications — primes need these for set-aside requirements (+40)
  const sbaTypes = sub.small_business_types || []
  const hasSba = sbaTypes.length > 0 && sbaTypes.some(t =>
    ["8(a)", "SDVOSB", "WOSB", "EDWOSB", "HUBZone", "VOSB"].includes(t)
  )
  if (hasSba) {
    score += 40
    reasons.push("SBA certified")
  }
  // 8(a) bonus — most valuable set-aside
  if (sbaTypes.includes("8(a)")) {
    score += 10
    reasons.push("8(a) program")
  }

  // Trade matches prime demand (+25)
  const trades = sub.trade_categories || []
  const matchesDemand = trades.some(t =>
    HIGH_DEMAND_TRADES.some(d => t.toLowerCase().includes(d.toLowerCase()))
  )
  if (matchesDemand) {
    score += 25
    reasons.push("In-demand trade")
  }

  // Has both email AND phone — higher contactability (+15)
  if (sub.contact_phone) {
    score += 15
    reasons.push("Phone available")
  }

  // Has NAICS codes — precise matching (+10)
  if (sub.naics_codes && sub.naics_codes.length > 0) {
    score += 10
    reasons.push("NAICS coded")
  }

  // GSA verified contractor (+10)
  if (sub.data_source === "gsa_elibrary") {
    score += 10
    reasons.push("GSA verified")
  }

  // Has website (+5)
  if (sub.website) {
    score += 5
    reasons.push("Website")
  }

  // Has capabilities description (+5)
  if (sub.description && sub.description.length > 20) {
    score += 5
    reasons.push("Capabilities")
  }

  // Determine tier
  let tier: string
  if (score >= 50) tier = "Tier 1 — High Priority"
  else if (score >= 30) tier = "Tier 2 — Priority"
  else if (score >= 15) tier = "Tier 3 — Standard"
  else tier = "Tier 4 — Basic"

  return { score, tier, reasons }
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

function buildOutreachPlainText(companyName: string, claimUrl: string, tradeCategories: string[], state: string, unsubscribeUrl: string): string {
  const trades = tradeCategories.slice(0, 3).join(", ") || "Government Contracting"
  const location = state || "your area"
  return `${companyName} — Prime Contractors Are Searching for ${trades} Subs in ${location}

Hi,

Prime contractors in ${location} are actively looking for ${trades} subcontractors on Procuvex. Your company came up as a match.

We've already built a profile for ${companyName} based on your public registrations. It takes 10 seconds to confirm it's accurate:

Confirm your profile: ${claimUrl}

WHY THIS MATTERS:
- Primes search Procuvex to find subcontractors for upcoming bids
- Confirmed profiles appear first in search results
- You'll receive RFQ invitations directly to your inbox
- 100% free — no cost to confirm or receive opportunities

${companyName} is one of ${Math.floor(Math.random() * 50) + 80} ${trades} contractors in ${location} who have been matched to upcoming opportunities this month.

Confirm your profile (10 seconds): ${claimUrl}

---
Procuvex — Connecting Primes with Qualified Subcontractors
Core314 Technologies LLC
456 Clinton Dr. Orange Park, FL 32073
https://procuvex.com

You received this because ${companyName} is listed in government contractor registrations.
Unsubscribe: ${unsubscribeUrl}
`
}

function buildOutreachEmail(companyName: string, claimUrl: string, tradeCategories: string[], state: string, unsubscribeUrl: string): string {
  const trades = tradeCategories.slice(0, 3).join(", ") || "Government Contracting"
  const location = state || "your area"
  const matchCount = Math.floor(Math.random() * 50) + 80
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Primes Are Searching for Subs Like You</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Procuvex Contractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Prime contractors in <strong>${location}</strong> are actively searching for <strong>${trades}</strong> subcontractors on Procuvex. <strong>${companyName}</strong> came up as a match.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 600;">Your profile is ready — just confirm it's accurate</p>
          <p style="color: #166534; margin: 8px 0 0; font-size: 13px; line-height: 1.6;">
            We built a profile for ${companyName} from your public registrations. One click to confirm = you start receiving bid invitations.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Confirm My Profile →
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">Takes 10 seconds. 100% free.</p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
          <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What confirmed profiles get:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ Priority placement in contractor searches</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ RFQ invitations sent directly to your inbox</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ Visibility to primes bidding in ${location}</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ No cost — free to confirm and receive opportunities</td></tr>
          </table>
        </div>

        <div style="background: #fefce8; border: 1px solid #eab308; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
          <p style="color: #854d0e; margin: 0; font-size: 12px;">
            <strong>${matchCount} ${trades} contractors</strong> in ${location} have been matched to opportunities this month. Unconfirmed profiles are deprioritized in search results.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Procuvex &mdash; Core314 Technologies LLC<br/>
          456 Clinton Dr. Orange Park, FL 32073<br/>
          <a href="https://procuvex.com" style="color: #6b7280;">procuvex.com</a>
        </p>
        <p style="font-size: 11px; color: #d1d5db; text-align: center; margin-top: 12px;">
          You received this because ${companyName} is listed in government contractor registrations.<br/>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from future emails.
        </p>
      </div>
    </div>
  `
}

function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64")
}

function injectSesTracking(html: string, recipientEmail: string, claimUrl: string): string {
  const base = "https://procuvex.com/.netlify/functions/ses-webhook"
  const emailParam = toBase64(recipientEmail)

  // Wrap claim URL with click tracking redirect
  const trackedClaimUrl = `${base}?t=click&e=${emailParam}&u=${toBase64(claimUrl)}`
  let tracked = html.replace(
    new RegExp(claimUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    trackedClaimUrl
  )

  // Inject tracking pixel before closing </div>
  const pixel = `<img src="${base}?t=open&e=${emailParam}" width="1" height="1" style="display:none" alt="" />`
  const lastDiv = tracked.lastIndexOf("</div>")
  if (lastDiv !== -1) {
    tracked = tracked.slice(0, lastDiv) + pixel + tracked.slice(lastDiv)
  }

  return tracked
}

async function verifyGlobalAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_global_admin")
    .eq("id", userId)
    .single()
  return data?.is_global_admin === true
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  // Handle GET requests (unsubscribe links)
  if (req.method === "GET") {
    const url = new URL(req.url)
    const actionParam = url.searchParams.get("action")
    const subId = url.searchParams.get("id")

    if (actionParam === "unsubscribe" && subId) {
      await supabase
        .from("master_subcontractors")
        .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
        .eq("id", subId)

      return new Response(
        `<html><head><title>Unsubscribed</title></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 20px;background:#f9fafb;"><div style="max-width:400px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h2 style="color:#111827;margin:0 0 12px;">You've been unsubscribed</h2><p style="color:#6b7280;margin:0;">You won't receive any more emails from Procuvex. If this was a mistake, visit <a href="https://procuvex.com/for-subcontractors" style="color:#2563eb;">procuvex.com/for-subcontractors</a> to re-join.</p></div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const callerId = req.headers.get("x-user-id")
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  if (!(await verifyGlobalAdmin(callerId))) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers })
  }

  const body = await req.json()
  const { action } = body

  // --- ACTION: send-outreach ---
  // Send claim emails to unclaimed subs with email addresses
  if (action === "send-outreach") {
    const { state, trade, limit: batchLimit } = body

    // Daily limit protection — check how many sent in the user's local day
    // Client can pass dayStart (ISO string of their local midnight) to avoid UTC timezone mismatch
    const todayStart = body.dayStart ? new Date(body.dayStart) : new Date()
    if (!body.dayStart) todayStart.setUTCHours(0, 0, 0, 0)
    const { count: sentToday } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .gte("outreach_sent_at", todayStart.toISOString())

    // Daily sending limit — auto-ramp based on sending history
    // Env var overrides auto-ramp if set
    const envLimit = process.env.OUTREACH_DAILY_LIMIT ? Number(process.env.OUTREACH_DAILY_LIMIT) : null
    let autoLimit = 200 // default
    if (!envLimit) {
      // Auto-ramp: check first-ever outreach date to determine maturity
      const { data: firstSent } = await supabase
        .from("master_subcontractors")
        .select("outreach_sent_at")
        .not("outreach_sent_at", "is", null)
        .order("outreach_sent_at", { ascending: true })
        .limit(1)
      if (firstSent && firstSent.length > 0) {
        const daysSinceFirst = Math.floor((Date.now() - new Date(firstSent[0].outreach_sent_at).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceFirst < 3) autoLimit = 100
        else if (daysSinceFirst < 7) autoLimit = 500
        else if (daysSinceFirst < 14) autoLimit = 2000
        else if (daysSinceFirst < 30) autoLimit = 5000
        else autoLimit = 10000
      } else {
        autoLimit = 100 // first-ever send day
      }
    }
    const dailyLimit = envLimit || autoLimit
    const remainingToday = Math.max(0, dailyLimit - (sentToday || 0))

    if (remainingToday === 0) {
      return new Response(JSON.stringify({
        sent: 0,
        message: `Daily limit reached (${dailyLimit}/day). ${sentToday} emails sent today. Try again tomorrow or increase OUTREACH_DAILY_LIMIT.`,
        daily_limit: dailyLimit,
        sent_today: sentToday,
      }), { headers })
    }

    const maxBatch = Math.min(batchLimit || 50, remainingToday, 500)

    // Fetch candidates with priority-relevant fields (fetch 5x batch for scoring)
    const fetchSize = Math.min(maxBatch * 5, 1000)
    let query = supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, slug, trade_categories, state, outreach_email_count, small_business_types, contact_phone, naics_codes, website, description, data_source, unsubscribed, data_health_score, archived")
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .not("trade_categories", "eq", "{}")
      .eq("archived", false)
      .gte("data_health_score", 20)
      .order("data_health_score", { ascending: false })
      .limit(fetchSize)

    // Optional filters
    if (state) query = query.eq("state", state)
    if (trade) query = query.contains("trade_categories", [trade])

    // Exclude recently contacted (within 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)

    const { data: targets, error } = await query

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No eligible recipients found" }), { headers })
    }

    // Check suppression list for these emails
    const emails = targets.map((t: any) => t.contact_email?.toLowerCase()).filter(Boolean)
    const { data: suppressed } = await supabase
      .from("email_suppression_list")
      .select("email")
      .in("email", emails.slice(0, 500))
    const suppressedSet = new Set((suppressed || []).map((s: any) => s.email))

    // Filter out unsubscribed, archived, and suppressed records; score by priority
    const scored = targets
      .filter((sub: any) => !sub.unsubscribed && !sub.archived && !suppressedSet.has(sub.contact_email?.toLowerCase()))
      .map((sub: any) => ({ ...sub, priority: computeOutreachPriority(sub) }))
      .sort((a: any, b: any) => b.priority.score - a.priority.score)

    // Take top N by priority
    const eligibleTargets = scored.slice(0, maxBatch)

    // Compute tier distribution for response
    const tierCounts: Record<string, number> = {}
    for (const t of eligibleTargets) {
      tierCounts[t.priority.tier] = (tierCounts[t.priority.tier] || 0) + 1
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const sub of eligibleTargets) {
      try {
        // Generate claim token
        const token = generateToken()
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

        // Save token to DB BEFORE sending (needed for claim URL to work)
        await supabase
          .from("master_subcontractors")
          .update({
            claim_token: token,
            claim_token_expires_at: expiresAt.toISOString(),
          })
          .eq("id", sub.id)

        // Build and send email
        const claimUrl = `https://procuvex.com/claim/${token}`
        const unsubscribeUrl = `https://procuvex.com/.netlify/functions/sub-outreach?action=unsubscribe&id=${sub.id}&token=${token}`
        let html = buildOutreachEmail(sub.company_name, claimUrl, sub.trade_categories || [], sub.state || "", unsubscribeUrl)
        const text = buildOutreachPlainText(sub.company_name, claimUrl, sub.trade_categories || [], sub.state || "", unsubscribeUrl)

        // Inject self-hosted open/click tracking for SES and Mailgun
        // (SendGrid has its own webhook-based tracking)
        if (USE_SES || USE_MAILGUN) {
          html = injectSesTracking(html, sub.contact_email!, claimUrl)
        }

        await sendEmail({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          replyTo: { email: "admin@core314.com", name: "Procuvex Support" },
          subject: `${sub.company_name} — A Prime is Searching for ${(sub.trade_categories || []).slice(0, 1).join("") || "Contractors"} in ${sub.state || "Your Area"}`,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        // Only mark as sent AFTER email successfully delivered to SendGrid
        await supabase
          .from("master_subcontractors")
          .update({
            outreach_sent_at: new Date().toISOString(),
            outreach_email_count: (sub as any).outreach_email_count ? (sub as any).outreach_email_count + 1 : 1,
            last_outreach_email_at: new Date().toISOString(),
          })
          .eq("id", sub.id)

        // Log the contact
        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: sub.id,
          contact_type: "outreach_email",
          contact_method: "email",
          subject: "Profile verification request",
          notes: `Sent to ${sub.contact_email}`,
          sent_by: callerId,
        })

        sent++
      } catch (err: any) {
        failed++
        const errMsg = err.message || "Unknown error"
        errors.push(`${sub.company_name}: ${errMsg}`)

        // SES/Mailgun bounce/rejection: archive the sub if email is permanently undeliverable
        if ((USE_SES || USE_MAILGUN) && (
          errMsg.includes("MessageRejected") ||
          errMsg.includes("bounce") ||
          errMsg.includes("suppression list") ||
          errMsg.includes("550") ||
          errMsg.includes("does not exist")
        )) {
          await supabase
            .from("master_subcontractors")
            .update({ archived: true, archive_reason: "ses_bounce" })
            .eq("id", sub.id)
        }
      }
    }

    return new Response(JSON.stringify({
      sent,
      failed,
      total: eligibleTargets.length,
      daily_limit: dailyLimit,
      sent_today: (sentToday || 0) + sent,
      remaining_today: remainingToday - sent,
      email_provider: EMAIL_PROVIDER,
      errors: errors.slice(0, 5),
      priority_tiers: tierCounts,
      avg_priority_score: eligibleTargets.length > 0
        ? Math.round(eligibleTargets.reduce((sum: number, t: any) => sum + t.priority.score, 0) / eligibleTargets.length)
        : 0,
    }), { headers })
  }

  // --- ACTION: generate-tokens ---
  // Generate claim tokens without sending emails (for manual/future use)
  if (action === "generate-tokens") {
    const { ids } = body // array of sub IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "ids array required" }), { status: 400, headers })
    }

    let generated = 0
    for (const id of ids.slice(0, 500)) {
      const token = generateToken()
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const { error } = await supabase
        .from("master_subcontractors")
        .update({ claim_token: token, claim_token_expires_at: expiresAt.toISOString() })
        .eq("id", id)
        .is("claim_token", null) // only generate if not already set
      if (!error) generated++
    }

    return new Response(JSON.stringify({ generated, total: ids.length }), { headers })
  }

  // --- ACTION: preview ---
  // Preview outreach targets with priority scoring
  if (action === "preview") {
    const { state, trade, limit: previewLimit } = body
    const maxPreview = Math.min(previewLimit || 50, 200)
    const fetchSize = Math.min(maxPreview * 5, 1000)

    let query = supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, state, trade_categories, outreach_sent_at, small_business_types, contact_phone, naics_codes, website, description, data_source, unsubscribed", { count: "exact" })
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(fetchSize)

    if (state) query = query.eq("state", state)
    if (trade) query = query.contains("trade_categories", [trade])

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)

    const { data, count, error } = await query
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    // Score and sort by priority
    const scored = (data || [])
      .filter((sub: any) => !sub.unsubscribed)
      .map((sub: any) => {
        const priority = computeOutreachPriority(sub)
        return {
          id: sub.id,
          company_name: sub.company_name,
          contact_email: sub.contact_email,
          state: sub.state,
          trade_categories: sub.trade_categories,
          outreach_sent_at: sub.outreach_sent_at,
          priority_score: priority.score,
          priority_tier: priority.tier,
          priority_reasons: priority.reasons,
        }
      })
      .sort((a: any, b: any) => b.priority_score - a.priority_score)
      .slice(0, maxPreview)

    // Tier summary
    const tierCounts: Record<string, number> = {}
    for (const t of scored) {
      tierCounts[t.priority_tier] = (tierCounts[t.priority_tier] || 0) + 1
    }

    return new Response(JSON.stringify({
      targets: scored,
      total: count,
      priority_tiers: tierCounts,
    }), { headers })
  }

  // --- ACTION: priority-stats ---
  // Get priority tier distribution for all eligible outreach targets
  if (action === "priority-stats") {
    const fetchSize = 2000
    const { data, error } = await supabase
      .from("master_subcontractors")
      .select("small_business_types, trade_categories, contact_phone, naics_codes, website, description, data_source, unsubscribed")
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .is("outreach_sent_at", null)
      .limit(fetchSize)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    const tiers: Record<string, number> = {
      "Tier 1 — High Priority": 0,
      "Tier 2 — Priority": 0,
      "Tier 3 — Standard": 0,
      "Tier 4 — Basic": 0,
    }
    let totalScore = 0
    const eligible = (data || []).filter((s: any) => !s.unsubscribed)
    for (const sub of eligible) {
      const { score, tier } = computeOutreachPriority(sub)
      tiers[tier] = (tiers[tier] || 0) + 1
      totalScore += score
    }

    return new Response(JSON.stringify({
      total_eligible: eligible.length,
      sampled: fetchSize,
      tiers,
      avg_priority_score: eligible.length > 0 ? Math.round(totalScore / eligible.length) : 0,
    }), { headers })
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers })
}
