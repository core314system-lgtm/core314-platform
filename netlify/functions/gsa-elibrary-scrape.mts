import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * GSA eLibrary Scraper
 *
 * Scrapes contractor data from gsaelibrary.gsa.gov and upserts into master_subcontractors.
 *
 * Modes:
 *   POST { action: "list", letter: "A" }
 *     → Fetches the contractor list page for a letter, returns array of contractor URLs
 *
 *   POST { action: "scrape", urls: string[] }
 *     → Scrapes detail pages for given URLs (batch of up to 20), upserts into DB
 *
 *   POST { action: "count" }
 *     → Fetches all 26 letter pages and returns total contractor count per letter
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const BASE_URL = "https://www.gsaelibrary.gsa.gov/ElibMain"

const CAPABILITY_TRADE_MAP: Record<string, string[]> = {
  'hvac': ['HVAC'],
  'heating': ['HVAC'],
  'air conditioning': ['HVAC'],
  'ventilation': ['HVAC'],
  'plumbing': ['Plumbing'],
  'electrical': ['Electrical'],
  'wiring': ['Electrical'],
  'janitorial': ['Janitorial'],
  'custodial': ['Janitorial'],
  'cleaning': ['Janitorial'],
  'landscaping': ['Landscaping'],
  'grounds': ['Landscaping'],
  'lawn': ['Landscaping'],
  'security': ['Security'],
  'guard': ['Security'],
  'surveillance': ['Security'],
  'painting': ['Painting'],
  'roofing': ['Roofing'],
  'elevator': ['Elevator'],
  'fire': ['Fire Protection'],
  'sprinkler': ['Fire Protection'],
  'construction': ['General Construction'],
  'building': ['General Construction'],
  'renovation': ['General Construction'],
  'demolition': ['General Construction'],
  'concrete': ['General Construction'],
  'carpentry': ['General Construction'],
  'flooring': ['Flooring'],
  'carpet': ['Flooring'],
  'tile': ['Flooring'],
  'pest': ['Pest Control'],
  'exterminator': ['Pest Control'],
  'waste': ['Waste Management'],
  'trash': ['Waste Management'],
  'recycling': ['Waste Management'],
  'it ': ['IT Services'],
  'information technology': ['IT Services'],
  'software': ['IT Services'],
  'cybersecurity': ['IT Services'],
  'network': ['IT Services'],
  'telecom': ['IT Services'],
  'medical': ['Medical'],
  'health': ['Medical'],
  'pharmaceutical': ['Medical'],
  'laboratory': ['Medical'],
  'furniture': ['Furniture'],
  'office supplies': ['Office Supplies'],
  'moving': ['Moving & Relocation'],
  'relocation': ['Moving & Relocation'],
  'logistics': ['Logistics'],
  'shipping': ['Logistics'],
  'freight': ['Logistics'],
  'engineering': ['Engineering'],
  'environmental': ['Environmental'],
  'remediation': ['Environmental'],
  'consulting': ['Consulting'],
  'management': ['Consulting'],
  'training': ['Training'],
  'education': ['Training'],
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Procuvex/1.0 (Government Contractor Database; contact: team@procuvex.com)',
          'Accept': 'text/html',
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(1000 * (i + 1))
    }
  }
  return ''
}

function extractContractorUrls(html: string): string[] {
  const urls: string[] = []
  const regex = /href="(contractorInfo\.do\?[^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, '&')
    if (!urls.includes(url)) {
      urls.push(url)
    }
  }
  return urls
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function extractText(html: string, afterLabel: string): string {
  const labelIdx = html.indexOf(afterLabel)
  if (labelIdx === -1) return ''
  const afterIdx = labelIdx + afterLabel.length
  // Find the next <font> or <td> content
  const tdMatch = html.substring(afterIdx, afterIdx + 500).match(/<(?:font|td)[^>]*>([^<]+)</)
  return tdMatch ? decodeHtmlEntities(tdMatch[1].trim()) : ''
}

