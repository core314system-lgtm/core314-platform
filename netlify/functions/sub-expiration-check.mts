import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.ts"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

// This function is designed to be called daily via a scheduled trigger (Netlify Scheduled Functions or cron)
export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  // Can be triggered by admin or scheduled
  const callerId = req.headers.get("x-user-id")

  try {
    initSendGrid()

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Find certifications expiring within 30 days
    const { data: expiring, error } = await supabase
      .from("master_sub_certifications")
      .select("id, master_sub_id, cert_type, cert_name, expiration_date, reminder_sent_at")
      .not("expiration_date", "is", null)
      .lte("expiration_date", thirtyDaysFromNow.toISOString())
      .gte("expiration_date", now.toISOString()) // not already expired
      .is("reminder_sent_at", null) // hasn't been reminded yet

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    if (!expiring || expiring.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No expiring certifications found" }), { headers })
    }

    // Group by sub
    const subIds = [...new Set(expiring.map(e => e.master_sub_id))]
    const { data: subs } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email")
      .in("id", subIds)
      .not("contact_email", "is", null)

    const subMap = new Map((subs || []).map(s => [s.id, s]))

    let sent = 0
    let failed = 0

    // Group expiring certs by sub
    const certsBySub = new Map<string, typeof expiring>()
    for (const cert of expiring) {
      const existing = certsBySub.get(cert.master_sub_id) || []
      existing.push(cert)
      certsBySub.set(cert.master_sub_id, existing)
    }

    for (const [subId, certs] of certsBySub) {
      const sub = subMap.get(subId)
      if (!sub || !sub.contact_email) continue

      try {
        const certList = certs.map(c => {
          const daysLeft = Math.ceil((new Date(c.expiration_date!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          return `${c.cert_name || c.cert_type} — expires in ${daysLeft} days (${new Date(c.expiration_date!).toLocaleDateString()})`
        })

        await sgMail.default.send({
          to: sub.contact_email,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          subject: `Action Required: ${certs.length} certification${certs.length > 1 ? "s" : ""} expiring soon`,
          html: buildExpirationEmail(sub.company_name, certList),
          text: htmlToPlainText(buildExpirationEmail(sub.company_name, certList)),
          customArgs: { email_type: "cert_expiration_reminder" },
          headers: {
            "List-Unsubscribe": `<mailto:team@procuvex.com?subject=Unsubscribe%20Cert%20Reminders%20${encodeURIComponent(sub.contact_email)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        // Mark reminders as sent
        for (const cert of certs) {
          await supabase
            .from("master_sub_certifications")
            .update({ reminder_sent_at: now.toISOString() })
            .eq("id", cert.id)
        }

        // Log contact
        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: subId,
          contact_type: "expiration_reminder",
          contact_method: "email",
          subject: `${certs.length} cert(s) expiring soon`,
          notes: certList.join("; "),
          sent_by: callerId || "system",
        })

        sent++
      } catch {
        failed++
      }
    }

    return new Response(JSON.stringify({ sent, failed, total_certs: expiring.length, total_subs: subIds.length }), { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

function buildExpirationEmail(companyName: string, certList: string[]): string {
  const items = certList.map(c => `<li style="margin-bottom: 8px;">${c}</li>`).join("")
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Expiration Alert</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 13px;">Procuvex Subcontractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Hi <strong>${companyName}</strong>,
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          The following certifications or documents are expiring within 30 days:
        </p>
        <ul style="color: #374151; font-size: 14px; line-height: 1.6; padding-left: 20px;">
          ${items}
        </ul>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="color: #991b1b; margin: 0; font-size: 13px;">
            <strong>Important:</strong> If your certifications expire, your Verified badge will be suspended
            and you won't appear in priority search results until documents are renewed.
          </p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://procuvex.com/my-sub-profile" style="background: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Update Your Documents
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex — A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}
