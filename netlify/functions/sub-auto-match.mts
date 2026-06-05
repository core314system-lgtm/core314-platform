import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

interface MatchResult {
  sub_id: string
  company_name: string
  contact_email: string | null
  state: string | null
  city: string | null
  trade_categories: string[]
  verification_status: string
  profile_completeness: number
  small_business_types: string[]
  match_score: number
  match_reasons: string[]
}

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const callerId = req.headers.get("x-user-id")
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const body = await req.json()
  const { action } = body

  // --- ACTION: match ---
  // Find subs matching given criteria (trade, location, certs)
  if (action === "match") {
    const { trades, states, require_verified, require_small_biz, small_biz_types, max_results, include_unclaimed } = body
    const limit = Math.min(max_results || 50, 200)

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return new Response(JSON.stringify({ error: "At least one trade required" }), { status: 400, headers })
    }

    // Base query — get subs that match trades
    // If include_unclaimed is true (Enterprise feature), also include unclaimed subs with contact emails
    let query = supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, state, city, trade_categories, verification_status, profile_completeness, small_business, small_business_types, geographic_coverage, slug")

    if (!include_unclaimed) {
      query = query.not("claimed_at", "is", null) // only claimed/active subs
    } else {
      // For Enterprise: include all subs that have contact emails OR are claimed
      query = query.or("claimed_at.not.is.null,contact_email.not.is.null")
    }

    if (require_verified) {
      query = query.eq("verification_status", "verified")
    }

    if (require_small_biz) {
      query = query.eq("small_business", true)
    }

    // Get candidates (larger set, we'll score them)
    const { data: candidates, error } = await query.limit(500)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    // Score each candidate
    const scored: MatchResult[] = (candidates || []).map(sub => {
      let score = 0
      const reasons: string[] = []

      // Trade match (primary factor — 40 points max)
      const tradeMatches = trades.filter((t: string) => sub.trade_categories?.includes(t))
      if (tradeMatches.length > 0) {
        score += Math.min(tradeMatches.length * 20, 40)
        reasons.push(`Trades: ${tradeMatches.join(", ")}`)
      } else {
        return null // no trade match = skip
      }

      // Location match (20 points)
      if (states && states.length > 0) {
        if (states.includes(sub.state)) {
          score += 15
          reasons.push(`Located in ${sub.state}`)
        }
        // Also check geographic coverage
        const geoCover = sub.geographic_coverage || []
        const geoMatches = states.filter((s: string) => geoCover.includes(s))
        if (geoMatches.length > 0) {
          score += 5
          reasons.push(`Covers: ${geoMatches.join(", ")}`)
        }
      }

      // Verification bonus (20 points)
      if (sub.verification_status === "verified") {
        score += 20
        reasons.push("Verified")
      } else if (sub.verification_status === "claimed") {
        score += 5
      }

      // Profile completeness bonus (10 points)
      score += Math.floor((sub.profile_completeness || 0) / 10)

      // Small business type match (10 points)
      if (small_biz_types && small_biz_types.length > 0 && sub.small_business_types) {
        const sbMatches = small_biz_types.filter((t: string) => sub.small_business_types.includes(t))
        if (sbMatches.length > 0) {
          score += 10
          reasons.push(`SB: ${sbMatches.join(", ")}`)
        }
      }

      return {
        sub_id: sub.id,
        company_name: sub.company_name,
        contact_email: sub.contact_email,
        state: sub.state,
        city: sub.city,
        trade_categories: sub.trade_categories,
        verification_status: sub.verification_status,
        profile_completeness: sub.profile_completeness,
        small_business_types: sub.small_business_types || [],
        match_score: score,
        match_reasons: reasons,
      }
    }).filter(Boolean) as MatchResult[]

    // Sort by score descending
    scored.sort((a, b) => b.match_score - a.match_score)
    const results = scored.slice(0, limit)

    // Increment match count for returned subs
    const matchedIds = results.map(r => r.sub_id)
    if (matchedIds.length > 0) {
      for (const id of matchedIds) {
        await supabase.rpc("increment_match_count", { sub_id: id }).catch(() => {})
      }
    }

    return new Response(JSON.stringify({ matches: results, total: scored.length }), { headers })
  }

  // --- ACTION: invite-all ---
  // Send RFQ invitation emails to matched subs
  if (action === "invite-all") {
    const { sub_ids, rfq_title, rfq_description, prime_company, due_date } = body

    if (!sub_ids || !Array.isArray(sub_ids) || sub_ids.length === 0) {
      return new Response(JSON.stringify({ error: "sub_ids required" }), { status: 400, headers })
    }

    initSendGrid()

    const { data: subs } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email")
      .in("id", sub_ids)
      .not("contact_email", "is", null)

    let sent = 0
    let failed = 0

    for (const sub of subs || []) {
      try {
        await sgMail.default.send({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          subject: `New Opportunity: ${rfq_title || "RFQ Invitation"}`,
          html: buildRfqInviteEmail(sub.company_name, rfq_title, rfq_description, prime_company, due_date),
          customArgs: { email_type: "rfq_invite" },
        })

        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: sub.id,
          contact_type: "rfq_invite",
          contact_method: "email",
          subject: rfq_title || "RFQ Invitation",
          notes: `From ${prime_company || "a prime contractor"}`,
          sent_by: callerId,
        })

        sent++
      } catch {
        failed++
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: (subs || []).length }), { headers })
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers })
}

function buildRfqInviteEmail(companyName: string, title: string, description: string, primeCompany: string, dueDate: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">New Opportunity</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">via Procuvex Subcontractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Hi <strong>${companyName}</strong>,
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          A prime contractor${primeCompany ? ` (${primeCompany})` : ""} is looking for subcontractors and your company was matched:
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #1e293b; font-size: 15px;">${title || "RFQ Invitation"}</p>
          ${description ? `<p style="margin: 0 0 8px; color: #475569; font-size: 13px;">${description}</p>` : ""}
          ${dueDate ? `<p style="margin: 0; color: #dc2626; font-size: 13px; font-weight: 500;">Due: ${dueDate}</p>` : ""}
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://procuvex.com/my-sub-profile" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            View Details & Respond
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex — A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}
