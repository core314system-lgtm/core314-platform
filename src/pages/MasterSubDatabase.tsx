import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TRADE_CATEGORIES, naicsToTradeNames, naicsToCategoryIds, generateSlug } from '../lib/naicsTradeMapping'
import {
  Search, MapPin, Mail, ShieldCheck,
  ChevronDown, ChevronUp, Download, Upload, Star,
  Users, BadgeCheck, Clock, Eye, ExternalLink, Loader2, X,
  Database, AlertCircle, FileUp, Lock,
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
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  unverified: { label: 'Unverified', color: 'bg-gray-100 text-gray-600', icon: Clock },
  claimed: { label: 'Claimed', color: 'bg-blue-100 text-blue-700', icon: Users },
  pending_verification: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700', icon: BadgeCheck },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600', icon: AlertCircle },
}

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
  const [stats, setStats] = useState({ total: 0, verified: 0, claimed: 0, withEmail: 0 })
  const [showOutreach, setShowOutreach] = useState(false)
  const [outreachState, setOutreachState] = useState('')
  const [outreachTrade, setOutreachTrade] = useState('')
  const [outreachLimit, setOutreachLimit] = useState(50)
  const [outreachSending, setOutreachSending] = useState(false)
  const [outreachResult, setOutreachResult] = useState<any>(null)
  const [outreachPreview, setOutreachPreview] = useState<any>(null)

  const PAGE_SIZE = 50

  const fetchStats = useCallback(async () => {
    const { count: total } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true })
    const { count: verified } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).eq('verification_status', 'verified')
    const { count: claimed } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).eq('verification_status', 'claimed')
    const { count: withEmail } = await supabase.from('master_subcontractors').select('id', { count: 'exact', head: true }).not('contact_email', 'is', null)
    setStats({
      total: total || 0,
      verified: verified || 0,
      claimed: claimed || 0,
      withEmail: withEmail || 0,
    })
  }, [])

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

  useEffect(() => { fetchSubs(); fetchStats() }, [fetchSubs, fetchStats])

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
    setFileProgress('Reading file... (large files may take a moment)')

    try {
      // Stream large files in chunks to avoid memory issues
      const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB chunks
      let text = ''
      let offset = 0
      const fileSize = file.size

      while (offset < fileSize) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE)
        text += await chunk.text()
        offset += CHUNK_SIZE
        if (fileSize > CHUNK_SIZE) {
          setFileProgress(`Reading file... ${Math.min(100, Math.round(offset / fileSize * 100))}%`)
        }
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim())
      setFileProgress(`Parsed ${lines.length.toLocaleString()} lines. Processing...`)

      // Skip header if present (check if first field looks like a UEI)
      let startIdx = 0
      if (lines.length > 0) {
        const firstFields = parseSamCsvLine(lines[0])
        if (firstFields[0]?.includes('UNIQUE') || firstFields[0]?.includes('UEI') || firstFields[0]?.toUpperCase?.().includes('ENTITY') || firstFields[0]?.length > 12) {
          startIdx = 1
        }
      }

      // Parse records
      const records: any[] = []
      let skippedNonUS = 0
      let skippedNoName = 0
      let skippedExpired = 0

      for (let i = startIdx; i < lines.length; i++) {
        if (i % 10000 === 0 && i > 0) {
          setFileProgress(`Processing... ${i.toLocaleString()} / ${lines.length.toLocaleString()} lines (${records.length} matched)`)
          await new Promise(r => setTimeout(r, 0)) // yield to UI
        }
        if (!lines[i]) continue
        const fields = parseSamCsvLine(lines[i])
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
        const url = (fields[SAM_COLUMNS.URL] || '').trim()

        // NAICS codes (defensive — column indices may vary)
        const naicsPrimary = (fields[SAM_COLUMNS.NAICS_PRIMARY] ?? '').trim()
        const naicsSecondary = (fields[SAM_COLUMNS.NAICS_SECONDARY] ?? '').trim()
        const secondaryList = naicsSecondary ? naicsSecondary.split(/[~,;|]/) : []
        const allNaics = [naicsPrimary, ...secondaryList].filter(n => n && n.trim() && /^\d{2,6}$/.test(n.trim())).map(n => n.trim())

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

        // POC info (may be empty in public extract)
        const pocFirst = (fields[SAM_COLUMNS.POC_GOV_FIRST] || '').trim()
        const pocLast = (fields[SAM_COLUMNS.POC_GOV_LAST] || '').trim()
        const contactName = [pocFirst, pocLast].filter(Boolean).join(' ') || null

        const slug = generateSlug(companyName)

        // Calculate profile completeness
        let completeness = 30 // base for having name + UEI
        if (city) completeness += 10
        if (state) completeness += 10
        if (url) completeness += 15
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
          website: url ? (url.startsWith('http') ? url : `https://${url}`) : null,
          naics_codes: allNaics,
          trade_categories: tradeNames,
          service_categories: tradeIds,
          small_business: sbaTypes.length > 0,
          small_business_types: sbaTypes,
          geographic_coverage: state ? [state] : [],
          contact_name: contactName,
          verification_status: 'unverified',
          data_source: 'sam_gov_extract',
          profile_completeness: completeness,
          sam_registration_status: 'active',
        })
      }

      setFileProgress(`Found ${records.length.toLocaleString()} matching records. Importing in batches...`)

      if (records.length === 0) {
        setFileResult({
          imported: 0,
          skipped: 0,
          total: lines.length - startIdx,
          skippedNonUS,
          skippedNoName,
          skippedExpired,
          message: 'No matching records found. Try adjusting state/NAICS filters.'
        })
        setFileUploading(false)
        return
      }

      // Import in batches of 50, using upsert to skip duplicates
      const BATCH_SIZE = 50
      let imported = 0
      let skipped = 0
      let errors: string[] = []

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        setFileProgress(`Importing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(records.length / BATCH_SIZE)}... (${imported} imported so far)`)

        const { data, error } = await supabase
          .from('master_subcontractors')
          .upsert(batch, { onConflict: 'sam_uei', ignoreDuplicates: true })
          .select('id')

        if (error) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
          // Try individual inserts for this batch
          for (const record of batch) {
            const { error: singleErr } = await supabase
              .from('master_subcontractors')
              .upsert(record, { onConflict: 'sam_uei', ignoreDuplicates: true })
            if (!singleErr) imported++
            else skipped++
          }
        } else {
          imported += data?.length || batch.length
        }
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
    const { data } = await supabase.from('master_subcontractors').select('*').order('company_name')
    if (!data || data.length === 0) return
    const headers = ['Company Name', 'Email', 'Phone', 'City', 'State', 'SAM UEI', 'CAGE', 'NAICS Codes', 'Trade Categories', 'Small Business Types', 'Verification', 'Profile %', 'Website']
    const rows = data.map(s => [
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
      body: JSON.stringify({ action: 'send-outreach', state: outreachState, trade: outreachTrade, limit: outreachLimit }),
    })
    const data = await res.json()
    setOutreachResult(data)
    setOutreachSending(false)
    setOutreachPreview(null)
    fetchStats()
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
          <p className="text-sm text-gray-500 mt-1">Procuvex verified network of subcontractors across all trades</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => { setShowOutreach(!showOutreach); setShowImport(false) }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50">
            <Mail size={16} /> Send Outreach
          </button>
          <button onClick={() => { setShowImport(!showImport); setShowOutreach(false) }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Upload size={16} /> Import from SAM.gov
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Database size={14} /> Total Companies</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Mail size={14} /> With Email</div>
          <div className="text-2xl font-bold text-blue-600">{stats.withEmail.toLocaleString()}</div>
          <div className="text-xs text-gray-400">{stats.total > 0 ? Math.round(stats.withEmail / stats.total * 100) : 0}% reachable</div>
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

      {/* Outreach Panel */}
      {showOutreach && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-green-900">Send Claim Outreach Emails</h3>
            <button onClick={() => setShowOutreach(false)} className="text-green-400 hover:text-green-600"><X size={18} /></button>
          </div>
          <p className="text-sm text-green-700">
            Send claim invitation emails to unclaimed subcontractors with email addresses.
            Each email contains a unique claim link valid for 90 days.
          </p>

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
              <p className="font-medium text-green-800 mb-2">{outreachPreview.total} eligible recipients found</p>
              {outreachPreview.targets?.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{t.company_name}</span>
                  <span className="text-gray-400 text-xs">{t.contact_email} • {t.state}</span>
                </div>
              ))}
              {outreachPreview.total > 5 && <p className="text-xs text-gray-400 mt-1">...and {outreachPreview.total - 5} more</p>}
            </div>
          )}

          {outreachResult && (
            <div className={`p-3 rounded-lg text-sm ${outreachResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-100 border border-green-300 text-green-800'}`}>
              {outreachResult.error ? (
                <p>{outreachResult.error}</p>
              ) : (
                <p>
                  <strong>{outreachResult.sent}</strong> emails sent successfully
                  {outreachResult.failed > 0 && <>, <strong>{outreachResult.failed}</strong> failed</>}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
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

                  {/* Profile Completeness */}
                  <div className="text-center px-3">
                    <div className="text-lg font-bold text-gray-700">{sub.profile_completeness}%</div>
                    <div className="text-xs text-gray-400">Profile</div>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${sub.profile_completeness}%`,
                          backgroundColor: sub.profile_completeness >= 80 ? '#16a34a' : sub.profile_completeness >= 50 ? '#2563eb' : '#9ca3af',
                        }}
                      />
                    </div>
                  </div>

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
                      <span>Source: {sub.data_source === 'sam_gov' ? 'SAM.gov' : sub.data_source}</span>
                      <span>Matches: {sub.match_count}</span>
                      <Link to={`/sub/${sub.slug}`} target="_blank"
                        className="ml-auto text-blue-600 hover:text-blue-700 flex items-center gap-1">
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
