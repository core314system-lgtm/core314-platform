import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * SAM.gov Entity Import — Seeds the master subcontractor database.
 *
 * Uses SAM.gov Entity Management API v3 to search for registered entities.
 * API docs: https://open.gsa.gov/api/entity-api/
 * Free API key required: https://sam.gov/content/entity-information
 *
 * POST /api/sam-entity-import
 * Body: {
 *   naicsCodes?: string[],     // Filter by NAICS codes
 *   state?: string,            // Filter by state (2-letter)
 *   entityType?: string,       // Filter by entity type
 *   page?: number,             // Page number (0-based)
 *   size?: number,             // Page size (max 100)
 *   dryRun?: boolean,          // If true, don't insert, just return preview
 * }
 *
 * Uses the SAM.gov public website API as fallback (no key needed).
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const SAM_API_KEY = process.env.SAM_GOV_API_KEY || ""

// NAICS prefix → trade categories mapping (duplicated server-side for serverless)
const NAICS_TRADE_MAP: Record<string, string[]> = {
  '236': ['General Construction'], '237': ['General Construction', 'Paving & Asphalt'],
  '238110': ['Concrete & Masonry'], '238120': ['Structural Steel'],
  '238140': ['Concrete & Masonry'], '238150': ['Glass & Glazing'],
  '238160': ['Roofing'], '238170': ['Insulation'],
  '238210': ['Electrical'], '238220': ['Plumbing', 'HVAC', 'Fire & Life Safety'],
  '238290': ['Mechanical Services'], '238310': ['Drywall & Framing'],
  '238320': ['Painting & Coatings'], '238330': ['Flooring'],
  '238910': ['General Construction'], '238990': ['General Construction'],
  '333415': ['HVAC'], '333921': ['Elevator & Escalator'],
  '335311': ['Emergency Power'], '335312': ['Emergency Power'],
  '339950': ['Signage'],
  '541310': ['Architectural Services'], '541330': ['Engineering Services'],
  '541360': ['Surveying & Geotechnical'], '541380': ['Testing & Inspection'],
  '541511': ['IT & Telecommunications'], '541512': ['IT & Telecommunications'],
  '541611': ['Consulting'], '541620': ['Environmental Services'],
  '561210': ['Janitorial & Custodial'], '561320': ['Staffing & Labor'],
  '561710': ['Pest Control'], '561720': ['Janitorial & Custodial'],
  '561730': ['Landscaping & Grounds'],
  '562': ['Waste Management', 'Environmental Services'],
  '562910': ['Environmental Services'], '562991': ['Pest Control'],
  '611430': ['Training'], '722310': ['Food Services'],
}

