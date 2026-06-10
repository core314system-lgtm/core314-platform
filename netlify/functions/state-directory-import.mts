import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * State DBE/HUB/MBE/WBE Directory Import
 * 
 * Downloads and imports contractor data from state government directories.
 * Currently supported sources:
 *   - texas_hub: Texas HUBs (Historically Underutilized Businesses)
 *   - texas_cmbl: Texas CMBL (Centralized Master Bidders List)
 * 
 * POST body: { source: string, dryRun?: boolean, maxRecords?: number }
 * 
 * GET ?action=sources  → list available sources with metadata
 * GET ?action=status   → show last import stats per source
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

// ─── Source Definitions ─────────────────────────────────────────────────────

interface SourceConfig {
  name: string
  description: string
  url: string
  state: string
  dataSource: string
  recordCount?: string
  parseRow: (row: string[], headers: string[]) => Record<string, any> | null
}

const SOURCES: Record<string, SourceConfig> = {
  texas_hub: {
    name: "Texas HUB Directory",
    description: "Historically Underutilized Businesses certified by Texas Comptroller. Includes minority, women, veteran-owned firms.",
    url: "https://comptroller.texas.gov/auto-data/purchasing/hub_name.csv",
    state: "TX",
    dataSource: "texas_hub",
    recordCount: "~15,000",
    parseRow: parseTexasHubRow,
  },
  texas_cmbl: {
    name: "Texas CMBL Directory",
    description: "Centralized Master Bidders List — all active vendors registered to bid on Texas state contracts.",
    url: "https://comptroller.texas.gov/auto-data/purchasing/web_name.csv",
    state: "TX",
    dataSource: "texas_cmbl",
    recordCount: "~12,000",
    parseRow: parseTexasCmblRow,
  },
}

// ─── Trade Category Mapping ─────────────────────────────────────────────────

const CAPABILITY_TRADE_MAP: Record<string, string[]> = {
  'hvac': ['HVAC'], 'heating': ['HVAC'], 'ventilation': ['HVAC'], 'air conditioning': ['HVAC'],
  'electrical': ['Electrical'], 'plumbing': ['Plumbing'],
  'fire': ['Fire & Life Safety'], 'sprinkler': ['Fire & Life Safety'], 'fire alarm': ['Fire & Life Safety'],
  'elevator': ['Elevator & Escalator'], 'escalator': ['Elevator & Escalator'],
  'janitorial': ['Janitorial & Custodial'], 'custodial': ['Janitorial & Custodial'], 'cleaning': ['Janitorial & Custodial'],
  'landscaping': ['Landscaping & Grounds'], 'lawn': ['Landscaping & Grounds'], 'grounds': ['Landscaping & Grounds'],
  'pest control': ['Pest Control'], 'extermination': ['Pest Control'],
  'roofing': ['Roofing'], 'roof': ['Roofing'],
  'painting': ['Painting & Coatings'], 'coatings': ['Painting & Coatings'],
  'flooring': ['Flooring'], 'carpet': ['Flooring'], 'tile': ['Flooring'],
  'security': ['Security Systems'], 'cctv': ['Security Systems'], 'access control': ['Security Systems'], 'guard': ['Security Systems'],
  'general contractor': ['General Construction'], 'construction': ['General Construction'],
  'demolition': ['Demolition'],
  'concrete': ['Concrete & Masonry'], 'masonry': ['Concrete & Masonry'],
  'steel': ['Structural Steel'], 'fabrication': ['Structural Steel'],
  'environmental': ['Environmental Services'], 'remediation': ['Environmental Services'], 'hazmat': ['Environmental Services'],
  'asbestos': ['Abatement'], 'abatement': ['Abatement'], 'lead': ['Abatement'], 'mold': ['Abatement'],
  'waste': ['Waste Management'], 'trash': ['Waste Management'], 'recycling': ['Waste Management'],
  'it ': ['IT & Telecommunications'], 'telecom': ['IT & Telecommunications'], 'networking': ['IT & Telecommunications'],
  'cabling': ['IT & Telecommunications'], 'fiber optic': ['IT & Telecommunications'],
  'building automation': ['Building Automation'], 'controls': ['Building Automation'],
  'generator': ['Emergency Power'], 'emergency power': ['Emergency Power'],
  'glass': ['Glass & Glazing'], 'glazing': ['Glass & Glazing'], 'window': ['Glass & Glazing'],
  'insulation': ['Insulation'],
  'drywall': ['Drywall & Framing'], 'framing': ['Drywall & Framing'], 'ceiling': ['Drywall & Framing'],
  'mechanical': ['Mechanical Services'], 'piping': ['Mechanical Services'],
  'welding': ['Welding & Metal Work'], 'metal work': ['Welding & Metal Work'],
  'paving': ['Paving & Asphalt'], 'asphalt': ['Paving & Asphalt'], 'striping': ['Paving & Asphalt'],
  'fencing': ['Fencing'], 'fence': ['Fencing'],
  'signage': ['Signage'], 'sign': ['Signage'],
  'food service': ['Food Services'], 'catering': ['Food Services'],
  'moving': ['Moving & Logistics'], 'relocation': ['Moving & Logistics'], 'logistics': ['Moving & Logistics'],
  'furniture': ['Furniture & Installation'],
  'engineering': ['Engineering Services'], 'civil': ['Engineering Services'],
  'architect': ['Architectural Services'], 'design': ['Architectural Services'],
  'survey': ['Surveying & Geotechnical'], 'geotechnical': ['Surveying & Geotechnical'],
  'waterproofing': ['Waterproofing'],
  'solar': ['Electrical'],
  'testing': ['Testing & Inspection'], 'inspection': ['Testing & Inspection'],
  'staffing': ['Staffing & Labor'], 'labor': ['Staffing & Labor'],
  'consulting': ['Consulting'], 'management': ['Consulting'],
  'insurance': ['Insurance & Bonds'], 'bonding': ['Insurance & Bonds'],
  'accounting': ['Professional Services'], 'legal': ['Professional Services'],
  'printing': ['Printing & Reproduction'], 'copying': ['Printing & Reproduction'],
  'courier': ['Moving & Logistics'], 'delivery': ['Moving & Logistics'],
  'medical': ['Medical & Health Services'], 'health': ['Medical & Health Services'],
}

