import type { Context } from "@netlify/functions"

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

  const sgApiKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
  if (!sgApiKey) {
    return new Response(JSON.stringify({ error: "SendGrid API key not configured" }), { status: 500, headers })
  }

  try {
    // Query SendGrid Messages API for outreach emails from team@procuvex.com
    const query = encodeURIComponent('from_email="team@procuvex.com" AND subject LIKE "%Procuvex Profile Is Ready%"')
    const res = await fetch(`https://api.sendgrid.com/v3/messages?limit=1000&query=${query}`, {
      headers: {
        "Authorization": `Bearer ${sgApiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      // Fall back to unfiltered query if subject filter not supported
      const fallbackRes = await fetch(`https://api.sendgrid.com/v3/messages?limit=1000`, {
        headers: {
          "Authorization": `Bearer ${sgApiKey}`,
          "Content-Type": "application/json",
        },
      })
      if (!fallbackRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch SendGrid data" }), { status: 500, headers })
      }
      const fallbackData = await fallbackRes.json()
      const outreachMsgs = (fallbackData.messages || []).filter((m: any) =>
        m.from_email === "team@procuvex.com" && m.subject?.includes("Procuvex Profile Is Ready")
      )
      return new Response(JSON.stringify(buildMetrics(outreachMsgs)), { headers })
    }

    const data = await res.json()
    const outreachMsgs = (data.messages || []).filter((m: any) =>
      m.from_email === "team@procuvex.com"
    )
    return new Response(JSON.stringify(buildMetrics(outreachMsgs)), { headers })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

function buildMetrics(messages: any[]) {
  const total = messages.length
  const delivered = messages.filter((m: any) => m.status === "delivered").length
  const notDelivered = messages.filter((m: any) => m.status === "not_delivered").length
  const processing = messages.filter((m: any) => m.status === "processing").length
  const opened = messages.filter((m: any) => (m.opens_count || 0) > 0).length
  const clicked = messages.filter((m: any) => (m.clicks_count || 0) > 0).length
  const totalOpens = messages.reduce((sum: number, m: any) => sum + (m.opens_count || 0), 0)
  const totalClicks = messages.reduce((sum: number, m: any) => sum + (m.clicks_count || 0), 0)

  // Per-email details sorted by opens descending
  const emails = messages.map((m: any) => ({
    to: m.to_email,
    subject: m.subject,
    status: m.status,
    opens: m.opens_count || 0,
    clicks: m.clicks_count || 0,
    lastEvent: m.last_event_time,
  })).sort((a: any, b: any) => b.opens - a.opens)

  return {
    summary: {
      total,
      delivered,
      not_delivered: notDelivered,
      processing,
      opened,
      clicked,
      total_opens: totalOpens,
      total_clicks: totalClicks,
      delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      open_rate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      click_rate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
    },
    emails,
  }
}
