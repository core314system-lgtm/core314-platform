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
    const formData = await req.formData()
    const eventType = formData.get("event") as string
    const recipient = (formData.get("recipient") as string || "").toLowerCase().trim()
    const severity = formData.get("severity") as string // permanent or temporary (for bounces)

    if (!recipient) {
      return new Response("OK", { status: 200 })
    }

    const { data: sub } = await supabase
      .from("master_subcontractors")
      .select("id, soft_bounce_count, data_health_score")
      .eq("contact_email", recipient)
      .single()

    if (!sub) {
      return new Response("OK", { status: 200 })
    }

    const now = new Date().toISOString()

    switch (eventType) {
      case "failed": {
        if (severity === "permanent") {
          // Hard bounce — delete the record
          await supabase.from("master_subcontractors").delete().eq("id", sub.id)
          await logHygieneAction(sub.id, recipient, "hard_bounce_delete", "Mailgun permanent failure")
        } else {
          // Soft bounce
          const newCount = (sub.soft_bounce_count || 0) + 1
          if (newCount >= 5) {
            await supabase.from("master_subcontractors").delete().eq("id", sub.id)
            await logHygieneAction(sub.id, recipient, "soft_bounce_limit_delete", `${newCount} soft bounces`)
          } else {
            const healthPenalty = Math.max(0, (sub.data_health_score || 50) - 15)
            await supabase
              .from("master_subcontractors")
              .update({ soft_bounce_count: newCount, data_health_score: healthPenalty, last_bounce_at: now })
              .eq("id", sub.id)
          }
        }
        break
      }

      case "complained": {
        // Spam complaint — delete + suppress
        await supabase.from("master_subcontractors").delete().eq("id", sub.id)
        await supabase.from("email_suppression_list").insert({
          email: recipient,
          reason: "spam_complaint",
          suppressed_at: now,
        }).onConflict("email").merge()
        await logHygieneAction(sub.id, recipient, "spam_complaint_delete", "Mailgun spam complaint")
        break
      }

      case "delivered": {
        const newScore = Math.min(100, (sub.data_health_score || 50) + 5)
        await supabase
          .from("master_subcontractors")
          .update({ soft_bounce_count: 0, data_health_score: newScore, email_verified_at: now })
          .eq("id", sub.id)
        break
      }

      case "unsubscribed": {
        await supabase.from("master_subcontractors").delete().eq("id", sub.id)
        await supabase.from("email_suppression_list").insert({
          email: recipient,
          reason: "unsubscribe",
          suppressed_at: now,
        }).onConflict("email").merge()
        await logHygieneAction(sub.id, recipient, "unsubscribe_delete", "Mailgun unsubscribe")
        break
      }
    }

    return new Response("OK", { status: 200 })
  } catch (err) {
    console.error("Mailgun webhook error:", err)
    return new Response("OK", { status: 200 })
  }
}

async function logHygieneAction(subId: string, email: string, action: string, reason: string) {
  await supabase.from("database_hygiene_log").insert({
    master_sub_id: subId,
    email,
    action,
    reason,
    performed_at: new Date().toISOString(),
  }).catch(() => {})
}
