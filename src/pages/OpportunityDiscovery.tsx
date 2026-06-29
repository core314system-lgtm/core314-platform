import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import {
  Search, ExternalLink, Plus, CheckCircle, Building, Globe, Loader2, AlertCircle,
  Radar, ShieldCheck, Clock, Calendar, Filter,
  Star, RefreshCw, X, Settings2,
  MapPin, FileText, AlertTriangle, TrendingUp
} from 'lucide-react'

// ========== Types ==========
interface Opportunity {
  noticeId: string
  title: string
  solicitationNumber: string
  agency: string
  postedDate: string
  responseDeadline: string
  daysUntilDeadline: number | null
  urgency: 'expired' | 'critical' | 'urgent' | 'normal' | 'relaxed'
  type: string
  typeCode: string
  setAside: string | null
  naicsCode: string
  classificationCode: string
  active: boolean
  description: string
  uiLink: string
  placeOfPerformance: { city: string | null; state: string | null; stateName: string | null } | null
  pointOfContact: Array<{ name: string; email: string; phone: string }>
  matchScore?: number
  matchReasons?: string[]
}

interface SearchPreferences {
  naicsCodes: string[]
  setAsides: string[]
  keywords: string[]
  agencies: string[]
  solicitationTypes: string[]
  states: string[]
  postedWithinDays: number
  deadlineWithinDays: number | null
}

// ========== Constants ==========
const OPP_TYPES = [
  { value: 'o', label: 'Solicitation' },
  { value: 'p', label: 'Presolicitation' },
  { value: 'k', label: 'Combined Synopsis/Solicitation' },
  { value: 'r', label: 'Sources Sought' },
  { value: 's', label: 'Special Notice' },
  { value: 'i', label: 'Intent to Bundle' },
]

const SET_ASIDES = [
  { value: 'SBA', label: 'Total Small Business' },
  { value: 'SBP', label: 'Partial Small Business' },
  { value: '8A', label: '8(a)' },
  { value: '8AN', label: '8(a) Sole Source' },
  { value: 'HZC', label: 'HUBZone' },
  { value: 'HZS', label: 'HUBZone Sole Source' },
  { value: 'SDVOSBC', label: 'SDVOSB' },
  { value: 'SDVOSBS', label: 'SDVOSB Sole Source' },
  { value: 'WOSB', label: 'WOSB' },
  { value: 'EDWOSB', label: 'EDWOSB' },
  { value: 'VSA', label: 'Veteran-Owned SB' },
]

const COMMON_AGENCIES = [
  'Department of Defense',
  'Department of the Army',
  'Department of the Navy',
  'Department of the Air Force',
  'Department of Veterans Affairs',
  'Department of Homeland Security',
  'General Services Administration',
  'Department of Health and Human Services',
  'Department of Energy',
  'National Aeronautics and Space Administration',
  'Department of Justice',
  'Department of the Interior',
  'Department of Transportation',
  'Department of State',
  'Environmental Protection Agency',
  'Department of Agriculture',
  'Department of Commerce',
  'Department of Labor',
  'Department of Education',
  'Department of Housing and Urban Development',
  'Small Business Administration',
  'Social Security Administration',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY'
]

const PREFS_KEY = 'procuvex_opportunity_preferences'

const DEFAULT_PREFS: SearchPreferences = {
  naicsCodes: [],
  setAsides: [],
  keywords: [],
  agencies: [],
  solicitationTypes: ['o', 'k'],
  states: [],
  postedWithinDays: 30,
  deadlineWithinDays: null,
}

function loadPreferences(): SearchPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS }
}

