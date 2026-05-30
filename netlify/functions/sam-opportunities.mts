import type { Context } from "@netlify/functions"
import { resilientFetch } from "./_shared/resilience.ts"

/**
 * Netlify Function: SAM.gov Opportunity Discovery Feed
 *
 * Enhanced opportunity search with NAICS filtering, set-aside filtering,
 * response deadline filtering, and AI match scoring.
 *
 * Uses SAM.gov's public search API (same API the SAM.gov website uses).
 * No API key required.
 *
 * POST /api/sam-opportunities
 * Body: {
 *   naicsCodes?: string[],          // NAICS codes to filter by
 *   setAsides?: string[],           // Set-aside types to filter by
 *   keywords?: string[],            // Keywords to search for
 *   agencies?: string[],            // Agency names to filter by
 *   solicitationTypes?: string[],   // Procurement types (o, p, k, r, s, i)
 *   states?: string[],              // Place of performance states
 *   activeOnly?: boolean,           // Only active opportunities (default true)
 *   postedWithinDays?: number,      // Only opportunities posted within N days
 *   deadlineWithinDays?: number,    // Only opportunities with deadline within N days
 *   minDollarValue?: number,        // Minimum estimated value
 *   maxDollarValue?: number,        // Maximum estimated value
 *   limit?: number,                 // Results per page (max 50)
 *   offset?: number,                // Pagination offset
 *   sortBy?: string,                // Sort field: modifiedDate, postedDate, responseDate
 * }
 */

interface SearchResult {
  _id: string
  title: string
  solicitationNumber: string
  publishDate: string
  responseDate: string | null
  isActive: boolean
  type: { code: string; value: string }
  descriptions: Array<{ content: string }>
  organizationHierarchy: Array<{ name: string; level: number; type: string }>
  award: { awardee: { name: string | null } } | null
  modifications: { count: number }
  setAside?: string | null
  setAsideDescription?: string | null
}

