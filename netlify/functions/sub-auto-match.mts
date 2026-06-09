import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const KNOWN_TRADES = [
  "HVAC", "Electrical", "Plumbing", "Fire & Life Safety", "Elevator & Escalator",
  "Janitorial", "Landscaping", "Snow & Ice Removal", "Pest Control", "Roofing",
  "Painting", "Flooring", "Security Systems", "General Construction", "Demolition",
  "Concrete & Masonry", "Structural Steel", "Environmental Services", "Waste Management",
  "IT & Telecommunications", "Building Automation", "Emergency Power", "Dock & Loading Equipment",
  "Glass & Glazing", "Insulation", "Drywall & Framing", "Mechanical Services",
  "Welding & Metal Work", "Paving & Asphalt", "Fencing", "Signage", "Food Services",
  "Moving & Logistics", "Furniture & Installation", "Engineering Services",
  "Architectural Services", "Surveying & Geotechnical", "Abatement", "Waterproofing",
  "Fire Protection", "Testing & Inspection", "Staffing & Labor", "Consulting", "Training",
  "Other Services",
]

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
  matched_trades: string[]
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
    const { trades: rawTrades, sow_labels, states, require_verified, require_small_biz, small_biz_types, max_results, include_unclaimed } = body
    const limit = Math.min(max_results || 50, 200)

    // AI-assisted SOW label → trade taxonomy mapping
    // When sow_labels are provided, map each one to the closest known trade category
    let trades: string[] = rawTrades || []
    let sowBreakdown: { sow_label: string; mapped_trade: string | null }[] = []

    if (sow_labels && Array.isArray(sow_labels) && sow_labels.length > 0) {
      try {
        const mappingPrompt = `You are a trade category classifier for the construction/facility maintenance industry.

I have a list of Statement of Work (SOW) line item descriptions from a project. Map EACH one to the single BEST matching trade category from the list below. If a SOW item clearly doesn't match any category, map it to the closest reasonable one.

Known trade categories:
${KNOWN_TRADES.join(", ")}

SOW line items to map:
${sow_labels.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")}

Respond with ONLY a JSON array of objects, one per SOW item, in order:
[{"sow_label": "<original label>", "mapped_trade": "<exact category name from the list>"}]

IMPORTANT: The "mapped_trade" value MUST be an exact match from the known trade categories list above. Do not invent new categories.`

        const apiKey = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
        if (!apiKey) throw new Error("OpenAI API key not configured")

        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            max_tokens: 1000,
            messages: [{ role: "user", content: mappingPrompt }],
          }),
        })

        if (!aiResp.ok) throw new Error(`OpenAI error: ${aiResp.status}`)
        const aiData = await aiResp.json()
        const content = aiData.choices?.[0]?.message?.content?.trim() || "[]"
        const jsonStr = content.replace(/```json\n?|```/g, "").trim()
        const parsed = JSON.parse(jsonStr) as { sow_label: string; mapped_trade: string }[]

        // Validate that mapped trades are actually in our taxonomy
        sowBreakdown = parsed.map(item => ({
          sow_label: item.sow_label,
          mapped_trade: KNOWN_TRADES.includes(item.mapped_trade) ? item.mapped_trade : null,
        }))

        // Build the actual trades list from AI mapping (deduplicated, only valid mappings)
        const mappedTrades = [...new Set(sowBreakdown.filter(s => s.mapped_trade).map(s => s.mapped_trade!))]
        if (mappedTrades.length > 0) {
          trades = mappedTrades
        }
      } catch (err) {
        // If AI mapping fails, fall back to raw trades
        console.error("AI trade mapping failed:", err)
      }
    }

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return new Response(JSON.stringify({ error: "At least one trade required" }), { status: 400, headers })
    }

    // Per-trade queries to guarantee coverage for ALL SOW trades.
    // A single .overlaps() query with .limit(500) causes common trades (HVAC, Plumbing)
    // to dominate the result set, crowding out rarer trades (Fire & Life Safety, Elevator).
    // Instead, we query each trade separately with its own limit, then merge + deduplicate.
    const selectFields = "id, company_name, contact_email, contact_phone, contact_name, state, city, trade_categories, verification_status, profile_completeness, small_business, small_business_types, geographic_coverage, slug, naics_codes, description, website, capability_statement_path, address_line1, sam_uei"
    const perTradeLimit = Math.max(Math.ceil(500 / trades.length), 50)

    const tradeQueries = trades.map((trade: string) => {
      let q = supabase
        .from("master_subcontractors")
        .select(selectFields)
        .contains("trade_categories", [trade])
        .or("contact_email.not.is.null,contact_phone.not.is.null")

      if (!include_unclaimed) {
        q = q.not("claimed_at", "is", null)
      }
      if (require_verified) {
        q = q.eq("verification_status", "verified")
      }
      if (require_small_biz) {
        q = q.eq("small_business", true)
      }

      return q.order("profile_completeness", { ascending: false }).limit(perTradeLimit)
    })

    const tradeResults = await Promise.all(tradeQueries)

    // Merge and deduplicate candidates from all per-trade queries
    const candidateMap = new Map<string, Record<string, unknown>>()
    let queryError: string | null = null

    for (const result of tradeResults) {
      if (result.error) {
        queryError = result.error.message
        break
      }
      for (const sub of (result.data || []) as Record<string, unknown>[]) {
        const id = sub.id as string
        if (!candidateMap.has(id)) {
          candidateMap.set(id, sub)
        }
      }
    }

    if (queryError) {
      return new Response(JSON.stringify({ error: queryError }), { status: 500, headers })
    }

    const candidates = Array.from(candidateMap.values())

    // Score each candidate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored: MatchResult[] = (candidates || []).map((sub: any) => {
      let score = 0
      const reasons: string[] = []

      // Trade match (primary factor — 20 points per matching trade, capped at 40)
      const tradeMatches = trades.filter((t: string) => sub.trade_categories?.includes(t))
      if (tradeMatches.length > 0) {
        score += Math.min(tradeMatches.length * 20, 40)
        reasons.push(`Trades: ${tradeMatches.join(", ")}`)
      } else {
        return null // no trade match = skip
      }
      const matchedTrades = tradeMatches as string[]

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

      // Data completeness bonus (15 points) — more complete data = better match
      let dataFields = 0
      if (sub.contact_email) dataFields++
      if (sub.contact_phone) dataFields++
      if (sub.contact_name) dataFields++
      if (sub.address_line1) dataFields++
      if (sub.city && sub.state) dataFields++
      if (sub.naics_codes?.length > 0) dataFields++
      if (sub.description) dataFields++
      if (sub.website || sub.capability_statement_path) dataFields++
      score += Math.min(Math.floor(dataFields * 2), 15)
      if (dataFields >= 6) reasons.push("Rich data profile")

      // NAICS code match bonus (5 points)
      // If we had project NAICS codes we'd match here — for now just reward having them
      if (sub.naics_codes?.length > 0) {
        score += 5
      }

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
        matched_trades: matchedTrades,
      }
    }).filter(Boolean) as MatchResult[]

    // Per-trade round-robin selection to ensure ALL SOW trades have representation
    // Without this, multi-trade subs (e.g. HVAC+Plumbing) dominate and single-trade
    // SOWs (Janitorial, Landscaping, etc.) get zero representation.
    const perTradeMin = Math.max(Math.ceil(limit / trades.length), 3)
    const tradeGroups: Record<string, MatchResult[]> = {}
    for (const trade of trades) {
      tradeGroups[trade as string] = scored
        .filter(s => s.matched_trades.includes(trade as string))
        .sort((a, b) => b.match_score - a.match_score)
    }

    const selectedIds = new Set<string>()
    const results: MatchResult[] = []

    // First pass: give each trade its fair share
    for (const trade of trades) {
      const group = tradeGroups[trade as string] || []
      let added = 0
      for (const sub of group) {
        if (results.length >= limit) break
        if (selectedIds.has(sub.sub_id)) continue
        selectedIds.add(sub.sub_id)
        results.push(sub)
        added++
        if (added >= perTradeMin) break
      }
    }

    // Second pass: fill remaining slots with highest-scoring unselected subs
    if (results.length < limit) {
      const remaining = scored
        .filter(s => !selectedIds.has(s.sub_id))
        .sort((a, b) => b.match_score - a.match_score)
      for (const sub of remaining) {
        if (results.length >= limit) break
        results.push(sub)
      }
    }

    // Final sort by score
    results.sort((a, b) => b.match_score - a.match_score)

    // Increment match count for returned subs
    const matchedIds = results.map(r => r.sub_id)
    if (matchedIds.length > 0) {
      for (const id of matchedIds) {
        try { await supabase.rpc("increment_match_count", { sub_id: id }) } catch { /* ignore */ }
      }
    }

    // Build per-trade count summary so frontend can show coverage
    const tradeCounts: Record<string, number> = {}
    for (const r of results) {
      for (const t of r.matched_trades) {
        tradeCounts[t] = (tradeCounts[t] || 0) + 1
      }
    }

    // Add sub counts to SOW breakdown
    const sowBreakdownWithCounts = sowBreakdown.map(item => ({
      ...item,
      sub_count: item.mapped_trade ? (tradeCounts[item.mapped_trade] || 0) : 0,
    }))

    return new Response(JSON.stringify({
      matches: results,
      total: scored.length,
      trade_counts: tradeCounts,
      sow_breakdown: sowBreakdownWithCounts.length > 0 ? sowBreakdownWithCounts : undefined,
    }), { headers })
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
