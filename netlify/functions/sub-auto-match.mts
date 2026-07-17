import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import zipcodes from "zipcodes"
import { htmlToPlainText } from "./_shared/html-to-text.ts"
import { KNOWN_TRADES } from "./_shared/tradeTaxonomy.ts"
import { resolveCaller } from "./_shared/auth.ts"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// US state adjacency map for regional filtering
const STATE_NEIGHBORS: Record<string, string[]> = {
  AL: ["FL","GA","MS","TN"], AK: [], AZ: ["CA","NV","UT","NM","CO"],
  AR: ["LA","MS","MO","OK","TN","TX"], CA: ["AZ","NV","OR"],
  CO: ["AZ","KS","NE","NM","OK","UT","WY"], CT: ["MA","NY","RI"],
  DE: ["MD","NJ","PA"], FL: ["AL","GA"], GA: ["AL","FL","NC","SC","TN"],
  HI: [], ID: ["MT","NV","OR","UT","WA","WY"],
  IL: ["IN","IA","KY","MO","WI"], IN: ["IL","KY","MI","OH"],
  IA: ["IL","MN","MO","NE","SD","WI"], KS: ["CO","MO","NE","OK"],
  KY: ["IL","IN","MO","OH","TN","VA","WV"], LA: ["AR","MS","TX"],
  ME: ["NH"], MD: ["DE","PA","VA","WV","DC"], MA: ["CT","NH","NY","RI","VT"],
  MI: ["IN","OH","WI"], MN: ["IA","ND","SD","WI"],
  MS: ["AL","AR","LA","TN"], MO: ["AR","IL","IA","KS","KY","NE","OK","TN"],
  MT: ["ID","ND","SD","WY"], NE: ["CO","IA","KS","MO","SD","WY"],
  NV: ["AZ","CA","ID","OR","UT"], NH: ["MA","ME","VT"],
  NJ: ["DE","NY","PA"], NM: ["AZ","CO","OK","TX","UT"],
  NY: ["CT","MA","NJ","PA","VT"], NC: ["GA","SC","TN","VA"],
  ND: ["MN","MT","SD"], OH: ["IN","KY","MI","PA","WV"],
  OK: ["AR","CO","KS","MO","NM","TX"], OR: ["CA","ID","NV","WA"],
  PA: ["DE","MD","NJ","NY","OH","WV"], RI: ["CT","MA"],
  SC: ["GA","NC"], SD: ["IA","MN","MT","ND","NE","WY"],
  TN: ["AL","AR","GA","KY","MO","MS","NC","VA"],
  TX: ["AR","LA","NM","OK"], UT: ["AZ","CO","ID","NV","NM","WY"],
  VT: ["MA","NH","NY"], VA: ["KY","MD","NC","TN","WV","DC"],
  WA: ["ID","OR"], WV: ["KY","MD","OH","PA","VA"],
  WI: ["IA","IL","MI","MN"], WY: ["CO","ID","MT","NE","SD","UT"],
  DC: ["MD","VA"],
}

