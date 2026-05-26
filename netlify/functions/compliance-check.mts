import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Netlify Function: Compliance Auto-Verification
 * 
 * Checks subcontractors against SAM.gov exclusions and verifies data completeness.
 * 
 * POST /api/compliance-check
 * Body: { subcontractor_ids?: string[], task_order_id?: string }
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

interface ComplianceResult {
  subcontractor_id: string
  company_name: string
  checks: {
    check_type: string
    status: 'pass' | 'fail' | 'warning' | 'unable_to_verify'
    detail: string
  }[]
  overall_status: 'clear' | 'warning' | 'flagged' | 'unknown'
}

// Check SAM.gov exclusions via their API
async function checkSamExclusion(companyName: string, apiKey: string): Promise<{ excluded: boolean; detail: string }> {
  try {
    const encoded = encodeURIComponent(companyName)
    const url = `https://api.sam.gov/entity-information/v3/exclusions?api_key=${apiKey}&q=${encoded}&format=json`
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    
    if (!resp.ok) {
      return { excluded: false, detail: 'Unable to verify — SAM.gov API unavailable' }
    }
    
    const data = await resp.json()
    const totalRecords = data.totalRecords || 0
    
    if (totalRecords > 0) {
      return { excluded: true, detail: `EXCLUDED — ${totalRecords} active exclusion record(s) found on SAM.gov` }
    }
    
    return { excluded: false, detail: 'No exclusion records found' }
  } catch {
    return { excluded: false, detail: 'Unable to verify — connection timeout' }
  }
}

export default async function handler(req: Request, _context: Context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    const { subcontractor_ids, task_order_id } = body

    // Get subcontractors to check
    let query = supabase.from('subcontractors').select('*')
    
    if (subcontractor_ids?.length) {
      query = query.in('id', subcontractor_ids)
    } else if (task_order_id) {
      // Get subs linked to this project
      const { data: projectSubs } = await supabase
        .from('project_subcontractors')
        .select('subcontractor_id')
        .eq('task_order_id', task_order_id)
      
      if (projectSubs?.length) {
        query = query.in('id', projectSubs.map(ps => ps.subcontractor_id))
      }
    }

    const { data: subs } = await query
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ results: [], message: 'No subcontractors to check' }), { status: 200, headers })
    }

    const samApiKey = process.env.SAM_GOV_API_KEY
    const results: ComplianceResult[] = []

    for (const sub of subs) {
      const checks: ComplianceResult['checks'] = []

      // Check 1: SAM.gov Exclusion
      if (samApiKey) {
        const exclusionResult = await checkSamExclusion(sub.company_name, samApiKey)
        checks.push({
          check_type: 'SAM.gov Exclusion',
          status: exclusionResult.excluded ? 'fail' : 'pass',
          detail: exclusionResult.detail,
        })
      } else {
        checks.push({
          check_type: 'SAM.gov Exclusion',
          status: 'unable_to_verify',
          detail: 'SAM.gov API key not configured',
        })
      }

      // Check 2: Contact Information Completeness
      const hasEmail = !!sub.contact_email
      const hasPhone = !!sub.contact_phone
      checks.push({
        check_type: 'Contact Information',
        status: hasEmail && hasPhone ? 'pass' : hasEmail || hasPhone ? 'warning' : 'fail',
        detail: !hasEmail && !hasPhone ? 'Missing both email and phone — cannot send RFQs'
          : !hasEmail ? 'Missing email address — RFQ distribution limited'
          : !hasPhone ? 'Missing phone number'
          : 'Complete contact information on file',
      })

      // Check 3: Service Category Defined
      const hasCats = sub.service_categories?.length > 0
      checks.push({
        check_type: 'Service Categories',
        status: hasCats ? 'pass' : 'warning',
        detail: hasCats ? `${sub.service_categories.length} category(s) defined` : 'No service categories assigned — AI matching will be limited',
      })

      // Check 4: Geographic Coverage
      const hasGeo = sub.geographic_coverage?.length > 0
      checks.push({
        check_type: 'Geographic Coverage',
        status: hasGeo ? 'pass' : 'warning',
        detail: hasGeo ? `Coverage: ${sub.geographic_coverage.join(', ')}` : 'No geographic coverage defined',
      })

      // Check 5: Small Business Certification (if claimed)
      if (sub.small_business) {
        const hasCage = !!sub.cage_code
        const hasDuns = !!sub.duns_number
        checks.push({
          check_type: 'Small Business Verification',
          status: hasCage || hasDuns ? 'pass' : 'warning',
          detail: hasCage || hasDuns
            ? `Identifiers on file: ${[hasCage && 'CAGE', hasDuns && 'DUNS/UEI'].filter(Boolean).join(', ')}`
            : 'Claimed small business but no CAGE/DUNS/UEI on file — verify in SAM.gov',
        })
      }

      // Determine overall status
      const hasFail = checks.some(c => c.status === 'fail')
      const hasWarning = checks.some(c => c.status === 'warning')
      const hasUnverified = checks.some(c => c.status === 'unable_to_verify')

      results.push({
        subcontractor_id: sub.id,
        company_name: sub.company_name,
        checks,
        overall_status: hasFail ? 'flagged' : hasWarning ? 'warning' : hasUnverified ? 'unknown' : 'clear',
      })
    }

    const flagged = results.filter(r => r.overall_status === 'flagged').length
    const warnings = results.filter(r => r.overall_status === 'warning').length
    const clear = results.filter(r => r.overall_status === 'clear').length

    return new Response(JSON.stringify({
      results,
      summary: { total: results.length, flagged, warnings, clear },
    }), { status: 200, headers })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}
