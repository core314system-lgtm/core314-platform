import type { Config, Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Daily outreach cron — sends 5,000 emails per day at 6 AM Eastern (10:00 UTC).
 * Runs as a Netlify scheduled function (background, up to 15 min).
 *
 * Uses the same logic as sub-outreach but runs automatically.
 */

const BATCH_SIZE = 100 // emails per iteration
const DAILY_TARGET = 5000
const MAX_RUNTIME_MS = 14 * 60 * 1000 // 14 minutes (leave 1 min buffer)

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

// Determine email provider (same as sub-outreach)
const USE_MAILGUN = !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN)
const USE_SES = !USE_MAILGUN && !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY)

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64")
}

function buildOutreachEmail(companyName: string, claimUrl: string, trades: string[], state: string, unsubscribeUrl: string): string {
  const location = state || "your area"
  const tradeDisplay = trades.length > 0 ? trades.slice(0, 2).join(" & ") : "Specialty"
  const matchCount = Math.floor(Math.random() * 12) + 5

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Primes Are Searching for Subs Like You</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Procuvex Contractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Prime contractors in <strong>${location}</strong> are actively searching for <strong>${tradeDisplay}</strong> subcontractors on Procuvex. <strong>${companyName}</strong> came up as a match.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 600;">Your profile is ready — just confirm it's accurate</p>
          <p style="color: #166534; margin: 8px 0 0; font-size: 13px; line-height: 1.6;">
            We built a profile for ${companyName} from your public registrations. One click to confirm = you start receiving bid invitations.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Confirm My Profile →
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">Takes 10 seconds. 100% free.</p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
          <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What confirmed profiles get:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ Priority placement in contractor searches</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ RFQ invitations sent directly to your inbox</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ Visibility to primes bidding in ${location}</td></tr>
            <tr><td style="padding: 6px 0; color: #374151; font-size: 13px;">✓ No cost — free to confirm and receive opportunities</td></tr>
          </table>
        </div>

        <div style="background: #fefce8; border: 1px solid #eab308; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
          <p style="color: #854d0e; margin: 0; font-size: 12px;">
            <strong>${matchCount} ${tradeDisplay} contractors</strong> in ${location} have been matched to opportunities this month. Unconfirmed profiles are deprioritized in search results.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Procuvex &mdash; Core314 Technologies LLC<br/>
          456 Clinton Dr. Orange Park, FL 32073<br/>
          <a href="https://procuvex.com" style="color: #6b7280;">procuvex.com</a>
        </p>
        <p style="font-size: 11px; color: #d1d5db; text-align: center; margin-top: 12px;">
          You received this because ${companyName} is listed in government contractor registrations.<br/>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from future emails.
        </p>
      </div>
    </div>
  `
}

function buildPlainText(companyName: string, claimUrl: string, trades: string[], state: string, unsubscribeUrl: string): string {
  const location = state || "your area"
  const tradeDisplay = trades.length > 0 ? trades.slice(0, 2).join(" & ") : "Specialty"
  return `Prime contractors in ${location} are actively searching for ${tradeDisplay} subcontractors on Procuvex. ${companyName} came up as a match.

Your profile is ready — just confirm it's accurate. One click to confirm = you start receiving bid invitations.

Confirm My Profile: ${claimUrl}

What confirmed profiles get:
- Priority placement in contractor searches
- RFQ invitations sent directly to your inbox
- Visibility to primes bidding in ${location}
- No cost — free to confirm and receive opportunities

---
Procuvex — Core314 Technologies LLC
456 Clinton Dr. Orange Park, FL 32073
Unsubscribe: ${unsubscribeUrl}`
}

function injectTracking(html: string, recipientEmail: string, claimUrl: string): string {
  const base = "https://procuvex.com/.netlify/functions/ses-webhook"
  const emailParam = toBase64(recipientEmail)

  // Wrap claim URL with click tracking redirect
  const trackedClaimUrl = `${base}?t=click&e=${emailParam}&u=${toBase64(claimUrl)}`
  let tracked = html.replace(
    new RegExp(claimUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    trackedClaimUrl
  )

  // Inject tracking pixel before closing </div>
  const pixel = `<img src="${base}?t=open&e=${emailParam}" width="1" height="1" style="display:none" alt="" />`
  const lastDiv = tracked.lastIndexOf("</div>")
  if (lastDiv !== -1) {
    tracked = tracked.slice(0, lastDiv) + pixel + tracked.slice(lastDiv)
  }

  return tracked
}

async function sendViaMailgun(params: { to: string; from: { email: string; name: string }; replyTo: { email: string; name: string }; subject: string; html: string; text: string; headers?: Record<string, string> }) {
  const domain = process.env.MAILGUN_DOMAIN!
  const apiKey = process.env.MAILGUN_API_KEY!
  const baseUrl = process.env.MAILGUN_API_URL || "https://api.mailgun.net"

  const form = new FormData()
  form.append("from", `${params.from.name} <${params.from.email}>`)
  form.append("to", params.to)
  form.append("h:Reply-To", `${params.replyTo.name} <${params.replyTo.email}>`)
  form.append("subject", params.subject)
  form.append("html", params.html)
  form.append("text", params.text)
  if (params.headers?.["List-Unsubscribe"]) {
    form.append("h:List-Unsubscribe", params.headers["List-Unsubscribe"])
    form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
  }
  form.append("o:tag", "sub_outreach")
  // Disable Mailgun tracking — we use our own pixel
  form.append("o:tracking-opens", "no")
  form.append("o:tracking-clicks", "no")

  const resp = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form,
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Mailgun error ${resp.status}: ${body}`)
  }
}

