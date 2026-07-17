import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TRADE_CATEGORIES, naicsToTradeNames, naicsToCategoryIds, generateSlug } from '../lib/naicsTradeMapping'
import {
  Search, MapPin, Mail, ShieldCheck,
  ChevronDown, ChevronUp, Download, Upload, Star,
  Users, BadgeCheck, Clock, Eye, ExternalLink, Loader2, X,
  Database, AlertCircle, FileUp, Lock, Trash2,
  TrendingUp, Activity, Send, RefreshCw, Zap, Globe,
} from 'lucide-react'

interface MasterSub {
  id: string
  company_name: string
  slug: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  sam_uei: string | null
  cage_code: string | null
  naics_codes: string[]
  service_categories: string[]
  trade_categories: string[]
  geographic_coverage: string[]
  small_business: boolean
  small_business_types: string[]
  verification_status: string
  profile_completeness: number
  data_source: string
  match_count: number
  view_count: number
  created_at: string
  source_id: string | null
  sam_expiration_date: string | null
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

// High-demand subcontractor trades for federal/government contracting
const HIGH_DEMAND_TIER1 = [
  '238210', // Electrical
  '238220', // Plumbing, HVAC, Mechanical
  '236220', // Commercial/Institutional Building Construction
  '238160', // Roofing
  '238110', // Concrete
  '238320', // Painting & Wall Covering
  '238910', // Site Preparation / Excavation
]

const HIGH_DEMAND_TIER2 = [
  '541512', // Computer Systems Design (Cybersecurity)
  '541519', // Other Computer Related Services
  '561720', // Janitorial Services
  '561730', // Landscaping Services
  '561612', // Security Guards & Patrol Services
  '541330', // Engineering Services
  '238290', // Other Building Equipment (Elevators, etc.)
  '238310', // Drywall & Insulation
  '238340', // Tile & Terrazzo
  '238350', // Finish Carpentry
]

const ALL_HIGH_DEMAND = [...HIGH_DEMAND_TIER1, ...HIGH_DEMAND_TIER2]

const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  unverified: { label: 'Unverified', color: 'bg-gray-100 text-gray-600', icon: Clock },
  claimed: { label: 'Claimed', color: 'bg-blue-100 text-blue-700', icon: Users },
  pending_verification: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700', icon: BadgeCheck },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600', icon: AlertCircle },
}

// The outreach pilot ran before production email deliverability was in place, so
// its engagement numbers aren't representative. Hidden during the diligence
// period to avoid misrepresenting the asset; flip to true to restore the panel.
const SHOW_OUTREACH_METRICS = false