function extractEmail(html: string): string {
  const emailMatch = html.match(/mailto:([^"'\s]+)/)
  return emailMatch ? emailMatch[1].trim() : ''
}

function parseContractorDetail(html: string) {
  // Contract number
  const contractNum = extractText(html, 'Contract #:')
  
  // Contractor name + DBA
  let companyName = ''
  let dba = ''
  const contractorMatch = html.match(/Contractor:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  if (contractorMatch) {
    const full = decodeHtmlEntities(contractorMatch[1].trim())
    const dbaIdx = full.indexOf('DBA:')
    if (dbaIdx > -1) {
      companyName = full.substring(0, dbaIdx).trim()
      dba = full.substring(dbaIdx + 4).trim()
    } else {
      companyName = full
    }
  }
  
  // Address - can span multiple lines
  let address = ''
  let city = ''
  let state = ''
  let zipCode = ''
  const addrMatch = html.match(/Address:<\/font><\/td>\s*<td[^>]*><font[^>]*>([\s\S]*?)<\/font>/)
  if (addrMatch) {
    const addrText = decodeHtmlEntities(addrMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim())
    const lines = addrText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length >= 1) {
      // Last line usually has City, ST ZIP
      const lastLine = lines[lines.length - 1]
      const cszMatch = lastLine.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
      if (cszMatch) {
        city = cszMatch[1].trim()
        state = cszMatch[2]
        zipCode = cszMatch[3]
        address = lines.slice(0, -1).join(', ')
      } else {
        address = lines.join(', ')
      }
    }
  }
  
  // Phone
  const phoneMatch = html.match(/Call:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const phone = phoneMatch ? decodeHtmlEntities(phoneMatch[1].trim()) : ''
  
  // Email
  const emailSection = html.match(/Email:<\/font>[\s\S]*?mailto:([^"'\s]+)/)
  const email = emailSection ? emailSection[1].trim() : ''
  
  // Website
  const webMatch = html.match(/Web Address:<\/font>[\s\S]*?href="(http[^"]+)"/)
  const website = webMatch ? webMatch[1] : ''
  
  // SAM UEI
  const ueiMatch = html.match(/SAM UEI:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const samUei = ueiMatch ? ueiMatch[1].trim() : ''
  
  // Socio-Economic status
  const socioMatch = html.match(/Socio-Economic\s*:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const socioEconomic = socioMatch ? decodeHtmlEntities(socioMatch[1].trim()) : ''
  
  // Contract end date
  const endDateMatch = html.match(/Current Option Period End Date\s*:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const contractEndDate = endDateMatch ? endDateMatch[1].trim() : ''
  
  // GSA Schedule/SIN categories from the contract table
  const categories: string[] = []
  const sinRegex = /<td[^>]*><font[^>]*><a[^>]*>([^<]+)<\/a><\/font><\/td>/g
  const titleRegex = /class="sinTitle"[^>]*>([^<]+)/g
  let sinMatch
  // Extract schedule titles from the contracts table
  const scheduleSection = html.match(/Terms &amp; Conditions \/ Price List[\s\S]*?<\/table>/)
  if (scheduleSection) {
    const titleMatches = scheduleSection[0].matchAll(/<td[^>]*>\s*<font[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)
    for (const m of titleMatches) {
      const title = decodeHtmlEntities(m[1].trim())
      if (title && !title.match(/^(Terms|View|Go)/) && !categories.includes(title)) {
        categories.push(title)
      }
    }
  }
  
  // EPLS status
  const eplsMatch = html.match(/EPLS\s*:[\s\S]*?<font[^>]*>([^<]+)/)
  const eplsStatus = eplsMatch ? decodeHtmlEntities(eplsMatch[1].trim()) : ''
  
  // Map socio-economic to small business types
  const smallBizTypes: string[] = []
  if (socioEconomic) {
    const lower = socioEconomic.toLowerCase()
    if (lower.includes('8(a)')) smallBizTypes.push('8(a)')
    if (lower.includes('hubzone')) smallBizTypes.push('HUBZone')
    if (lower.includes('sdvosb') || lower.includes('service-disabled')) smallBizTypes.push('SDVOSB')
    if (lower.includes('wosb') || lower.includes('woman')) smallBizTypes.push('WOSB')
    if (lower.includes('small business') && smallBizTypes.length === 0) smallBizTypes.push('Small Business')
  }
  
  // Map categories to trade categories
  const tradeCategories: string[] = []
  const allText = (categories.join(' ') + ' ' + companyName + ' ' + (dba || '')).toLowerCase()
  for (const [keyword, trades] of Object.entries(CAPABILITY_TRADE_MAP)) {
    if (allText.includes(keyword)) {
      for (const t of trades) {
        if (!tradeCategories.includes(t)) tradeCategories.push(t)
      }
    }
  }
  
  return {
    company_name: companyName,
    dba,
    contract_number: contractNum,
    address,
    city,
    state,
    zip_code: zipCode,
    phone,
    contact_email: email,
    website,
    sam_uei: samUei,
    socio_economic: socioEconomic,
    contract_end_date: contractEndDate,
    gsa_categories: categories,
    epls_status: eplsStatus,
    small_business_types: smallBizTypes,
    trade_categories: tradeCategories,
    source: 'gsa_elibrary',
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
  
  const body = await req.json()
  const { action } = body
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  
  try {
    if (action === 'list') {
      // Fetch contractor list for a letter
      const letter = (body.letter || 'A').toUpperCase()
      const html = await fetchWithRetry(`${BASE_URL}/contractorList.do?contractorListFor=${letter}`)
      const urls = extractContractorUrls(html)
      return new Response(JSON.stringify({ letter, count: urls.length, urls }), {
        status: 200, headers
      })
    }
    
    if (action === 'count') {
      // Get counts per letter
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      const counts: Record<string, number> = {}
      let total = 0
      for (const letter of letters) {
        const html = await fetchWithRetry(`${BASE_URL}/contractorList.do?contractorListFor=${letter}`)
        const urls = extractContractorUrls(html)
        counts[letter] = urls.length
        total += urls.length
        await sleep(500)
      }
      return new Response(JSON.stringify({ counts, total }), { status: 200, headers })
    }
    
    if (action === 'scrape') {
      // Scrape detail pages and upsert
      const urls: string[] = body.urls || []
      if (urls.length === 0) {
        return new Response(JSON.stringify({ error: 'No URLs provided' }), { status: 400, headers })
      }
      if (urls.length > 25) {
        return new Response(JSON.stringify({ error: 'Max 25 URLs per batch' }), { status: 400, headers })
      }
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const results = { scraped: 0, inserted: 0, updated: 0, errors: 0, details: [] as any[] }
      
      for (const url of urls) {
        try {
          const fullUrl = url.startsWith('http') ? url : `${BASE_URL}/${url}`
          const html = await fetchWithRetry(fullUrl)
          const data = parseContractorDetail(html)
          
          if (!data.company_name) {
            results.errors++
            continue
          }
          
          results.scraped++
          
          // Check for existing record by SAM UEI or company_name + state
          let existingId: string | null = null
          if (data.sam_uei) {
            const { data: existing } = await supabase
              .from('master_subcontractors')
              .select('id')
              .eq('sam_uei', data.sam_uei)
              .limit(1)
            if (existing && existing.length > 0) existingId = existing[0].id
          }
          if (!existingId && data.company_name && data.state) {
            const { data: existing } = await supabase
              .from('master_subcontractors')
              .select('id')
              .ilike('company_name', data.company_name)
              .eq('state', data.state)
              .limit(1)
            if (existing && existing.length > 0) existingId = existing[0].id
          }
          
          const record: any = {
            company_name: data.company_name,
            state: data.state || null,
            city: data.city || null,
            address: data.address || null,
            zip_code: data.zip_code || null,
            contact_email: data.contact_email || null,
            contact_name: null,
            contact_phone: data.phone || null,
            website: data.website || null,
            sam_uei: data.sam_uei || null,
            small_business_types: data.small_business_types.length > 0 ? data.small_business_types : null,
            trade_categories: data.trade_categories.length > 0 ? data.trade_categories : null,
            service_description: data.gsa_categories.length > 0 ? data.gsa_categories.join('; ') : null,
            source: 'gsa_elibrary',
          }
          
          if (existingId) {
            // Update: merge contact info if missing
            const updateFields: any = {}
            if (data.contact_email) updateFields.contact_email = data.contact_email
            if (data.phone) updateFields.contact_phone = data.phone
            if (data.website) updateFields.website = data.website
            if (data.sam_uei) updateFields.sam_uei = data.sam_uei
            if (data.small_business_types.length > 0) updateFields.small_business_types = data.small_business_types
            if (data.gsa_categories.length > 0) updateFields.service_description = data.gsa_categories.join('; ')
            
            if (Object.keys(updateFields).length > 0) {
              await supabase.from('master_subcontractors').update(updateFields).eq('id', existingId)
              results.updated++
            }
          } else {
            // Insert new record
            const { error } = await supabase.from('master_subcontractors').insert(record)
            if (error) {
              results.errors++
              results.details.push({ company: data.company_name, error: error.message })
            } else {
              results.inserted++
            }
          }
          
          // Rate limit: 500ms between requests
          await sleep(500)
        } catch (e: any) {
          results.errors++
          results.details.push({ url, error: e.message })
        }
      }
      
      return new Response(JSON.stringify(results), { status: 200, headers })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action. Use: list, count, or scrape' }), {
      status: 400, headers
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers
    })
  }
}