// Trade-to-SOW matching: maps sub trade categories to SOW service_category/sow_name keywords
// Used to correctly assign subs to the SOW items they're qualified for
const TRADE_SOW_SYNONYMS: Record<string, string[]> = {
  "hvac": ["hvac", "chiller", "heating", "cooling", "air conditioning", "mechanical", "refrigeration", "boiler"],
  "mechanical services": ["hvac", "chiller", "mechanical", "boiler", "heating", "cooling", "plumbing"],
  "electrical": ["electrical", "power", "lighting", "wiring", "generator", "emergency power"],
  "emergency power": ["electrical", "power", "generator", "emergency power", "ups"],
  "plumbing": ["plumbing", "pipe", "water", "sewer", "drain", "backflow"],
  "fire & life safety": ["fire", "life safety", "fire protection", "sprinkler", "fire alarm", "suppression", "extinguisher"],
  "fire protection": ["fire", "fire protection", "sprinkler", "fire alarm", "suppression", "extinguisher", "life safety"],
  "elevator & escalator": ["elevator", "escalator", "lift", "vertical transport"],
  "janitorial & custodial": ["janitorial", "custodial", "cleaning", "housekeeping", "sanitation"],
  "janitorial": ["janitorial", "custodial", "cleaning", "housekeeping", "sanitation"],
  "landscaping & grounds": ["landscaping", "grounds", "lawn", "turf", "irrigation", "tree", "horticulture"],
  "landscaping": ["landscaping", "grounds", "lawn", "turf", "irrigation"],
  "pest control": ["pest", "extermination", "fumigation", "rodent", "insect", "termite"],
  "building automation": ["bas", "building automation", "controls", "bms", "building management", "automation"],
  "security systems": ["security", "access control", "cctv", "surveillance", "intrusion"],
  "roofing": ["roofing", "roof"],
  "painting & coatings": ["painting", "coatings", "paint"],
  "flooring": ["flooring", "carpet", "tile", "vinyl"],
  "snow & ice removal": ["snow", "ice", "winter", "deicing"],
  "concrete & masonry": ["concrete", "masonry", "brick", "block"],
  "environmental services": ["environmental", "hazmat", "abatement", "remediation"],
  "general construction": ["construction", "general", "renovation", "remodel"],
  "demolition": ["demolition", "demo"],
  "waste management": ["waste", "trash", "disposal", "recycling", "dumpster"],
  "glass & glazing": ["glass", "glazing", "window"],
  "it & telecommunications": ["it", "telecom", "network", "cable", "data", "fiber"],
  "testing & inspection": ["testing", "inspection", "commissioning"],
}

