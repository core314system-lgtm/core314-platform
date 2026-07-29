import type { Config, Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Outreach health check — runs 1 hour after the daily cron (11:00 UTC / 7 AM Eastern).
 *
 * 1. Checks if today's 5,000 target was met
 * 2. If not, triggers remaining sends automatically (self-healing)
 * 3. Sends alert email to admin with daily status report
 */

const DAILY_TARGET = 5000
const ALERT_EMAIL = "admin@core314.com"
const BATCH_PER_CALL = 50
const CONCURRENT_CALLS = 5
const MAX_RECOVERY_MS = 13 * 60 * 1000

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const USE_MAILGUN = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN)

async function sendAlertEmail(subject: string, body: string) {
  if (USE_MAILGUN) {
    const domain = process.env.MAILGUN_DOMAIN!
    const apiKey = process.env.MAILGUN_API_KEY!
    const form = new FormData()
    form.append("from", "Procuvex System <system@procuvex.com>")
    form.append("to", ALERT_EMAIL)
    form.append("subject", subject)
    form.append("html", body)
    form.append("o:tracking-opens", "no")
    form.append("o:tracking-clicks", "no")
    await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      body: form,
    })
  }
}

async function callSubOutreach(adminId: string): Promise<number> {
  try {
    const resp = await fetch("https://procuvex.com/.netlify/functions/sub-outreach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": adminId,
      },
      body: JSON.stringify({ action: "send-outreach", limit: BATCH_PER_CALL }),
      signal: AbortSignal.timeout(25000),
    })
    if (!resp.ok) return 0
    const data = await resp.json() as any
    return data.sent || 0
  } catch {
    return 0
  }
}

export default async (_req: Request, _context: Context) => {
  const startTime = Date.now()
  console.log(`[outreach-healthcheck] Running daily health check`)

  // Count today's sends
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: sentToday } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .gte("outreach_sent_at", todayStart.toISOString())

  const sent = sentToday || 0
  const shortfall = Math.max(0, DAILY_TARGET - sent)

  // Count total remaining unsent subs
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: totalRemaining } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .is("claimed_at", null)
    .not("contact_email", "is", null)
    .not("trade_categories", "eq", "{}")
    .eq("archived", false)
    .eq("unsubscribed", false)
    .gte("data_health_score", 70)
    .or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)

  const remaining = totalRemaining || 0
  const daysLeft = remaining > 0 ? Math.ceil(remaining / DAILY_TARGET) : 0

  // Count engagement from recent sends
  const { count: recentOpens } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .gte("outreach_sent_at", todayStart.toISOString())
    .gt("engagement_open_count", 0)

  const { count: totalConfirmed } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .not("claimed_at", "is", null)

  // If shortfall exists, auto-recover
  let recovered = 0
  if (shortfall > 0 && remaining > 0) {
    console.log(`[outreach-healthcheck] Shortfall detected: ${sent}/${DAILY_TARGET}. Recovering ${shortfall}...`)

    const { data: admin } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("is_global_admin", true)
      .limit(1)
      .single()

    if (admin) {
      let consecutiveZeros = 0
      while (recovered < shortfall) {
        if (Date.now() - startTime > MAX_RECOVERY_MS) break

        const promises = Array.from({ length: CONCURRENT_CALLS }, () => callSubOutreach(admin.id))
        const results = await Promise.all(promises)
        const batchSent = results.reduce((sum, r) => sum + r, 0)
        recovered += batchSent

        if (batchSent === 0) {
          consecutiveZeros++
          if (consecutiveZeros >= 3) break
        } else {
          consecutiveZeros = 0
        }

        console.log(`[outreach-healthcheck] Recovery: +${batchSent} (${recovered}/${shortfall})`)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  const finalSent = sent + recovered
  const status = finalSent >= DAILY_TARGET ? "ON TRACK" : shortfall > 0 && recovered > 0 ? "RECOVERED" : "SHORTFALL"

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

  // Send daily status email
  const emailBody = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${status === "ON TRACK" || status === "RECOVERED" ? "#16a34a" : "#dc2626"}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="margin: 0;">Daily Outreach Report — ${status}</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">${dateStr}</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Emails Sent Today</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${finalSent.toLocaleString()} / ${DAILY_TARGET.toLocaleString()}</td></tr>
          ${recovered > 0 ? `<tr><td style="padding: 8px 0; color: #6b7280;">Auto-Recovered</td><td style="padding: 8px 0; font-weight: bold; text-align: right; color: #f59e0b;">${recovered.toLocaleString()}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #6b7280;">Opens from Today's Batch</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${(recentOpens || 0).toLocaleString()}</td></tr>
          <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Remaining in Queue</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${remaining.toLocaleString()}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Days Until Complete</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${daysLeft}</td></tr>
          <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #6b7280;">Total Profiles Confirmed</td><td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">${(totalConfirmed || 0).toLocaleString()}</td></tr>
        </table>
        ${status === "SHORTFALL" ? `<div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 12px; margin-top: 16px;"><p style="color: #dc2626; margin: 0; font-size: 14px;"><strong>Action needed:</strong> Only ${finalSent} of ${DAILY_TARGET} emails sent. Auto-recovery was unable to complete the full batch. Check Netlify function logs.</p></div>` : ""}
      </div>
    </div>
  `

  await sendAlertEmail(
    `Procuvex Outreach: ${status} — ${finalSent.toLocaleString()}/${DAILY_TARGET.toLocaleString()} sent`,
    emailBody
  )

  console.log(`[outreach-healthcheck] ${status}: ${finalSent}/${DAILY_TARGET} sent. Recovered: ${recovered}. Remaining: ${remaining}`)

  return new Response(JSON.stringify({
    status,
    sent_today: finalSent,
    daily_target: DAILY_TARGET,
    recovered,
    remaining_in_queue: remaining,
    days_left: daysLeft,
    total_confirmed: totalConfirmed || 0,
  }))
}

// Schedule: 11:00 UTC = 7:00 AM Eastern (1 hour after cron)
export const config: Config = {
  schedule: "0 11 * * *",
}