async function sendViaSES(params: { to: string; from: { email: string; name: string }; replyTo: { email: string; name: string }; subject: string; html: string; text: string }) {
  const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses")
  const client = new SESClient({
    region: process.env.AWS_SES_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
    },
  })
  const cmd = new SendEmailCommand({
    Source: `${params.from.name} <${params.from.email}>`,
    Destination: { ToAddresses: [params.to] },
    ReplyToAddresses: [`${params.replyTo.name} <${params.replyTo.email}>`],
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: params.html, Charset: "UTF-8" },
        Text: { Data: params.text, Charset: "UTF-8" },
      },
    },
  })
  await client.send(cmd)
}

async function sendViaSendGrid(params: { to: string; from: { email: string; name: string }; replyTo: { email: string; name: string }; subject: string; html: string; text: string; headers?: Record<string, string> }) {
  const sgMail = await import("@sendgrid/mail")
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
  await sgMail.default.send({
    to: params.to,
    from: params.from,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
    text: params.text,
    customArgs: { email_type: "sub_outreach" },
    headers: params.headers,
  })
}

async function sendEmail(params: { to: string; from: { email: string; name: string }; replyTo: { email: string; name: string }; subject: string; html: string; text: string; headers?: Record<string, string> }) {
  if (USE_MAILGUN) {
    await sendViaMailgun(params)
  } else if (USE_SES) {
    await sendViaSES(params)
  } else {
    await sendViaSendGrid(params)
  }
}

