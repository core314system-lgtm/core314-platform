import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mailgun-only for outreach drip follow-ups
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || "procuvex.com"
const MAILGUN_API_URL = process.env.MAILGUN_API_URL || "https://api.mailgun.net"

async function sendViaMailgun(params: {
  to: string
  from: { email: string; name: string }
  replyTo: { email: string; name: string }
  subject: string
  html: string
  text: string
  tag: string
  headers?: Record<string, string>
}): Promise<string> {
  if (!MAILGUN_API_KEY) {
    throw new Error("MAILGUN_API_KEY is not configured — drip emails cannot send")
  }

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
  form.append("o:tag", params.tag)
  form.append("o:tracking-opens", "yes")
  form.append("o:tracking-clicks", "htmlonly")

  const resp = await fetch(`${MAILGUN_API_URL}/v3/${MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
    body: form,
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Mailgun error ${resp.status}: ${body}`)
  }

  const data = await resp.json() as { id?: string }
  return data.id || ""
}

/**
 * OUTREACH DRIP SEQUENCE
 * Automated follow-up emails for subs who haven't responded to initial outreach.
 * 
 * Sequence:
 * - Day 0: Initial outreach (handled by sub-outreach.mts)
 * - Day 3: Follow-up #1 — "A prime searched for your trade"
 * - Day 7: Follow-up #2 — "Last chance before deprioritization"
 * 
 * This function runs on a schedule (daily) and sends follow-ups to eligible subs.
 */

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  const isScheduled = req.headers.get("x-nf-event") === "schedule" ||
                      req.headers.get("user-agent")?.includes("Netlify")

  // Require admin auth for manual invocations
  if (!isScheduled) {
    const callerId = req.headers.get("x-user-id")
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    const { data: admin } = await supabase
      .from("user_profiles")
      .select("is_global_admin")
      .eq("id", callerId)
      .single()
    if (!admin?.is_global_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }
  }

  let body: { action?: string; dry_run?: boolean } = {}
  try { body = await req.json() } catch {}
  const dryRun = body.dry_run || false

  if (!MAILGUN_API_KEY) {
    return new Response(JSON.stringify({ error: "MAILGUN_API_KEY not configured" }), { status: 500, headers })
  }

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()

  let followUp1Sent = 0
  let followUp2Sent = 0
  let errors: string[] = []

  // --- FOLLOW-UP #1: 3 days after initial send ---
  // Targets: sent outreach 3-4 days ago, email_count = 1, not claimed, not unsubscribed
  const { data: day3Targets } = await supabase
    .from("master_subcontractors")
    .select("id, company_name, contact_email, claim_token, trade_categories, state")
    .is("claimed_at", null)
    .is("confirmed_at", null)
    .eq("archived", false)
    .eq("outreach_email_count", 1)
    .lte("outreach_sent_at", threeDaysAgo)
    .gte("outreach_sent_at", fourDaysAgo)
    .not("contact_email", "is", null)
    .neq("unsubscribed", true)
    .limit(100)

  if (day3Targets && day3Targets.length > 0) {
    for (const sub of day3Targets) {
      if (dryRun) { followUp1Sent++; continue }
      try {
        const claimUrl = sub.claim_token
          ? `https://procuvex.com/claim/${sub.claim_token}`
          : `https://procuvex.com/claim-lookup/${sub.id}`
        const unsubscribeUrl = `https://procuvex.com/.netlify/functions/sub-outreach?action=unsubscribe&id=${sub.id}&token=${sub.claim_token || sub.id}`
        const trades = (sub.trade_categories || []).slice(0, 2).join(", ") || "your trade"
        const location = sub.state || "your area"

        await sendViaMailgun({
          to: sub.contact_email!,
          from: { email: `team@${MAILGUN_DOMAIN}`, name: "Procuvex" },
          replyTo: { email: "admin@core314.com", name: "Procuvex Support" },
          subject: `${sub.company_name} — A prime searched for ${trades} subs in ${location}`,
          html: buildFollowUp1Email(sub.company_name, claimUrl, sub.trade_categories || [], location, unsubscribeUrl),
          text: buildFollowUp1Text(sub.company_name, claimUrl, sub.trade_categories || [], location, unsubscribeUrl),
          tag: "sub_outreach_followup1",
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        await supabase.from("master_subcontractors").update({
          outreach_email_count: 2,
          last_outreach_email_at: new Date().toISOString(),
        }).eq("id", sub.id)

        followUp1Sent++
      } catch (err: any) {
        errors.push(`Day3 ${sub.company_name}: ${err.message}`)
      }
    }
  }

  // --- FOLLOW-UP #2: 7 days after initial send ---
  // Targets: sent outreach 7-8 days ago, email_count = 2, not claimed, not unsubscribed
  const { data: day7Targets } = await supabase
    .from("master_subcontractors")
    .select("id, company_name, contact_email, claim_token, trade_categories, state")
    .is("claimed_at", null)
    .is("confirmed_at", null)
    .eq("archived", false)
    .eq("outreach_email_count", 2)
    .lte("last_outreach_email_at", sevenDaysAgo)
    .gte("last_outreach_email_at", eightDaysAgo)
    .not("contact_email", "is", null)
    .neq("unsubscribed", true)
    .limit(100)

  if (day7Targets && day7Targets.length > 0) {
    for (const sub of day7Targets) {
      if (dryRun) { followUp2Sent++; continue }
      try {
        const claimUrl = sub.claim_token
          ? `https://procuvex.com/claim/${sub.claim_token}`
          : `https://procuvex.com/claim-lookup/${sub.id}`
        const unsubscribeUrl = `https://procuvex.com/.netlify/functions/sub-outreach?action=unsubscribe&id=${sub.id}&token=${sub.claim_token || sub.id}`
        const trades = (sub.trade_categories || []).slice(0, 2).join(", ") || "your trade"
        const location = sub.state || "your area"

        await sendViaMailgun({
          to: sub.contact_email!,
          from: { email: `team@${MAILGUN_DOMAIN}`, name: "Procuvex" },
          replyTo: { email: "admin@core314.com", name: "Procuvex Support" },
          subject: `Final notice: ${sub.company_name} profile will be deprioritized`,
          html: buildFollowUp2Email(sub.company_name, claimUrl, sub.trade_categories || [], location, unsubscribeUrl),
          text: buildFollowUp2Text(sub.company_name, claimUrl, sub.trade_categories || [], location, unsubscribeUrl),
          tag: "sub_outreach_followup2",
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        await supabase.from("master_subcontractors").update({
          outreach_email_count: 3,
          last_outreach_email_at: new Date().toISOString(),
        }).eq("id", sub.id)

        followUp2Sent++
      } catch (err: any) {
        errors.push(`Day7 ${sub.company_name}: ${err.message}`)
      }
    }
  }

  return new Response(JSON.stringify({
    follow_up_1_sent: followUp1Sent,
    follow_up_2_sent: followUp2Sent,
    day3_eligible: day3Targets?.length || 0,
    day7_eligible: day7Targets?.length || 0,
    dry_run: dryRun,
    errors: errors.slice(0, 10),
  }), { headers })
}

// --- Follow-up #1 (Day 3): "A prime searched for your trade" ---
function buildFollowUp1Email(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Hi,
        </p>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Quick update — a prime contractor just searched for <strong>${tradeStr}</strong> subcontractors in <strong>${location}</strong> on Procuvex. <strong>${companyName}</strong> matched their criteria.
        </p>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          However, since your profile hasn't been confirmed yet, you appeared lower in the results. Confirmed profiles get priority placement.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            Confirm My Profile (10 sec) →
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          This takes 10 seconds and is completely free. You just confirm the info we already have is accurate.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">
          Procuvex &mdash; Core314 Technologies LLC &mdash; 456 Clinton Dr. Orange Park, FL 32073<br/>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `
}

function buildFollowUp1Text(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `Hi,

Quick update — a prime contractor just searched for ${tradeStr} subcontractors in ${location} on Procuvex. ${companyName} matched their criteria.

However, since your profile hasn't been confirmed yet, you appeared lower in the results. Confirmed profiles get priority placement.

Confirm your profile (10 seconds, free): ${claimUrl}

---
Procuvex - Core314 Technologies LLC
Unsubscribe: ${unsubscribeUrl}
`
}

// --- Follow-up #2 (Day 7): "Last chance — deprioritization" ---
function buildFollowUp2Email(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Hi,
        </p>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          This is a final courtesy notice for <strong>${companyName}</strong>.
        </p>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          We've had your profile in our contractor network for a week and it still hasn't been confirmed. Starting next week, <strong>unconfirmed profiles will be deprioritized</strong> — meaning primes searching for ${tradeStr} in ${location} won't see your company in the first page of results.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0; font-size: 13px; font-weight: 600;">
            Unconfirmed profiles lose visibility after 7 days
          </p>
          <p style="color: #991b1b; margin: 6px 0 0; font-size: 12px;">
            Confirm now to keep ${companyName} visible to prime contractors.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            Keep My Profile Active →
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">One click. No account. No cost.</p>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
          If you don't want to appear in contractor searches, no action needed — your profile will naturally become less visible over time. You can also unsubscribe below.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">
          Procuvex &mdash; Core314 Technologies LLC &mdash; 456 Clinton Dr. Orange Park, FL 32073<br/>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> &mdash; This is the last email we'll send about profile confirmation.
        </p>
      </div>
    </div>
  `
}

function buildFollowUp2Text(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `Hi,

This is a final courtesy notice for ${companyName}.

We've had your profile in our contractor network for a week and it still hasn't been confirmed. Starting next week, unconfirmed profiles will be deprioritized — meaning primes searching for ${tradeStr} in ${location} won't see your company in the first page of results.

Confirm now to keep your profile visible: ${claimUrl}

One click. No account. No cost.

If you don't want to appear in contractor searches, no action needed. You can also unsubscribe below.

---
Procuvex - Core314 Technologies LLC
Unsubscribe: ${unsubscribeUrl}
This is the last email we'll send about profile confirmation.
`
}