interface DetailData {
  naics?: Array<{ code: string[]; type: string }>
  title?: string
  solicitationNumber?: string
  classificationCode?: string
  placeOfPerformance?: {
    city?: { code: string } | null
    state?: { code: string; name: string } | null
    country?: { code: string; name: string } | null
  }
  pointOfContact?: Array<{
    fullName: string
    email: string
    phone: string
    type: string
  }>
  type?: { value: string }
  award?: {
    amount?: string
    date?: string
    awardee?: { name?: string }
  }
  description?: Array<{ body?: string }>
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  }

  try {
    const body = await req.json()
    const {
      naicsCodes = [],
      setAsides = [],
      keywords = [],
      agencies = [],
      solicitationTypes = [],
      states = [],
      activeOnly = true,
      postedWithinDays,
      deadlineWithinDays,
      limit = 25,
      offset = 0,
      sortBy = "modifiedDate",
    } = body

    const effectiveLimit = Math.min(limit, 50)

    // Build SAM.gov search URL
    const searchUrl = new URL("https://sam.gov/api/prod/sgs/v1/search/")
    searchUrl.searchParams.set("index", "opp")
    searchUrl.searchParams.set("mode", "search")
    searchUrl.searchParams.set("responseType", "json")
    searchUrl.searchParams.set("size", String(effectiveLimit))
    searchUrl.searchParams.set("page", String(Math.floor(offset / Math.max(effectiveLimit, 1))))
    searchUrl.searchParams.set("sort", `-${sortBy}`)

    // Build query
    const queryParts: string[] = []

    // Keywords
    if (keywords.length > 0) {
      queryParts.push(`(${keywords.map((k: string) => `"${k}"`).join(" OR ")})`)
    }

    // NAICS codes
    if (naicsCodes.length > 0) {
      const naicsQuery = naicsCodes.map((n: string) => `naicsCode:${n}`).join(" OR ")
      queryParts.push(`(${naicsQuery})`)
    }

    // Solicitation types
    if (solicitationTypes.length > 0) {
      const typeMap: Record<string, string> = {
        o: "Solicitation",
        p: "Presolicitation",
        k: "Combined Synopsis/Solicitation",
        r: "Sources Sought",
        s: "Special Notice",
        i: "Intent to Bundle",
        a: "Award Notice",
        u: "Justification",
      }
      const typeLabels = solicitationTypes
        .map((t: string) => typeMap[t] || t)
        .map((t: string) => `"${t}"`)
      queryParts.push(`type.value:(${typeLabels.join(" OR ")})`)
    }

    // Set-asides
    if (setAsides.length > 0) {
      const setAsideMap: Record<string, string> = {
        SBA: "Total Small Business Set-Aside",
        SBP: "Partial Small Business Set-Aside",
        "8A": "8(a) Set-Aside",
        "8AN": "8(a) Sole Source",
        HZC: "HUBZone Set-Aside",
        HZS: "HUBZone Sole Source",
        SDVOSBC: "Service-Disabled Veteran-Owned Small Business Set-Aside",
        SDVOSBS: "Service-Disabled Veteran-Owned Small Business Sole Source",
        WOSB: "Women-Owned Small Business",
        WOSBSS: "Women-Owned Small Business Sole Source",
        EDWOSB: "Economically Disadvantaged WOSB",
        EDWOSBSS: "Economically Disadvantaged WOSB Sole Source",
        VSA: "Veteran-Owned Small Business Set-Aside",
      }
      const saLabels = setAsides
        .map((s: string) => setAsideMap[s] || s)
        .map((s: string) => `"${s}"`)
      queryParts.push(`setAsideDescription:(${saLabels.join(" OR ")})`)
    }

    // Agency names
    if (agencies.length > 0) {
      const agencyQuery = agencies.map((a: string) => `"${a}"`).join(" OR ")
      queryParts.push(`organizationHierarchy.name:(${agencyQuery})`)
    }

    // States
    if (states.length > 0) {
      const stateQuery = states.map((s: string) => `"${s}"`).join(" OR ")
      queryParts.push(`placeOfPerformance.state.code:(${stateQuery})`)
    }

    // Active only
    if (activeOnly) {
      queryParts.push("isActive:true")
    }

    const q = queryParts.length > 0 ? queryParts.join(" AND ") : "*"
    searchUrl.searchParams.set("q", q)

    // Date filters
    if (postedWithinDays) {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - postedWithinDays)
      searchUrl.searchParams.set("qFilters", `publishDate:[${fromDate.toISOString()} TO *]`)
    }

    const searchRes = await resilientFetch(searchUrl.toString(), {
      headers: { Accept: "application/hal+json" },
      signal: AbortSignal.timeout(15000),
    }, { maxRetries: 2, baseDelayMs: 1000 })

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      return new Response(
        JSON.stringify({ error: `SAM.gov search error (${searchRes.status}): ${errText || "Unknown error"}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      )
    }

    const searchData = await searchRes.json()
    const results: SearchResult[] = searchData?._embedded?.results || []
    const totalRecords = searchData?.page?.totalElements || 0

    // Fetch details for each result (in parallel, up to 15)
    const enrichPromises = results.slice(0, 15).map(async (r) => {
      try {
        const detailRes = await resilientFetch(
          `https://sam.gov/api/prod/opps/v2/opportunities/${r._id}?responseType=json`,
          { headers: { Accept: "application/hal+json, application/json" }, signal: AbortSignal.timeout(10000) },
          { maxRetries: 1, baseDelayMs: 500 }
        )
        if (detailRes.ok) {
          const dj = await detailRes.json()
          return dj?.data2 as DetailData | null
        }
      } catch { /* ignore detail fetch errors */ }
      return null
    })
    const enriched = await Promise.all(enrichPromises)

    // Normalize response
    const opportunities = results.map((r, i) => {
      const detail = enriched[i]
      const agency = (r.organizationHierarchy || [])
        .sort((a, b) => a.level - b.level)
        .map((o) => o.name)
        .join(" > ")

      const description = (r.descriptions || [])
        .map((d) => d.content || "")
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .substring(0, 800)

      const naicsCode = detail?.naics?.[0]?.code?.[0] || ""
      const pop = detail?.placeOfPerformance
      const contacts = detail?.pointOfContact || []

      // Calculate urgency based on response deadline
      let daysUntilDeadline: number | null = null
      let urgency: "expired" | "critical" | "urgent" | "normal" | "relaxed" = "normal"
      if (r.responseDate) {
        const deadline = new Date(r.responseDate)
        const now = new Date()
        daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilDeadline < 0) urgency = "expired"
        else if (daysUntilDeadline <= 3) urgency = "critical"
        else if (daysUntilDeadline <= 7) urgency = "urgent"
        else if (daysUntilDeadline <= 14) urgency = "normal"
        else urgency = "relaxed"
      }

      return {
        noticeId: r._id,
        title: r.title || "",
        solicitationNumber: r.solicitationNumber || "",
        agency,
        postedDate: r.publishDate || "",
        responseDeadline: r.responseDate || "",
        daysUntilDeadline,
        urgency,
        type: r.type?.value || "",
        typeCode: r.type?.code || "",
        setAside: r.setAsideDescription || r.setAside || null,
        naicsCode,
        classificationCode: detail?.classificationCode || "",
        active: r.isActive,
        description,
        uiLink: `https://sam.gov/opp/${r._id}/view`,
        placeOfPerformance: pop
          ? {
              city: pop.city?.code?.split(" - ")?.[1] || pop.city?.code || null,
              state: pop.state?.code || null,
              stateName: pop.state?.name || null,
            }
          : null,
        pointOfContact: contacts.slice(0, 2).map((poc) => ({
          name: poc.fullName || "",
          email: poc.email || "",
          phone: poc.phone || "",
        })),
      }
    })

    // Filter by deadline if requested
    let filteredOpps = opportunities
    if (deadlineWithinDays) {
      filteredOpps = opportunities.filter(
        (o) => o.daysUntilDeadline !== null && o.daysUntilDeadline >= 0 && o.daysUntilDeadline <= deadlineWithinDays
      )
    }

    return new Response(
      JSON.stringify({
        totalRecords,
        filteredCount: filteredOpps.length,
        opportunities: filteredOpps,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  }
}

export const config = {
  path: "/api/sam-opportunities",
}
