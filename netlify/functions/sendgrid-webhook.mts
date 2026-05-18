import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 })
  }

  try {
    const events = await req.json()

    if (!Array.isArray(events)) {
      return new Response("OK", { status: 200 })
    }

    for (const event of events) {
      const eventType = event.event // delivered, open, click, bounce, etc.
      const sowSubId = event.sow_subcontractor_id || event.unique_args?.sow_subcontractor_id
      const rfqToken = event.rfq_token || event.unique_args?.rfq_token
      const sgMessageId = event.sg_message_id

      if (!sowSubId && !rfqToken) continue

      // Map SendGrid event types to our tracking types
      const typeMap: Record<string, string> = {
        processed: "sent",
        delivered: "delivered",
        open: "opened",
        click: "clicked",
        bounce: "bounced",
        deferred: "deferred",
        dropped: "dropped",
        spamreport: "spam_report",
        unsubscribe: "unsubscribe",
      }

      const trackingType = typeMap[eventType] || eventType
      if (!trackingType) continue

      // Find the rfq_token record if we have a token
      let resolvedSowSubId = sowSubId
      let rfqTokenId = null
      if (rfqToken && !resolvedSowSubId) {
        const { data: tokenData } = await supabase
          .from("rfq_tokens")
          .select("id, sow_subcontractor_id")
          .eq("token", rfqToken)
          .single()
        if (tokenData) {
          resolvedSowSubId = tokenData.sow_subcontractor_id
          rfqTokenId = tokenData.id
        }
      }

      // Insert tracking event
      await supabase.from("email_tracking").insert({
        rfq_token_id: rfqTokenId,
        sow_subcontractor_id: resolvedSowSubId,
        sendgrid_message_id: sgMessageId,
        event_type: trackingType,
        email_to: event.email,
        email_subject: event.subject,
        timestamp: event.timestamp ? new Date(event.timestamp * 1000).toISOString() : new Date().toISOString(),
        metadata: {
          ip: event.ip,
          useragent: event.useragent,
          url: event.url,
          reason: event.reason,
          response: event.response,
        },
      })

      // Update sow_subcontractor tracking fields
      if (resolvedSowSubId) {
        const updates: Record<string, any> = {}
        if (trackingType === "opened") updates.email_opened_at = new Date().toISOString()
        if (trackingType === "clicked") updates.email_clicked_at = new Date().toISOString()

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("sow_subcontractors")
            .update(updates)
            .eq("id", resolvedSowSubId)
        }
      }
    }

    return new Response("OK", { status: 200 })
  } catch (err: any) {
    console.error("Webhook error:", err)
    return new Response("OK", { status: 200 }) // Always return 200 to SendGrid
  }
}
