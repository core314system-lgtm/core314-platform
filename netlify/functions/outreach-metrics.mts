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
    // All metrics come from our own database — outreach-specific only
    // No SendGrid Stats API (that returns account-wide numbers across all email types)

    // Total outreach emails sent (records with outreach_sent_at)
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

    // Total open events (sum of all engagement_open_count)
    const { data: openSum } = await supabase
      .from("master_subcontractors")
      .select("engagement_open_count")
      .not("outreach_sent_at", "is", null)
      .gt("engagement_open_count", 0)

    const totalOpens = (openSum || []).reduce((sum, r) => sum + (r.engagement_open_count || 0), 0)

    // Total click events (sum of all engagement_click_count)
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

    // Per-email details: show all recently sent emails (most recent first)
    // Include engaged ones at top, then recent sends without engagement
    const { data: recentSent } = await supabase
      .from("master_subcontractors")
      .select("contact_email, company_name, engagement_open_count, engagement_click_count, outreach_sent_at, last_engagement_at, data_health_score")
      .not("outreach_sent_at", "is", null)
      .order("outreach_sent_at", { ascending: false })
      .limit(100)

    const emails = (recentSent || []).map((m) => ({
      to: m.contact_email,
      subject: `${m.company_name}`,
      status: (m.engagement_open_count || 0) > 0 ? "opened" : "delivered",
      opens: m.engagement_open_count || 0,
      clicks: m.engagement_click_count || 0,
      lastEvent: m.last_engagement_at || m.outreach_sent_at,
    }))

    return new Response(JSON.stringify({
      summary: {
        total,
        delivered,
        not_delivered: bouncedCount,
        processing: 0,
        opened: openedCount,
        clicked: clickedCount,
        total_opens: totalOpens,
        total_clicks: totalClicks,
        delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        open_rate: delivered > 0 ? Math.round((openedCount / delivered) * 100) : 0,
        click_rate: delivered > 0 ? Math.round((clickedCount / delivered) * 100) : 0,
      },
      emails,
    }), { headers })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
