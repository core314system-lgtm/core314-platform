import type { Context } from "@netlify/functions"

/**
 * Netlify Function: Search SAM.gov Opportunities
 * 
 * Proxies requests to the SAM.gov Opportunities API (public, no key required for basic search).
 * https://open.gsa.gov/api/get-opportunities-public-api/
 * 
 * POST /api/sam-search
 * Body: { keyword, postedFrom?, postedTo?, solicitationType?, naicsCode?, setAside?, limit?, offset? }
 */

interface SamOpportunity {
  noticeId: string
  title: string
  solicitationNumber: string
  fullParentPathName: string
  postedDate: string
  responseDeadLine: string
  type: string
  typeOfSetAsideDescription: string | null
  naicsCode: string
  classificationCode: string
  active: string
  description: string
  organizationType: string
  uiLink: string
  officeAddress: {
    city: string
    state: string
    zipcode: string
  } | null
  placeOfPerformance: {
    city: { name: string } | null
    state: { code: string; name: string } | null
    country: { code: string } | null
  } | null
  pointOfContact: Array<{
    fullName: string
    email: string
    phone: string
    type: string
  }>
  award?: {
    awardee?: { name: string }
    amount?: string
    date?: string
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const {
      keyword = "",
      postedFrom,
      postedTo,
      solicitationType,
      naicsCode,
      setAside,
      limit = 25,
      offset = 0,
    } = body

    // Build SAM.gov API URL
    const samApiKey = process.env.SAM_GOV_API_KEY || ""
    const baseUrl = "https://api.sam.gov/opportunities/v2/search"

    const params = new URLSearchParams()
    if (keyword) params.set("keyword", keyword)

    // SAM.gov requires postedFrom and postedTo date range (MM/dd/yyyy)
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const formatDate = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`
    params.set("postedFrom", postedFrom || formatDate(sixMonthsAgo))
    params.set("postedTo", postedTo || formatDate(now))
    if (solicitationType) params.set("ptype", solicitationType)
    if (naicsCode) params.set("ncode", naicsCode)
    if (setAside) params.set("typeOfSetAside", setAside)
    params.set("limit", String(limit))
    params.set("offset", String(offset))

    // SAM.gov API key is optional for basic public data
    if (samApiKey) {
      params.set("api_key", samApiKey)
    }

    const url = `${baseUrl}?${params.toString()}`
    const samRes = await fetch(url, {
      headers: { Accept: "application/json" },
    })

    if (!samRes.ok) {
      const errText = await samRes.text()
      const errorMsg =
        samRes.status === 404
          ? "SAM.gov Opportunities API is currently unavailable (404). This may be a temporary outage — please try again later."
          : samRes.status === 429
            ? "SAM.gov rate limit exceeded. Please wait a few minutes and try again."
            : `SAM.gov API error (${samRes.status}): ${errText || "Unknown error"}`
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    }

    const samData = await samRes.json()

    // Normalize response
    const opportunities = (samData.opportunitiesData || []).map((opp: SamOpportunity) => ({
      noticeId: opp.noticeId || "",
      title: opp.title || "",
      solicitationNumber: opp.solicitationNumber || "",
      agency: opp.fullParentPathName || "",
      postedDate: opp.postedDate || "",
      responseDeadline: opp.responseDeadLine || "",
      type: opp.type || "",
      setAside: opp.typeOfSetAsideDescription || null,
      naicsCode: opp.naicsCode || "",
      classificationCode: opp.classificationCode || "",
      active: opp.active === "Yes",
      description: (opp.description || "").substring(0, 500),
      uiLink: opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`,
      placeOfPerformance: opp.placeOfPerformance
        ? {
            city: opp.placeOfPerformance.city?.name || null,
            state: opp.placeOfPerformance.state?.code || null,
          }
        : null,
      pointOfContact: (opp.pointOfContact || []).slice(0, 2).map((poc) => ({
        name: poc.fullName || "",
        email: poc.email || "",
        phone: poc.phone || "",
      })),
    }))

    return new Response(
      JSON.stringify({
        totalRecords: samData.totalRecords || 0,
        opportunities,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export const config = {
  path: "/api/sam-search",
}