export default function MasterSubDatabase() {
  const { profile, loading: authLoading } = useAuth()
  const isAdmin = profile?.is_global_admin === true

  const [subs, setSubs] = useState<MasterSub[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  const [filterVerification, setFilterVerification] = useState('')
  const [filterSmallBiz, setFilterSmallBiz] = useState(false)
  const [sortBy, setSortBy] = useState<'company_name' | 'created_at' | 'profile_completeness' | 'match_count'>('company_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importState, setImportState] = useState('')
  const [importNaics, setImportNaics] = useState('')
  const [importMode, setImportMode] = useState<'api' | 'file'>('file')
  const [fileUploading, setFileUploading] = useState(false)
  const [fileResult, setFileResult] = useState<any>(null)
  const [fileProgress, setFileProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stats, setStats] = useState({ total: 0, verified: 0, claimed: 0, withEmail: 0, outreachEligible: 0 })
  const [showOutreach, setShowOutreach] = useState(false)
  const [outreachState, setOutreachState] = useState('')
  const [outreachTrade, setOutreachTrade] = useState('')
  const [outreachLimit, setOutreachLimit] = useState(50)
  const [outreachSending, setOutreachSending] = useState(false)
  const [outreachResult, setOutreachResult] = useState<any>(null)
  const [outreachPreview, setOutreachPreview] = useState<any>(null)
  const [priorityStats, setPriorityStats] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [outreachStats, setOutreachStats] = useState<{ totalSent: number; sentToday: number; totalClaimed: number; recentClaims: any[] }>({ totalSent: 0, sentToday: 0, totalClaimed: 0, recentClaims: [] })
  const [outreachStatsLoading, setOutreachStatsLoading] = useState(false)
  const [emailMetrics, setEmailMetrics] = useState<any>(null)
  const [emailMetricsLoading, setEmailMetricsLoading] = useState(false)
  const [showEmailDetails, setShowEmailDetails] = useState(false)

  // Email Verification state
  const [exportingEmails, setExportingEmails] = useState(false)
  const [exportEmailProgress, setExportEmailProgress] = useState('')
  const [showVerificationImport, setShowVerificationImport] = useState(false)
  const [verificationImporting, setVerificationImporting] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{ total: number; invalid: number; risky: number; valid: number } | null>(null)
  const verificationFileRef = useRef<HTMLInputElement>(null)
  const verificationPanelRef = useRef<HTMLDivElement>(null)

  // SBS Import state
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [showSbsImport, setShowSbsImport] = useState(false)
  const [sbsUploading, setSbsUploading] = useState(false)
  const [sbsProgress, setSbsProgress] = useState('')
  const [sbsResult, setSbsResult] = useState<any>(null)
  const sbsFileRef = useRef<HTMLInputElement>(null)
  const outreachPanelRef = useRef<HTMLDivElement>(null)
  const importPanelRef = useRef<HTMLDivElement>(null)
  const sbsImportPanelRef = useRef<HTMLDivElement>(null)

  // Database Health state
  const [showHealthPanel, setShowHealthPanel] = useState(false)
  const [healthStats, setHealthStats] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [hygieneRunning, setHygieneRunning] = useState(false)
  const [hygieneResult, setHygieneResult] = useState<any>(null)
  const healthPanelRef = useRef<HTMLDivElement>(null)

  // State Directory Import state
  const [showStateImport, setShowStateImport] = useState(false)
  const [stateImporting, setStateImporting] = useState(false)
  const [stateImportResult, setStateImportResult] = useState<any>(null)
  const [stateImportSource, setStateImportSource] = useState('texas_hub')
  const [stateImportMode, setStateImportMode] = useState<'auto' | 'upload'>('auto')
  const [stateUploadFormat, setStateUploadFormat] = useState('ohio_mbe')
  const [stateUploadFile, setStateUploadFile] = useState<File | null>(null)
  const stateImportRef = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 50

  const fetchStats = useCallback(async () => {
    const { count: total } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).eq('archived', false)
    const { count: verified } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).eq('verification_status', 'verified').eq('archived', false)
    const { count: claimed } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).eq('verification_status', 'claimed').eq('archived', false)
    const { count: withEmail } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).not('contact_email', 'is', null).neq('contact_email', '').eq('archived', false)
    const { count: outreachEligible } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).not('contact_email', 'is', null).eq('archived', false).gte('data_health_score', 70)
    setStats({
      total: total || 0,
      verified: verified || 0,
      claimed: claimed || 0,
      withEmail: withEmail || 0,
      outreachEligible: outreachEligible || 0,
    })
  }, [])

  const fetchOutreachStats = useCallback(async () => {
    setOutreachStatsLoading(true)
    // Use local midnight (not UTC) so "Sent Today" matches user's local day
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Total emails sent (any record with outreach_sent_at set)
    const { count: totalSent } = await supabase
      .from('master_subcontractors')
      .select('id', { count: 'exact', head: true })
      .not('outreach_sent_at', 'is', null)

    // Sent today (local day)
    const { count: sentToday } = await supabase
      .from('master_subcontractors')
      .select('id', { count: 'exact', head: true })
      .gte('outreach_sent_at', todayStart.toISOString())

    // Claimed after outreach (have both outreach_sent_at and claimed_at)
    const { count: totalClaimed } = await supabase
      .from('master_subcontractors')
      .select('id', { count: 'exact', head: true })
      .not('outreach_sent_at', 'is', null)
      .not('claimed_at', 'is', null)

    // Recent claims (last 10)
    const { data: recentClaims } = await supabase
      .from('master_subcontractors')
      .select('id, company_name, city, state, trade_categories, claimed_at')
      .not('claimed_at', 'is', null)
      .order('claimed_at', { ascending: false })
      .limit(10)

    setOutreachStats({
      totalSent: totalSent || 0,
      sentToday: sentToday || 0,
      totalClaimed: totalClaimed || 0,
      recentClaims: recentClaims || [],
    })
    setOutreachStatsLoading(false)
  }, [])

  const fetchEmailMetrics = useCallback(async () => {
    setEmailMetricsLoading(true)
    try {
      const res = await fetch('/.netlify/functions/outreach-metrics')
      if (res.ok) {
        const data = await res.json()
        setEmailMetrics(data)
      }
    } catch (err) {
      console.error('Failed to fetch email metrics:', err)
    }
    setEmailMetricsLoading(false)
  }, [])

  const fetchHealthStats = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const res = await fetch('/.netlify/functions/database-hygiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
        body: JSON.stringify({ action: 'stats' }),
      })
      if (res.ok) {
        const data = await res.json()
        setHealthStats(data.stats)
      } else {
        const errData = await res.json().catch(() => ({}))
        setHealthError(errData.error || `Failed to load (${res.status})`)
      }
    } catch (err: any) {
      console.error('Failed to fetch health stats:', err)
      setHealthError(err.message || 'Network error')
    }
    setHealthLoading(false)
  }, [profile?.id])

  const runHygieneCycle = useCallback(async (action: string = 'full-cycle') => {
    setHygieneRunning(true)
    setHygieneResult(null)
    try {
      const res = await fetch('/.netlify/functions/database-hygiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const data = await res.json()
        setHygieneResult(data)
        fetchHealthStats()
        fetchStats()
      } else {
        const errData = await res.json().catch(() => ({}))
        setHygieneResult({ error: errData.error || `Failed (${res.status})` })
      }
    } catch (err: any) {
      console.error('Hygiene cycle failed:', err)
      setHygieneResult({ error: err.message || 'Network error' })
    }
    setHygieneRunning(false)
  }, [profile?.id, fetchHealthStats, fetchStats])

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('master_subcontractors')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,city.ilike.%${search}%,description.ilike.%${search}%,sam_uei.ilike.%${search}%`)
    }
    if (filterState) {
      query = query.eq('state', filterState)
    }
    if (filterTrade) {
      query = query.contains('trade_categories', [filterTrade])
    }
    if (filterVerification) {
      query = query.eq('verification_status', filterVerification)
    }
    if (filterSmallBiz) {
      query = query.eq('small_business', true)
    }

    query = query.order(sortBy, { ascending: sortDir === 'asc' })
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) {
      console.error('Error fetching master subs:', error)
    }
    setSubs(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }, [search, filterState, filterTrade, filterVerification, filterSmallBiz, sortBy, sortDir, page])

  useEffect(() => { fetchSubs(); fetchStats(); fetchOutreachStats(); fetchEmailMetrics() }, [fetchSubs, fetchStats, fetchOutreachStats, fetchEmailMetrics])

  // SAM.gov Public V2 Extract columns (pipe-delimited)
  // See: https://open.gsa.gov/api/sam-entity-extracts-api/v1/SAM_Entity_Management_Public_V2_Extract_Layout.pdf
  const SAM_COLUMNS = {
    UEI: 0,          // UNIQUE ENTITY IDENTIFIER (SAM)
    CAGE: 3,         // CAGE CODE
    EXTRACT_CODE: 5, // SAM EXTRACT CODE
    REG_DATE: 7,     // INITIAL REGISTRATION DATE
    EXPIRY_DATE: 8,  // REGISTRATION EXPIRATION DATE
    LAST_UPDATE: 9,  // LAST UPDATE DATE
    ACTIVATION_DATE: 10, // ACTIVATION DATE
    LEGAL_NAME: 11,  // LEGAL BUSINESS NAME
    DBA_NAME: 12,    // DBA NAME
    ADDR1: 15,       // PHYSICAL ADDRESS LINE 1
    ADDR2: 16,       // PHYSICAL ADDRESS LINE 2
    CITY: 17,        // PHYSICAL ADDRESS CITY
    STATE: 18,       // PHYSICAL ADDRESS PROVINCE OR STATE
    ZIP: 19,         // PHYSICAL ADDRESS ZIP
    COUNTRY: 21,     // PHYSICAL ADDRESS COUNTRY CODE
    URL: 26,         // ENTITY URL
    NAICS_PRIMARY: 32, // PRIMARY NAICS
    NAICS_SECONDARY: 33, // NAICS CODE STRING (pipe-separated within field, or ~-delimited)
    SBA_BIZ_TYPES: 40, // SBA BUSINESS TYPES STRING
    POC_GOV_FIRST: 77,  // GOVT BUSINESS POC FIRST NAME
    POC_GOV_LAST: 79,   // GOVT BUSINESS POC LAST NAME
    POC_GOV_PHONE: 85,  // GOVT BUSINESS POC PHONE
    POC_GOV_EMAIL: 86,  // GOVT BUSINESS POC EMAIL (public extract may not include this)
    POC_ALT_FIRST: 88,  // ALT GOVT BUSINESS POC FIRST NAME
    POC_ALT_LAST: 90,   // ALT GOVT BUSINESS POC LAST NAME
  }

  function parseSamCsvLine(line: string): string[] {
    // SAM files are pipe-delimited
    return line.split('|')
  }

  function parseSbaTypes(sbaStr: string): string[] {
    if (!sbaStr?.trim()) return []
    const types: string[] = []
    const str = sbaStr.toUpperCase()
    if (str.includes('SDB') || str.includes('SMALL DISADVANTAGED')) types.push('SDB')
    if (str.includes('8(A)') || str.includes('8A')) types.push('8(a)')
    if (str.includes('HUBZONE') || str.includes('HUB ZONE')) types.push('HUBZone')
    if (str.includes('WOSB') || str.includes('WOMEN')) types.push('WOSB')
    if (str.includes('SDVOSB') || str.includes('SERVICE-DISABLED') || str.includes('SERVICE DISABLED VETERAN')) types.push('SDVOSB')
    if (str.includes('VOSB') && !str.includes('SDVOSB')) types.push('VOSB')
    return types
  }

  async function handleFileUpload(file: File) {
    setFileUploading(true)
    setFileResult(null)
    setFileProgress('Reading file... (streaming — large files supported)')

    try {
      // Stream file line-by-line to avoid memory limits on large SAM.gov files (1-2GB)
      const records: any[] = []
      let skippedNonUS = 0
      let skippedNoName = 0
      let skippedExpired = 0
      let lineCount = 0
      let isFirstLine = true
      let leftover = ''

      const reader = file.stream().getReader()
      const decoder = new TextDecoder('utf-8')
      let bytesRead = 0
      const fileSize = file.size

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        bytesRead += value?.byteLength || 0
        const chunkText = decoder.decode(value, { stream: true })
        const combined = leftover + chunkText
        const lines = combined.split(/\r?\n/)
        leftover = lines.pop() || '' // last partial line carries over

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue
          lineCount++

          // Check header on first line
          if (isFirstLine) {
            isFirstLine = false
            const firstFields = parseSamCsvLine(line)
            if (firstFields[0]?.includes('UNIQUE') || firstFields[0]?.includes('UEI') || firstFields[0]?.toUpperCase?.().includes('ENTITY') || firstFields[0]?.length > 12) {
              continue
            }
          }

          if (lineCount % 20000 === 0) {
            const pct = Math.round(bytesRead / fileSize * 100)
            setFileProgress(`Streaming... ${pct}% — ${lineCount.toLocaleString()} lines scanned, ${records.length} matched`)
            await new Promise(r => setTimeout(r, 0)) // yield to UI
          }

          const fields = parseSamCsvLine(line)
          if (!fields || fields.length < 12) continue

          const country = (fields[SAM_COLUMNS.COUNTRY] ?? '').trim()
          if (country && country !== 'USA' && country !== 'US' && country !== 'UNITED STATES') {
            skippedNonUS++
            continue
          }

          const extractCode = (fields[SAM_COLUMNS.EXTRACT_CODE] ?? '').trim()
          if (extractCode === 'E' || extractCode === '4') {
            skippedExpired++
            continue
          }

          const companyName = (fields[SAM_COLUMNS.LEGAL_NAME] || '').trim()
          if (!companyName) {
            skippedNoName++
            continue
          }

          const uei = (fields[SAM_COLUMNS.UEI] || '').trim()
          const cage = (fields[SAM_COLUMNS.CAGE] || '').trim()
          const state = (fields[SAM_COLUMNS.STATE] || '').trim()
          const city = (fields[SAM_COLUMNS.CITY] || '').trim()
          const zip = (fields[SAM_COLUMNS.ZIP] || '').trim()
          const addr1 = (fields[SAM_COLUMNS.ADDR1] || '').trim()
          const entUrl = (fields[SAM_COLUMNS.URL] || '').trim()

          // NAICS codes — only use primary (position 33 is a count field, not secondary codes)
          const naicsPrimary = (fields[SAM_COLUMNS.NAICS_PRIMARY] ?? '').trim()
          // Only accept valid NAICS codes (start with 1-9, not '0000' or count fields like '0001')
          const allNaics = [naicsPrimary].filter(n => n && /^[1-9]\d{1,5}$/.test(n.trim())).map(n => n.trim())

          // Filter by state if specified
          if (importState && state !== importState) continue

          // Filter by NAICS if specified
          if (importNaics) {
            const filterCodes = importNaics.split(',').map(c => c.trim())
            const hasMatch = filterCodes.some(fc => allNaics.some(nc => nc.startsWith(fc) || fc.startsWith(nc)))
            if (!hasMatch) continue
          }

          const tradeIds = naicsToCategoryIds(allNaics)
          const tradeNames = naicsToTradeNames(allNaics)
          const sbaTypes = parseSbaTypes(fields[SAM_COLUMNS.SBA_BIZ_TYPES] || '')

          // POC columns in public extract are misaligned (contain country codes, not names)
          const contactName: string | null = null

          // Skip records without a website (can't contact or scrape without one)
          if (!entUrl) continue

          // Slug must be unique — append UEI to guarantee no collisions
          const slug = generateSlug(`${companyName} ${uei}`)

          // Calculate profile completeness
          let completeness = 30 // base for having name + UEI
          if (city) completeness += 10
          if (state) completeness += 10
          if (entUrl) completeness += 15
          if (allNaics.length > 0) completeness += 15
          if (sbaTypes.length > 0) completeness += 10
          if (contactName) completeness += 10
          completeness = Math.min(completeness, 100)

          records.push({
            company_name: companyName,
            slug,
            sam_uei: uei || null,
            cage_code: cage || null,
            address_line1: addr1 || null,
            city: city || null,
            state: state || null,
            zip_code: zip || null,
            website: entUrl ? (entUrl.startsWith('http') ? entUrl : `https://${entUrl}`) : null,
            naics_codes: allNaics,
            trade_categories: tradeNames,
            service_categories: tradeIds,
            small_business: sbaTypes.length > 0,
            small_business_types: sbaTypes,
            geographic_coverage: state ? [state] : [],
            contact_name: contactName,
            verification_status: 'unverified',
            data_source: 'sam_gov',
            profile_completeness: completeness,
            sam_registration_status: 'active',
          })
        } // end for (rawLine of lines)
      } // end while (true) — streaming chunks

      // Process any remaining leftover line
      if (leftover.trim()) {
        const fields = parseSamCsvLine(leftover.trim())
        if (fields && fields.length >= 12) {
          const companyName = (fields[SAM_COLUMNS.LEGAL_NAME] || '').trim()
          const state = (fields[SAM_COLUMNS.STATE] || '').trim()
          const naicsPrimary = (fields[SAM_COLUMNS.NAICS_PRIMARY] ?? '').trim()
          const allNaics = [naicsPrimary].filter(n => n && /^\d{2,6}$/.test(n.trim()))
          if (companyName && (!importState || state === importState)) {
            if (!importNaics || importNaics.split(',').some(fc => allNaics.some(nc => nc.startsWith(fc.trim())))) {
              lineCount++
            }
          }
        }
      }

      setFileProgress(`Found ${records.length.toLocaleString()} matching records from ${lineCount.toLocaleString()} lines. Importing...`)

      if (records.length === 0) {
        setFileResult({
          imported: 0,
          skipped: 0,
          total: lineCount,
          skippedNonUS,
          skippedNoName,
          skippedExpired,
          message: 'No matching records found. Try adjusting state/NAICS filters.'
        })
        setFileUploading(false)
        return
      }

      // Filter out records without a UEI (can't upsert without conflict key)
      const validRecords = records.filter(r => r.sam_uei)
      const noUeiCount = records.length - validRecords.length

      // Get auth token for server-side insert (bypasses RLS)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setFileResult({ error: 'Not authenticated. Please log in and try again.' })
        setFileUploading(false)
        return
      }

      // Import via serverless function (uses service role key to bypass RLS)
      const BATCH_SIZE = 200
      let imported = 0
      let skipped = 0
      let errors: string[] = []

      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const batch = validRecords.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        const totalBatches = Math.ceil(validRecords.length / BATCH_SIZE)
        setFileProgress(`Importing batch ${batchNum} of ${totalBatches}... (${imported} imported, ${skipped} skipped)`)

        // Yield to UI every 5 batches
        if (batchNum % 5 === 0) await new Promise(r => setTimeout(r, 0))

        try {
          const res = await fetch('/.netlify/functions/sam-bulk-insert', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ records: batch }),
          })
          const result = await res.json()

          if (result.error) {
            if (errors.length < 10) errors.push(`Batch ${batchNum}: ${result.error}`)
            skipped += batch.length
          } else {
            imported += result.imported || 0
            skipped += result.skipped || 0
            if (result.errors?.length > 0 && errors.length < 10) {
              errors.push(...result.errors)
            }
          }
        } catch (fetchErr: any) {
          if (errors.length < 10) errors.push(`Batch ${batchNum}: Network error - ${fetchErr.message}`)
          skipped += batch.length
        }
      }

      if (noUeiCount > 0) {
        errors.push(`${noUeiCount} records skipped (no SAM UEI — required for de-duplication)`)
      }

      setFileResult({
        imported,
        skipped,
        total: records.length,
        skippedNonUS,
        skippedNoName,
        skippedExpired,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      })

      // Refresh data
      fetchSubs()
      fetchStats()
    } catch (err: any) {
      setFileResult({ error: err.message || String(err) })
    }
    setFileUploading(false)
    setFileProgress('')
  }

  async function handleImport(dryRun: boolean) {
    setImporting(true)
    setImportResult(null)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/sam-entity-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          state: importState || undefined,
          naicsCodes: importNaics ? importNaics.split(',').map(s => s.trim()) : undefined,
          size: 100,
          dryRun,
        }),
      })
      const data = await res.json()
      setImportResult(data)
      if (!dryRun && !data.error) {
        fetchSubs()
        fetchStats()
      }
    } catch (err) {
      setImportResult({ error: String(err) })
    }
    setImporting(false)
  }

  async function exportCSV() {
    setExporting(true)
    setExportProgress('Fetching records...')
    try {
      const PAGE_SIZE = 1000
      const allData: any[] = []
      let from = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase
          .from('master_subcontractors')
          .select('*')
          .order('company_name')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        if (!data || data.length === 0) { hasMore = false; break }
        allData.push(...data)
        setExportProgress(`Fetched ${allData.length.toLocaleString()} records...`)
        from += PAGE_SIZE
        if (data.length < PAGE_SIZE) hasMore = false
      }
      if (allData.length === 0) { setExporting(false); setExportProgress(''); return }
      setExportProgress(`Building CSV for ${allData.length.toLocaleString()} records...`)
      const headers = ['Company Name', 'Email', 'Phone', 'City', 'State', 'SAM UEI', 'CAGE', 'NAICS Codes', 'Trade Categories', 'Small Business Types', 'Verification', 'Profile %', 'Website']
      const rows = allData.map(s => [
        s.company_name, s.contact_email || '', s.contact_phone || '', s.city || '', s.state || '',
        s.sam_uei || '', s.cage_code || '', (s.naics_codes || []).join('; '), (s.trade_categories || []).join('; '),
        (s.small_business_types || []).join('; '), s.verification_status, s.profile_completeness, s.website || '',
      ])
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `procuvex-master-subs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
      setExportProgress('')
    }
  }

  async function exportEmailsForVerification() {
    setExportingEmails(true)
    setExportEmailProgress('Fetching emails...')
    try {
      const PAGE_SIZE = 1000
      const allEmails: { email: string; id: string; company: string }[] = []
      let from = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase
          .from('master_subcontractors')
          .select('id, contact_email, company_name')
          .not('contact_email', 'is', null)
          .neq('contact_email', '')
          .eq('archived', false)
          .is('claimed_at', null)
          .order('company_name')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        if (!data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          if (row.contact_email) allEmails.push({ email: row.contact_email.toLowerCase().trim(), id: row.id, company: row.company_name })
        }
        setExportEmailProgress(`Fetched ${allEmails.length.toLocaleString()} emails...`)
        from += PAGE_SIZE
        if (data.length < PAGE_SIZE) hasMore = false
      }
      if (allEmails.length === 0) { setExportingEmails(false); setExportEmailProgress(''); return }
      setExportEmailProgress(`Building CSV for ${allEmails.length.toLocaleString()} emails...`)
      const headers = ['email', 'id', 'company_name']
      const rows = allEmails.map(e => [e.email, e.id, e.company])
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `procuvex-emails-for-verification-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Email export failed:', err)
    } finally {
      setExportingEmails(false)
      setExportEmailProgress('')
    }
  }

  async function importVerificationResults(file: File) {
    setVerificationImporting(true)
    setVerificationResult(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setVerificationImporting(false); return }
      const headerLine = lines[0].toLowerCase()

      // Detect column indices — supports MillionVerifier, ZeroBounce, NeverBounce, and generic formats
      const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim())
      const emailCol = headers.findIndex(h => h === 'email' || h === 'email_address')
      const resultCol = headers.findIndex(h => h === 'result' || h === 'status' || h === 'quality' || h === 'verification_status' || h === 'sub_status')

      if (emailCol === -1 || resultCol === -1) {
        alert('CSV must have "email" and "result" (or "status") columns')
        setVerificationImporting(false)
        return
      }

      // Parse results
      const invalidEmails: string[] = []
      const riskyEmails: string[] = []
      const validEmails: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const email = cols[emailCol]?.toLowerCase()
        const result = cols[resultCol]?.toLowerCase()
        if (!email || !result) continue

        // Map various service result formats to valid/invalid/risky
        const isInvalid = ['invalid', 'bad', 'undeliverable', 'bounce', 'disposable', 'dead', 'syntax_error', 'mailbox_not_found', 'mailbox_full'].includes(result)
        const isRisky = ['risky', 'unknown', 'catch-all', 'catch_all', 'role', 'do_not_mail', 'spamtrap', 'abuse'].includes(result)

        if (isInvalid) invalidEmails.push(email)
        else if (isRisky) riskyEmails.push(email)
        else validEmails.push(email)
      }

      // Batch update invalid emails — archive them
      for (let i = 0; i < invalidEmails.length; i += 100) {
        const batch = invalidEmails.slice(i, i + 100)
        await supabase
          .from('master_subcontractors')
          .update({ archived: true, archive_reason: 'email_verification_invalid' })
          .in('contact_email', batch)
      }

      // Archive risky emails
      for (let i = 0; i < riskyEmails.length; i += 100) {
        const batch = riskyEmails.slice(i, i + 100)
        await supabase
          .from('master_subcontractors')
          .update({ archived: true, archive_reason: 'email_verification_risky' })
          .in('contact_email', batch)
      }

      // Mark verified-valid emails with boosted health score (70) = outreach eligible
      for (let i = 0; i < validEmails.length; i += 100) {
        const batch = validEmails.slice(i, i + 100)
        await supabase
          .from('master_subcontractors')
          .update({ data_health_score: 70 })
          .in('contact_email', batch)
          .eq('archived', false)
      }

      setVerificationResult({
        total: lines.length - 1,
        invalid: invalidEmails.length,
        risky: riskyEmails.length,
        valid: validEmails.length,
      })

      // Refresh stats
      fetchStats()
      fetchSubs()
    } catch (err) {
      console.error('Verification import failed:', err)
      alert('Failed to import verification results. Check the CSV format.')
    } finally {
      setVerificationImporting(false)
    }
  }

  async function previewOutreach() {
    setOutreachResult(null)
    const res = await fetch('/.netlify/functions/sub-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
      body: JSON.stringify({ action: 'preview', state: outreachState, trade: outreachTrade, limit: outreachLimit }),
    })
    const data = await res.json()
    setOutreachPreview(data)
  }

  async function sendOutreach() {
    setOutreachSending(true)
    setOutreachResult(null)
    const res = await fetch('/.netlify/functions/sub-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
      body: JSON.stringify({ action: 'send-outreach', state: outreachState, trade: outreachTrade, limit: outreachLimit, dayStart: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }),
    })
    const data = await res.json()
    setOutreachResult(data)
    setOutreachSending(false)
    setOutreachPreview(null)
    fetchStats()
    fetchOutreachStats()
  }

  async function deleteSub(id: string) {
    if (!confirm('Delete this subcontractor permanently?')) return
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    try {
      const res = await fetch('/.netlify/functions/sam-bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ids: [id] }),
      })
      const result = await res.json()
      if (result.deleted) {
        fetchSubs()
        fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  async function deleteAll() {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setDeleting(false); return }
    try {
      const res = await fetch('/.netlify/functions/sam-bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deleteAll: true }),
      })
      const result = await res.json()
      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        alert(`Deleted ${result.deleted} records.`)
        fetchSubs()
        fetchStats()
      }
    } catch (err) { console.error(err) }
    setDeleting(false)
    setShowDeleteConfirm(false)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} /></div>
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Lock size={48} className="text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700">Admin Access Required</h2>
        <p className="text-gray-500 text-center max-w-md">
          The Master Subcontractor Database admin panel is restricted to global administrators.
          Contact your organization admin for access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Subcontractor Database</h1>
          <p className="text-sm text-gray-500 mt-1">Sourced from public government records — SBA, SAM.gov, GSA eLibrary, and state directories</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
            <Trash2 size={16} /> Delete All
          </button>
          <button onClick={exportCSV} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? exportProgress || 'Exporting...' : 'Export CSV'}
          </button>
          <button onClick={() => { const opening = !showOutreach; setShowOutreach(opening); setShowImport(false); setShowSbsImport(false); if (opening) setTimeout(() => outreachPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50">
            <Mail size={16} /> Send Outreach
          </button>
          <button onClick={() => { const opening = !showImport; setShowImport(opening); setShowOutreach(false); setShowSbsImport(false); if (opening) setTimeout(() => importPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Upload size={16} /> Import from SAM.gov
          </button>
          <button onClick={() => { const opening = !showSbsImport; setShowSbsImport(opening); setShowImport(false); setShowOutreach(false); if (opening) setTimeout(() => sbsImportPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            <FileUp size={16} /> Import SBS Data
          </button>
          <button onClick={() => { const opening = !showStateImport; setShowStateImport(opening); setShowImport(false); setShowOutreach(false); setShowSbsImport(false); setShowHealthPanel(false); if (opening) setTimeout(() => stateImportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Globe size={16} /> State Directories
          </button>
          <button onClick={() => { const opening = !showVerificationImport; setShowVerificationImport(opening); setShowImport(false); setShowOutreach(false); setShowSbsImport(false); setShowStateImport(false); setShowHealthPanel(false); if (opening) setTimeout(() => verificationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
            <ShieldCheck size={16} /> Email Verification
          </button>
          <button onClick={() => { const opening = !showHealthPanel; setShowHealthPanel(opening); setShowImport(false); setShowOutreach(false); setShowSbsImport(false); setShowStateImport(false); setShowVerificationImport(false); if (opening) { fetchHealthStats(); setTimeout(() => healthPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100) } }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700">
            <Activity size={16} /> Database Health
          </button>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-red-700 mb-2">Delete Entire Database?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>all {stats.total.toLocaleString()} subcontractor records</strong> from the database. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={deleteAll} disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outreach Panel */}
      {showOutreach && (
        <div ref={outreachPanelRef} className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-green-900">Send Claim Outreach Emails</h3>
            <button onClick={() => setShowOutreach(false)} className="text-green-400 hover:text-green-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-green-700">
            Send claim invitation emails to unclaimed subcontractors with verified email addresses.
            Only emails marked as "safe to send" by verification are eligible. Each email contains a unique claim link valid for 90 days.
          </p>
          <div className="bg-white border border-green-200 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
              <TrendingUp size={12} /> Priority-Based Sending
            </p>
            <p className="text-xs text-gray-500">
              Outreach is sent to the highest-value subs first: SBA-certified contractors (8(a), SDVOSB, WOSB, HUBZone), 
              in-demand trades (HVAC, Electrical, Plumbing, etc.), and subs with the most complete data. 
              This ensures primes get the most relevant matches when they search.
            </p>
            {!priorityStats && (
              <button onClick={async () => {
                const res = await fetch('/.netlify/functions/sub-outreach', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
                  body: JSON.stringify({ action: 'priority-stats' }),
                })
                setPriorityStats(await res.json())
              }} className="mt-2 text-xs text-green-700 underline hover:text-green-900">View priority breakdown</button>
            )}
            {priorityStats && (
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {Object.entries(priorityStats.tiers || {}).map(([tier, count]: [string, any]) => {
                  const label = tier.split(' \u2014 ')[1] || tier
                  const colors: Record<string, string> = {
                    'High Priority': 'bg-red-50 text-red-700 border-red-200',
                    'Priority': 'bg-amber-50 text-amber-700 border-amber-200',
                    'Standard': 'bg-blue-50 text-blue-700 border-blue-200',
                    'Basic': 'bg-gray-50 text-gray-600 border-gray-200',
                  }
                  return (
                    <div key={tier} className={`rounded-lg border p-2 ${colors[label] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      <p className="text-lg font-bold">{Number(count).toLocaleString()}</p>
                      <p className="text-[10px] font-medium">{label}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State (optional)</label>
              <select value={outreachState} onChange={e => setOutreachState(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="">All States</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trade (optional)</label>
              <select value={outreachTrade} onChange={e => setOutreachTrade(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="">All Trades</option>
                {TRADE_CATEGORIES.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Batch Size</label>
              <select value={outreachLimit} onChange={e => setOutreachLimit(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={previewOutreach}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100">
              <Eye size={14} /> Preview Recipients
            </button>
            <button onClick={sendOutreach} disabled={outreachSending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {outreachSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send Emails
            </button>
          </div>

          {outreachPreview && (
            <div className="bg-white border border-green-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-green-800 mb-2">{outreachPreview.total?.toLocaleString()} eligible recipients found (sorted by priority)</p>
              {outreachPreview.priority_tiers && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {Object.entries(outreachPreview.priority_tiers).map(([tier, count]: [string, any]) => {
                    const label = tier.split(' \u2014 ')[1] || tier
                    const colors: Record<string, string> = {
                      'High Priority': 'bg-red-100 text-red-700',
                      'Priority': 'bg-amber-100 text-amber-700',
                      'Standard': 'bg-blue-100 text-blue-700',
                      'Basic': 'bg-gray-100 text-gray-600',
                    }
                    return <span key={tier} className={`px-2 py-0.5 rounded text-xs font-medium ${colors[label] || 'bg-gray-100'}`}>{label}: {count}</span>
                  })}
                </div>
              )}
              {outreachPreview.targets?.slice(0, 8).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      t.priority_score >= 50 ? 'bg-red-500' :
                      t.priority_score >= 30 ? 'bg-amber-500' :
                      t.priority_score >= 15 ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-gray-700">{t.company_name}</span>
                    <span className="text-[10px] text-gray-400">({t.priority_score} pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.priority_reasons?.slice(0, 3).map((r: string) => (
                      <span key={r} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                    <span className="text-gray-400 text-xs">{t.state}</span>
                  </div>
                </div>
              ))}
              {outreachPreview.total > 8 && <p className="text-xs text-gray-400 mt-1">...and {(outreachPreview.total - 8).toLocaleString()} more</p>}
            </div>
          )}

          {outreachResult && (
            <div className={`p-3 rounded-lg text-sm ${outreachResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-100 border border-green-300 text-green-800'}`}>
              {outreachResult.error ? (
                <p>{outreachResult.error}</p>
              ) : (
                <>
                  <p>
                    <strong>{outreachResult.sent}</strong> emails sent successfully
                    {outreachResult.failed > 0 && <>, <strong>{outreachResult.failed}</strong> failed</>}
                    {outreachResult.email_provider && (
                      <span className="ml-2 text-green-600">via {outreachResult.email_provider}</span>
                    )}
                    {outreachResult.avg_priority_score > 0 && (
                      <span className="ml-2 text-green-600">• Avg priority: {outreachResult.avg_priority_score} pts</span>
                    )}
                  </p>
                  {outreachResult.priority_tiers && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Object.entries(outreachResult.priority_tiers).map(([tier, count]: [string, any]) => {
                        const label = tier.split(' \u2014 ')[1] || tier
                        return <span key={tier} className="text-xs text-green-600">{label}: {count}</span>
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div ref={importPanelRef} className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">SAM.gov Entity Import</h3>
            <button onClick={() => setShowImport(false)} className="text-blue-400 hover:text-blue-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-blue-700">
            Import registered entities from SAM.gov into the master database. Filter by state and/or NAICS codes.
            Duplicates (matching SAM UEI) are automatically skipped.
          </p>

          {/* Mode Tabs */}
          <div className="flex gap-1 bg-blue-100 p-1 rounded-lg">
            <button onClick={() => setImportMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                importMode === 'file' ? 'bg-white text-blue-900 shadow-sm font-medium' : 'text-blue-600 hover:text-blue-800'
              }`}>
              <FileUp size={14} /> Upload Data File
            </button>
            <button onClick={() => setImportMode('api')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                importMode === 'api' ? 'bg-white text-blue-900 shadow-sm font-medium' : 'text-blue-600 hover:text-blue-800'
              }`}>
              <Database size={14} /> API Import
            </button>
          </div>

          {importMode === 'file' ? (
            <div className="space-y-3">
              <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Upload a SAM.gov Public Entity Extract file. Download from:{' '}
                  <a href="https://sam.gov/data-services/Entity%20Registration/Public%20V2" target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800">SAM.gov Data Services</a>
                </p>
                <p className="text-xs text-gray-500">
                  Supported format: SAM Public V2 extract (pipe-delimited .dat or .csv file inside the ZIP).
                  Monthly files contain all active entities. You can filter by state and NAICS below before importing.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State Filter (optional)</label>
                    <select value={importState} onChange={e => setImportState(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                      <option value="">All States (large!)</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">NAICS Codes (comma-separated, optional)</label>
                    <input type="text" value={importNaics} onChange={e => setImportNaics(e.target.value)}
                      placeholder="e.g. 238220, 238210, 561720"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <div className="flex gap-1 mt-1">
                      <button type="button" onClick={() => setImportNaics(HIGH_DEMAND_TIER1.join(', '))}
                        className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">Tier 1 (Construction)</button>
                      <button type="button" onClick={() => setImportNaics(ALL_HIGH_DEMAND.join(', '))}
                        className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">All High Demand</button>
                      <button type="button" onClick={() => setImportNaics('')}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Clear</button>
                    </div>
                  </div>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dat,.csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUploading}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full justify-center">
                    {fileUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                    {fileUploading ? 'Processing...' : 'Select SAM.gov Extract File'}
                  </button>
                </div>
                {fileProgress && (
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 size={14} className="animate-spin" />
                    {fileProgress}
                  </div>
                )}
              </div>
              {fileResult && (
                <div className={`p-3 rounded-lg text-sm ${fileResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {fileResult.error ? (
                    <p>Error: {fileResult.error}</p>
                  ) : (
                    <div className="space-y-1">
                      <p><strong>{fileResult.imported?.toLocaleString()}</strong> companies imported successfully</p>
                      {fileResult.skipped > 0 && <p>{fileResult.skipped.toLocaleString()} skipped (duplicates or errors)</p>}
                      {fileResult.skippedNonUS > 0 && <p className="text-gray-500">{fileResult.skippedNonUS.toLocaleString()} skipped (non-US)</p>}
                      {fileResult.skippedExpired > 0 && <p className="text-gray-500">{fileResult.skippedExpired.toLocaleString()} skipped (expired)</p>}
                      {fileResult.message && <p className="text-yellow-700">{fileResult.message}</p>}
                      {fileResult.errors?.length > 0 && (
                        <div className="text-yellow-700 mt-1">
                          <p>Warnings:</p>
                          {fileResult.errors.map((e: string, i: number) => <p key={i} className="text-xs">{e}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">State Filter (optional)</label>
                  <select value={importState} onChange={e => setImportState(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white">
                    <option value="">All States</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">NAICS Codes (comma-separated, optional)</label>
                  <input type="text" value={importNaics} onChange={e => setImportNaics(e.target.value)}
                    placeholder="e.g. 238220, 238210, 561720"
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm" />
                  <div className="flex gap-1 mt-1">
                    <button type="button" onClick={() => setImportNaics(HIGH_DEMAND_TIER1.join(', '))}
                      className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">Tier 1 (Construction)</button>
                    <button type="button" onClick={() => setImportNaics(ALL_HIGH_DEMAND.join(', '))}
                      className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">All High Demand</button>
                    <button type="button" onClick={() => setImportNaics('')}
                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Clear</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleImport(true)} disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-blue-400 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                  Preview Import
                </button>
                <button onClick={() => handleImport(false)} disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  Import Now
                </button>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">Note: API import may not work from cloud infrastructure due to SAM.gov IP restrictions. Use "Upload Data File" tab for reliable imports.</p>
              </div>
              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {importResult.error ? (
                    <p>Error: {importResult.error}</p>
                  ) : (
                    <div>
                      <p><strong>{importResult.imported}</strong> imported, <strong>{importResult.skipped}</strong> skipped (duplicates), <strong>{importResult.totalRecords?.toLocaleString()}</strong> total available</p>
                      {importResult.errors?.length > 0 && (
                        <p className="text-yellow-700 mt-1">Warnings: {importResult.errors.join('; ')}</p>
                      )}
                      {importResult.preview && (
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          <p className="font-medium mb-1">Preview (first 10):</p>
                          {importResult.preview.map((p: any, i: number) => (
                            <div key={i} className="text-xs py-1 border-t border-green-200">
                              {p.company_name} — {p.city}, {p.state} — {(p.trade_categories || []).join(', ') || 'No trades mapped'} {p.contact_email ? '✉' : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SBS Import Panel */}
      {showSbsImport && (
        <div ref={sbsImportPanelRef} className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-emerald-900">Import SBS (Small Business Source) Data</h3>
            <button onClick={() => setShowSbsImport(false)} className="text-emerald-400 hover:text-emerald-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-emerald-700">
            Upload an Excel (.xlsx) or CSV file with subcontractor data. Expected columns: Business Name, Capabilities (2 cols), Active SBA, Contact Person, Contact Email, Address Line 1, Address Line 2, City, State, Zipcode.
          </p>
          <p className="text-xs text-emerald-600">
            Duplicates (matching company name + state) will have their contact information merged into existing records. New companies will be added as new entries.
          </p>

          <input
            type="file"
            ref={sbsFileRef}
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setSbsUploading(true)
              setSbsProgress('Reading file...')
              setSbsResult(null)

              try {
                const XLSX = await import('xlsx')
                const buffer = await file.arrayBuffer()
                const wb = XLSX.read(buffer, { type: 'array' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

                // Skip header row
                const dataRows = rawRows.slice(1).filter(r => r.length > 0 && r[0])
                setSbsProgress(`Parsed ${dataRows.length.toLocaleString()} rows. Importing...`)

                // Send in batches of 200 (smaller batches avoid function timeouts)
                const batchSize = 200
                let totalImported = 0
                let totalUpdated = 0
                let totalSkipped = 0
                const errors: string[] = []

                for (let i = 0; i < dataRows.length; i += batchSize) {
                  const batch = dataRows.slice(i, i + batchSize).map(row =>
                    row.map((cell: any) => (cell === null || cell === undefined) ? '' : String(cell))
                  )
                  setSbsProgress(`Importing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(dataRows.length / batchSize)}... (${i}/${dataRows.length})`)

                  try {
                    const res = await fetch('/.netlify/functions/sbs-import', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ rows: batch }),
                    })

                    if (res.ok) {
                      const data = await res.json()
                      totalImported += data.imported || 0
                      totalUpdated += data.updated || 0
                      totalSkipped += data.skipped || 0
                      if (data.errors?.length > 0) errors.push(...data.errors)
                    } else {
                      const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
                      errors.push(`Batch ${Math.floor(i / batchSize)}: ${errData.error}`)
                    }
                  } catch (fetchErr: any) {
                    // Network error or timeout — log and continue with next batch
                    errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${fetchErr.message || 'Network error'}`)
                  }
                }

                setSbsResult({ imported: totalImported, updated: totalUpdated, skipped: totalSkipped, total: dataRows.length, errors })
                setSbsProgress('')
                fetchStats()
                fetchSubs()
              } catch (err: any) {
                setSbsResult({ error: err.message || 'Failed to parse file' })
                setSbsProgress('')
              }
              setSbsUploading(false)
              if (sbsFileRef.current) sbsFileRef.current.value = ''
            }}
          />

          <button
            onClick={() => sbsFileRef.current?.click()}
            disabled={sbsUploading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 w-full justify-center"
          >
            {sbsUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {sbsUploading ? 'Processing...' : 'Select SBS Excel/CSV File'}
          </button>

          {sbsProgress && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <Loader2 size={14} className="animate-spin" /> {sbsProgress}
            </div>
          )}

          {sbsResult && (
            <div className={`rounded-lg p-4 text-sm ${sbsResult.error ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-100 border border-emerald-300 text-emerald-900'}`}>
              {sbsResult.error ? (
                <p>Error: {sbsResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">Import Complete</p>
                  <p><strong>{sbsResult.imported?.toLocaleString()}</strong> new subcontractors added</p>
                  <p><strong>{sbsResult.updated?.toLocaleString()}</strong> existing records updated (contact info merged)</p>
                  <p><strong>{sbsResult.skipped?.toLocaleString()}</strong> rows skipped (no company name)</p>
                  <p className="text-xs text-emerald-700 mt-1">Total rows processed: {sbsResult.total?.toLocaleString()}</p>
                  {sbsResult.errors?.length > 0 && (
                    <p className="text-amber-700 mt-1 text-xs">Warnings: {sbsResult.errors.slice(0, 5).join('; ')}{sbsResult.errors.length > 5 ? ` (+${sbsResult.errors.length - 5} more)` : ''}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* State Directory Import Panel */}
      {showStateImport && (
        <div ref={stateImportRef} className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-900">Import State DBE/HUB/MBE/WBE Directories</h3>
            <button onClick={() => setShowStateImport(false)} className="text-purple-400 hover:text-purple-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-purple-800">
            Import verified contractors from state government directories. Supports auto-download (Texas) and file upload (OH, IL, NY, FL, VA, GA, PA, or any state CSV).
          </p>

          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-purple-300">
            <button onClick={() => { setStateImportMode('auto'); setStateImportResult(null) }}
              className={`flex-1 px-3 py-2 text-sm font-medium ${stateImportMode === 'auto' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 hover:bg-purple-50'}`}>
              Auto-Download (TX)
            </button>
            <button onClick={() => { setStateImportMode('upload'); setStateImportResult(null) }}
              className={`flex-1 px-3 py-2 text-sm font-medium ${stateImportMode === 'upload' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 hover:bg-purple-50'}`}>
              Upload File (All States)
            </button>
          </div>

          {stateImportMode === 'auto' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-1">Select Source</label>
                <select value={stateImportSource} onChange={(e) => setStateImportSource(e.target.value)}
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm">
                  <option value="texas_hub">Texas HUB Directory (~15,000 firms — minority, women, veteran-owned)</option>
                  <option value="texas_cmbl">Texas CMBL (~12,000 firms — all state bidders list)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  setStateImporting(true); setStateImportResult(null)
                  try {
                    const res = await fetch('/.netlify/functions/state-directory-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: stateImportSource, dryRun: true }) })
                    const data = await res.json(); setStateImportResult({ ...data, isDryRun: true })
                  } catch (e: any) { setStateImportResult({ error: e.message }) }
                  setStateImporting(false)
                }} disabled={stateImporting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-purple-600 text-purple-700 rounded-lg hover:bg-purple-100 font-medium disabled:opacity-50">
                  <Eye size={16} /> Preview
                </button>
                <button onClick={async () => {
                  if (!confirm('Import new records? Duplicates will be skipped.')) return
                  setStateImporting(true); setStateImportResult(null)
                  try {
                    const res = await fetch('/.netlify/functions/state-directory-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: stateImportSource }) })
                    const data = await res.json(); setStateImportResult(data); if (data.success) fetchStats()
                  } catch (e: any) { setStateImportResult({ error: e.message }) }
                  setStateImporting(false)
                }} disabled={stateImporting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                  {stateImporting ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {stateImporting ? 'Importing...' : 'Import Now'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-1">State Format</label>
                <select value={stateUploadFormat} onChange={(e) => setStateUploadFormat(e.target.value)}
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm">
                  <option value="ohio_mbe">Ohio — MBE Directory (~1,300 firms)</option>
                  <option value="ohio_edge">Ohio — EDGE Directory (~800 firms)</option>
                  <option value="illinois_bep">Illinois — BEP MBE/WBE Directory (~4,000 firms)</option>
                  <option value="new_york_mwbe">New York — MWBE Directory (~12,000 firms)</option>
                  <option value="florida_dbe">Florida — DOT DBE Directory (~8,000 firms)</option>
                  <option value="virginia_swam">Virginia — SWaM Directory (~10,000 firms)</option>
                  <option value="georgia_dbe">Georgia — DOT DBE Directory (~3,000 firms)</option>
                  <option value="pennsylvania_sdb">Pennsylvania — Small Diverse Business (~5,000 firms)</option>
                  <option value="generic_state">Generic — Any state CSV (auto-detect columns)</option>
                </select>
              </div>

              <div className="text-xs bg-purple-100 rounded p-2 text-purple-800">
                <strong>How to get the file:</strong>{' '}
                {stateUploadFormat === 'ohio_mbe' && 'Go to eodreporting.oit.ohio.gov/mbe-certification → leave search blank → Search → Export to Excel → save as CSV'}
                {stateUploadFormat === 'ohio_edge' && 'Go to eodreporting.oit.ohio.gov/edge-certification → leave search blank → Search → Export to Excel → save as CSV'}
                {stateUploadFormat === 'illinois_bep' && 'Go to ceibep.diversitysoftware.com → select MBE/WBE → scroll down → "Download Entire Directory to Excel" → save as CSV'}
                {stateUploadFormat === 'new_york_mwbe' && 'Go to ny.newnycontracts.com → select M/WBE → complete CAPTCHA → "Download Directory to Excel" → save as CSV'}
                {stateUploadFormat === 'florida_dbe' && 'Go to FL DOT DBE Directory → Report Format: Excel → Search (no criteria = all) → download → save as CSV'}
                {stateUploadFormat === 'virginia_swam' && 'Go to directory.sbsd.virginia.gov → search with no filters → export results → save as CSV'}
                {stateUploadFormat === 'georgia_dbe' && 'Go to GA DOT UCP Directory → export all results → save as CSV'}
                {stateUploadFormat === 'pennsylvania_sdb' && 'Go to PA DGS Small Diverse Business site → search all → export → save as CSV'}
                {stateUploadFormat === 'generic_state' && 'Download CSV from any state directory. Headers should include company name, email, phone, city, state, zip.'}
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-1">Upload CSV File</label>
                <input type="file" accept=".csv,.txt" onChange={(e) => setStateUploadFile(e.target.files?.[0] || null)}
                  className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm bg-white" />
                {stateUploadFile && <p className="text-xs text-purple-600 mt-1">{stateUploadFile.name} ({(stateUploadFile.size / 1024).toFixed(0)} KB)</p>}
              </div>

              <div className="flex gap-2">
                <button onClick={async () => {
                  if (!stateUploadFile) { setStateImportResult({ error: 'Please select a CSV file to upload' }); return }
                  setStateImporting(true); setStateImportResult(null)
                  try {
                    const csvData = await stateUploadFile.text()
                    const res = await fetch('/.netlify/functions/state-directory-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: stateUploadFormat, csvData, dryRun: true }) })
                    const data = await res.json(); setStateImportResult({ ...data, isDryRun: true })
                  } catch (e: any) { setStateImportResult({ error: e.message }) }
                  setStateImporting(false)
                }} disabled={stateImporting || !stateUploadFile} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-purple-600 text-purple-700 rounded-lg hover:bg-purple-100 font-medium disabled:opacity-50">
                  <Eye size={16} /> Preview
                </button>
                <button onClick={async () => {
                  if (!stateUploadFile) { setStateImportResult({ error: 'Please select a CSV file to upload' }); return }
                  if (!confirm('Import new records from uploaded file? Duplicates will be skipped.')) return
                  setStateImporting(true); setStateImportResult(null)
                  try {
                    const csvData = await stateUploadFile.text()
                    const res = await fetch('/.netlify/functions/state-directory-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: stateUploadFormat, csvData }) })
                    const data = await res.json(); setStateImportResult(data); if (data.success) fetchStats()
                  } catch (e: any) { setStateImportResult({ error: e.message }) }
                  setStateImporting(false)
                }} disabled={stateImporting || !stateUploadFile} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                  {stateImporting ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {stateImporting ? 'Importing...' : 'Import Now'}
                </button>
              </div>
            </div>
          )}

          {stateImportResult && (
            <div className={`p-4 rounded-lg ${stateImportResult.error ? 'bg-red-100 border border-red-300' : stateImportResult.isDryRun ? 'bg-blue-100 border border-blue-300' : 'bg-green-100 border border-green-300'}`}>
              {stateImportResult.error ? (
                <p className="text-sm text-red-700"><AlertCircle size={14} className="inline mr-1" />{stateImportResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {stateImportResult.isDryRun ? 'Preview Results' : 'Import Complete'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-bold text-lg text-gray-900">{stateImportResult.stats?.totalInFile?.toLocaleString()}</div>
                      <div className="text-gray-500">Records in File</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-bold text-lg text-gray-900">{stateImportResult.stats?.parsed?.toLocaleString()}</div>
                      <div className="text-gray-500">Valid Records</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-bold text-lg text-orange-600">{stateImportResult.stats?.duplicatesSkipped?.toLocaleString()}</div>
                      <div className="text-gray-500">Duplicates Skipped</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-bold text-lg text-green-600">{stateImportResult.stats?.newRecords?.toLocaleString() || stateImportResult.stats?.inserted?.toLocaleString()}</div>
                      <div className="text-gray-500">{stateImportResult.isDryRun ? 'New to Import' : 'Imported'}</div>
                    </div>
                  </div>
                  {stateImportResult.stats?.remaining > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                      {stateImportResult.stats.remaining.toLocaleString()} records remaining — run import again to get the next batch.
                    </p>
                  )}
                  {stateImportResult.sampleRecords && stateImportResult.sampleRecords.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Sample new records:</p>
                      <div className="space-y-1">
                        {stateImportResult.sampleRecords.map((r: any, i: number) => (
                          <div key={i} className="text-xs bg-white rounded px-2 py-1 flex justify-between">
                            <span className="font-medium">{r.company_name}</span>
                            <span className="text-gray-500">{r.city}, {r.state} {r.contact_email ? `• ${r.contact_email}` : '• no email'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-purple-700 bg-purple-100 rounded p-2">
            <strong>Deduplication:</strong> Records are matched by email address and vendor ID. Existing records, suppressed emails, 
            and previously imported records from the same source will be automatically skipped.
          </div>
        </div>
      )}

      {/* Email Verification Panel */}
      {showVerificationImport && (
        <div ref={verificationPanelRef} className="bg-cyan-50 border border-cyan-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-cyan-900 flex items-center gap-2"><ShieldCheck size={20} /> Email Verification</h3>
            <button onClick={() => setShowVerificationImport(false)} className="text-cyan-400 hover:text-cyan-600"><X size={18} /></button>
          </div>

          <p className="text-sm text-cyan-800">
            Verify all emails before sending outreach to protect your domain reputation. Invalid emails are archived automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Export */}
            <div className="bg-white rounded-lg p-4 border border-cyan-200">
              <h4 className="font-semibold text-gray-900 mb-2">Step 1: Export Emails</h4>
              <p className="text-xs text-gray-600 mb-3">
                Download all {stats.withEmail.toLocaleString()} emails as a CSV. Upload this file to a verification service like{' '}
                <a href="https://www.millionverifier.com" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline">MillionVerifier</a> (~$169 for 100K),{' '}
                <a href="https://www.zerobounce.net" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline">ZeroBounce</a>, or{' '}
                <a href="https://neverbounce.com" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline">NeverBounce</a>.
              </p>
              <button onClick={exportEmailsForVerification} disabled={exportingEmails}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                {exportingEmails ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exportingEmails ? exportEmailProgress || 'Exporting...' : `Export ${stats.withEmail.toLocaleString()} Emails`}
              </button>
            </div>

            {/* Step 2: Import Results */}
            <div className="bg-white rounded-lg p-4 border border-cyan-200">
              <h4 className="font-semibold text-gray-900 mb-2">Step 2: Import Verification Results</h4>
              <p className="text-xs text-gray-600 mb-3">
                Upload the results CSV from your verification service. Must have &ldquo;email&rdquo; and &ldquo;result&rdquo; (or &ldquo;status&rdquo;) columns.
                Invalid emails will be archived. Risky emails get lower health scores.
              </p>
              <input ref={verificationFileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importVerificationResults(f) }} />
              <button onClick={() => verificationFileRef.current?.click()} disabled={verificationImporting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                {verificationImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {verificationImporting ? 'Processing...' : 'Upload Verification CSV'}
              </button>
            </div>
          </div>

          {verificationResult && (
            <div className="bg-white rounded-lg p-4 border border-cyan-200">
              <h4 className="font-semibold text-gray-900 mb-2">Verification Results</h4>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{verificationResult.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Processed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{verificationResult.valid.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Valid (Safe to Send)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{verificationResult.risky.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Risky (Lowered Score)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{verificationResult.invalid.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Invalid (Archived)</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Invalid emails have been archived and will not receive outreach. Risky emails have reduced health scores and will be deprioritized in outreach.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Database Health Panel */}
      {showHealthPanel && (
        <div ref={healthPanelRef} className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-rose-900 flex items-center gap-2"><Activity size={20} /> Database Health & Hygiene</h3>
            <button onClick={() => setShowHealthPanel(false)} className="text-rose-400 hover:text-rose-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-rose-800">
            Real-time database quality monitoring. Records with hard bounces, dead domains, spam complaints, or expired SAM registrations are automatically purged.
            Health scores decay without engagement; archived records are excluded from search and outreach.
          </p>

          {healthLoading && (
            <div className="flex items-center gap-2 text-rose-600 text-sm py-4 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading health stats...
            </div>
          )}

          {healthError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <strong>Error loading stats:</strong> {healthError}
            </div>
          )}

          {healthStats && (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center border border-rose-100">
                  <div className="text-2xl font-bold text-gray-900">{(healthStats.total || 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total Records</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{(healthStats.active || 0).toLocaleString()}</div>
                  <div className="text-xs text-green-700">Active</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-amber-200">
                  <div className="text-2xl font-bold text-amber-600">{(healthStats.archived || 0).toLocaleString()}</div>
                  <div className="text-xs text-amber-700">Archived</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{(healthStats.suppressed || 0).toLocaleString()}</div>
                  <div className="text-xs text-red-700">Suppressed</div>
                </div>
              </div>

              {/* Health Score Distribution */}
              <div className="bg-white rounded-lg p-4 border border-rose-100">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Health Score Distribution</h4>
                <div className="flex items-end gap-1 h-20 mb-2">
                  {(() => {
                    const { high = 0, medium = 0, low = 0 } = healthStats.health_distribution || {}
                    const max = Math.max(high, medium, low, 1)
                    return (
                      <>
                        <div className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-green-500 rounded-t" style={{ height: `${(high / max) * 100}%`, minHeight: '4px' }}></div>
                          <span className="text-xs text-green-700 mt-1 font-medium">{high.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">High (70+)</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-amber-500 rounded-t" style={{ height: `${(medium / max) * 100}%`, minHeight: '4px' }}></div>
                          <span className="text-xs text-amber-700 mt-1 font-medium">{medium.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">Med (30-69)</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-red-500 rounded-t" style={{ height: `${(low / max) * 100}%`, minHeight: '4px' }}></div>
                          <span className="text-xs text-red-700 mt-1 font-medium">{low.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500">Low (&lt;30)</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>Overall Quality Score: <strong className="text-gray-800">{healthStats.data_quality_score}%</strong></span>
                  <span>Engaged: <strong className="text-blue-700">{(healthStats.engaged || 0).toLocaleString()}</strong></span>
                  <span>SAM Expired: <strong className="text-amber-700">{(healthStats.sam_expired || 0).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Recent Hygiene Actions */}
              {healthStats.recent_actions_7d && Object.keys(healthStats.recent_actions_7d).length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-rose-100">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Hygiene Actions (Last 7 Days)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(healthStats.recent_actions_7d).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                        <span className="text-gray-600">{action.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-gray-900">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Hygiene Actions — always visible when panel is open */}
          <div className="bg-white rounded-lg p-4 border border-rose-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Run Hygiene Cycle</h4>
            <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => runHygieneCycle('full-cycle')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium disabled:opacity-50">
                    {hygieneRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Full Cycle
                  </button>
                  <button onClick={() => runHygieneCycle('domain-check')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 text-sm disabled:opacity-50">
                    Domain MX Check
                  </button>
                  <button onClick={() => runHygieneCycle('decay-scoring')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 text-sm disabled:opacity-50">
                    Apply Score Decay
                  </button>
                  <button onClick={() => runHygieneCycle('engagement-decay')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 text-sm disabled:opacity-50">
                    Engagement Archive
                  </button>
                  <button onClick={() => runHygieneCycle('sam-expiry')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 text-sm disabled:opacity-50">
                    SAM Expiry Check
                  </button>
                  <button onClick={() => runHygieneCycle('auto-archive')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 text-sm disabled:opacity-50">
                    Auto-Archive (Score=0)
                  </button>
                  <button onClick={() => runHygieneCycle('archive-no-email')} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50">
                    Archive No-Email Records
                  </button>
                  <button onClick={async () => {
                    setHygieneRunning(true); setHygieneResult(null)
                    try {
                      const res = await fetch('/.netlify/functions/outreach-drip', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user-id': profile?.id || '' },
                        body: JSON.stringify({ action: 'run' }),
                      })
                      const data = await res.json()
                      setHygieneResult(data)
                    } catch (err: any) { setHygieneResult({ error: err.message }) }
                    setHygieneRunning(false)
                  }} disabled={hygieneRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                    Run Drip Follow-ups
                  </button>
                </div>

            {hygieneResult && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <strong>Cycle complete.</strong>
                <pre className="mt-1 text-xs whitespace-pre-wrap text-green-700">{JSON.stringify(hygieneResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Database size={14} /> Total Companies</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Mail size={14} /> With Email</div>
          <div className="text-2xl font-bold text-blue-600">{stats.withEmail.toLocaleString()}</div>
          <div className="text-xs text-gray-400">{stats.total > 0 ? Math.round(stats.withEmail / stats.total * 100) : 0}% have an email on file</div>
        </div>
        <div className="bg-white rounded-xl border border-green-300 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700 text-xs mb-1"><BadgeCheck size={14} /> Outreach Eligible</div>
          <div className="text-2xl font-bold text-green-700">{stats.outreachEligible.toLocaleString()}</div>
          <div className="text-xs text-green-600">Passed deliverability screening</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users size={14} /> Claimed</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.claimed.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><BadgeCheck size={14} /> Verified</div>
          <div className="text-2xl font-bold text-green-600">{stats.verified.toLocaleString()}</div>
        </div>
      </div>

      {/* Outreach Dashboard */}
      {SHOW_OUTREACH_METRICS && outreachStats.totalSent > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">Outreach Performance</h3>
            </div>
            <button onClick={fetchOutreachStats} disabled={outreachStatsLoading} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50">
              {outreachStatsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border border-indigo-100 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-indigo-400 text-xs mb-1"><Send size={12} /> Emails Sent</div>
              <div className="text-xl font-bold text-indigo-700">{outreachStats.totalSent}</div>
            </div>
            <div className="bg-white rounded-lg border border-indigo-100 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 text-xs mb-1"><Clock size={12} /> Sent Today</div>
              <div className="text-xl font-bold text-blue-700">{outreachStats.sentToday}</div>
            </div>
            <div className="bg-white rounded-lg border border-green-100 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-green-400 text-xs mb-1"><Users size={12} /> Claims</div>
              <div className="text-xl font-bold text-green-700">{outreachStats.totalClaimed}</div>
            </div>
            <div className="bg-white rounded-lg border border-purple-100 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-purple-400 text-xs mb-1"><TrendingUp size={12} /> Conversion</div>
              <div className="text-xl font-bold text-purple-700">
                {outreachStats.totalSent > 0 ? ((outreachStats.totalClaimed / outreachStats.totalSent) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          </div>

          {outreachStats.recentClaims.length > 0 && (
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2">
                <Activity size={12} /> Recent Claims
              </div>
              <div className="divide-y divide-gray-100">
                {outreachStats.recentClaims.map((claim: any) => (
                  <div key={claim.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{claim.company_name}</span>
                      {claim.city && claim.state && (
                        <span className="text-gray-400 ml-2 text-xs">{claim.city}, {claim.state}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(claim.claimed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                      {new Date(claim.claimed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outreachStats.recentClaims.length === 0 && (
            <div className="text-center py-3 text-sm text-indigo-400">
              No claims yet — activity will appear here as subcontractors claim their profiles
            </div>
          )}

          {/* Email Delivery Metrics */}
          <div className="mt-4 bg-white rounded-lg border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-600" />
                <h4 className="font-semibold text-sm text-indigo-900">Email Delivery Metrics</h4>
              </div>
              <button onClick={fetchEmailMetrics} disabled={emailMetricsLoading} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50">
                {emailMetricsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {emailMetrics ? 'Refresh' : 'Load Metrics'}
              </button>
            </div>

            {/* Warmup Schedule Status */}
            {emailMetrics?.warmup?.active && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-medium mb-1">
                  <Clock size={12} /> Domain Warmup Active — Day {emailMetrics.warmup.day}
                </div>
                <div className="text-amber-700 text-xs">
                  Sending {emailMetrics.warmup.sent_today} / {emailMetrics.warmup.daily_limit} emails today via <span className="font-mono text-amber-900">{emailMetrics.warmup.domain}</span>
                </div>
              </div>
            )}

            {!emailMetrics && !emailMetricsLoading && (
              <div className="text-center py-4 text-sm text-gray-400">
                Loading delivery metrics...
              </div>
            )}

            {emailMetricsLoading && (
              <div className="text-center py-4 text-sm text-indigo-500 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading delivery metrics...
              </div>
            )}

            {emailMetrics && (
              <>
                {/* Primary: Real Human Engagement (bot-filtered) */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-1.5 flex items-center gap-1">
                    <Users size={10} /> Real Human Engagement (bot-filtered)
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="bg-green-50 rounded-lg p-2.5 text-center border border-green-200">
                      <div className="text-[10px] uppercase tracking-wider text-green-600 font-medium">Delivered</div>
                      <div className="text-lg font-bold text-green-700">{emailMetrics.summary.delivered}</div>
                      <div className="text-[10px] text-green-500">{emailMetrics.summary.delivery_rate}% rate</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center border border-blue-200">
                      <div className="text-[10px] uppercase tracking-wider text-blue-600 font-medium">Human Opens</div>
                      <div className="text-lg font-bold text-blue-700">{emailMetrics.summary.human_opened ?? emailMetrics.summary.opened}</div>
                      <div className="text-[10px] text-blue-500">{emailMetrics.summary.open_rate}% rate</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2.5 text-center border border-amber-200">
                      <div className="text-[10px] uppercase tracking-wider text-amber-600 font-medium">Human Clicks</div>
                      <div className="text-lg font-bold text-amber-700">{emailMetrics.summary.human_clicked ?? emailMetrics.summary.clicked}</div>
                      <div className="text-[10px] text-amber-500">{emailMetrics.summary.click_rate}% rate</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2.5 text-center border border-purple-200">
                      <div className="text-[10px] uppercase tracking-wider text-purple-600 font-medium">Page Visits</div>
                      <div className="text-lg font-bold text-purple-700">{emailMetrics.summary.page_visits ?? 0}</div>
                      <div className="text-[10px] text-purple-500">JS-verified</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2.5 text-center border-2 border-emerald-400">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">Claimed</div>
                      <div className="text-lg font-bold text-emerald-700">{emailMetrics.summary.confirmed ?? 0}</div>
                      <div className="text-[10px] text-emerald-500">confirmed</div>
                    </div>
                  </div>
                </div>

                {/* Secondary: Raw metrics (includes bots) */}
                <details className="mb-3">
                  <summary className="text-[10px] uppercase tracking-wider text-gray-400 font-medium cursor-pointer hover:text-gray-600">
                    Raw metrics (includes bots) — {emailMetrics.summary.opened} opens / {emailMetrics.summary.clicked} clicks / {emailMetrics.summary.not_delivered} bounced
                  </summary>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-400">Raw Opens</div>
                      <div className="text-sm font-bold text-gray-500">{emailMetrics.summary.opened}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-400">Raw Clicks</div>
                      <div className="text-sm font-bold text-gray-500">{emailMetrics.summary.clicked}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-400">Total Opens</div>
                      <div className="text-sm font-bold text-gray-500">{emailMetrics.summary.total_opens}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-red-400">Bounced</div>
                      <div className="text-sm font-bold text-red-500">{emailMetrics.summary.not_delivered}</div>
                    </div>
                  </div>
                </details>

                <button onClick={() => setShowEmailDetails(!showEmailDetails)} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 mb-2">
                  {showEmailDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showEmailDetails ? 'Hide' : 'Show'} individual email details ({emailMetrics.emails.length})
                </button>

                {showEmailDetails && (
                  <div className="max-h-[400px] overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-2 font-medium text-gray-600">Recipient</th>
                          <th className="text-center p-2 font-medium text-gray-600">Status</th>
                          <th className="text-center p-2 font-medium text-gray-600">Opens</th>
                          <th className="text-center p-2 font-medium text-gray-600">Clicks</th>
                          <th className="text-right p-2 font-medium text-gray-600">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {emailMetrics.emails.map((email: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-2">
                              <div className="font-medium text-gray-800 truncate max-w-[250px]">{email.subject?.replace(' — Your Procuvex Profile Is Ready', '') || 'N/A'}</div>
                              <div className="text-gray-400 truncate max-w-[250px]">{email.to}</div>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                email.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                email.status === 'bot_open' ? 'bg-gray-100 text-gray-500' :
                                email.status === 'human_open' ? 'bg-blue-100 text-blue-700' :
                                email.status === 'not_delivered' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{email.status === 'not_delivered' ? 'bounced' : email.status === 'bot_open' ? 'bot' : email.status === 'human_open' ? 'human' : email.status}</span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={email.opens > 0 ? 'text-blue-700 font-bold' : 'text-gray-300'}>{email.opens}</span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={email.clicks > 0 ? 'text-amber-700 font-bold' : 'text-gray-300'}>{email.clicks}</span>
                            </td>
                            <td className="p-2 text-right text-gray-400">
                              {email.lastEvent ? new Date(email.lastEvent).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(email.lastEvent).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search company name, city, description, UEI..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <select value={filterState} onChange={e => { setFilterState(e.target.value); setPage(0) }}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All States</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTrade} onChange={e => { setFilterTrade(e.target.value); setPage(0) }}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All Trades</option>
          {TRADE_CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterVerification} onChange={e => { setFilterVerification(e.target.value); setPage(0) }}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All Status</option>
          <option value="verified">Verified</option>
          <option value="claimed">Claimed</option>
          <option value="unverified">Unverified</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filterSmallBiz} onChange={e => { setFilterSmallBiz(e.target.checked); setPage(0) }}
            className="rounded border-gray-300" />
          Small Business
        </label>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Sort by:</span>
        {(['company_name', 'created_at', 'profile_completeness', 'match_count'] as const).map(col => (
          <button key={col} onClick={() => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('asc') } }}
            className={`px-2 py-1 rounded ${sortBy === col ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'}`}>
            {col === 'company_name' ? 'Name' : col === 'created_at' ? 'Date Added' : col === 'profile_completeness' ? 'Profile %' : 'Matches'}
            {sortBy === col && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </button>
        ))}
        <span className="ml-auto text-gray-400">{totalCount.toLocaleString()} results</span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading...
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Database size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">
            {search || filterState || filterTrade ? 'No subcontractors match your filters.' : 'No subcontractors in the master database yet.'}
          </p>
          <p className="text-sm text-gray-400">Use "Import from SAM.gov" above to seed the database with registered government entities.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map(sub => {
            const vStatus = VERIFICATION_LABELS[sub.verification_status] || VERIFICATION_LABELS.unverified
            const VIcon = vStatus.icon
            const isExpanded = expandedId === sub.id
            return (
              <div key={sub.id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
                  {/* Company Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{sub.company_name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${vStatus.color}`}>
                        <VIcon size={12} /> {vStatus.label}
                      </span>
                      {sub.small_business && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Star size={12} /> Small Biz
                        </span>
                      )}
                      {sub.source_id?.startsWith('gsa:') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <ShieldCheck size={12} /> GSA Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {sub.city && sub.state && (
                        <span className="flex items-center gap-1"><MapPin size={13} /> {sub.city}, {sub.state}</span>
                      )}
                      {sub.contact_email && (
                        <span className="flex items-center gap-1"><Mail size={13} /> {sub.contact_email}</span>
                      )}
                      {sub.sam_uei && (
                        <span className="text-xs text-gray-400">UEI: {sub.sam_uei}</span>
                      )}
                    </div>
                    {sub.trade_categories && sub.trade_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {sub.trade_categories.slice(0, 5).map(t => (
                          <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{t}</span>
                        ))}
                        {sub.trade_categories.length > 5 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">+{sub.trade_categories.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Profile Completeness — recalculate client-side for accuracy */}
                  {(() => {
                    const fields = [
                      sub.company_name, sub.contact_email, sub.contact_phone,
                      sub.city, sub.state, sub.website, sub.description,
                      sub.naics_codes?.length > 0 ? 'yes' : null,
                      sub.trade_categories?.length > 0 ? 'yes' : null,
                      sub.sam_uei,
                      sub.small_business_types?.length > 0 ? 'yes' : null,
                      sub.source_id,
                    ]
                    const filled = fields.filter(f => f && String(f).length > 0).length
                    const pct = Math.round((filled / fields.length) * 100)
                    return (
                  <div className="text-center px-3">
                    <div className="text-lg font-bold text-gray-700">{pct}%</div>
                    <div className="text-xs text-gray-400">Profile</div>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct >= 80 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#9ca3af',
                        }}
                      />
                    </div>
                  </div>
                    )
                  })()}

                  {/* Small biz types */}
                  {sub.small_business_types && sub.small_business_types.length > 0 && (
                    <div className="hidden lg:flex flex-col gap-0.5">
                      {sub.small_business_types.slice(0, 3).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded font-medium text-center">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Expand arrow */}
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-xs text-gray-400 block">Contact</span>
                        <span className="text-gray-700">{sub.contact_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Phone</span>
                        <span className="text-gray-700">{sub.contact_phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Website</span>
                        {sub.website ? (
                          <a href={sub.website.startsWith('http') ? sub.website : `https://${sub.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1">
                            {sub.website.replace(/^https?:\/\//, '').substring(0, 35)} <ExternalLink size={12} />
                          </a>
                        ) : '—'}
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">CAGE Code</span>
                        <span className="text-gray-700">{sub.cage_code || '—'}</span>
                      </div>
                    </div>
                    {sub.source_id?.startsWith('gsa:') && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-xs text-gray-400 block">GSA Contract #</span>
                          <span className="text-gray-700 font-mono text-xs">{sub.source_id.replace('gsa:', '')}</span>
                        </div>
                        {sub.sam_expiration_date && (
                          <div>
                            <span className="text-xs text-gray-400 block">Contract Expiration</span>
                            <span className="text-gray-700">{new Date(sub.sam_expiration_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {sub.description && (
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">Description</span>
                        <p className="text-sm text-gray-600">{sub.description}</p>
                      </div>
                    )}
                    {sub.naics_codes && sub.naics_codes.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">NAICS Codes</span>
                        <div className="flex flex-wrap gap-1">
                          {sub.naics_codes.map(c => (
                            <span key={c} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-gray-200">
                      <span>Added: {new Date(sub.created_at).toLocaleDateString()}</span>
                      <span>Source: {sub.source_id?.startsWith('gsa:') ? 'GSA eLibrary' : sub.data_source === 'sam_gov' ? 'SAM.gov' : sub.data_source === 'import' ? 'SBS Import' : sub.data_source}</span>
                      <span>Matches: {sub.match_count}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSub(sub.id) }}
                        className="ml-auto text-red-500 hover:text-red-700 flex items-center gap-1">
                        <Trash2 size={12} /> Delete
                      </button>
                      <Link to={`/sub/${sub.slug}`} target="_blank"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        <ExternalLink size={12} /> View Public Profile
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