function descriptionToTrades(description: string): string[] {
  if (!description) return []
  const trades = new Set<string>()
  const lower = description.toLowerCase()
  for (const [keyword, tradeList] of Object.entries(CAPABILITY_TRADE_MAP)) {
    if (lower.includes(keyword)) {
      tradeList.forEach(t => trades.add(t))
    }
  }
  return [...trades]
}

// ─── Texas HUB Eligibility Codes ────────────────────────────────────────────

const TX_ELIGIBILITY_MAP: Record<string, string[]> = {
  'BL': ['African American'],
  'HI': ['Hispanic'],
  'AI': ['Native American'],
  'AS': ['Asian Pacific American'],
  'WO': ['Women-Owned'],
  'DV': ['Disabled Veteran'],
  'NP': ['Non-Profit'],
}

function texasEligibilityToTypes(code: string, gender: string): string[] {
  const types: string[] = ['HUB']
  const eligTypes = TX_ELIGIBILITY_MAP[code.trim().toUpperCase()] || []
  types.push(...eligTypes)
  if (gender === 'F') types.push('Women-Owned')
  return [...new Set(types)]
}

// ─── Row Parsers ────────────────────────────────────────────────────────────

/**
 * Texas HUB CSV columns:
 * VENDOR ID NUMBER, VENDOR NAME, VENDOR ADDRESS LINE 1, VENDOR ADDRESS LINE 2,
 * CITY, STATE, ZIP CODE, FOREIGN ADDRESS, PHONE NUMBER, FAX NUMBER, GENDER,
 * ELIGIBILITY CODE, STATUS CODE, COUNTY, BUSINESS DESCRIPTION, VENDOR NUMBER,
 * EXPIRATION DATE, CONTACT NAME, TEXAS OFFICE FLAG, INTERNET ADDRESS,
 * QISV FLAG, SDV FLAG, SMALL BUSINESS FLAG
 */
