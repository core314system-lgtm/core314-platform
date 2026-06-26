import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
if (SENDGRID_API_KEY) sgMail.default.setApiKey(SENDGRID_API_KEY)

async function sendDripEmail(params: {
  to: string
  from: { email: string; name: string }
  replyTo: { email: string; name: string }
  subject: string
  html: string
  text: string
  tag: string
  headers?: Record<string, string>
}): Promise<string> {
  if (!SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is not configured — drip emails cannot send")
  }

  const msg: Record<string, unknown> = {
    to: params.to,
    from: params.from,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
    text: params.text,
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
    },
    customArgs: { email_type: params.tag },
  }

  if (params.headers?.["List-Unsubscribe"]) {
    msg.headers = {
      "List-Unsubscribe": params.headers["List-Unsubscribe"],
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
  }

  const [response] = await sgMail.default.send(msg as Parameters<typeof sgMail.default.send>[0])
  return response?.headers?.["x-message-id"] || ""
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

  if (!SENDGRID_API_KEY) {
    return new Response(JSON.stringify({ error: "SENDGRID_API_KEY not configured" }), { status: 500, headers })
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

        await sendDripEmail({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
          replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
          subject: `Following up — ${sub.company_name} profile on Procuvex`,
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

        await sendDripEmail({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
          replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
          subject: `Last note about ${sub.company_name} on Procuvex`,
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

// --- Follow-up #1 (Day 3): short personal nudge ---
function buildFollowUp1Email(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <div style="padding: 20px 0;">
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">Hi,</p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          Just wanted to make sure you saw my note from a few days ago. We have a profile set up for <strong>${companyName}</strong> on Procuvex — primes are searching for ${tradeStr} subs in ${location} and your company matches.
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          If you want to show up in those searches, just confirm the profile is accurate:
        </p>
        <p style="margin: 20px 0;">
          <a href="${claimUrl}" style="color: #1e40af; font-size: 15px; font-weight: 600; text-decoration: underline;">Confirm your profile</a>
          <span style="color: #6b7280; font-size: 14px;"> (10 seconds, free)</span>
        </p>
        <p style="color: #1a1a1a; font-size: 15px; margin: 24px 0 4px;">&mdash; Chris</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 12px;" />
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> &mdash;
          Core314 Technologies LLC, 456 Clinton Dr. Orange Park, FL 32073
        </p>
      </div>
    </div>
  `
}

function buildFollowUp1Text(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `Hi,

Just wanted to make sure you saw my note from a few days ago. We have a profile set up for ${companyName} on Procuvex — primes are searching for ${tradeStr} subs in ${location} and your company matches.

If you want to show up in those searches, just confirm the profile is accurate:

${claimUrl}

10 seconds, free.

— Chris

Unsubscribe: ${unsubscribeUrl}
`
}

// --- Follow-up #2 (Day 7): final personal note ---
function buildFollowUp2Email(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <div style="padding: 20px 0;">
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">Hi,</p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          Last note from me on this — I don't want to be a bother.
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          <strong>${companyName}</strong>'s profile has been on Procuvex for a week. Primes searching for ${tradeStr} in ${location} can find you, but unconfirmed profiles get less visibility over time.
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          If you're interested in receiving bid invitations from primes, confirm here:
        </p>
        <p style="margin: 20px 0;">
          <a href="${claimUrl}" style="color: #1e40af; font-size: 15px; font-weight: 600; text-decoration: underline;">Confirm your profile</a>
        </p>
        <p style="color: #1a1a1a; line-height: 1.7; font-size: 15px; margin: 0 0 16px;">
          If not, no worries at all. This is the last email I'll send about this.
        </p>
        <p style="color: #1a1a1a; font-size: 15px; margin: 24px 0 4px;">&mdash; Chris</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 12px;" />
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5;">
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> &mdash;
          Core314 Technologies LLC, 456 Clinton Dr. Orange Park, FL 32073
        </p>
      </div>
    </div>
  `
}

function buildFollowUp2Text(companyName: string, claimUrl: string, trades: string[], location: string, unsubscribeUrl: string): string {
  const tradeStr = trades.slice(0, 2).join(", ") || "your trade"
  return `Hi,

Last note from me on this — I don't want to be a bother.

${companyName}'s profile has been on Procuvex for a week. Primes searching for ${tradeStr} in ${location} can find you, but unconfirmed profiles get less visibility over time.

If you're interested: ${claimUrl}

If not, no worries at all. This is the last email I'll send about this.

— Chris

Unsubscribe: ${unsubscribeUrl}
`
}
