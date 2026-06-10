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
      const orgId = event.unique_args?.org_id
      const emailType = event.unique_args?.email_type || event.email_type // welcome, invite, rfq, sub_outreach, etc.
      const recipientEmail = event.email || ''

      // ──────────────────────────────────────────────────────────
      // DATABASE HYGIENE: Handle outreach bounces + engagement
      // ──────────────────────────────────────────────────────────
      if (emailType === "sub_outreach" || emailType === "rfq_outreach") {
        await handleOutreachEvent(eventType, recipientEmail, event)
      }

      // Log to email_delivery_log for global monitoring (bounce/complaint tracking)
      if (orgId && (eventType === 'bounce' || eventType === 'dropped' || eventType === 'spamreport' || eventType === 'delivered')) {
        const logEntry: Record<string, unknown> = {
          org_id: orgId,
          email_type: emailType || 'unknown',
          recipient_email: recipientEmail,
          sendgrid_message_id: sgMessageId,
          status: eventType === 'spamreport' ? 'spam_report' : eventType,
        }
        if (eventType === 'bounce' || eventType === 'dropped') {
          logEntry.bounce_reason = event.reason || event.response || ''
          logEntry.bounced_at = new Date().toISOString()
        }
        if (eventType === 'delivered') {
          logEntry.delivered_at = new Date().toISOString()
        }
        await supabase.from('email_delivery_log').insert(logEntry)
      }

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

/**
 * Handle outreach email events for master_subcontractors database hygiene.
 * 
 * HARD BOUNCE → Permanently delete the record (dead email = useless)
 * SPAM COMPLAINT → Permanently delete + add to global suppression
 * SOFT BOUNCE → Increment bounce count; delete after 5 consecutive
 * DELIVERED → Reset bounce count, boost health score
 * OPEN → Significant health score boost
 * CLICK → Major health score boost (highest engagement signal)
 */
async function handleOutreachEvent(eventType: string, email: string, event: any) {
  if (!email) return

  // Find the master_subcontractors record by email
  const { data: sub } = await supabase
    .from("master_subcontractors")
    .select("id, soft_bounce_count, data_health_score, last_engagement_at")
    .eq("contact_email", email.toLowerCase())
    .single()

  if (!sub) return

  const now = new Date().toISOString()

  switch (eventType) {
    case "bounce": {
      const bounceType = event.type || event.bounce_classification || ""
      const isHardBounce = bounceType === "bounce" || 
                           (event.status && event.status.startsWith("5")) ||
                           (event.reason && (
                             event.reason.includes("does not exist") ||
                             event.reason.includes("unknown user") ||
                             event.reason.includes("invalid recipient") ||
                             event.reason.includes("no such user") ||
                             event.reason.includes("mailbox not found") ||
                             event.reason.includes("550")
                           ))

      if (isHardBounce) {
        // HARD BOUNCE: Permanently delete — this email is dead
        await supabase.from("master_subcontractors").delete().eq("id", sub.id)
        await logHygieneAction(sub.id, email, "hard_bounce_delete", event.reason || "Hard bounce")
      } else {
        // SOFT BOUNCE: Increment counter, delete after 5
        const newCount = (sub.soft_bounce_count || 0) + 1
        if (newCount >= 5) {
          await supabase.from("master_subcontractors").delete().eq("id", sub.id)
          await logHygieneAction(sub.id, email, "soft_bounce_limit_delete", `${newCount} soft bounces`)
        } else {
          const healthPenalty = Math.max(0, (sub.data_health_score || 50) - 15)
          await supabase
            .from("master_subcontractors")
            .update({ 
              soft_bounce_count: newCount, 
              data_health_score: healthPenalty,
              last_bounce_at: now,
            })
            .eq("id", sub.id)
        }
      }
      break
    }

    case "dropped": {
      // DROPPED: Email was never sent (invalid, suppressed, etc.) — permanent delete
      await supabase.from("master_subcontractors").delete().eq("id", sub.id)
      await logHygieneAction(sub.id, email, "dropped_delete", event.reason || "Email dropped by provider")
      break
    }

    case "spamreport": {
      // SPAM COMPLAINT: Permanent delete + suppression list
      await supabase.from("master_subcontractors").delete().eq("id", sub.id)
      // Add to suppression list so we never import this email again
      await supabase.from("email_suppression_list").insert({
        email: email.toLowerCase(),
        reason: "spam_complaint",
        suppressed_at: now,
      }).onConflict("email").merge()
      await logHygieneAction(sub.id, email, "spam_complaint_delete", "Marked as spam by recipient")
      break
    }

    case "delivered": {
      // DELIVERED: Good signal — reset bounce count, boost score
      const newScore = Math.min(100, (sub.data_health_score || 50) + 5)
      await supabase
        .from("master_subcontractors")
        .update({ 
          soft_bounce_count: 0, 
          data_health_score: newScore,
          email_verified_at: now,
        })
        .eq("id", sub.id)
      break
    }

    case "open": {
      // OPEN: Strong engagement signal
      const newScore = Math.min(100, (sub.data_health_score || 50) + 10)
      await supabase
        .from("master_subcontractors")
        .update({ 
          data_health_score: newScore,
          last_engagement_at: now,
        })
        .eq("id", sub.id)
      // Increment open count atomically
      await supabase.rpc("increment_master_sub_field", { 
        row_id: sub.id, 
        field_name: "engagement_open_count" 
      }).catch(async () => {
        // Fallback: manual increment if RPC doesn't exist
        const { data: current } = await supabase
          .from("master_subcontractors")
          .select("engagement_open_count")
          .eq("id", sub.id)
          .single()
        await supabase.from("master_subcontractors")
          .update({ engagement_open_count: (current?.engagement_open_count || 0) + 1 })
          .eq("id", sub.id)
      })
      break
    }

    case "click": {
      // CLICK: Highest engagement signal
      const newScore = Math.min(100, (sub.data_health_score || 50) + 20)
      await supabase
        .from("master_subcontractors")
        .update({ 
          data_health_score: newScore,
          last_engagement_at: now,
        })
        .eq("id", sub.id)
      // Increment click count atomically
      await supabase.rpc("increment_master_sub_field", { 
        row_id: sub.id, 
        field_name: "engagement_click_count" 
      }).catch(async () => {
        // Fallback: manual increment if RPC doesn't exist
        const { data: current } = await supabase
          .from("master_subcontractors")
          .select("engagement_click_count")
          .eq("id", sub.id)
          .single()
        await supabase.from("master_subcontractors")
          .update({ engagement_click_count: (current?.engagement_click_count || 0) + 1 })
          .eq("id", sub.id)
      })
      break
    }
  }
}

async function logHygieneAction(subId: string, email: string, action: string, reason: string) {
  await supabase.from("database_hygiene_log").insert({
    master_sub_id: subId,
    email,
    action,
    reason,
    performed_at: new Date().toISOString(),
  }).catch(() => {}) // Don't fail the webhook if log table doesn't exist yet
}