function parseTexasHubRow(fields: string[], _headers: string[]): Record<string, any> | null {
  if (fields.length < 20) return null
  
  const vendorId = cleanField(fields[0])
  const companyName = cleanField(fields[1])
  const address1 = cleanField(fields[2])
  const address2 = cleanField(fields[3])
  const city = cleanField(fields[4])
  const state = cleanField(fields[5])
  const zip = cleanField(fields[6])
  const phone = cleanField(fields[8])
  const gender = cleanField(fields[10])
  const eligibilityCode = cleanField(fields[11])
  const statusCode = cleanField(fields[12])
  const county = cleanField(fields[13])
  const description = cleanField(fields[14])
  const expirationDate = cleanField(fields[16])
  const contactName = cleanField(fields[17])
  const email = cleanField(fields[19])
  const sdvFlag = cleanField(fields[21])

  // Skip inactive records
  if (statusCode && statusCode !== 'A') return null
  
  // Must have company name
  if (!companyName) return null

  const trades = descriptionToTrades(description)
  const smallBizTypes = texasEligibilityToTypes(eligibilityCode, gender)
  if (sdvFlag === 'Y' && !smallBizTypes.includes('Disabled Veteran')) {
    smallBizTypes.push('Service-Disabled Veteran')
  }

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contactName || null,
    address: [address1, address2].filter(Boolean).join(', ') || null,
    city: city || null,
    state: state || 'TX',
    zip_code: zip || null,
    county: county || null,
    description: description || null,
    trade_categories: trades.length > 0 ? trades : null,
    small_business_types: smallBizTypes,
    data_source: 'texas_hub',
    external_id: vendorId || null,
    expiration_date: parseDate(expirationDate),
  }
}

/**
 * Texas CMBL uses the same format as HUB
 */
function parseTexasCmblRow(fields: string[], headers: string[]): Record<string, any> | null {
  const record = parseTexasHubRow(fields, headers)
  if (record) {
    record.data_source = 'texas_cmbl'
    // CMBL vendors aren't necessarily HUBs
    record.small_business_types = record.small_business_types?.filter((t: string) => t !== 'HUB') || []
  }
  return record
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function cleanField(val: string | undefined): string {
  if (!val) return ''
  return val.replace(/^"|"$/g, '').trim()
}

function formatPhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return raw
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Handle "DD-MMM-YYYY" format (e.g., "17-JUL-2028")
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  }
  const match = raw.match(/(\d{2})-([A-Z]{3})-(\d{4})/)
  if (match) {
    const [, day, mon, year] = match
    const monthNum = months[mon]
    if (monthNum) return `${year}-${monthNum}-${day}`
  }
  return null
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
    city: 10, state: 10, trade_categories: 15, description: 15, contact_name: 10,
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