function savePreferencesLocal(prefs: SearchPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// ========== Match Scoring ==========
function calculateMatchScore(opp: Opportunity, prefs: SearchPreferences): { score: number; reasons: string[] } {
  let score = 50 // base score
  const reasons: string[] = []

  // NAICS match (+25)
  if (prefs.naicsCodes.length > 0 && opp.naicsCode) {
    const exactMatch = prefs.naicsCodes.includes(opp.naicsCode)
    const prefixMatch = prefs.naicsCodes.some(n => opp.naicsCode.startsWith(n.substring(0, 4)))
    if (exactMatch) {
      score += 25
      reasons.push('NAICS code match')
    } else if (prefixMatch) {
      score += 15
      reasons.push('Related NAICS code')
    }
  }

  // Set-aside match (+15)
  if (prefs.setAsides.length > 0 && opp.setAside) {
    const saMatch = prefs.setAsides.some(sa => {
      const saMap: Record<string, string[]> = {
        SBA: ['Total Small Business', 'Small Business'],
        SBP: ['Partial Small Business'],
        '8A': ['8(a)'],
        '8AN': ['8(a) Sole Source'],
        HZC: ['HUBZone'],
        HZS: ['HUBZone Sole Source'],
        SDVOSBC: ['Service-Disabled Veteran', 'SDVOSB'],
        SDVOSBS: ['SDVOSB Sole Source'],
        WOSB: ['Women-Owned'],
        EDWOSB: ['Economically Disadvantaged'],
        VSA: ['Veteran-Owned'],
      }
      return (saMap[sa] || [sa]).some(label => opp.setAside!.toLowerCase().includes(label.toLowerCase()))
    })
    if (saMatch) {
      score += 15
      reasons.push('Set-aside eligibility match')
    }
  }

  // Keyword match (+10 per keyword, max +20)
  if (prefs.keywords.length > 0 && opp.title) {
    let kwMatches = 0
    for (const kw of prefs.keywords) {
      if (opp.title.toLowerCase().includes(kw.toLowerCase()) ||
          opp.description.toLowerCase().includes(kw.toLowerCase())) {
        kwMatches++
      }
    }
    if (kwMatches > 0) {
      score += Math.min(kwMatches * 10, 20)
      reasons.push(`${kwMatches} keyword match${kwMatches > 1 ? 'es' : ''}`)
    }
  }

  // State match (+5)
  if (prefs.states.length > 0 && opp.placeOfPerformance?.state) {
    if (prefs.states.includes(opp.placeOfPerformance.state)) {
      score += 5
      reasons.push('Location match')
    }
  }

  // Deadline urgency bonus/penalty
  if (opp.daysUntilDeadline !== null) {
    if (opp.daysUntilDeadline <= 3 && opp.daysUntilDeadline >= 0) {
      score -= 5 // slight penalty for very tight deadlines
      reasons.push('Tight deadline')
    }
    if (opp.daysUntilDeadline < 0) {
      score -= 30
      reasons.push('Deadline passed')
    }
  }

  // Solicitation type bonus
  if (opp.typeCode === 'k' || opp.typeCode === 'o') {
    score += 5
    reasons.push('Active solicitation')
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

// ========== Urgency Badge ==========
function UrgencyBadge({ urgency, days }: { urgency: string; days: number | null }) {
  if (days === null) return null

  const config: Record<string, { bg: string; text: string; label: string }> = {
    expired: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Expired' },
    critical: { bg: 'bg-red-100', text: 'text-red-700', label: `${days}d left` },
    urgent: { bg: 'bg-amber-100', text: 'text-amber-700', label: `${days}d left` },
    normal: { bg: 'bg-blue-100', text: 'text-blue-700', label: `${days}d left` },
    relaxed: { bg: 'bg-green-100', text: 'text-green-700', label: `${days}d left` },
  }

  const c = config[urgency] || config.normal

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Clock size={12} />
      {c.label}
    </span>
  )
}

// ========== Match Score Badge ==========
function MatchScoreBadge({ score }: { score: number }) {
  let color = 'bg-gray-100 text-gray-600'
  if (score >= 80) color = 'bg-green-100 text-green-700'
  else if (score >= 60) color = 'bg-blue-100 text-blue-700'
  else if (score >= 40) color = 'bg-amber-100 text-amber-700'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Star size={12} />
      {score}% match
    </span>
  )
}

// ========== Main Component ==========
export default function OpportunityDiscovery() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()

  // Preferences
  const [prefs, setPrefs] = useState<SearchPreferences>(loadPreferences)
  const [showPreferences, setShowPreferences] = useState(false)
  const [naicsInput, setNaicsInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [savedPrefs, setSavedPrefs] = useState(false)
  const prefsRef = useRef<HTMLDivElement>(null)

  // Scroll to preferences panel when it opens
  useEffect(() => {
    if (showPreferences && prefsRef.current) {
      prefsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showPreferences])

  // Load preferences from database on mount
  useEffect(() => {
    async function loadFromDb() {
      try {
        const { data } = await supabase
          .from('company_profile')
          .select('opportunity_preferences')
          .limit(1)
          .single()
        if (data?.opportunity_preferences && typeof data.opportunity_preferences === 'object') {
          const dbPrefs = data.opportunity_preferences as Partial<SearchPreferences>
          const merged: SearchPreferences = {
            naicsCodes: dbPrefs.naicsCodes || DEFAULT_PREFS.naicsCodes,
            setAsides: dbPrefs.setAsides || DEFAULT_PREFS.setAsides,
            keywords: dbPrefs.keywords || DEFAULT_PREFS.keywords,
            agencies: dbPrefs.agencies || DEFAULT_PREFS.agencies,
            solicitationTypes: dbPrefs.solicitationTypes || DEFAULT_PREFS.solicitationTypes,
            states: dbPrefs.states || DEFAULT_PREFS.states,
            postedWithinDays: dbPrefs.postedWithinDays || DEFAULT_PREFS.postedWithinDays,
            deadlineWithinDays: dbPrefs.deadlineWithinDays ?? DEFAULT_PREFS.deadlineWithinDays,
          }
          // Only use DB prefs if they have meaningful content
          if (merged.naicsCodes.length > 0 || merged.keywords.length > 0 || merged.setAsides.length > 0) {
            setPrefs(merged)
            savePreferencesLocal(merged)
          }
        }
      } catch { /* company_profile table or column may not exist yet */ }
    }
    loadFromDb()
  }, [])

  // Search state
  const [results, setResults] = useState<Opportunity[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [offset, setOffset] = useState(0)

  // Quick search override
  const [quickKeyword, setQuickKeyword] = useState('')

  // Import state
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterSetAside, setFilterSetAside] = useState('')
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'posted'>('match')

  // Expanded opportunity
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Save preferences to localStorage and database
  async function handleSavePreferences() {
    savePreferencesLocal(prefs)
    setSavedPrefs(true)
    setTimeout(() => setSavedPrefs(false), 2000)

    // Persist to database
    try {
      const { data: existing } = await supabase
        .from('company_profile')
        .select('id')
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from('company_profile')
          .update({ opportunity_preferences: prefs, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('company_profile')
          .insert({ company_name: 'My Company', opportunity_preferences: prefs })
      }
    } catch { /* column may not exist yet — localStorage fallback still works */ }
  }

  // Add NAICS code
  function addNaicsCode() {
    const code = naicsInput.trim()
    if (code && !prefs.naicsCodes.includes(code)) {
      setPrefs(p => ({ ...p, naicsCodes: [...p.naicsCodes, code] }))
    }
    setNaicsInput('')
  }

  // Add keyword
  function addKeyword() {
    const kw = keywordInput.trim()
    if (kw && !prefs.keywords.includes(kw)) {
      setPrefs(p => ({ ...p, keywords: [...p.keywords, kw] }))
    }
    setKeywordInput('')
  }

  // Search
  const handleSearch = useCallback(async (newOffset = 0) => {
    setSearching(true)
    setError('')
    setOffset(newOffset)

    try {
      const searchBody: Record<string, unknown> = {
        naicsCodes: prefs.naicsCodes,
        setAsides: prefs.setAsides,
        keywords: quickKeyword ? [...prefs.keywords, quickKeyword] : prefs.keywords,
        agencies: prefs.agencies,
        solicitationTypes: prefs.solicitationTypes,
        states: prefs.states,
        activeOnly: true,
        postedWithinDays: prefs.postedWithinDays || 30,
        limit: 25,
        offset: newOffset,
      }

      if (prefs.deadlineWithinDays) {
        searchBody.deadlineWithinDays = prefs.deadlineWithinDays
      }

      const res = await fetch('/api/sam-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Search failed' }))
        setError(err.error || 'Search failed')
        setSearching(false)
        return
      }

      const data = await res.json()
      let opps: Opportunity[] = data.opportunities || []

      // Calculate match scores
      opps = opps.map(opp => {
        const { score, reasons } = calculateMatchScore(opp, prefs)
        return { ...opp, matchScore: score, matchReasons: reasons }
      })

      setResults(opps)
      setTotalRecords(data.totalRecords || 0)
      setHasSearched(true)
    } catch {
      setError('Network error — could not reach SAM.gov. Please try again.')
    }
    setSearching(false)
  }, [prefs, quickKeyword])

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    // Apply local filters first
    if (sortBy === 'match') return (b.matchScore || 0) - (a.matchScore || 0)
    if (sortBy === 'deadline') {
      if (a.daysUntilDeadline === null) return 1
      if (b.daysUntilDeadline === null) return -1
      return a.daysUntilDeadline - b.daysUntilDeadline
    }
    if (sortBy === 'posted') return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
    return 0
  })

  // Apply local filters
  const filteredResults = sortedResults.filter(opp => {
    if (filterType && opp.typeCode !== filterType) return false
    if (filterSetAside && opp.setAside && !opp.setAside.toLowerCase().includes(
      SET_ASIDES.find(s => s.value === filterSetAside)?.label.toLowerCase() || ''
    )) return false
    return true
  })

  // Import opportunity as project
  async function handleImport(opp: Opportunity) {
    setImportingId(opp.noticeId)

    const insertData: Record<string, unknown> = {
      title: opp.title,
      solicitation_number: opp.solicitationNumber || null,
      site_name: opp.placeOfPerformance?.city && opp.placeOfPerformance?.state
        ? `${opp.placeOfPerformance.city}, ${opp.placeOfPerformance.state}`
        : opp.agency || null,
      location_city: opp.placeOfPerformance?.city || null,
      location_state: opp.placeOfPerformance?.state || null,
      due_date: opp.responseDeadline ? new Date(opp.responseDeadline).toISOString().split('T')[0] : null,
      notes: `Imported from SAM.gov Opportunity Feed\nAgency: ${opp.agency}\nNotice ID: ${opp.noticeId}\nSolicitation: ${opp.solicitationNumber}\nNAICS: ${opp.naicsCode}\nSet-Aside: ${opp.setAside || 'None'}\nType: ${opp.type}\nMatch Score: ${opp.matchScore || 'N/A'}%\n${opp.pointOfContact.length > 0 ? `Contact: ${opp.pointOfContact[0].name} (${opp.pointOfContact[0].email})` : ''}\nSAM.gov Link: ${opp.uiLink}\n\n${opp.description}`,
      status: 'draft',
      project_type: 'government_task_order',
      created_by: user?.id,
      naics_code: opp.naicsCode || null,
      set_aside: opp.setAside || null,
    }

    if (isMultiTenantEnabled && currentOrg) {
      insertData.org_id = currentOrg.id
    }

    let projectId: string | null = null

    const { data, error } = await supabase.from('task_orders').insert(insertData).select().single()
    if (error) {
      delete insertData.naics_code
      delete insertData.set_aside
      const { data: fallback, error: e2 } = await supabase.from('task_orders').insert(insertData).select().single()
      if (e2) {
        alert('Import failed: ' + e2.message)
        setImportingId(null)
        return
      }
      projectId = fallback?.id || null
    } else {
      projectId = data?.id || null
    }

    // Record workflow history
    if (projectId) {
      try {
        await supabase.from('workflow_history').insert({
          task_order_id: projectId,
          from_stage: null,
          to_stage: 'draft',
          changed_by: user?.id || '',
          changed_by_name: null,
          note: `Imported from SAM.gov Opportunity Feed (${opp.solicitationNumber}) — Match Score: ${opp.matchScore || 'N/A'}%`,
        })
      } catch { /* workflow_history may not exist */ }

      // Download SAM.gov documents
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (token) {
          await fetch('/api/sam-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              opportunityId: opp.noticeId,
              projectId,
              userToken: token,
              userId: user?.id,
            }),
          })
        }
      } catch { /* ignore doc download errors */ }
    }

    setImportedIds(prev => new Set(prev).add(opp.noticeId))
    setImportingId(null)

    // Navigate to the new project
    if (projectId) {
      navigate(`/projects/${projectId}`)
    }
  }

  // Stats
  const criticalCount = results.filter(r => r.urgency === 'critical').length
  const urgentCount = results.filter(r => r.urgency === 'urgent').length
  const highMatchCount = results.filter(r => (r.matchScore || 0) >= 70).length
  const prefsConfigured = prefs.naicsCodes.length > 0 || prefs.keywords.length > 0 || prefs.setAsides.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radar className="text-blue-600" size={28} />
            Opportunity Discovery
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Find and import federal contract opportunities from SAM.gov matched to your capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              showPreferences
                ? 'bg-blue-600 text-white'
                : prefsConfigured
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Settings2 size={16} />
            {prefsConfigured ? 'Edit Preferences' : 'Set Up Preferences'}
          </button>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPreferences && (
        <div ref={prefsRef} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings2 size={20} className="text-blue-600" />
              Search Preferences
            </h2>
            <button onClick={() => setShowPreferences(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500">Configure your company profile to automatically score and rank opportunities by relevance.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* NAICS Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Codes</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={naicsInput}
                  onChange={e => setNaicsInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNaicsCode())}
                  placeholder="e.g. 541512"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button onClick={addNaicsCode} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {prefs.naicsCodes.map(code => (
                  <span key={code} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                    {code}
                    <button onClick={() => setPrefs(p => ({ ...p, naicsCodes: p.naicsCodes.filter(c => c !== code) }))} className="hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder="e.g. facilities maintenance"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button onClick={addKeyword} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {prefs.keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                    {kw}
                    <button onClick={() => setPrefs(p => ({ ...p, keywords: p.keywords.filter(k => k !== kw) }))} className="hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Set-Asides */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Set-Aside Eligibility</label>
              <div className="grid grid-cols-2 gap-1">
                {SET_ASIDES.map(sa => (
                  <label key={sa.value} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.setAsides.includes(sa.value)}
                      onChange={e => {
                        if (e.target.checked) {
                          setPrefs(p => ({ ...p, setAsides: [...p.setAsides, sa.value] }))
                        } else {
                          setPrefs(p => ({ ...p, setAsides: p.setAsides.filter(s => s !== sa.value) }))
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {sa.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Solicitation Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation Types</label>
              <div className="grid grid-cols-2 gap-1">
                {OPP_TYPES.map(t => (
                  <label key={t.value} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.solicitationTypes.includes(t.value)}
                      onChange={e => {
                        if (e.target.checked) {
                          setPrefs(p => ({ ...p, solicitationTypes: [...p.solicitationTypes, t.value] }))
                        } else {
                          setPrefs(p => ({ ...p, solicitationTypes: p.solicitationTypes.filter(s => s !== t.value) }))
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Agencies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agencies</label>
              <select
                multiple
                value={prefs.agencies}
                onChange={e => setPrefs(p => ({ ...p, agencies: Array.from(e.target.selectedOptions, o => o.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-32 focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_AGENCIES.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* States */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Place of Performance (States)</label>
              <select
                multiple
                value={prefs.states}
                onChange={e => setPrefs(p => ({ ...p, states: Array.from(e.target.selectedOptions, o => o.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-32 focus:ring-2 focus:ring-blue-500"
              >
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Time Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Posted Within</label>
              <select
                value={prefs.postedWithinDays}
                onChange={e => setPrefs(p => ({ ...p, postedWithinDays: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 180 days</option>
                <option value={365}>Last year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline Within</label>
              <select
                value={prefs.deadlineWithinDays || ''}
                onChange={e => setPrefs(p => ({ ...p, deadlineWithinDays: e.target.value ? Number(e.target.value) : null }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any deadline</option>
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => { handleSavePreferences(); setShowPreferences(false); handleSearch() }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Save & Search
            </button>
            <button
              onClick={handleSavePreferences}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              Save Preferences
            </button>
            {savedPrefs && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={quickKeyword}
              onChange={e => setQuickKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={prefsConfigured
                ? "Quick search (adds to your saved preferences)..."
                : "Search SAM.gov opportunities by keyword..."
              }
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {searching ? 'Searching...' : 'Search'}
          </button>
          {hasSearched && (
            <button
              onClick={() => handleSearch()}
              className="px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              title="Refresh results"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>

        {/* Active preferences summary */}
        {prefsConfigured && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Active filters:</span>
            {prefs.naicsCodes.map(n => (
              <span key={n} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">NAICS: {n}</span>
            ))}
            {prefs.setAsides.map(sa => (
              <span key={sa} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{SET_ASIDES.find(s => s.value === sa)?.label || sa}</span>
            ))}
            {prefs.keywords.map(kw => (
              <span key={kw} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">"{kw}"</span>
            ))}
            {prefs.agencies.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">{prefs.agencies.length} agencies</span>
            )}
            {prefs.states.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{prefs.states.length} states</span>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Search Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results Header + Stats */}
      {hasSearched && !error && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {totalRecords.toLocaleString()} opportunities found
              </h2>
              {results.length > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  {highMatchCount > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <TrendingUp size={14} /> {highMatchCount} high match
                    </span>
                  )}
                  {criticalCount > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle size={14} /> {criticalCount} closing soon
                    </span>
                  )}
                  {urgentCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock size={14} /> {urgentCount} urgent
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'match' | 'deadline' | 'posted')}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="match">Sort: Best Match</option>
                <option value="deadline">Sort: Deadline (Soonest)</option>
                <option value="posted">Sort: Recently Posted</option>
              </select>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border ${
                  showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700'
                }`}
              >
                <Filter size={14} />
                Filters
              </button>
            </div>
          </div>

          {/* Inline Filters */}
          {showFilters && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Types</option>
                  {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Set-Aside</label>
                <select
                  value={filterSetAside}
                  onChange={e => setFilterSetAside(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Set-Asides</option>
                  {SET_ASIDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {(filterType || filterSetAside) && (
                <button
                  onClick={() => { setFilterType(''); setFilterSetAside('') }}
                  className="self-end text-sm text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Results List */}
          <div className="space-y-3">
            {filteredResults.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <Search size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No opportunities match your current filters.</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your preferences or broadening your search.</p>
              </div>
            )}

            {filteredResults.map(opp => {
              const isExpanded = expandedId === opp.noticeId
              const isImported = importedIds.has(opp.noticeId)
              const isImporting = importingId === opp.noticeId

              return (
                <div
                  key={opp.noticeId}
                  className={`bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                    opp.urgency === 'critical' ? 'border-red-200' :
                    opp.urgency === 'urgent' ? 'border-amber-200' :
                    (opp.matchScore || 0) >= 70 ? 'border-green-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {opp.matchScore !== undefined && <MatchScoreBadge score={opp.matchScore} />}
                          <UrgencyBadge urgency={opp.urgency} days={opp.daysUntilDeadline} />
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{opp.type}</span>
                          {opp.setAside && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs flex items-center gap-1">
                              <ShieldCheck size={10} /> {opp.setAside.length > 30 ? opp.setAside.substring(0, 30) + '...' : opp.setAside}
                            </span>
                          )}
                        </div>
                        <h3
                          className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : opp.noticeId)}
                        >
                          {opp.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building size={12} /> {opp.agency}
                          </span>
                          {opp.solicitationNumber && (
                            <span className="flex items-center gap-1">
                              <FileText size={12} /> {opp.solicitationNumber}
                            </span>
                          )}
                          {opp.naicsCode && (
                            <span className="flex items-center gap-1">
                              <Globe size={12} /> NAICS: {opp.naicsCode}
                            </span>
                          )}
                          {opp.placeOfPerformance?.state && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {opp.placeOfPerformance.city ? `${opp.placeOfPerformance.city}, ` : ''}{opp.placeOfPerformance.state}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Posted: {new Date(opp.postedDate).toLocaleDateString()}
                          </span>
                          {opp.responseDeadline && (
                            <span className={`flex items-center gap-1 font-medium ${
                              opp.urgency === 'critical' ? 'text-red-600' :
                              opp.urgency === 'urgent' ? 'text-amber-600' : ''
                            }`}>
                              <Clock size={12} /> Due: {new Date(opp.responseDeadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={opp.uiLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View on SAM.gov"
                        >
                          <ExternalLink size={16} />
                        </a>
                        {isImported ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                            <CheckCircle size={14} /> Imported
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImport(opp)}
                            disabled={isImporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {isImporting ? (
                              <><Loader2 size={14} className="animate-spin" /> Importing...</>
                            ) : (
                              <><Plus size={14} /> Import to Procuvex</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Match Reasons */}
                    {opp.matchReasons && opp.matchReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {opp.matchReasons.map((reason, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-medium">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Description</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{opp.description || 'No description available.'}</p>
                        </div>
                        <div className="space-y-3">
                          {opp.pointOfContact.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Point of Contact</h4>
                              {opp.pointOfContact.map((poc, i) => (
                                <div key={i} className="text-sm text-gray-600">
                                  <p className="font-medium">{poc.name}</p>
                                  {poc.email && <p className="text-blue-600">{poc.email}</p>}
                                  {poc.phone && <p>{poc.phone}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Details</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                              {opp.classificationCode && <p><span className="text-gray-500">Classification:</span> {opp.classificationCode}</p>}
                              {opp.naicsCode && <p><span className="text-gray-500">NAICS:</span> {opp.naicsCode}</p>}
                              {opp.setAside && <p><span className="text-gray-500">Set-Aside:</span> {opp.setAside}</p>}
                            </div>
                          </div>
                          <a
                            href={opp.uiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <ExternalLink size={14} />
                            View Full Details on SAM.gov
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalRecords > 25 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleSearch(Math.max(0, offset - 25))}
                disabled={offset === 0 || searching}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + 25, totalRecords)} of {totalRecords.toLocaleString()}
              </span>
              <button
                onClick={() => handleSearch(offset + 25)}
                disabled={offset + 25 >= totalRecords || searching}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State / Getting Started */}
      {!hasSearched && !error && !showPreferences && !searching && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Radar size={32} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Discover Federal Contract Opportunities</h2>
            <p className="text-sm text-gray-500 mb-6">
              Search SAM.gov for active solicitations, presolicitations, and sources sought notices.
              Set up your preferences to automatically score opportunities by relevance to your capabilities.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowPreferences(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Settings2 size={16} />
                Set Up Your Profile & Preferences
              </button>
              <p className="text-xs text-gray-400">Or just type a keyword above and hit Search to browse all opportunities</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">47K+</div>
                <div className="text-xs text-gray-500 mt-1">Active Opportunities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">$760B</div>
                <div className="text-xs text-gray-500 mt-1">Federal Procurement</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">Daily</div>
                <div className="text-xs text-gray-500 mt-1">Updated from SAM.gov</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
