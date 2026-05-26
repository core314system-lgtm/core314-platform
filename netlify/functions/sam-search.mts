import type { Context } from "@netlify/functions"

/**
 * Netlify Function: Search SAM.gov Opportunities
 *
 * Uses the SAM.gov public search API (same API the SAM.gov website uses).
 * Search: https://sam.gov/api/prod/sgs/v1/search/?index=opp&...
 * Detail: https://sam.gov/api/prod/opps/v2/opportunities/{id}
 *
 * POST /api/sam-search
 * Body: { keyword, solicitationType?, naicsCode?, setAside?, activeOnly?, limit?, offset? }
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
      solicitationType,
      activeOnly = true,
      limit = 25,
      offset = 0,
    } = body

    // Build SAM.gov search URL (public search API used by sam.gov website)
    const searchUrl = new URL("https://sam.gov/api/prod/sgs/v1/search/")
    searchUrl.searchParams.set("index", "opp")
    searchUrl.searchParams.set("mode", "search")
    searchUrl.searchParams.set("responseType", "json")
    searchUrl.searchParams.set("size", String(limit))
    searchUrl.searchParams.set("page", String(Math.floor(offset / Math.max(limit, 1))))
    searchUrl.searchParams.set("sort", "-modifiedDate")

    // Build query string
    let q = keyword || "*"
    if (solicitationType) {
      const typeMap: Record<string, string> = {
        o: "Solicitation",
        p: "Presolicitation",
        k: "Combined Synopsis/Solicitation",
        r: "Sources Sought",
        s: "Special Notice",
        i: "Intent to Bundle",
      }
      const typeLabel = typeMap[solicitationType] || solicitationType
      q += ` AND type.value:("${typeLabel}")`
    }
    if (activeOnly) {
      q += " AND isActive:true"
    }
    searchUrl.searchParams.set("q", q)

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/hal+json" },
    })

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      return new Response(
        JSON.stringify({
          error: `SAM.gov search error (${searchRes.status}): ${errText || "Unknown error"}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    }

    const searchData = await searchRes.json()
    const results: SearchResult[] = searchData?._embedded?.results || []
    const totalRecords = searchData?.page?.totalElements || 0

    // Fetch details and attachment counts for each result (in parallel)
    const enrichPromises = results.slice(0, 10).map(async (r) => {
      const [detailRes, resourceRes] = await Promise.all([
        fetch(
          `https://sam.gov/api/prod/opps/v2/opportunities/${r._id}?responseType=json`,
          { headers: { Accept: "application/hal+json, application/json" } }
        ).catch(() => null),
        fetch(
          `https://sam.gov/api/prod/opps/v3/opportunities/${r._id}/resources?responseType=json`,
          { headers: { Accept: "application/hal+json, application/json" } }
        ).catch(() => null),
      ])

      let detail: DetailData | null = null
      if (detailRes && detailRes.ok) {
        try {
          const dj = await detailRes.json()
          detail = dj?.data2 as DetailData | null
        } catch { /* ignore */ }
      }

      let fileCount = 0
      let linkCount = 0
      if (resourceRes && resourceRes.ok) {
        try {
          const rj = await resourceRes.json()
          const lists = rj?._embedded?.opportunityAttachmentList || []
          for (const list of lists) {
            for (const att of list.attachments || []) {
              if (att.accessLevel !== "public") continue
              if (att.type === "file") fileCount++
              else if (att.type === "link") linkCount++
            }
          }
        } catch { /* ignore */ }
      }

      return { detail, fileCount, linkCount }
    })
    const enriched = await Promise.all(enrichPromises)

    // Normalize response
    const opportunities = results.map((r, i) => {
      const { detail, fileCount, linkCount } = enriched[i] || {}
      const agency = (r.organizationHierarchy || [])
        .sort((a, b) => a.level - b.level)
        .map((o) => o.name)
        .join(" > ")

      const description = (r.descriptions || [])
        .map((d) => d.content || "")
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .substring(0, 500)

      const naicsCode =
        detail?.naics?.[0]?.code?.[0] || ""
      const pop = detail?.placeOfPerformance
      const contacts = detail?.pointOfContact || []

      return {
        noticeId: r._id,
        title: r.title || "",
        solicitationNumber: r.solicitationNumber || "",
        agency,
        postedDate: r.publishDate || "",
        responseDeadline: r.responseDate || "",
        type: r.type?.value || "",
        setAside: null as string | null,
        naicsCode,
        classificationCode: detail?.classificationCode || "",
        active: r.isActive,
        description,
        uiLink: `https://sam.gov/opp/${r._id}/view`,
        placeOfPerformance: pop
          ? {
              city: pop.city?.code?.split(" - ")?.[1] || pop.city?.code || null,
              state: pop.state?.code || null,
            }
          : null,
        pointOfContact: contacts.slice(0, 2).map((poc) => ({
          name: poc.fullName || "",
          email: poc.email || "",
          phone: poc.phone || "",
        })),
        attachmentCounts: {
          files: fileCount || 0,
          links: linkCount || 0,
        },
      }
    })

    return new Response(
      JSON.stringify({ totalRecords, opportunities }),
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
