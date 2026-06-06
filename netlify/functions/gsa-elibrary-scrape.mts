import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

/**
 * GSA eLibrary Scraper — Server-Side Background Processing
 *
 * Scrapes contractor data from gsaelibrary.gsa.gov and upserts into master_subcontractors.
 * Runs as a scheduled function (every 2 minutes) that processes batches automatically.
 * Progress is tracked in a `gsa_scrape_progress` table so it survives across invocations.
 *
 * Manual API modes (POST):
 *   { action: "start" }       → Start a new A-Z background scrape job
 *   { action: "status" }      → Get current scrape job status
 *   { action: "stop" }        → Stop a running scrape job
 *   { action: "list", letter } → Fetch contractor URLs for a letter (utility)
 *
 * Scheduled mode (GET from cron):
 *   Picks up active job, processes next batch of ~12 contractors, saves progress.
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const BASE_URL = "https://www.gsaelibrary.gsa.gov/ElibMain"
const BATCH_SIZE = 12 // contractors per scheduled invocation (fits in 26s timeout)
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

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
  const tdMatch = html.substring(afterIdx, afterIdx + 500).match(/<(?:font|td)[^>]*>([^<]+)</)
  return tdMatch ? decodeHtmlEntities(tdMatch[1].trim()) : ''
}

function parseContractorDetail(html: string) {
  const contractNum = extractText(html, 'Contract #:')
  
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
  
  let address = ''
  let city = ''
  let state = ''
  let zipCode = ''
  const addrMatch = html.match(/Address:<\/font><\/td>\s*<td[^>]*><font[^>]*>([\s\S]*?)<\/font>/)
  if (addrMatch) {
    const addrText = decodeHtmlEntities(addrMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim())
    const lines = addrText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length >= 1) {
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
  
  const phoneMatch = html.match(/Call:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const phone = phoneMatch ? decodeHtmlEntities(phoneMatch[1].trim()) : ''
  
  const emailSection = html.match(/Email:<\/font>[\s\S]*?mailto:([^"'\s]+)/)
  const email = emailSection ? emailSection[1].trim() : ''
  
  const webMatch = html.match(/Web Address:<\/font>[\s\S]*?href="(http[^"]+)"/)
  const website = webMatch ? webMatch[1] : ''
  
  const ueiMatch = html.match(/SAM UEI:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const samUei = ueiMatch ? ueiMatch[1].trim() : ''
  
  const socioMatch = html.match(/Socio-Economic\s*:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const socioEconomic = socioMatch ? decodeHtmlEntities(socioMatch[1].trim()) : ''
  
  const endDateMatch = html.match(/Current Option Period End Date\s*:<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]+)/)
  const contractEndDate = endDateMatch ? endDateMatch[1].trim() : ''
  
  const categories: string[] = []
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
  
  const eplsMatch = html.match(/EPLS\s*:[\s\S]*?<font[^>]*>([^<]+)/)
  const eplsStatus = eplsMatch ? decodeHtmlEntities(eplsMatch[1].trim()) : ''
  
  const smallBizTypes: string[] = []
  if (socioEconomic) {
    const lower = socioEconomic.toLowerCase()
    if (lower.includes('8(a)')) smallBizTypes.push('8(a)')
    if (lower.includes('hubzone')) smallBizTypes.push('HUBZone')
    if (lower.includes('sdvosb') || lower.includes('service-disabled')) smallBizTypes.push('SDVOSB')
    if (lower.includes('wosb') || lower.includes('woman')) smallBizTypes.push('WOSB')
    if (lower.includes('small business') && smallBizTypes.length === 0) smallBizTypes.push('Small Business')
  }
  
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
  }
}

// ─── Ensure progress table exists via direct pg connection ──
async function ensureProgressTable(): Promise<void> {
  const supabaseUrl = process.env.TASKORDER_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const projectRef = supabaseUrl.match(/https:\/\/(\w+)\.supabase\.co/)?.[1]
  if (!projectRef) return
  
  const dbPassword = process.env.TASKORDER_SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD || ''
  if (!dbPassword) return
  
  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  
  try {
    await client.connect()
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.gsa_scrape_progress (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'idle',
        current_letter TEXT DEFAULT 'A',
        current_url_index INTEGER DEFAULT 0,
        urls_for_letter JSONB DEFAULT '[]'::jsonb,
        letters_completed TEXT[] DEFAULT '{}'::TEXT[],
        total_scraped INTEGER DEFAULT 0,
        total_inserted INTEGER DEFAULT 0,
        total_updated INTEGER DEFAULT 0,
        total_errors INTEGER DEFAULT 0,
        last_error TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `)
    // Enable RLS + policy (idempotent)
    await client.query(`ALTER TABLE public.gsa_scrape_progress ENABLE ROW LEVEL SECURITY;`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gsa_scrape_progress' AND policyname = 'gsa_scrape_service_access') THEN
          CREATE POLICY "gsa_scrape_service_access" ON public.gsa_scrape_progress FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `)
  } finally {
    await client.end()
  }
}

// ─── Process a batch of contractors ─────────────────────────
async function processNextBatch(supabase: any): Promise<{ processed: boolean; message: string }> {
  // Get active job
  const { data: jobs, error: jobErr } = await supabase
    .from('gsa_scrape_progress')
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
  
  if (jobErr || !jobs || jobs.length === 0) {
    return { processed: false, message: 'No active scrape job' }
  }
  
  const job = jobs[0]
  let { current_letter, current_url_index, urls_for_letter, letters_completed,
        total_scraped, total_inserted, total_updated, total_errors } = job
  
  const letterIdx = LETTERS.indexOf(current_letter)
  if (letterIdx === -1) {
    await supabase.from('gsa_scrape_progress').update({
      status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', job.id)
    return { processed: false, message: 'All letters completed' }
  }
  
  // If we don't have URLs for this letter yet, fetch the list page
  let urls: string[] = urls_for_letter || []
  if (urls.length === 0 || current_url_index === 0) {
    try {
      const html = await fetchWithRetry(`${BASE_URL}/contractorList.do?contractorListFor=${current_letter}`)
      urls = extractContractorUrls(html)
      await supabase.from('gsa_scrape_progress').update({
        urls_for_letter: urls,
        updated_at: new Date().toISOString()
      }).eq('id', job.id)
    } catch (e: any) {
      await supabase.from('gsa_scrape_progress').update({
        last_error: `Failed to fetch list for ${current_letter}: ${e.message}`,
        updated_at: new Date().toISOString()
      }).eq('id', job.id)
      return { processed: true, message: `Error fetching letter ${current_letter}` }
    }
  }
  
  // If no URLs for this letter, move to next
  if (urls.length === 0) {
    const nextLetterIdx = letterIdx + 1
    if (nextLetterIdx >= LETTERS.length) {
      await supabase.from('gsa_scrape_progress').update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        letters_completed: [...(letters_completed || []), current_letter],
        updated_at: new Date().toISOString()
      }).eq('id', job.id)
      return { processed: false, message: 'All letters completed' }
    }
    await supabase.from('gsa_scrape_progress').update({
      current_letter: LETTERS[nextLetterIdx],
      current_url_index: 0,
      urls_for_letter: [],
      letters_completed: [...(letters_completed || []), current_letter],
      updated_at: new Date().toISOString()
    }).eq('id', job.id)
    return { processed: true, message: `Letter ${current_letter} had no contractors, moving to ${LETTERS[nextLetterIdx]}` }
  }
  
  // Process the batch
  const batchUrls = urls.slice(current_url_index, current_url_index + BATCH_SIZE)
  if (batchUrls.length === 0) {
    // Done with this letter, move to next
    const nextLetterIdx = letterIdx + 1
    if (nextLetterIdx >= LETTERS.length) {
      await supabase.from('gsa_scrape_progress').update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        letters_completed: [...(letters_completed || []), current_letter],
        updated_at: new Date().toISOString()
      }).eq('id', job.id)
      return { processed: false, message: 'All letters completed' }
    }
    await supabase.from('gsa_scrape_progress').update({
      current_letter: LETTERS[nextLetterIdx],
      current_url_index: 0,
      urls_for_letter: [],
      letters_completed: [...(letters_completed || []), current_letter],
      updated_at: new Date().toISOString()
    }).eq('id', job.id)
    return { processed: true, message: `Finished letter ${current_letter}, moving to ${LETTERS[nextLetterIdx]}` }
  }
  
  let batchScraped = 0, batchInserted = 0, batchUpdated = 0, batchErrors = 0
  
  for (const url of batchUrls) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${BASE_URL}/${url}`
      const html = await fetchWithRetry(fullUrl)
      const data = parseContractorDetail(html)
      
      if (!data.company_name) {
        batchErrors++
        continue
      }
      
      batchScraped++
      
      // Check for existing record
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
      
      if (existingId) {
        const updateFields: Record<string, any> = {}
        if (data.contact_email) updateFields.contact_email = data.contact_email
        if (data.phone) updateFields.contact_phone = data.phone
        if (data.website) updateFields.website = data.website
        if (data.sam_uei) updateFields.sam_uei = data.sam_uei
        if (data.small_business_types.length > 0) updateFields.small_business_types = data.small_business_types
        if (data.gsa_categories.length > 0) updateFields.description = data.gsa_categories.join('; ')
        if (data.trade_categories.length > 0) updateFields.trade_categories = data.trade_categories
        
        if (Object.keys(updateFields).length > 0) {
          updateFields.updated_at = new Date().toISOString()
          await supabase.from('master_subcontractors').update(updateFields).eq('id', existingId)
          batchUpdated++
        }
      } else {
        const slug = data.company_name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 80) + '-' + Math.random().toString(36).substring(2, 8)
        
        const { error: insertErr } = await supabase.from('master_subcontractors').insert({
          company_name: data.company_name,
          slug,
          dba_name: data.dba || null,
          state: data.state || null,
          city: data.city || null,
          address_line1: data.address || null,
          zip_code: data.zip_code || null,
          contact_email: data.contact_email || null,
          contact_phone: data.phone || null,
          website: data.website || null,
          sam_uei: data.sam_uei || null,
          small_business: data.small_business_types.length > 0,
          small_business_types: data.small_business_types.length > 0 ? data.small_business_types : [],
          trade_categories: data.trade_categories.length > 0 ? data.trade_categories : [],
          service_categories: data.trade_categories.length > 0 ? data.trade_categories : [],
          geographic_coverage: data.state ? [data.state] : [],
          description: data.gsa_categories.length > 0 ? data.gsa_categories.join('; ') : null,
          data_source: 'import',
          verification_status: 'unverified',
        })
        if (insertErr) {
          batchErrors++
        } else {
          batchInserted++
        }
      }
      
      await sleep(500) // Rate limit
    } catch (e: any) {
      batchErrors++
    }
  }
  
  // Update progress
  const newIndex = current_url_index + batchUrls.length
  const update: Record<string, any> = {
    current_url_index: newIndex,
    total_scraped: total_scraped + batchScraped,
    total_inserted: total_inserted + batchInserted,
    total_updated: total_updated + batchUpdated,
    total_errors: total_errors + batchErrors,
    updated_at: new Date().toISOString(),
  }
  
  // Check if letter is done
  if (newIndex >= urls.length) {
    const nextLetterIdx = letterIdx + 1
    if (nextLetterIdx >= LETTERS.length) {
      update.status = 'complete'
      update.completed_at = new Date().toISOString()
      update.letters_completed = [...(letters_completed || []), current_letter]
    } else {
      update.current_letter = LETTERS[nextLetterIdx]
      update.current_url_index = 0
      update.urls_for_letter = []
      update.letters_completed = [...(letters_completed || []), current_letter]
    }
  }
  
  await supabase.from('gsa_scrape_progress').update(update).eq('id', job.id)
  
  return {
    processed: true,
    message: `Letter ${current_letter}: processed ${batchUrls.length} contractors (${batchInserted} new, ${batchUpdated} updated, ${batchErrors} errors). Position: ${newIndex}/${urls.length}`
  }
}

// ─── Main handler ───────────────────────────────────────────
export default async (req: Request, _context: Context) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    })
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Scheduled invocation (GET) — process next batch
  if (req.method === 'GET') {
    try {
      const result = await processNextBatch(supabase)
      return new Response(JSON.stringify(result), { status: 200, headers })
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers })
    }
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'GET or POST required' }), { status: 405, headers })
  }
  
  const body = await req.json()
  const { action } = body
  
  try {
    if (action === 'start') {
      // Auto-create progress table if it doesn't exist
      try { await ensureProgressTable() } catch (_e) { /* table may already exist */ }
      
      // Check for existing running job
      const { data: existing } = await supabase
        .from('gsa_scrape_progress')
        .select('id, status')
        .eq('status', 'running')
        .limit(1)
      
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: 'A scrape job is already running', job_id: existing[0].id }), {
          status: 409, headers
        })
      }
      
      // Create new job
      const { data: newJob, error } = await supabase
        .from('gsa_scrape_progress')
        .insert({
          status: 'running',
          current_letter: 'A',
          current_url_index: 0,
          urls_for_letter: [],
          letters_completed: [],
          total_scraped: 0,
          total_inserted: 0,
          total_updated: 0,
          total_errors: 0,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message, hint: 'The gsa_scrape_progress table may not exist. Create it in Supabase first.' }), {
          status: 500, headers
        })
      }
      
      // Immediately process first batch
      const firstResult = await processNextBatch(supabase)
      
      return new Response(JSON.stringify({
        message: 'Background scrape started. The scheduled function will process batches every 2 minutes.',
        job_id: newJob.id,
        first_batch: firstResult.message,
      }), { status: 200, headers })
    }
    
    if (action === 'status') {
      const { data: jobs } = await supabase
        .from('gsa_scrape_progress')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
      
      if (!jobs || jobs.length === 0) {
        return new Response(JSON.stringify({ status: 'no_jobs', message: 'No scrape jobs found' }), {
          status: 200, headers
        })
      }
      
      const job = jobs[0]
      const urlsTotal = (job.urls_for_letter || []).length
      return new Response(JSON.stringify({
        job_id: job.id,
        status: job.status,
        current_letter: job.current_letter,
        current_url_index: job.current_url_index,
        urls_in_letter: urlsTotal,
        letters_completed: job.letters_completed || [],
        letters_remaining: LETTERS.filter((l: string) => !(job.letters_completed || []).includes(l) && l >= job.current_letter),
        total_scraped: job.total_scraped,
        total_inserted: job.total_inserted,
        total_updated: job.total_updated,
        total_errors: job.total_errors,
        last_error: job.last_error,
        started_at: job.started_at,
        updated_at: job.updated_at,
        completed_at: job.completed_at,
      }), { status: 200, headers })
    }
    
    if (action === 'stop') {
      const { data: jobs } = await supabase
        .from('gsa_scrape_progress')
        .select('id')
        .eq('status', 'running')
        .limit(1)
      
      if (!jobs || jobs.length === 0) {
        return new Response(JSON.stringify({ message: 'No running job to stop' }), { status: 200, headers })
      }
      
      await supabase.from('gsa_scrape_progress').update({
        status: 'stopped',
        updated_at: new Date().toISOString()
      }).eq('id', jobs[0].id)
      
      return new Response(JSON.stringify({ message: 'Scrape job stopped', job_id: jobs[0].id }), {
        status: 200, headers
      })
    }
    
    if (action === 'list') {
      const letter = (body.letter || 'A').toUpperCase()
      const html = await fetchWithRetry(`${BASE_URL}/contractorList.do?contractorListFor=${letter}`)
      const urls = extractContractorUrls(html)
      return new Response(JSON.stringify({ letter, count: urls.length, urls }), { status: 200, headers })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action. Use: start, status, stop, or list' }), {
      status: 400, headers
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers })
  }
}

// Run every 2 minutes to process background scrape batches
export const config = {
  schedule: "*/2 * * * *",
}
