import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Organization Subcontractor Bulk Import
 * 
 * Imports user-uploaded subcontractor data into their PRIVATE org database.
 * This data is NEVER shared with or ingested into the Procuvex Master Sub Database.
 * 
 * POST body: { org_id: string, user_id: string, rows: string[][], columns: string[] }
 * 
 * Supported column names (flexible mapping):
 *   company_name, contact_name, contact_email, contact_phone, website,
 *   address_line1, city, state, zip_code, trade_categories, naics_codes,
 *   small_business_types, notes, tags, sam_uei, cage_code
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const COLUMN_ALIASES: Record<string, string> = {
  // company_name
  'company': 'company_name',
  'company name': 'company_name',
  'business name': 'company_name',
  'business': 'company_name',
  'name': 'company_name',
  'firm': 'company_name',
  'vendor': 'company_name',
  'vendor name': 'company_name',
  'subcontractor': 'company_name',
  'sub name': 'company_name',
  // contact_name
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'poc': 'contact_name',
  'point of contact': 'contact_name',
  'rep': 'contact_name',
  'representative': 'contact_name',
  // contact_email
  'email': 'contact_email',
  'e-mail': 'contact_email',
  'email address': 'contact_email',
  // contact_phone
  'phone': 'contact_phone',
  'telephone': 'contact_phone',
  'phone number': 'contact_phone',
  'tel': 'contact_phone',
  // website
  'url': 'website',
  'web': 'website',
  'site': 'website',
  // address
  'address': 'address_line1',
  'street': 'address_line1',
  'street address': 'address_line1',
  // city/state/zip
  'city': 'city',
  'town': 'city',
  'state': 'state',
  'province': 'state',
  'zip': 'zip_code',
  'zip code': 'zip_code',
  'zipcode': 'zip_code',
  'postal': 'zip_code',
  'postal code': 'zip_code',
  // trades
  'trade': 'trade_categories',
  'trades': 'trade_categories',
  'trade categories': 'trade_categories',
  'services': 'trade_categories',
  'specialty': 'trade_categories',
  'specialties': 'trade_categories',
  'capabilities': 'trade_categories',
  // naics
  'naics': 'naics_codes',
  'naics code': 'naics_codes',
  'naics codes': 'naics_codes',
  // small business
  'sba': 'small_business_types',
  'certifications': 'small_business_types',
  'certs': 'small_business_types',
  'designations': 'small_business_types',
  'small business': 'small_business_types',
  // sam/cage
  'uei': 'sam_uei',
  'sam uei': 'sam_uei',
  'unique entity id': 'sam_uei',
  'cage': 'cage_code',
  'cage code': 'cage_code',
  // notes
  'notes': 'notes',
  'comments': 'notes',
  'description': 'notes',
  // tags
  'tags': 'tags',
  'labels': 'tags',
  'category': 'tags',
}

function normalizeColumnName(col: string): string {
  const lower = col.toLowerCase().trim()
  return COLUMN_ALIASES[lower] || lower
}

function parseArrayField(value: string): string[] {
  if (!value) return []
  // Split by comma, semicolon, or pipe
  return value.split(/[,;|]/).map(v => v.trim()).filter(Boolean)
}

interface ImportRow {
  company_name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  trade_categories?: string[]
  naics_codes?: string[]
  small_business_types?: string[]
  notes?: string
  tags?: string[]
  sam_uei?: string
  cage_code?: string
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const body = await req.json()
    const { org_id, user_id, rows, columns, dry_run } = body

    if (!org_id || !user_id || !rows || !columns) {
      return new Response(JSON.stringify({ error: "Missing required fields: org_id, user_id, rows, columns" }), { status: 400, headers })
    }

    // Verify user belongs to org
    const { data: membership } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .maybeSingle()

    if (!membership) {
      return new Response(JSON.stringify({ error: "User does not belong to this organization" }), { status: 403, headers })
    }

    // Map columns to field names
    const fieldMap: Record<number, string> = {}
    for (let i = 0; i < columns.length; i++) {
      const normalized = normalizeColumnName(columns[i])
      fieldMap[i] = normalized
    }

    // Parse rows into records
    const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const records: any[] = []
    const errors: { row: number; reason: string }[] = []

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      const record: any = {
        org_id,
        created_by: user_id,
        data_source: columns.length > 0 ? 'csv_import' : 'manual',
        import_batch_id: batchId,
      }

      for (let colIdx = 0; colIdx < row.length && colIdx < columns.length; colIdx++) {
        const field = fieldMap[colIdx]
        const value = (row[colIdx] || '').trim()
        if (!value) continue

        switch (field) {
          case 'company_name':
          case 'contact_name':
          case 'contact_email':
          case 'contact_phone':
          case 'website':
          case 'address_line1':
          case 'city':
          case 'state':
          case 'zip_code':
          case 'notes':
          case 'sam_uei':
          case 'cage_code':
            record[field] = value
            break
          case 'trade_categories':
          case 'naics_codes':
          case 'small_business_types':
          case 'tags':
            record[field] = parseArrayField(value)
            break
          default:
            // Unknown column — store in notes
            if (value) {
              record.notes = record.notes ? `${record.notes}\n${columns[colIdx]}: ${value}` : `${columns[colIdx]}: ${value}`
            }
        }
      }

      // Validate: must have company_name at minimum
      if (!record.company_name) {
        errors.push({ row: rowIdx + 1, reason: "Missing company name" })
        continue
      }

      // Determine small_business flag
      if (record.small_business_types && record.small_business_types.length > 0) {
        record.small_business = true
      }

      records.push(record)
    }

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_rows: rows.length,
        valid_records: records.length,
        errors,
        sample: records.slice(0, 5),
        field_mapping: Object.entries(fieldMap).map(([idx, field]) => ({ column: columns[parseInt(idx)], mapped_to: field })),
      }), { status: 200, headers })
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100
    let inserted = 0
    let duplicates = 0

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)

      // Dedup within org: skip if company_name + state already exists
      const companyNames = batch.map(r => r.company_name)
      const { data: existing } = await supabase
        .from("org_subcontractors")
        .select("company_name, state")
        .eq("org_id", org_id)
        .in("company_name", companyNames)

      const existingSet = new Set(
        (existing || []).map(e => `${e.company_name}||${e.state || ''}`)
      )

      const newRecords = batch.filter(r => {
        const key = `${r.company_name}||${r.state || ''}`
        if (existingSet.has(key)) {
          duplicates++
          return false
        }
        return true
      })

      if (newRecords.length > 0) {
        const { error } = await supabase
          .from("org_subcontractors")
          .insert(newRecords)

        if (error) {
          console.error("Insert batch error:", error)
          errors.push({ row: i + 1, reason: `Batch insert failed: ${error.message}` })
        } else {
          inserted += newRecords.length
        }
      }
    }

    // Log the import activity
    if (inserted > 0) {
      await supabase.from("org_sub_activity_log").insert({
        org_id,
        org_sub_id: records[0]?.id || '00000000-0000-0000-0000-000000000000', // placeholder for batch
        event_type: 'imported',
        metadata: { batch_id: batchId, count: inserted, duplicates },
        performed_by: user_id,
      }).then(() => {}) // fire and forget
    }

    return new Response(JSON.stringify({
      success: true,
      imported: inserted,
      duplicates,
      errors: errors.slice(0, 20), // limit error reporting
      total_rows: rows.length,
      batch_id: batchId,
    }), { status: 200, headers })

  } catch (err: any) {
    console.error("org-sub-import error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers })
  }
}
