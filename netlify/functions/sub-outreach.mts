import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
if (SENDGRID_API_KEY) sgMail.default.setApiKey(SENDGRID_API_KEY)

async function sendEmail(params: {
  to: string
  from: { email: string; name: string }
  replyTo: { email: string; name: string }
  subject: string
  html: string
  text: string
  tag?: string
  headers?: Record<string, string>
}): Promise<string> {
  if (!SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is not configured — outreach cannot send")
  }

  const msg: Record<string, unknown> = {
    to: params.to,
    from: params.from,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
    text: params.text,
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
    },
    customArgs: { email_type: params.tag || "sub_outreach" },
  }

  if (params.headers?.["List-Unsubscribe"]) {
    msg.headers = {
      "List-Unsubscribe": params.headers["List-Unsubscribe"],
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
  }

  const [response] = await sgMail.default.send(msg as Parameters<typeof sgMail.default.send>[0])
  return response?.headers?.["x-message-id"] || ""
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
  const trades = tradeCategories.slice(0, 3).join(", ") || "government contracting"
  const location = state || "your area"
  return `Hi,

I'm reaching out because ${companyName} is registered as a ${trades} contractor in ${location}, and we have prime contractors on Procuvex looking for subs with exactly that profile.

We pulled together a profile for ${companyName} from your public registrations (SAM.gov, state licenses, etc). If the info looks right, one click confirms it and you'll start showing up when primes search for ${trades} subs in ${location}.

Confirm your profile: ${claimUrl}

Takes about 10 seconds. No account needed. No cost — ever.

If this isn't relevant to your business, just ignore this email or unsubscribe below. No hard feelings.

— Chris Brown
Core314 Technologies / Procuvex
https://procuvex.com

You received this because ${companyName} appears in government contractor registrations.
Unsubscribe: ${unsubscribeUrl}
`
}

function buildOutreachEmail(companyName: string, claimUrl: string, tradeCategories: string[], state: string, unsubscribeUrl: string): string {
  const trades = tradeCategories.slice(0, 3).join(", ") || "government contracting"
  const location = state || "your area"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <div style="padding: 20px 0;">
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">Hi,</p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          I'm reaching out because <strong>${companyName}</strong> is registered as a ${trades} contractor in ${location}, and we have prime contractors on Procuvex looking for subs with exactly that profile.
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          We pulled together a profile for ${companyName} from your public registrations (SAM.gov, state licenses, etc). If the info looks right, one click confirms it and you'll start showing up when primes search for ${trades} subs in ${location}.
        </p>
        <p style="margin: 24px 0;">
          <a href="${claimUrl}" style="color: #1e40af; font-size: 15px; font-weight: 600; text-decoration: underline;">Confirm your profile here</a>
          <span style="color: #6b7280; font-size: 14px;"> &mdash; takes ~10 seconds, no account needed, no cost.</span>
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          If this isn't relevant to your business, just ignore this email or <a href="${unsubscribeUrl}" style="color: #6b7280;">unsubscribe</a>. No hard feelings.
        </p>
        <p style="color: #1a1a1a; font-size: 15px; margin: 24px 0 4px;">&mdash; Chris Brown</p>
        <p style="color: #6b7280; font-size: 13px; margin: 0;">Core314 Technologies / <a href="https://procuvex.com" style="color: #6b7280;">Procuvex</a></p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 12px;" />
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          You received this because ${companyName} appears in government contractor registrations.<br/>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> &mdash;
          Core314 Technologies LLC, 456 Clinton Dr. Orange Park, FL 32073
        </p>
      </div>
    </div>
  `
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

    // Daily sending limit — respects warmup schedule for domain reputation
    // Priority: warmup_daily_limit (from cron) > WARMUP_START_DATE calculation > OUTREACH_DAILY_LIMIT > auto-ramp
    let dailyLimit: number

    // If cron passes the warmup limit explicitly, use it (most authoritative)
    if (body.warmup_daily_limit && Number(body.warmup_daily_limit) > 0) {
      dailyLimit = Number(body.warmup_daily_limit)
    } else {
      // Compute warmup limit from WARMUP_START_DATE (same logic as outreach-cron)
      const warmupStart = process.env.WARMUP_START_DATE
      if (warmupStart) {
        const start = new Date(warmupStart)
        if (!isNaN(start.getTime())) {
          const daysSinceStart = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000))
          const WARMUP_TIERS = [
            { days: 4, limit: 500 },
            { days: 8, limit: 1000 },
            { days: 12, limit: 2000 },
            { days: 16, limit: 3000 },
          ]
          let warmupLimit = 5000
          for (const tier of WARMUP_TIERS) {
            if (daysSinceStart < tier.days) { warmupLimit = tier.limit; break }
          }
          dailyLimit = warmupLimit
        } else {
          dailyLimit = process.env.OUTREACH_DAILY_LIMIT ? Number(process.env.OUTREACH_DAILY_LIMIT) : 500
        }
      } else {
        dailyLimit = process.env.OUTREACH_DAILY_LIMIT ? Number(process.env.OUTREACH_DAILY_LIMIT) : 500
      }
    }

    const remainingToday = Math.max(0, dailyLimit - (sentToday || 0))

    if (remainingToday === 0) {
      return new Response(JSON.stringify({
        sent: 0,
        message: `Daily warmup limit reached (${dailyLimit}/day). ${sentToday} emails sent today.`,
        daily_limit: dailyLimit,
        sent_today: sentToday,
        remaining_today: 0,
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
      .eq("archived", false)
      .gte("data_health_score", 70)
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

        const sendgridMessageId = await sendEmail({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
          replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
          subject: `${sub.company_name} — quick question about ${(sub.trade_categories || []).slice(0, 1).join("") || "contracting"} work in ${sub.state || "your area"}`,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        // Only mark as sent AFTER SendGrid confirms acceptance
        await supabase
          .from("master_subcontractors")
          .update({
            outreach_sent_at: new Date().toISOString(),
            outreach_email_count: (sub as any).outreach_email_count ? (sub as any).outreach_email_count + 1 : 1,
            last_outreach_email_at: new Date().toISOString(),
          })
          .eq("id", sub.id)

        // Log the contact with SendGrid message ID
        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: sub.id,
          contact_type: "outreach_email",
          contact_method: "email",
          subject: "Profile verification request",
          notes: `Sent via SendGrid to ${sub.contact_email} (${sendgridMessageId})`,
          sent_by: callerId,
        })

        sent++
      } catch (err: any) {
        failed++
        const errMsg = err.message || "Unknown error"
        errors.push(`${sub.company_name}: ${errMsg}`)

        // Archive the sub if email is permanently undeliverable
        if (
          errMsg.includes("MessageRejected") ||
          errMsg.includes("bounce") ||
          errMsg.includes("suppression list") ||
          errMsg.includes("550") ||
          errMsg.includes("does not exist")
        ) {
          await supabase
            .from("master_subcontractors")
            .update({ archived: true, archive_reason: "email_bounce" })
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
      email_provider: "SendGrid",
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
      .eq("archived", false)
      .gte("data_health_score", 70)
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