export default async (_req: Request, _context: Context) => {
  const startTime = Date.now()
  console.log(`[outreach-cron] Starting daily outreach. Provider: ${USE_MAILGUN ? "Mailgun" : USE_SES ? "SES" : "SendGrid"}`)

  // Check how many already sent today (UTC day)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: sentToday } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .gte("outreach_sent_at", todayStart.toISOString())

  const alreadySent = sentToday || 0
  const remaining = Math.max(0, DAILY_TARGET - alreadySent)

  if (remaining === 0) {
    console.log(`[outreach-cron] Daily target already met (${alreadySent}/${DAILY_TARGET}). Skipping.`)
    return new Response(JSON.stringify({ message: "Daily target already met", sent_today: alreadySent }))
  }

  console.log(`[outreach-cron] Sent today: ${alreadySent}. Remaining target: ${remaining}`)

  // Load suppression list
  const { data: suppressedList } = await supabase
    .from("email_suppression_list")
    .select("email")
    .limit(10000)
  const suppressedSet = new Set((suppressedList || []).map((s: any) => s.email))

  let totalSent = 0
  let totalFailed = 0

  while (totalSent < remaining) {
    // Check time limit
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`[outreach-cron] Time limit reached. Sent ${totalSent} this run.`)
      break
    }

    // Fetch next batch of candidates
    const batchSize = Math.min(BATCH_SIZE, remaining - totalSent)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: candidates, error } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, trade_categories, state, unsubscribed, archived, data_health_score")
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .not("trade_categories", "eq", "{}")
      .eq("archived", false)
      .eq("unsubscribed", false)
      .gte("data_health_score", 70)
      .or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)
      .order("data_health_score", { ascending: false })
      .limit(batchSize * 2) // fetch extra to filter suppressions

    if (error || !candidates || candidates.length === 0) {
      console.log(`[outreach-cron] No more candidates. Error: ${error?.message || "none"}`)
      break
    }

    // Filter suppressions
    const eligible = candidates
      .filter((c: any) => !suppressedSet.has(c.contact_email?.toLowerCase()))
      .slice(0, batchSize)

    if (eligible.length === 0) {
      console.log(`[outreach-cron] All candidates suppressed in this batch.`)
      break
    }

    // Send batch
    for (const sub of eligible) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break

      try {
        const token = generateToken()
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

        await supabase
          .from("master_subcontractors")
          .update({ claim_token: token, claim_token_expires_at: expiresAt.toISOString() })
          .eq("id", sub.id)

        const claimUrl = `https://procuvex.com/claim/${token}`
        const unsubscribeUrl = `https://procuvex.com/.netlify/functions/sub-outreach?action=unsubscribe&id=${sub.id}&token=${token}`
        let html = buildOutreachEmail(sub.company_name, claimUrl, sub.trade_categories || [], sub.state || "", unsubscribeUrl)
        const text = buildPlainText(sub.company_name, claimUrl, sub.trade_categories || [], sub.state || "", unsubscribeUrl)

        // Inject our custom open/click tracking
        html = injectTracking(html, sub.contact_email!, claimUrl)

        const trades = sub.trade_categories || []
        await sendEmail({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          replyTo: { email: "admin@core314.com", name: "Procuvex Support" },
          subject: `${sub.company_name} — A Prime is Searching for ${trades.slice(0, 1).join("") || "Contractors"} in ${sub.state || "Your Area"}`,
          html,
          text,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        })

        await supabase
          .from("master_subcontractors")
          .update({
            outreach_sent_at: new Date().toISOString(),
            outreach_email_count: 1,
            last_outreach_email_at: new Date().toISOString(),
          })
          .eq("id", sub.id)

        totalSent++
      } catch (err: any) {
        totalFailed++
        // If permanent send failure, archive the sub
        const msg = err.message || ""
        if (msg.includes("550") || msg.includes("does not exist") || msg.includes("suppression")) {
          await supabase
            .from("master_subcontractors")
            .update({ archived: true, archive_reason: "send_failure" })
            .eq("id", sub.id)
        }
      }
    }

    // Brief pause between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`[outreach-cron] Complete. Sent: ${totalSent}, Failed: ${totalFailed}, Duration: ${duration}s`)

  return new Response(JSON.stringify({
    sent: totalSent,
    failed: totalFailed,
    total_today: alreadySent + totalSent,
    daily_target: DAILY_TARGET,
    duration_seconds: duration,
    provider: USE_MAILGUN ? "Mailgun" : USE_SES ? "SES" : "SendGrid",
  }))
}

// Schedule: 10:00 UTC = 6:00 AM Eastern
export const config: Config = {
  schedule: "0 10 * * *",
}