// ─── CSV Parser (handles quoted fields with commas) ─────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders })
  }

  // GET: list sources or check status
  if (req.method === "GET") {
    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    if (action === "sources") {
      const sources = Object.entries(SOURCES).map(([key, src]) => ({
        key,
        name: src.name,
        description: src.description,
        state: src.state,
        recordCount: src.recordCount,
      }))
      return new Response(JSON.stringify({ sources }), { headers: corsHeaders })
    }

    if (action === "status") {
      // Get last import stats per source
      const { data: logs } = await supabase
        .from("database_hygiene_log")
        .select("action, reason, performed_at")
        .like("action", "state_import_%")
        .order("performed_at", { ascending: false })
        .limit(20)
      return new Response(JSON.stringify({ logs: logs || [] }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "Use action=sources or action=status" }), { status: 400, headers: corsHeaders })
  }

  // POST: run import
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { source, dryRun = false, maxRecords } = body

    if (!source || !SOURCES[source]) {
      return new Response(JSON.stringify({
        error: `Invalid source. Available: ${Object.keys(SOURCES).join(', ')}`,
        sources: Object.keys(SOURCES),
      }), { status: 400, headers: corsHeaders })
    }

    const config = SOURCES[source]

    // 1. Download the CSV from state website
    const csvResponse = await fetch(config.url)
    if (!csvResponse.ok) {
      return new Response(JSON.stringify({
        error: `Failed to download from ${config.name}: ${csvResponse.status} ${csvResponse.statusText}`,
      }), { status: 502, headers: corsHeaders })
    }

    const csvText = await csvResponse.text()
    const lines = csvText.split('\n').filter(l => l.trim().length > 0)
    
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "CSV file is empty or has no data rows" }), { status: 400, headers: corsHeaders })
    }

    // Parse header
    const headers = parseCSVLine(lines[0])
    
    // 2. Parse all rows
    const records: Record<string, any>[] = []
    let parseErrors = 0
    const limit = maxRecords || lines.length

    for (let i = 1; i < Math.min(lines.length, limit + 1); i++) {
      try {
        const fields = parseCSVLine(lines[i])
        const record = config.parseRow(fields, headers)
        if (record) {
          records.push(record)
        }
      } catch {
        parseErrors++
      }
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No valid records found in CSV", parseErrors }), { status: 400, headers: corsHeaders })
    }

    // 3. Deduplicate against existing database
    // Check by email (most reliable) and by company_name + state (fallback)
    const emails = records
      .map(r => r.contact_email)
      .filter(Boolean)
      .map((e: string) => e.toLowerCase())
    
    // Batch check existing emails (in chunks of 500)
    const existingEmails = new Set<string>()
    for (let i = 0; i < emails.length; i += 500) {
      const chunk = emails.slice(i, i + 500)
      const { data } = await supabase
        .from("master_subcontractors")
        .select("contact_email")
        .in("contact_email", chunk)
      if (data) {
        data.forEach(r => {
          if (r.contact_email) existingEmails.add(r.contact_email.toLowerCase())
        })
      }
    }

    // Also check existing by data_source + external_id (avoid re-importing same record)
    const externalIds = records.map(r => r.external_id).filter(Boolean)
    const existingExternalIds = new Set<string>()
    for (let i = 0; i < externalIds.length; i += 500) {
      const chunk = externalIds.slice(i, i + 500)
      const { data } = await supabase
        .from("master_subcontractors")
        .select("external_id")
        .eq("data_source", config.dataSource)
        .in("external_id", chunk)
      if (data) {
        data.forEach(r => {
          if (r.external_id) existingExternalIds.add(r.external_id)
        })
      }
    }

    // Check suppression list
    const emailsToCheck = records
      .map(r => r.contact_email?.toLowerCase())
      .filter(Boolean)
    const suppressedEmails = new Set<string>()
    for (let i = 0; i < emailsToCheck.length; i += 500) {
      const chunk = emailsToCheck.slice(i, i + 500)
      const { data } = await supabase
        .from("email_suppression_list")
        .select("email")
        .in("email", chunk)
      if (data) {
        data.forEach(r => suppressedEmails.add(r.email))
      }
    }

    // Filter to new records only
    const newRecords = records.filter(r => {
      // Skip if external_id already exists for this source
      if (r.external_id && existingExternalIds.has(r.external_id)) return false
      // Skip if email already in database
      if (r.contact_email && existingEmails.has(r.contact_email.toLowerCase())) return false
      // Skip if email is suppressed
      if (r.contact_email && suppressedEmails.has(r.contact_email.toLowerCase())) return false
      return true
    })

    const stats: Record<string, any> = {
      source: config.name,
      totalInFile: lines.length - 1,
      parsed: records.length,
      parseErrors,
      duplicatesSkipped: records.length - newRecords.length,
      suppressedSkipped: records.filter(r => r.contact_email && suppressedEmails.has(r.contact_email.toLowerCase())).length,
      newRecords: newRecords.length,
      inserted: 0,
      errors: 0,
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        stats,
        sampleRecords: newRecords.slice(0, 5),
      }), { headers: corsHeaders })
    }

    // 4. Insert new records in batches (cap at 500 per invocation to stay within function timeout)
    const MAX_INSERT = 500
    const recordsToInsert = newRecords.slice(0, MAX_INSERT)
    stats.newRecords = newRecords.length
    if (newRecords.length > MAX_INSERT) {
      stats.remaining = newRecords.length - MAX_INSERT
    }

    const BATCH_SIZE = 100
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE).map(r => ({
        company_name: r.company_name,
        contact_email: r.contact_email?.toLowerCase() || null,
        contact_phone: r.contact_phone,
        contact_name: r.contact_name,
        address_line1: r.address || null,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code,
        description: r.description,
        trade_categories: r.trade_categories,
        small_business_types: r.small_business_types,
        data_source: r.data_source,
        external_id: r.external_id,
        slug: generateSlug(r.company_name) + '-' + Math.random().toString(36).slice(2, 8),
        profile_completeness: calculateCompleteness(r),
        data_health_score: 50,
      }))

      const { error } = await supabase
        .from("master_subcontractors")
        .insert(batch)
      
      if (error) {
        // Try one by one on batch failure
        for (const record of batch) {
          const { error: singleError } = await supabase
            .from("master_subcontractors")
            .insert(record)
          if (singleError) {
            stats.errors++
          } else {
            stats.inserted++
          }
        }
      } else {
        stats.inserted += batch.length
      }
    }

    // Log the import
    await supabase.from("database_hygiene_log").insert({
      action: `state_import_${source}`,
      reason: `Imported ${stats.inserted} new records from ${config.name} (${stats.duplicatesSkipped} duplicates skipped, ${stats.errors} errors)`,
      performed_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, stats }), { headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