function naicsToTrades(codes: string[]): string[] {
  const trades = new Set<string>()
  for (const code of codes) {
    const clean = code.replace(/\D/g, '')
    for (let len = clean.length; len >= 2; len--) {
      const prefix = clean.substring(0, len)
      if (NAICS_TRADE_MAP[prefix]) {
        NAICS_TRADE_MAP[prefix].forEach(t => trades.add(t))
        break
      }
    }
  }
  return Array.from(trades)
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

function extractSmallBizTypes(entity: any): string[] {
  const types: string[] = []
  const biz = entity?.businessTypes?.businessTypeList || []
  for (const bt of biz) {
    const code = bt?.businessTypeCode || ''
    const desc = (bt?.businessTypeDescription || '').toLowerCase()
    if (code === '27' || desc.includes('self-certified small disadvantaged')) types.push('SDB')
    if (code === 'A2' || desc.includes('woman owned')) types.push('WOSB')
    if (code === 'A5' || desc.includes('veteran owned')) types.push('VOSB')
    if (code === 'QF' || desc.includes('service disabled veteran')) types.push('SDVOSB')
    if (code === 'XX' || desc.includes('8(a)')) types.push('8(a)')
    if (code === 'A6' || desc.includes('hubzone')) types.push('HUBZone')
    if (desc.includes('economically disadvantaged woman')) types.push('EDWOSB')
  }
  return [...new Set(types)]
}

interface ImportResult {
  imported: number
  skipped: number
  total: number
  preview?: any[]
  errors: string[]
}

async function searchSamEntities(params: {
  naicsCodes?: string[]
  state?: string
  entityType?: string
  page?: number
  size?: number
}): Promise<{ entities: any[]; totalRecords: number }> {
  const { naicsCodes, state, page = 0, size = 100 } = params

  // Use SAM.gov public website search API (no key required)
  const searchUrl = new URL("https://sam.gov/api/prod/sgs/v1/search/")
  searchUrl.searchParams.set("index", "ent")
  searchUrl.searchParams.set("mode", "search")
  searchUrl.searchParams.set("responseType", "json")
  searchUrl.searchParams.set("size", String(Math.min(size, 100)))
  searchUrl.searchParams.set("page", String(page))

  let q = "isActive:true AND entityType:Entity"
  if (naicsCodes && naicsCodes.length > 0) {
    q += ` AND naicsCode:(${naicsCodes.join(' OR ')})`
  }
  if (state) {
    q += ` AND samAddress.stateOrProvince:${state}`
  }
  searchUrl.searchParams.set("q", q)

  const res = await fetch(searchUrl.toString(), {
    headers: { Accept: "application/json" },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`SAM.gov search failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const results = data?._embedded?.results || []
  const totalRecords = data?.page?.totalElements || 0

  return { entities: results, totalRecords }
}

function entityToRecord(entity: any, existingSlugs: Set<string>): any | null {
  const name = entity?.legalBusinessName || entity?.entityName || ''
  if (!name) return null

  // Extract email from POC if available
  const poc = entity?.pointsOfContact?.governmentBusinessPOC ||
              entity?.pointsOfContact?.electronicBusinessPOC || {}
  const email = poc?.email || null
  const contactName = [poc?.firstName, poc?.lastName].filter(Boolean).join(' ') || null
  const phone = poc?.USPhone || poc?.nonUSPhone || null

  // Extract address
  const addr = entity?.samAddress || entity?.physicalAddress || {}
  const city = addr?.city || null
  const stateCode = addr?.stateOrProvince || null
  const zip = addr?.zipCode || addr?.zip || null
  const addressLine = [addr?.addressLine1, addr?.addressLine2].filter(Boolean).join(', ') || null

  // Extract NAICS codes
  const naicsList = entity?.naics || entity?.naicsList || []
  const naicsCodes = naicsList.map((n: any) => n?.naicsCode || n?.code || '').filter(Boolean)

  // Extract SAM identifiers
  const uei = entity?.ueiSAM || entity?.uniqueEntityId || entity?.UEI || null
  const cage = entity?.cageCode || null

  // Skip if no UEI
  if (!uei) return null

  // Generate unique slug
  let baseSlug = generateSlug(name)
  let slug = baseSlug
  let counter = 1
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  existingSlugs.add(slug)

  // Map to trade categories
  const trades = naicsToTrades(naicsCodes)

  // Small business types
  const smallBizTypes = extractSmallBizTypes(entity)

  // Entity description
  const entityUrl = entity?.entityURL || null
  const regStatus = entity?.registrationStatus || entity?.samRegistrationStatus || 'Active'

  return {
    company_name: name,
    slug,
    contact_name: contactName,
    contact_email: email,
    contact_phone: phone,
    website: entityUrl,
    address_line1: addressLine,
    city,
    state: stateCode,
    zip_code: zip,
    description: entity?.entityDescription || null,
    sam_uei: uei,
    cage_code: cage,
    naics_codes: naicsCodes,
    service_categories: trades,
    trade_categories: trades,
    geographic_coverage: stateCode ? [stateCode] : [],
    small_business: smallBizTypes.length > 0,
    small_business_types: smallBizTypes,
    sam_registration_status: regStatus,
    entity_type: entity?.entityType || 'Business',
    verification_status: 'unverified',
    data_source: 'sam_gov',
    source_id: uei,
    profile_completeness: calculateCompleteness({
      company_name: name, contact_email: email, contact_phone: phone,
      city, state: stateCode, naics_codes: naicsCodes, website: entityUrl,
      description: entity?.entityDescription,
    }),
  }
}

function calculateCompleteness(fields: Record<string, any>): number {
  const weights: Record<string, number> = {
    company_name: 15, contact_email: 15, contact_phone: 10,
    city: 10, state: 10, naics_codes: 15, website: 10,
    description: 15,
  }
  let score = 0
  for (const [key, weight] of Object.entries(weights)) {
    const val = fields[key]
    if (val && (Array.isArray(val) ? val.length > 0 : String(val).length > 0)) {
      score += weight
    }
  }
  return score
}

export default async (req: Request, _context: Context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  // Auth check
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const body = await req.json()
    const { naicsCodes, state, page = 0, size = 25, dryRun = false } = body

    // Search SAM.gov for entities
    const { entities, totalRecords } = await searchSamEntities({
      naicsCodes, state, page, size,
    })

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get existing UEIs to avoid duplicates
    const { data: existingUeis } = await supabase
      .from('master_subcontractors')
      .select('sam_uei, slug')

    const existingUeiSet = new Set((existingUeis || []).map(r => r.sam_uei))
    const existingSlugs = new Set((existingUeis || []).map(r => r.slug))

    // Convert entities to records
    const result: ImportResult = { imported: 0, skipped: 0, total: entities.length, errors: [] }
    const records: any[] = []

    for (const entity of entities) {
      const record = entityToRecord(entity, existingSlugs)
      if (!record) {
        result.skipped++
        continue
      }
      if (existingUeiSet.has(record.sam_uei)) {
        result.skipped++
        continue
      }
      records.push(record)
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        ...result,
        imported: records.length,
        totalRecords,
        preview: records.slice(0, 10),
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Batch insert (upsert by sam_uei)
    if (records.length > 0) {
      const batchSize = 50
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        const { error } = await supabase
          .from('master_subcontractors')
          .upsert(batch, { onConflict: 'sam_uei', ignoreDuplicates: true })

        if (error) {
          result.errors.push(`Batch ${Math.floor(i / batchSize)}: ${error.message}`)
        } else {
          result.imported += batch.length
        }
      }
    }

    return new Response(JSON.stringify({
      ...result,
      totalRecords,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}

export const config = {
  path: "/api/sam-entity-import",
}
