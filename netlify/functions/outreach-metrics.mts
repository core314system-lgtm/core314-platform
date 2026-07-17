import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { getStore } from "@netlify/blobs"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const OUTREACH_DOMAIN = process.env.OUTREACH_DOMAIN || "procuvex.com"

function getWarmupInfo(): { daily_limit: number; day_number: number; schedule_active: boolean } {
  const startDate = process.env.WARMUP_START_DATE
  if (!startDate) return { daily_limit: 5000, day_number: -1, schedule_active: false }
  const start = new Date(startDate)
  if (isNaN(start.getTime())) return { daily_limit: 5000, day_number: -1, schedule_active: false }
  const daysSinceStart = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000))
  const WARMUP_TIERS = [
    { days: 4, limit: 500 },
    { days: 8, limit: 1000 },
    { days: 12, limit: 2000 },
    { days: 16, limit: 3000 },
  ]
  for (const tier of WARMUP_TIERS) {
    if (daysSinceStart < tier.days) return { daily_limit: tier.limit, day_number: daysSinceStart + 1, schedule_active: true }
  }
  return { daily_limit: 5000, day_number: daysSinceStart + 1, schedule_active: false }
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
}

// Opens/clicks within 2 min of send are likely email security scanners
const BOT_THRESHOLD_MS = 120_000

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers })
  }

  try {
    // Total outreach emails sent
    const { count: totalSent } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)

    // Bounced (from hygiene log)
    const { count: bounced } = await supabase
      .from("database_hygiene_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "hard_bounce_delete")

    const { count: softBounced } = await supabase
      .from("database_hygiene_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "soft_bounce_delete")

    // Fetch all records with engagement to classify bot vs human
    const { data: engaged } = await supabase
      .from("master_subcontractors")
      .select("engagement_open_count, engagement_click_count, outreach_sent_at, last_engagement_at")
      .not("outreach_sent_at", "is", null)
      .or("engagement_open_count.gt.0,engagement_click_count.gt.0")

    let rawOpened = 0
    let rawClicked = 0
    let rawTotalOpens = 0
    let rawTotalClicks = 0
    let humanOpened = 0
    let humanClicked = 0

    for (const r of engaged || []) {
      const opens = r.engagement_open_count || 0
      const clicks = r.engagement_click_count || 0
      const sentAt = r.outreach_sent_at ? new Date(r.outreach_sent_at).getTime() : 0
      const engagedAt = r.last_engagement_at ? new Date(r.last_engagement_at).getTime() : 0
      const isLikelyHuman = sentAt > 0 && engagedAt > 0 && (engagedAt - sentAt) > BOT_THRESHOLD_MS

      if (opens > 0) {
        rawOpened++
        rawTotalOpens += opens
        if (isLikelyHuman) humanOpened++
      }
      if (clicks > 0) {
        rawClicked++
        rawTotalClicks += clicks
        if (isLikelyHuman) humanClicked++
      }
    }

    // Claimed / confirmed profiles (the only unambiguous metric)
    const { count: confirmed } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("claimed_at", "is", null)

    // Get real page visit count from Netlify Blobs
    let pageVisits = 0
    try {
      const store = getStore("claim-page-visits")
      const raw = await store.get("__total", { type: "json" }) as { count: number } | null
      pageVisits = raw?.count || 0
    } catch {
      // Blobs store may not exist yet
    }

    const total = totalSent || 0
    const bouncedCount = (bounced || 0) + (softBounced || 0)

    // Delivery metrics are derived from our own send/bounce tracking.
    // (Engagement events are recorded by sendgrid-webhook into the DB.)
    const actualDelivered = total - bouncedCount
    const actualBounced = bouncedCount
    const actualAccepted = total

    // Get warmup schedule info
    const warmup = getWarmupInfo()

    // Today's sent count
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { count: sentToday } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .gte("outreach_sent_at", todayStart.toISOString())

    // Per-email details
    const { data: recentSent } = await supabase
      .from("master_subcontractors")
      .select("contact_email, company_name, engagement_open_count, engagement_click_count, outreach_sent_at, last_engagement_at, data_health_score")
      .not("outreach_sent_at", "is", null)
      .order("outreach_sent_at", { ascending: false })
      .limit(100)

    const emails = (recentSent || []).map((m) => {
      const sentMs = m.outreach_sent_at ? new Date(m.outreach_sent_at).getTime() : 0
      const engMs = m.last_engagement_at ? new Date(m.last_engagement_at).getTime() : 0
      const isHuman = sentMs > 0 && engMs > 0 && (engMs - sentMs) > BOT_THRESHOLD_MS
      const hasEngagement = (m.engagement_open_count || 0) > 0

      return {
        to: m.contact_email,
        subject: `${m.company_name}`,
        status: hasEngagement ? (isHuman ? "human_open" : "bot_open") : "delivered",
        opens: m.engagement_open_count || 0,
        clicks: m.engagement_click_count || 0,
        lastEvent: m.last_engagement_at || m.outreach_sent_at,
      }
    })

    return new Response(JSON.stringify({
      summary: {
        total: actualAccepted || total,
        delivered: actualDelivered,
        not_delivered: actualBounced,
        processing: 0,
        // Raw metrics (includes bots)
        opened: rawOpened,
        clicked: rawClicked,
        total_opens: rawTotalOpens,
        total_clicks: rawTotalClicks,
        // Human-only metrics (filtered)
        human_opened: humanOpened,
        human_clicked: humanClicked,
        // Real engagement
        page_visits: pageVisits,
        confirmed: confirmed || 0,
        // Rates
        delivery_rate: actualAccepted > 0 ? Math.round((actualDelivered / actualAccepted) * 100) : 0,
        open_rate: actualDelivered > 0 ? Math.round((humanOpened / actualDelivered) * 100) : 0,
        click_rate: actualDelivered > 0 ? Math.round((humanClicked / actualDelivered) * 100) : 0,
      },
      warmup: {
        active: warmup.schedule_active,
        day: warmup.day_number,
        daily_limit: warmup.daily_limit,
        sent_today: sentToday || 0,
        domain: OUTREACH_DOMAIN,
      },
      emails,
    }), { headers })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
