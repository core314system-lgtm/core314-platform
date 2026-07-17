import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { descriptionToTrades } from "./_shared/tradeMatching.ts"

/**
 * SBS (Small Business Source) Data Import
 *
 * Imports subcontractor data from an SBS Excel/CSV export.
 * Expected columns (order matters, mapped by index):
 *   0: Business name
 *   1: Capabilities 1 (trade/service description)
 *   2: Capabilities 2 (additional capabilities)
 *   3: Active SBA designations (e.g., WOSB, SDVOSB, 8(a))
 *   4: Contact person name
 *   5: Contact person email
 *   6: Address line 1
 *   7: Address line 2
 *   8: City
 *   9: State
 *  10: Zipcode
 *
 * POST body: { rows: string[][], dryRun?: boolean }
 * Client-side parses Excel → sends row arrays to this function in batches.
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Map capability text (SBS columns) to canonical trade categories using the
// shared word-boundary matcher. When nothing matches we store null rather than
// dumping raw capability text into trade_categories (which produced junk,
// non-canonical trade names that never matched the trade filter).
function capabilitiesToTrades(cap1: string, cap2: string): string[] {
  return descriptionToTrades(`${cap1} ${cap2}`)
}

function parseSbaTypes(sbaText: string): string[] {
  if (!sbaText) return []
  const types: string[] = []
  const upper = sbaText.toUpperCase().trim()
  if (upper.includes('WOSB') || upper.includes('WOMAN')) types.push('WOSB')
  if (upper.includes('SDVOSB') || upper.includes('SERVICE DISABLED')) types.push('SDVOSB')
  if (upper.includes('VOSB') || upper.includes('VETERAN')) {
    if (!types.includes('SDVOSB')) types.push('VOSB')
  }
  if (upper.includes('8(A)') || upper.includes('8A')) types.push('8(a)')
  if (upper.includes('HUBZONE') || upper.includes('HUB ZONE')) types.push('HUBZone')
  if (upper.includes('SDB') || upper.includes('SMALL DISADVANTAGED')) types.push('SDB')
  if (upper.includes('EDWOSB') || upper.includes('ECONOMICALLY DISADVANTAGED')) types.push('EDWOSB')
  // If we didn't match any known type but there's text, add it raw
  if (types.length === 0 && upper.length > 0) {
    types.push(upper)
  }
  return [...new Set(types)]
}

// Full state name → abbreviation
const STATE_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
  'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR', 'guam': 'GU',
  'american samoa': 'AS', 'u.s. virgin islands': 'VI', 'northern mariana islands': 'MP',
}

function normalizeState(raw: string): string {
  const trimmed = raw.trim()
  // Already an abbreviation
  if (trimmed.length === 2) return trimmed.toUpperCase()
  // Full name lookup
  return STATE_ABBREV[trimmed.toLowerCase()] || trimmed.toUpperCase().substring(0, 2)
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

function calculateCompleteness(fields: Record<string, any>): number {
  const weights: Record<string, number> = {
    company_name: 15, contact_email: 15, contact_phone: 10,
    city: 10, state: 10, trade_categories: 15, website: 10,
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
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const headers = { "Content-Type": "application/json", ...corsHeaders }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers })
  }

  try {
    const body = await req.json()
    const { rows, dryRun, columnMap } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), { status: 400, headers })
    }

    // Column mapping — default to SBS export format
    // 0: Business name, 1: Capabilities narrative, 2: Capabilities statement link,
    // 3: Active SBA certifications, 4: Contact person, 5: Contact email,
    // 6: Address line 1, 7: Address line 2, 8: City, 9: State, 10: Zipcode
    const cols = columnMap || {
      business_name: 0,
      capabilities_1: 1,
      capabilities_link: 2,
      active_sba: 3,
      contact_person: 4,
      contact_email: 5,
      address_line1: 6,
      address_line2: 7,
      city: 8,
      state: 9,
      zipcode: 10,
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Targeted dedup: only query records matching company names in this batch
    // (instead of loading the entire 70K+ table which times out)
    const batchNames = [...new Set(
      rows.map((r: any) => (r[cols.business_name] || '').trim()).filter(Boolean)
    )]
    const existingMap = new Map<string, { id: string; slug: string; contact_email: string | null }>()

    // Query in chunks of 50 names (PostgREST URL length limits)
    for (let ci = 0; ci < batchNames.length; ci += 50) {
      const nameChunk = batchNames.slice(ci, ci + 50)
      const { data: matches } = await supabase
        .from('master_subcontractors')
        .select('id, company_name, state, slug, contact_email')
        .in('company_name', nameChunk)
        .limit(1000)
      if (matches) {
        for (const rec of matches) {
          const key = `${rec.company_name?.toLowerCase().trim()}|${rec.state?.toUpperCase().trim()}`
          existingMap.set(key, { id: rec.id, slug: rec.slug, contact_email: rec.contact_email })
        }
      }
    }

    const result = { imported: 0, updated: 0, skipped: 0, total: rows.length, errors: [] as string[] }
    const newRecords: any[] = []
    const updateRecords: { id: string; data: any }[] = []
    const preview: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const companyName = (row[cols.business_name] || '').trim()
      if (!companyName) {
        result.skipped++
        continue
      }

      const cap1 = (row[cols.capabilities_1] || '').trim()
      const capLink = (row[cols.capabilities_link] || '').trim()
      const sbaText = (row[cols.active_sba] || '').trim()
      const contactName = (row[cols.contact_person] || '').trim()
      const contactEmail = (row[cols.contact_email] || '').trim()
      const addr1 = (row[cols.address_line1] || '').trim()
      const addr2 = (row[cols.address_line2] || '').trim()
      const city = (row[cols.city] || '').trim()
      const state = normalizeState((row[cols.state] || '').trim())
      const zip = (row[cols.zipcode] || '').toString().trim()

      const trades = capabilitiesToTrades(cap1, '')
      const sbaTypes = parseSbaTypes(sbaText)
      const dedupKey = `${companyName.toLowerCase()}|${state}`
      const existing = existingMap.get(dedupKey)

      if (existing) {
        // Update existing record — merge all available data
        const updates: any = {}
        if (contactEmail && !existing.contact_email) {
          updates.contact_email = contactEmail
        }
        if (contactName) updates.contact_name = contactName
        if (trades.length > 0) { updates.trade_categories = trades; updates.service_categories = trades }
        if (sbaTypes.length > 0) {
          updates.small_business = true
          updates.small_business_types = sbaTypes
        }
        if (addr1) updates.address_line1 = addr1
        if (addr2) updates.address_line2 = addr2
        if (zip) updates.zip_code = zip
        if (cap1) updates.description = cap1
        if (capLink) {
          if (capLink.toLowerCase().endsWith('.pdf') || capLink.toLowerCase().includes('capability')) {
            updates.capability_statement_path = capLink
          } else if (capLink.startsWith('http')) {
            updates.website = capLink
          }
        }
        updates.data_source = 'import'

        // Recalculate completeness with merged data
        updates.profile_completeness = calculateCompleteness({
          company_name: companyName,
          contact_email: contactEmail || existing.contact_email,
          city,
          state,
          trade_categories: trades,
        })

        if (Object.keys(updates).length > 0) {
          updateRecords.push({ id: existing.id, data: updates })
        }
        continue
      }

      // New record — use timestamp-based slug to guarantee uniqueness without loading all slugs
      const baseSlug = generateSlug(companyName)
      const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`

      // Determine if capability link is a PDF/capability statement or a website
      let website: string | null = null
      let capStatementPath: string | null = null
      if (capLink) {
        if (capLink.toLowerCase().endsWith('.pdf') || capLink.toLowerCase().includes('capability')) {
          capStatementPath = capLink
        } else if (capLink.startsWith('http')) {
          website = capLink
        }
      }

      const record = {
        company_name: companyName,
        slug,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: null,
        website,
        capability_statement_path: capStatementPath,
        address_line1: addr1 || null,
        address_line2: addr2 || null,
        city: city || null,
        state: state || null,
        zip_code: zip || null,
        description: cap1 || null,
        trade_categories: trades.length > 0 ? trades : null,
        service_categories: trades.length > 0 ? trades : null,
        geographic_coverage: state ? [state] : [],
        small_business: sbaTypes.length > 0,
        small_business_types: sbaTypes,
        verification_status: 'unverified',
        data_source: 'import',
        profile_completeness: calculateCompleteness({
          company_name: companyName,
          contact_email: contactEmail,
          city,
          state,
          trade_categories: trades,
        }),
      }

      newRecords.push(record)

      if (dryRun && preview.length < 20) {
        preview.push(record)
      }
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        preview,
        summary: {
          total: rows.length,
          new_records: newRecords.length,
          updates: updateRecords.length,
          skipped: result.skipped,
        },
      }), { status: 200, headers })
    }

    // Batch insert new records
    if (newRecords.length > 0) {
      const batchSize = 50
      for (let i = 0; i < newRecords.length; i += batchSize) {
        const batch = newRecords.slice(i, i + batchSize)
        const { error } = await supabase
          .from('master_subcontractors')
          .insert(batch)

        if (error) {
          result.errors.push(`Insert batch ${Math.floor(i / batchSize)}: ${error.message}`)
        } else {
          result.imported += batch.length
        }
      }
    }

    // Batch update existing records
    if (updateRecords.length > 0) {
      for (const upd of updateRecords) {
        const { error } = await supabase
          .from('master_subcontractors')
          .update(upd.data)
          .eq('id', upd.id)

        if (error) {
          result.errors.push(`Update ${upd.id}: ${error.message}`)
        } else {
          result.updated++
        }
      }
    }

    return new Response(JSON.stringify(result), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Import failed" }), { status: 500, headers })
  }
}
