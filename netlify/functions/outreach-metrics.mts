import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers })
  }

  try {
    // Pull metrics from our own database (instant, no delay)
    // Total emails sent (records with outreach_sent_at)
    const { count: totalSent } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)

    // Records that have received at least 1 open (engagement_open_count > 0)
    const { count: opened } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)
      .gt("engagement_open_count", 0)

    // Records that have received at least 1 click (engagement_click_count > 0)
    const { count: clicked } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)
      .gt("engagement_click_count", 0)

    // Bounced (from hygiene log — hard_bounce_delete actions)
    const { count: bounced } = await supabase
      .from("database_hygiene_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "hard_bounce_delete")

    // Soft bounced (from hygiene log)
    const { count: softBounced } = await supabase
      .from("database_hygiene_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "soft_bounce_delete")

    // Total open events (sum)
    const { data: openSum } = await supabase
      .from("master_subcontractors")
      .select("engagement_open_count")
      .not("outreach_sent_at", "is", null)
      .gt("engagement_open_count", 0)

    const totalOpens = (openSum || []).reduce((sum, r) => sum + (r.engagement_open_count || 0), 0)

    // Total click events (sum)
    const { data: clickSum } = await supabase
      .from("master_subcontractors")
      .select("engagement_click_count")
      .not("outreach_sent_at", "is", null)
      .gt("engagement_click_count", 0)

    const totalClicks = (clickSum || []).reduce((sum, r) => sum + (r.engagement_click_count || 0), 0)

    const total = totalSent || 0
    const bouncedCount = (bounced || 0) + (softBounced || 0)
    const delivered = total - bouncedCount
    const openedCount = opened || 0
    const clickedCount = clicked || 0

    // Also try SendGrid Stats API for additional context (aggregated daily stats update faster than Messages API)
    let sgStats: any = null
    const sgApiKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
    if (sgApiKey) {
      try {
        // Get stats for the last 30 days
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const endDate = new Date().toISOString().split("T")[0]
        const statsRes = await fetch(
          `https://api.sendgrid.com/v3/stats?start_date=${startDate}&end_date=${endDate}&aggregated_by=day`,
          { headers: { Authorization: `Bearer ${sgApiKey}` } }
        )
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          // Aggregate all days
          let sgDelivered = 0, sgOpens = 0, sgClicks = 0, sgBounces = 0, sgRequests = 0
          for (const day of statsData) {
            for (const metric of day.stats || []) {
              sgDelivered += metric.metrics?.delivered || 0
              sgOpens += metric.metrics?.opens || 0
              sgClicks += metric.metrics?.clicks || 0
              sgBounces += metric.metrics?.bounces || 0
              sgRequests += metric.metrics?.requests || 0
            }
          }
          sgStats = { delivered: sgDelivered, opens: sgOpens, clicks: sgClicks, bounces: sgBounces, requests: sgRequests }
        }
      } catch { /* SendGrid stats are supplementary, don't fail */ }
    }

    // Use the higher of DB vs SendGrid stats (since DB may not have all historical data yet)
    const finalDelivered = sgStats ? Math.max(delivered, sgStats.delivered) : delivered
    const finalOpened = sgStats ? Math.max(openedCount, sgStats.opens > 0 ? openedCount : 0) : openedCount
    const finalClicked = sgStats ? Math.max(clickedCount, sgStats.clicks > 0 ? clickedCount : 0) : clickedCount
    const finalBounced = sgStats ? Math.max(bouncedCount, sgStats.bounces) : bouncedCount
    const finalTotal = sgStats ? Math.max(total, sgStats.requests) : total

    // Per-email details (most engaged subs)
    const { data: topEngaged } = await supabase
      .from("master_subcontractors")
      .select("contact_email, company_name, engagement_open_count, engagement_click_count, outreach_sent_at, last_engagement_at")
      .not("outreach_sent_at", "is", null)
      .gt("engagement_open_count", 0)
      .order("engagement_open_count", { ascending: false })
      .limit(50)

    const emails = (topEngaged || []).map((m) => ({
      to: m.contact_email,
      subject: `${m.company_name} — outreach`,
      status: "delivered",
      opens: m.engagement_open_count || 0,
      clicks: m.engagement_click_count || 0,
      lastEvent: m.last_engagement_at || m.outreach_sent_at,
    }))

    return new Response(JSON.stringify({
      summary: {
        total: finalTotal,
        delivered: finalDelivered,
        not_delivered: finalBounced,
        processing: Math.max(0, finalTotal - finalDelivered - finalBounced),
        opened: finalOpened,
        clicked: finalClicked,
        total_opens: sgStats?.opens || totalOpens,
        total_clicks: sgStats?.clicks || totalClicks,
        delivery_rate: finalTotal > 0 ? Math.round((finalDelivered / finalTotal) * 100) : 0,
        open_rate: finalDelivered > 0 ? Math.round((finalOpened / finalDelivered) * 100) : 0,
        click_rate: finalDelivered > 0 ? Math.round((finalClicked / finalDelivered) * 100) : 0,
      },
      emails,
      source: sgStats ? "database+sendgrid" : "database",
    }), { headers })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