function matchSubTradeToSow(
  subTrades: string[],
  sowItems: { id: string; service_category: string; sow_name: string; description: string | null }[]
): typeof sowItems[number] | null {
  const normalizedSubTrades = subTrades.map(t => t.toLowerCase().trim())

  // Build keyword sets for each sub trade
  const subKeywords = new Set<string>()
  for (const trade of normalizedSubTrades) {
    // Add the trade itself
    subKeywords.add(trade)
    // Add synonyms
    const synonyms = TRADE_SOW_SYNONYMS[trade]
    if (synonyms) {
      for (const s of synonyms) subKeywords.add(s)
    }
    // Also add individual words from the trade name
    for (const word of trade.split(/[\s&,]+/).filter(w => w.length > 2)) {
      subKeywords.add(word)
    }
  }

  // Score each SOW item
  let bestMatch: typeof sowItems[number] | null = null
  let bestScore = 0

  for (const sow of sowItems) {
    const sowText = `${sow.service_category} ${sow.sow_name} ${sow.description || ""}`.toLowerCase()
    const sowWords = sowText.split(/[\s&,/()]+/).filter(w => w.length > 2)

    let score = 0
    for (const keyword of subKeywords) {
      if (sowText.includes(keyword)) {
        score += keyword.length // Longer keyword matches are worth more
      }
    }
    // Also check if SOW words match sub trades directly
    for (const word of sowWords) {
      for (const trade of normalizedSubTrades) {
        if (trade.includes(word) && word.length > 3) {
          score += word.length
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = sow
    }
  }

  // Require a minimum match score to prevent false assignments
  // A score of at least 4 means at least one meaningful keyword matched
  return bestScore >= 4 ? bestMatch : null
}

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
  distance_miles?: number | null
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  // Verify the caller's Supabase JWT and derive their id from it — never trust
  // a client-supplied user id header, which is trivially spoofable.
  const caller = await resolveCaller(req.headers.get("authorization"))
  if (!caller) {
    return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers })
  }
  const callerId = caller.userId

  const body = await req.json()
  const { action } = body

  // --- ACTION: match ---
  // Find subs matching given criteria (trade, location, certs)
  if (action === "match") {
    const { trades: rawTrades, sow_labels, states, location_scope, local_radius_miles, project_zip, require_verified, require_small_biz, small_biz_types, max_results, include_unclaimed } = body
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

    // Location scope can be a single value or an array (combinable)
    // "local" = radius from project zip, "regional" = state + neighbors, "national" = no filter
    // Examples: "regional", ["local", "regional"], ["local", "national"]
    const rawScope = location_scope || "regional"
    const scopes: string[] = Array.isArray(rawScope) ? rawScope : [rawScope]
    const includesLocal = scopes.includes("local")
    const includesRegional = scopes.includes("regional")
    const includesNational = scopes.includes("national")
    const radiusMiles = Number(local_radius_miles) || 50

    // Resolve project zip for radius-based filtering
    let projectLat: number | null = null
    let projectLng: number | null = null
    let localZipSet: Set<string> | null = null

    if (includesLocal && project_zip) {
      const zipInfo = zipcodes.lookup(String(project_zip).substring(0, 5))
      if (zipInfo) {
        projectLat = zipInfo.latitude
        projectLng = zipInfo.longitude
        // Get all zip codes within the radius for DB pre-filtering
        const nearbyZips = zipcodes.radius(String(project_zip).substring(0, 5), radiusMiles) || []
        localZipSet = new Set(nearbyZips)
      }
    }

    // Build the set of states to include in the DB query
    let scopeStates: string[] | null = null // null = no state filter
    if (includesNational) {
      // National = no filter, trumps everything
      scopeStates = null
    } else {
      const stateSet = new Set<string>()
      if (includesLocal && projectLat && states?.[0]) {
        // For local, include the project state + neighboring states to cast a wide net
        // (actual radius filtering happens post-query)
        stateSet.add(states[0])
        const neighbors = STATE_NEIGHBORS[states[0] as string] || []
        for (const n of neighbors) stateSet.add(n)
      }
      if (includesRegional && states && states.length > 0) {
        for (const st of states) {
          stateSet.add(st as string)
          const neighbors = STATE_NEIGHBORS[st as string] || []
          for (const n of neighbors) stateSet.add(n)
        }
      }
      if (stateSet.size > 0) {
        scopeStates = Array.from(stateSet)
      } else if (states && states.length > 0) {
        // Fallback: at least filter to project state
        scopeStates = [...states]
      }
    }

    // Per-trade queries to guarantee coverage for ALL SOW trades.
    // A single .overlaps() query with .limit(500) causes common trades (HVAC, Plumbing)
    // to dominate the result set, crowding out rarer trades.
    const selectFields = "id, company_name, contact_email, contact_phone, contact_name, state, city, zip_code, trade_categories, verification_status, profile_completeness, small_business, small_business_types, geographic_coverage, slug, naics_codes, description, website, capability_statement_path, address_line1, sam_uei"
    const perTradeLimit = Math.max(Math.ceil(500 / trades.length), 50)

    const tradeQueries = trades.map((trade: string) => {
      let q = supabase
        .from("master_subcontractors")
        .select(selectFields)
        .contains("trade_categories", [trade])
        .or("contact_email.not.is.null,contact_phone.not.is.null")

      // Apply location scope filter at DB level
      if (scopeStates && scopeStates.length > 0) {
        q = q.in("state", scopeStates)
      }

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

      // Location/proximity scoring (up to 30 points)
      let distanceMiles: number | null = null
      if (includesLocal && projectLat && projectLng) {
        if (!sub.zip_code) {
          // No zip code — can't determine distance
          if (!includesRegional && !includesNational) return null
        } else {
          const subZip = String(sub.zip_code).substring(0, 5)
          const subInfo = zipcodes.lookup(subZip)
          if (subInfo) {
            distanceMiles = zipcodes.distance(String(project_zip).substring(0, 5), subZip) ?? null
            if (distanceMiles !== null && distanceMiles <= radiusMiles) {
              // Within local radius — high proximity bonus
              const proximityBonus = Math.round(30 * (1 - distanceMiles / radiusMiles))
              score += Math.max(proximityBonus, 10)
              reasons.push(`${Math.round(distanceMiles)} mi away`)
            } else if (!includesRegional && !includesNational) {
              // Local only and sub is outside radius — skip
              return null
            }
          } else if (!includesRegional && !includesNational) {
            return null // Invalid zip, local-only = skip
          }
        }
      }
      if (states && states.length > 0) {
        if (states.includes(sub.state)) {
          score += 15
          reasons.push(`Located in ${sub.state}`)
        }
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
        distance_miles: distanceMiles,
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
      location_scope: scopes,
      radius_miles: includesLocal ? radiusMiles : undefined,
      scope_states: scopeStates,
    }), { headers })
  }

  // --- ACTION: invite-all ---
  // Send RFQ invitation emails to matched subs with portal access + delivery tracking
  if (action === "invite-all") {
    const { sub_ids, task_order_id, rfq_title, rfq_description, prime_company, due_date, rfq_template, rfq_subject, custom_message, project_data } = body

    if (!sub_ids || !Array.isArray(sub_ids) || sub_ids.length === 0) {
      return new Response(JSON.stringify({ error: "sub_ids required" }), { status: 400, headers })
    }

    initSendGrid()
    const siteUrl = process.env.URL || "https://procuvex.com"

    // Look up org name and org_id for sender
    let orgName = prime_company || "Procuvex"
    let orgId: string | null = null
    if (callerId) {
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", callerId).single()
      if (profile?.org_id) {
        orgId = profile.org_id
        const { data: org } = await supabase.from("organizations").select("name").eq("id", profile.org_id).single()
        if (org?.name) orgName = org.name
      }
    }

    const { data: subs } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_name, contact_email, trade_categories, state, city, zip_code")
      .in("id", sub_ids)
      .not("contact_email", "is", null)

    // Load SOW items for portal token generation when task_order_id is provided
    let sowItems: { id: string; service_category: string; sow_name: string; description: string | null }[] = []
    if (task_order_id) {
      const { data } = await supabase
        .from("sow_items")
        .select("id, service_category, sow_name, description")
        .eq("task_order_id", task_order_id)
      sowItems = data || []
    }

    let sent = 0
    let failed = 0

    // Merge field values from project data
    const proj = project_data || {}
    const mergeBase: Record<string, string> = {
      "{org_name}": orgName,
      "{task_order_title}": proj.title || rfq_title || "",
      "{sow_name}": proj.sow_categories || "",
      "{service_category}": proj.sow_categories || "",
      "{site_name}": proj.site_name || "",
      "{location_city}": proj.location_city || "",
      "{location_state}": proj.location_state || "",
      "{due_date}": proj.due_date
        ? new Date(proj.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : due_date || "TBD",
      "{solicitation_number}": proj.solicitation_number || "",
    }

    for (const sub of subs || []) {
      try {
        // Per-sub merge fields
        const mergeFields = {
          ...mergeBase,
          "{contact_name}": sub.contact_name || sub.company_name,
        }

        // Generate portal token if we have a task_order_id and SOW items
        let portalUrl = `${siteUrl}/my-sub-profile`
        let portalToken: string | null = null
        let sowSubId: string | null = null

        if (task_order_id && sowItems.length > 0) {
          // Find or create a subcontractors record for this master sub
          const { data: existingSub } = await supabase
            .from("subcontractors")
            .select("id")
            .eq("contact_email", sub.contact_email)
            .limit(1)
            .single()

          let subId = existingSub?.id
          if (!subId) {
            const { data: newSub } = await supabase
              .from("subcontractors")
              .insert({
                company_name: sub.company_name,
                contact_name: sub.contact_name,
                contact_email: sub.contact_email,
                service_categories: sub.trade_categories || [],
                geographic_coverage: [sub.state, sub.city].filter(Boolean),
              })
              .select("id")
              .single()
            subId = newSub?.id
          }

          if (subId) {
            // Match sub to the best SOW item using smart trade-to-SOW matching
            const subTrades = sub.trade_categories || []
            const matchedSow = matchSubTradeToSow(subTrades, sowItems)

            if (matchedSow) {
              // Create sow_subcontractor entry (upsert)
              const { data: existingSowSub } = await supabase
                .from("sow_subcontractors")
                .select("id")
                .eq("sow_item_id", matchedSow.id)
                .eq("subcontractor_id", subId)
                .single()

              let currentSowSubId = existingSowSub?.id
              if (!currentSowSubId) {
                const { data: newSowSub } = await supabase
                  .from("sow_subcontractors")
                  .insert({
                    sow_item_id: matchedSow.id,
                    subcontractor_id: subId,
                    match_score: 80,
                    outreach_status: "invited",
                    rfq_sent_date: new Date().toISOString(),
                  })
                  .select("id")
                  .single()
                currentSowSubId = newSowSub?.id
              } else {
                await supabase
                  .from("sow_subcontractors")
                  .update({ outreach_status: "invited", rfq_sent_date: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq("id", currentSowSubId)
              }

              sowSubId = currentSowSubId || null

              // Generate portal token tied to the matched SOW
              if (currentSowSubId) {
                const token = generatePortalToken()
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 365)

                const { error: tokenErr } = await supabase.from("rfq_tokens").insert({
                  token,
                  sow_subcontractor_id: currentSowSubId,
                  sow_item_id: matchedSow.id,
                  task_order_id,
                  subcontractor_id: subId,
                  expires_at: expiresAt.toISOString(),
                })

                if (!tokenErr) {
                  portalUrl = `${siteUrl}/portal/${token}`
                  portalToken = token
                }
              }
            }
            // No match: sub's trade doesn't align with any SOW — they still
            // get the email with a /my-sub-profile link, but are NOT assigned
            // to a random SOW they aren't qualified for.
          }
        }

        // Render template or use default
        let emailBody = ""
        if (rfq_template) {
          let rendered = rfq_template
          for (const [key, val] of Object.entries(mergeFields)) {
            rendered = rendered.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), val)
          }
          emailBody = rendered
            .split("\n")
            .map((line: string) => {
              const boldReplaced = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
              return `<p style="margin: 4px 0; font-size: 14px; color: #374151;">${boldReplaced || "&nbsp;"}</p>`
            })
            .join("\n")
        }

        const customMsgHtml = custom_message
          ? `<div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0; font-size: 14px;"><strong>Note from the team:</strong><br/>${custom_message}</div>`
          : ""

        const ctaLabel = portalToken ? "View RFQ & Submit Quote" : "View Details & Respond"
        const emailHtml = rfq_template
          ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Request for Quote</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">On behalf of ${orgName}</p>
              </div>
              <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
                ${emailBody}
                ${customMsgHtml}
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${portalUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                    ${ctaLabel}
                  </a>
                </div>
                ${portalToken ? '<p style="font-size: 12px; color: #6b7280; text-align: center;">This link is unique to your organization and will remain active for the duration of this project.</p>' : ""}
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Delivered on behalf of ${orgName}<br/>Powered by Procuvex</p>
              </div>
            </div>`
          : buildRfqInviteEmail(sub.company_name, rfq_title, rfq_description, orgName, due_date, portalUrl, !!portalToken)

        const subjectLine = rfq_subject
          ? rfq_subject.replace(/\{contact_name\}/g, sub.contact_name || sub.company_name)
          : `New Opportunity: ${rfq_title || "RFQ Invitation"}`

        // Fix 3: Send with tracking customArgs so SendGrid webhook can track delivery/bounce
        const [response] = await sgMail.default.send({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: orgName },
          subject: subjectLine,
          html: emailHtml,
          text: htmlToPlainText(emailHtml),
          trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
          customArgs: {
            email_type: "rfq_invite",
            ...(sowSubId ? { sow_subcontractor_id: sowSubId } : {}),
            ...(portalToken ? { rfq_token: portalToken } : {}),
            ...(task_order_id ? { task_order_id } : {}),
            ...(orgId ? { org_id: orgId } : {}),
          },
          headers: {
            "List-Unsubscribe": `<mailto:team@procuvex.com?subject=Unsubscribe%20RFQ%20${encodeURIComponent(sub.contact_email!)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })

        // Fix 3: Log email tracking event for delivery monitoring
        if (sowSubId) {
          await supabase.from("email_tracking").insert({
            rfq_token_id: portalToken || null,
            sow_subcontractor_id: sowSubId,
            sendgrid_message_id: response?.headers?.["x-message-id"] || null,
            event_type: "sent",
            email_to: sub.contact_email,
            email_subject: subjectLine,
          })
        }

        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: sub.id,
          contact_type: "rfq_invite",
          contact_method: "email",
          subject: subjectLine,
          notes: `From ${orgName}${portalToken ? " (portal link included)" : ""}`,
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

function generatePortalToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function buildRfqInviteEmail(companyName: string, title: string, description: string, primeCompany: string, dueDate: string, portalUrl?: string, hasPortal?: boolean): string {
  const ctaUrl = portalUrl || "https://procuvex.com/my-sub-profile"
  const ctaLabel = hasPortal ? "View RFQ & Submit Quote" : "View Details & Respond"
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
          <a href="${ctaUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            ${ctaLabel}
          </a>
        </div>
        ${hasPortal ? '<p style="font-size: 12px; color: #6b7280; text-align: center;">This link is unique to your organization and will remain active for the duration of this project.</p>' : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex — A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}
