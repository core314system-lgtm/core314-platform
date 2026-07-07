import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TRADE_CATEGORIES } from '../lib/naicsTradeMapping'
import { useTier } from '../hooks/useTier'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { useSubConnections } from '../hooks/useSubConnections'
import { maskEmail, maskPhone } from '../lib/contactMasking'
import { loadAiOutput } from '../lib/aiStorage'
import type { AnalysisResult } from '../lib/types'
import RfqComposeModal from '../components/RfqComposeModal'
import {
  Search, MapPin, Mail, Phone,
  Users, BadgeCheck, Eye, Loader2,
  Database, Building, Building2, Globe, Star, Filter, Zap, Send, CheckCircle, Unlock,
  ChevronDown, ChevronRight, Shield, Lock, AlertTriangle,
} from 'lucide-react'

interface SubResult {
  id: string
  company_name: string
  slug: string
  city: string | null
  state: string | null
  trade_categories: string[]
  small_business: boolean
  small_business_types: string[]
  verification_status: string
  profile_completeness: number
  website: string | null
  naics_codes: string[]
  geographic_coverage: string[]
  contact_email?: string | null
  contact_phone?: string | null
  contact_name?: string | null
  description?: string | null
  capability_statement_path?: string | null
  address_line1?: string | null
  sam_uei?: string | null
  _source?: 'master' | 'org' // Source indicator for UI badges
}

function computeDataQuality(sub: SubResult): { score: number; label: string; color: string } {
  let filled = 0
  const total = 10
  if (sub.contact_email) filled++
  if (sub.contact_phone) filled++
  if (sub.contact_name) filled++
  if (sub.address_line1) filled++
  if (sub.city && sub.state) filled++
  if (sub.trade_categories?.length > 0) filled++
  if (sub.naics_codes?.length > 0) filled++
  if (sub.small_business_types?.length > 0) filled++
  if (sub.description) filled++
  if (sub.website || sub.capability_statement_path) filled++
  const score = Math.round((filled / total) * 100)
  if (score >= 80) return { score, label: 'Excellent', color: 'green' }
  if (score >= 60) return { score, label: 'Good', color: 'blue' }
  if (score >= 40) return { score, label: 'Fair', color: 'amber' }
  return { score, label: 'Basic', color: 'gray' }
}

interface ProjectOption {
  id: string
  title: string
  location_state: string
  location_city?: string
  site_name?: string
  due_date?: string
  solicitation_number?: string
}

interface AiMatch {
  sub_id: string
  company_name: string
  contact_email: string | null
  state: string | null
  city: string | null
  trade_categories: string[]
  verification_status: string
  profile_completeness: number
  small_business_types: string[]
  match_score: number
  match_reasons: string[]
  matched_trades: string[]
  distance_miles?: number | null
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const PAGE_SIZE = 20

export default function FindSubcontractors() {
  const { isEnterprise, isGrowth, hasActiveSubscription, status: subStatus } = useTier()
  const { user, profile } = useAuth()
  const { currentOrg } = useOrg()
  const { isConnected, connect, connectionsUsedThisMonth, connectionsLimit, canConnect } = useSubConnections()
  const isAdmin = profile?.is_global_admin === true
  const isPaidUser = isAdmin || isEnterprise || isGrowth
  const isTrialUser = !isPaidUser && subStatus === 'trialing'
  const TRIAL_RESULT_LIMIT = 5
  const [dailySearchCount, setDailySearchCount] = useState(0)
  const [rateLimited, setRateLimited] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [results, setResults] = useState<SubResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  const [filterVerified, setFilterVerified] = useState(false)
  const [filterSmallBiz, setFilterSmallBiz] = useState(false)
  const [includeOrgSubs, setIncludeOrgSubs] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<{ total: number; verified: number; trades: number } | null>(null)

  // Enterprise AI Match
  const [showAiMatch, setShowAiMatch] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [aiMatches, setAiMatches] = useState<AiMatch[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSearched, setAiSearched] = useState(false)
  const [selectedAiSubs, setSelectedAiSubs] = useState<Set<string>>(new Set())
  const [sendingAiRfqs, setSendingAiRfqs] = useState(false)
  const [aiRfqResult, setAiRfqResult] = useState<{ sent: number; failed: number } | null>(null)
  const [aiTradeCounts, setAiTradeCounts] = useState<Record<string, number>>({})
  const [aiTradeFilter, setAiTradeFilter] = useState<string>('')
  const [sowBreakdown, setSowBreakdown] = useState<{ sow_label: string; mapped_trade: string | null; sub_count: number }[]>([])
  const [showSowBreakdown, setShowSowBreakdown] = useState(true)
  const [locationScopes, setLocationScopes] = useState<Set<string>>(new Set(['regional']))
  const [localRadius, setLocalRadius] = useState(50)
  const [projectZip, setProjectZip] = useState('')
  const [showRfqCompose, setShowRfqCompose] = useState(false)

  // Load daily search count for rate limit display
  useEffect(() => {
    if (user && currentOrg?.id) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      supabase
        .from('sub_access_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('action_type', ['search', 'page_browse'])
        .gte('created_at', dayStart.toISOString())
        .then(({ count }) => { setDailySearchCount(count || 0) })
    }
  }, [user, currentOrg?.id])

  // Audit logger for subcontractor access
  async function logAccess(actionType: 'search' | 'connect' | 'view_profile' | 'page_browse', metadata: Record<string, any> = {}) {
    if (!user || !currentOrg?.id) return
    try {
      await supabase.from('sub_access_log').insert({
        user_id: user.id,
        org_id: currentOrg.id,
        action_type: actionType,
        metadata,
      })
      if (actionType === 'search' || actionType === 'page_browse') {
        setDailySearchCount(prev => prev + 1)
      }
    } catch {} // Graceful fallback if table doesn't exist
  }

  // Get daily search limit based on plan
  function getDailySearchLimit(): number {
    if (isAdmin) return Infinity
    if (isEnterprise) return 200
    if (isGrowth) return 50
    return 15 // Trial/no subscription
  }

  useEffect(() => {
    fetchStats()
    if (isEnterprise) loadProjects()
  }, [isEnterprise])

  async function loadProjects() {
    const { data } = await supabase
      .from('task_orders')
      .select('id, title, location_state, location_city, site_name, due_date, solicitation_number')
      .in('status', ['draft', 'in_progress', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(50)
    setProjects(data || [])
  }

  async function fetchStats() {
    let masterCount = 0
    let verifiedCount = 0
    let orgSubCount = 0

    // Count contactable subs from master database (may not exist in all envs)
    try {
      const { count, error } = await supabase
        .from('master_subcontractors_safe')
        .select('*', { count: 'exact', head: true })
        .or('contact_email.not.is.null,contact_phone.not.is.null')
      if (!error) masterCount = count || 0

      const { count: vc, error: ve } = await supabase
        .from('master_subcontractors_safe')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'verified')
      if (!ve) verifiedCount = vc || 0
    } catch { /* view may not exist */ }

    // Count org's own subcontractors (RLS-scoped)
    try {
      const { count: oc, error: oe } = await supabase
        .from('subcontractors')
        .select('*', { count: 'exact', head: true })
      if (!oe) orgSubCount = oc || 0
    } catch { /* table may not exist */ }

    setStats({
      total: masterCount + orgSubCount,
      verified: verifiedCount,
      trades: TRADE_CATEGORIES.length,
    })
  }

  // Use refs to always have current filter values — eliminates React closure staleness
  const filterTradeRef = useRef(filterTrade)
  const searchRef = useRef(search)
  const filterStateRef = useRef(filterState)
  const filterVerifiedRef = useRef(filterVerified)
  const filterSmallBizRef = useRef(filterSmallBiz)
  const includeOrgSubsRef = useRef(includeOrgSubs)
  filterTradeRef.current = filterTrade
  searchRef.current = search
  filterStateRef.current = filterState
  filterVerifiedRef.current = filterVerified
  filterSmallBizRef.current = filterSmallBiz
  includeOrgSubsRef.current = includeOrgSubs

  // Resolve text search to matching trade category if applicable
  function resolveTradeFromSearch(searchText: string): string | null {
    if (!searchText.trim()) return null
    const lower = searchText.trim().toLowerCase()
    const match = TRADE_CATEGORIES.find(t =>
      t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase())
    )
    return match ? match.name : null
  }

  const performSearch = useCallback(async (pageNum: number = 0) => {
    // Enforce rate limit check
    const limit = getDailySearchLimit()
    if (dailySearchCount >= limit && !isAdmin) {
      setRateLimited(true)
      setLoading(false)
      return
    }

    // Block access for inactive subscriptions (not trial, not active)
    if (!hasActiveSubscription && !isAdmin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setSearched(true)

    // Log the search for audit trail
    logAccess(pageNum === 0 ? 'search' : 'page_browse', {
      search: searchRef.current,
      trade: filterTradeRef.current,
      state: filterStateRef.current,
      page: pageNum,
    })

    // Always read from refs — guaranteed to be current regardless of closure timing
    const activeTrade = filterTradeRef.current
    const activeSearch = searchRef.current
    const activeState = filterStateRef.current
    const activeVerified = filterVerifiedRef.current
    const activeSmallBiz = filterSmallBizRef.current
    const activeIncludeOrg = includeOrgSubsRef.current

    // If user typed something that matches a trade category name, treat it as a trade filter
    const inferredTrade = !activeTrade ? resolveTradeFromSearch(activeSearch) : null
    const effectiveTrade = activeTrade || inferredTrade

    let query = supabase
      .from('master_subcontractors_safe')
      .select('id, company_name, slug, city, state, trade_categories, small_business, small_business_types, verification_status, profile_completeness, website, naics_codes, geographic_coverage, contact_email, contact_phone, contact_name, description, capability_statement_path, address_line1, sam_uei, data_health_score', { count: 'exact' })

    // Only return contactable, non-archived subs (must have email or phone)
    query = query.or('contact_email.not.is.null,contact_phone.not.is.null')
    query = query.eq('archived', false)

    // Text search: only used for company name matching if no trade was inferred
    if (activeSearch.trim() && !inferredTrade) {
      query = query.ilike('company_name', `%${activeSearch.trim()}%`)
    }
    if (activeState) {
      query = query.eq('state', activeState)
    }
    if (effectiveTrade) {
      query = query.contains('trade_categories', [effectiveTrade])
    }
    if (activeVerified) {
      query = query.eq('verification_status', 'verified')
    }
    if (activeSmallBiz) {
      query = query.eq('small_business', true)
    }

    query = query
      .order('verification_status', { ascending: false })
      .order('profile_completeness', { ascending: false })
      .order('contact_email', { ascending: false, nullsFirst: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query

    // Also search org subs if toggle is on
    let orgResults: SubResult[] = []
    if (activeIncludeOrg && currentOrg) {
      let orgQuery = supabase
        .from('org_subcontractors')
        .select('id, company_name, contact_name, contact_email, contact_phone, city, state, trade_categories, naics_codes, small_business, small_business_types, website, notes')
        .eq('org_id', currentOrg.id)

      if (activeSearch.trim() && !inferredTrade) {
        orgQuery = orgQuery.ilike('company_name', `%${activeSearch.trim()}%`)
      }
      if (activeState) {
        orgQuery = orgQuery.eq('state', activeState)
      }
      if (effectiveTrade) {
        orgQuery = orgQuery.contains('trade_categories', [effectiveTrade])
      }
      if (activeSmallBiz) {
        orgQuery = orgQuery.eq('small_business', true)
      }

      orgQuery = orgQuery.order('company_name').limit(PAGE_SIZE)

      const { data: orgData } = await orgQuery
      orgResults = (orgData || []).map(s => ({
        id: s.id,
        company_name: s.company_name,
        slug: '',
        city: s.city,
        state: s.state,
        trade_categories: s.trade_categories || [],
        small_business: s.small_business || false,
        small_business_types: s.small_business_types || [],
        verification_status: 'org_private',
        profile_completeness: 0,
        website: s.website,
        naics_codes: s.naics_codes || [],
        geographic_coverage: [],
        contact_email: s.contact_email,
        contact_phone: s.contact_phone,
        contact_name: s.contact_name,
        description: s.notes,
        _source: 'org' as const,
      }))
    }

    if (!error) {
      // Tag master results with source
      let masterResults = (data || []).map(s => ({ ...s, _source: 'master' as const }))
      
      // Trial users: limit to TRIAL_RESULT_LIMIT results as a preview
      if (isTrialUser && !isAdmin) {
        masterResults = masterResults.slice(0, TRIAL_RESULT_LIMIT)
      }

      // Merge: org subs first (on page 0), then master
      if (pageNum === 0 && orgResults.length > 0) {
        setResults([...orgResults, ...masterResults])
      } else {
        setResults(masterResults)
      }
      setTotalCount(isTrialUser ? Math.min((count || 0), TRIAL_RESULT_LIMIT) : (count || 0) + orgResults.length)
      setPage(pageNum)
    }
    setLoading(false)
  }, [currentOrg])

  // Auto-trigger search when any filter changes (dropdown, checkbox, etc.)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    performSearch(0)
  }, [filterTrade, filterState, filterVerified, filterSmallBiz, includeOrgSubs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    performSearch(0)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // No subscription at all — show full gate
  if (!hasActiveSubscription && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Lock size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Required</h1>
        <p className="text-gray-600">
          Access to the subcontractor database requires an active subscription.
          Our network includes 18,000+ verified subcontractors across all trade categories.
        </p>
        <a href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
          View Plans
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security & Usage Banner */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Rate limit warning */}
        {rateLimited && (
          <div className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertTriangle size={16} />
            <span className="font-medium">Daily search limit reached ({getDailySearchLimit()} searches/day).</span>
            <span>Upgrade your plan for higher limits. Resets at midnight.</span>
          </div>
        )}
        {/* Trial user limitation notice */}
        {isTrialUser && (
          <div className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <Shield size={16} />
            <span className="font-medium">Trial Preview Mode</span>
            <span>— You can see up to {TRIAL_RESULT_LIMIT} results per search. Subscribe to a paid plan for full access to all {stats?.total.toLocaleString() || '18,000+'} subcontractors.</span>
            <a href="/pricing" className="ml-auto text-amber-700 font-medium underline hover:text-amber-900">Upgrade</a>
          </div>
        )}
        {/* Connection usage indicator */}
        {!isAdmin && isPaidUser && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield size={12} />
            Connections: {connectionsUsedThisMonth}/{connectionsLimit === Infinity ? '∞' : connectionsLimit} this month
            {' · '}
            Searches: {dailySearchCount}/{getDailySearchLimit()} today
          </div>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Subcontractors</h1>
        <p className="text-sm text-gray-500 mt-1">
          {stats ? `Search ${stats.total.toLocaleString()} subcontractors with verified contact information across ${stats.trades} trade categories` : 'Loading subcontractor database...'}
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Database size={14} /> Subcontractors</div>
          <div className="text-2xl font-bold text-gray-900">{stats ? stats.total.toLocaleString() : '—'}</div>
          <div className="text-xs text-gray-400">in network</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><BadgeCheck size={14} /> Verified</div>
          <div className="text-2xl font-bold text-green-600">{stats ? stats.verified.toLocaleString() : '—'}</div>
          <div className="text-xs text-gray-400">certified & validated</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Building size={14} /> Trade Categories</div>
          <div className="text-2xl font-bold text-blue-600">{stats ? stats.trades : '—'}</div>
          <div className="text-xs text-gray-400">specializations covered</div>
        </div>
      </div>

      {/* Browse by Category — shown when user hasn't searched yet */}
      {!searched && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Browse by Trade Category</h2>
              <p className="text-xs text-gray-500">Click a category to see available subcontractors</p>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {TRADE_CATEGORIES.filter(t => t.id !== 'other').slice(0, 18).map(trade => (
              <button
                key={trade.id}
                onClick={() => { setFilterTrade(trade.name); setSearch('') }}
                className="p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-center group"
              >
                <div className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{trade.name}</div>
              </button>
            ))}
          </div>
          {TRADE_CATEGORIES.length > 18 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              + {TRADE_CATEGORIES.length - 18} more categories available via the filter dropdown below
            </p>
          )}
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by company name or trade..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterTrade}
            onChange={e => setFilterTrade(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="">All Trades</option>
            {TRADE_CATEGORIES.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterVerified}
              onChange={e => setFilterVerified(e.target.checked)}
              className="rounded border-gray-300"
            />
            <BadgeCheck size={14} className="text-green-500" />
            Verified Only
          </label>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterSmallBiz}
              onChange={e => setFilterSmallBiz(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Star size={14} className="text-amber-500" />
            Small Business
          </label>

          {currentOrg && (
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-2 pl-2 border-l">
              <input
                type="checkbox"
                checked={includeOrgSubs}
                onChange={e => setIncludeOrgSubs(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Building2 size={14} className="text-indigo-500" />
              Include My Subcontractors
            </label>
          )}
        </div>
      </form>

      {/* Connection Credits Banner */}
      {!isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Unlock size={18} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Contact Reveal Credits</div>
              <div className="text-xs text-gray-500">
                {connectionsUsedThisMonth} of {connectionsLimit === Infinity ? 'unlimited' : connectionsLimit} used this month
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-600">
                {connectionsLimit === Infinity ? '∞' : connectionsLimit - connectionsUsedThisMonth}
              </div>
              <div className="text-[10px] text-gray-400 uppercase">remaining</div>
            </div>
            {connectionsLimit !== Infinity && (
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (connectionsUsedThisMonth / connectionsLimit) * 100)}%`,
                    backgroundColor: connectionsUsedThisMonth >= connectionsLimit ? '#ef4444' : connectionsUsedThisMonth >= connectionsLimit * 0.8 ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection error toast */}
      {connectError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{connectError}</span>
          <button onClick={() => setConnectError(null)} className="text-red-500 hover:text-red-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {/* Enterprise AI Match */}
      {isEnterprise && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-purple-600" />
              <h3 className="font-semibold text-purple-900">AI Project Matching</h3>
              <span className="text-[10px] font-bold text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded">ENT</span>
            </div>
            <button
              onClick={() => setShowAiMatch(!showAiMatch)}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {showAiMatch ? 'Hide' : 'Find Subs for a Project'}
            </button>
          </div>
          <p className="text-sm text-purple-700 mb-3">
            Select a project and the AI will automatically find and rank subcontractors from the master database that match your SOW requirements.
          </p>

          {showAiMatch && (
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <select
                  value={selectedProject}
                  onChange={e => { setSelectedProject(e.target.value); setAiSearched(false); setAiMatches([]); setAiRfqResult(null) }}
                  className="flex-1 text-sm border border-purple-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}{p.location_state ? ` (${p.location_state})` : ''}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (!selectedProject || !user) return
                    if (locationScopes.has('local') && !projectZip) {
                      alert('Please enter a project ZIP code for local radius search')
                      return
                    }
                    setAiLoading(true)
                    setAiSearched(true)
                    setAiRfqResult(null)
                    try {
                      const proj = projects.find(p => p.id === selectedProject)
                      const { data: sowItems } = await supabase
                        .from('sow_items')
                        .select('service_category')
                        .eq('task_order_id', selectedProject)
                      let sowLabels = (sowItems || []).map(s => s.service_category).filter(Boolean)
                      // Fallback: if no SOW items, try to pull service_categories from saved AI analysis
                      if (sowLabels.length === 0) {
                        const analysis = await loadAiOutput<AnalysisResult>(selectedProject, 'analysis')
                        if (analysis?.service_categories?.length) {
                          // Auto-create SOW items so they exist for future matches
                          const cats = analysis.service_categories
                          for (const cat of cats) {
                            await supabase.from('sow_items').insert({
                              task_order_id: selectedProject,
                              sow_name: cat.category,
                              service_category: cat.category,
                              description: cat.description,
                              source_document: null,
                              status: 'not_started',
                            })
                          }
                          sowLabels = cats.map(c => c.category)
                        }
                      }
                      const trades = [...new Set(sowLabels)]
                      if (trades.length === 0) {
                        setAiMatches([])
                        setAiLoading(false)
                        return
                      }
                      const res = await fetch('/.netlify/functions/sub-auto-match', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
                        body: JSON.stringify({
                          action: 'match',
                          trades,
                          sow_labels: sowLabels,
                          states: proj?.location_state ? [proj.location_state] : [],
                          location_scope: Array.from(locationScopes),
                          local_radius_miles: locationScopes.has('local') ? localRadius : undefined,
                          project_zip: locationScopes.has('local') ? projectZip : undefined,
                          max_results: Math.min(Math.max(trades.length * 10, 50), 200),
                          include_unclaimed: true,
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setAiMatches(data.matches || [])
                        setAiTradeCounts(data.trade_counts || {})
                        setAiTradeFilter('')
                        setSowBreakdown(data.sow_breakdown || [])
                        setShowSowBreakdown(true)
                      }
                    } catch (err) {
                      console.error('AI match error:', err)
                    }
                    setAiLoading(false)
                  }}
                  disabled={!selectedProject || aiLoading}
                  className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Find Matches
                </button>
              </div>

              {/* Location Scope Controls */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-xs font-medium text-purple-800 mb-2 flex items-center gap-1">
                  <MapPin size={12} /> Search Scope — select one or more:
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  {[
                    { key: 'local', label: 'Local (Radius)' },
                    { key: 'regional', label: 'Regional (State + Neighbors)' },
                    { key: 'national', label: 'National (All States)' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={locationScopes.has(opt.key)}
                        onChange={() => {
                          const next = new Set(locationScopes)
                          if (next.has(opt.key)) next.delete(opt.key)
                          else next.add(opt.key)
                          if (next.size === 0) next.add('regional')
                          setLocationScopes(next)
                        }}
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-purple-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {locationScopes.has('local') && (
                  <div className="flex gap-3 mt-2 items-center">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-purple-700">ZIP:</label>
                      <input
                        type="text"
                        value={projectZip}
                        onChange={e => setProjectZip(e.target.value.replace(/[^0-9]/g, '').substring(0, 5))}
                        placeholder="Project ZIP"
                        className="w-20 text-sm border border-purple-300 rounded px-2 py-1"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-purple-700">Radius:</label>
                      <select
                        value={localRadius}
                        onChange={e => setLocalRadius(Number(e.target.value))}
                        className="text-sm border border-purple-300 rounded px-2 py-1 bg-white"
                      >
                        <option value={10}>10 miles</option>
                        <option value={25}>25 miles</option>
                        <option value={50}>50 miles</option>
                        <option value={100}>100 miles</option>
                        <option value={150}>150 miles</option>
                        <option value={200}>200 miles</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {aiLoading && (
                <div className="text-center py-6 text-purple-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Analyzing project requirements against 18,000+ subcontractors...
                </div>
              )}

              {aiSearched && !aiLoading && aiMatches.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No matches found. Make sure the project has SOW items with service categories defined (use "Sync from AI Analysis" on the SOW Tracker).
                </div>
              )}

              {aiMatches.length > 0 && (
                <div className="space-y-3">
                  {/* SOW Breakdown Summary */}
                  {sowBreakdown.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowSowBreakdown(!showSowBreakdown)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-purple-800 hover:bg-purple-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Database size={14} />
                          SOW Coverage Breakdown — {sowBreakdown.filter(s => s.mapped_trade && s.sub_count > 0).length} of {sowBreakdown.length} SOW items matched
                        </span>
                        {showSowBreakdown ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {showSowBreakdown && (
                        <div className="px-4 pb-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-purple-600 border-b border-purple-200">
                                <th className="pb-1.5 font-medium">SOW Line Item</th>
                                <th className="pb-1.5 font-medium">Mapped Trade Category</th>
                                <th className="pb-1.5 font-medium text-right">Subs Found</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sowBreakdown.map((item, i) => (
                                <tr key={i} className="border-b border-purple-100 last:border-0">
                                  <td className="py-1.5 text-gray-700">{item.sow_label}</td>
                                  <td className="py-1.5">
                                    {item.mapped_trade ? (
                                      <span className="inline-flex items-center gap-1 text-purple-700">
                                        <CheckCircle size={10} className="text-green-500" />
                                        {item.mapped_trade}
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 italic">Requires manual assignment</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right font-medium">
                                    {item.sub_count > 0 ? (
                                      <span className="text-green-700">{item.sub_count}</span>
                                    ) : (
                                      <span className="text-gray-400">0</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-purple-800">{aiMatches.length} matching subcontractor{aiMatches.length !== 1 ? 's' : ''} found across {Object.keys(aiTradeCounts).length} trade{Object.keys(aiTradeCounts).length !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-gray-500 ml-2 inline-flex items-center gap-1">
                        <MapPin size={10} />
                        {Array.from(locationScopes).map(s => s === 'local' ? `Local (${localRadius}mi)` : s === 'regional' ? 'Regional' : 'National').join(' + ')}
                      </span>
                      {Object.keys(aiTradeCounts).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <button
                            onClick={() => setAiTradeFilter('')}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              aiTradeFilter === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                            }`}
                          >
                            All ({aiMatches.length})
                          </button>
                          {Object.entries(aiTradeCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([trade, count]) => (
                            <button
                              key={trade}
                              onClick={() => setAiTradeFilter(aiTradeFilter === trade ? '' : trade)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                aiTradeFilter === trade ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                              }`}
                            >
                              {trade} ({count})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedAiSubs.size === aiMatches.length) setSelectedAiSubs(new Set())
                          else setSelectedAiSubs(new Set(aiMatches.map(m => m.sub_id)))
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {selectedAiSubs.size === aiMatches.length ? 'Deselect All' : 'Select All'}
                      </button>
                      {selectedAiSubs.size > 0 && (
                        <button
                          onClick={() => setShowRfqCompose(true)}
                          disabled={sendingAiRfqs}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {sendingAiRfqs ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Compose RFQ ({selectedAiSubs.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {aiRfqResult && (
                    <div className={`rounded-lg p-3 text-sm ${aiRfqResult.failed > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                      <CheckCircle size={14} className="inline mr-1.5" />
                      {aiRfqResult.sent} RFQ invitation{aiRfqResult.sent !== 1 ? 's' : ''} sent
                      {aiRfqResult.failed > 0 && ` (${aiRfqResult.failed} failed — no email on file)`}
                    </div>
                  )}

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {aiMatches.filter(m => !aiTradeFilter || m.matched_trades?.includes(aiTradeFilter)).map(match => (
                      <div
                        key={match.sub_id}
                        className={`bg-white rounded-lg border p-3 flex items-start gap-3 transition-colors ${
                          selectedAiSubs.has(match.sub_id) ? 'border-purple-400 ring-1 ring-purple-200' : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAiSubs.has(match.sub_id)}
                          onChange={() => {
                            setSelectedAiSubs(prev => {
                              const next = new Set(prev)
                              if (next.has(match.sub_id)) next.delete(match.sub_id)
                              else next.add(match.sub_id)
                              return next
                            })
                          }}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                          match.match_score >= 80 ? 'text-green-700 bg-green-100' :
                          match.match_score >= 60 ? 'text-amber-700 bg-amber-100' : 'text-gray-700 bg-gray-100'
                        }`}>
                          <div className="text-lg font-bold leading-none">{match.match_score}</div>
                          <div className="text-[8px] uppercase tracking-wider">score</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{match.company_name}</span>
                            {match.verification_status === 'verified' && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Verified</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                            {(match.city || match.state) && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} /> {[match.city, match.state].filter(Boolean).join(', ')}
                                {match.distance_miles != null && <span className="text-purple-600 font-medium">({Math.round(match.distance_miles)} mi)</span>}
                              </span>
                            )}
                            {match.contact_email && (
                              <span className="flex items-center gap-1"><Mail size={10} /> {isConnected(match.sub_id) ? match.contact_email : maskEmail(match.contact_email)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {match.match_reasons.map((r, i) => (
                              <span key={i} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{r}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!searched ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Search the Procuvex Network</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Find qualified subcontractors by trade, location, or company name.
            Verified subcontractors have validated certifications, insurance, and capabilities.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Results Found</h3>
          <p className="text-sm text-gray-500">Try broadening your search or adjusting filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{totalCount.toLocaleString()} subcontractor{totalCount !== 1 ? 's' : ''} with contact information</span>
            {totalPages > 1 && (
              <span>Page {page + 1} of {totalPages}</span>
            )}
          </div>

          {results.map(sub => (
            <div key={sub.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${sub._source === 'org' ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {sub._source === 'org' ? (
                      <Link
                        to="/subcontractors"
                        className="text-base font-semibold text-gray-900 hover:text-indigo-600 truncate"
                      >
                        {sub.company_name}
                      </Link>
                    ) : (
                      <Link
                        to={`/sub/${sub.slug}`}
                        className="text-base font-semibold text-gray-900 hover:text-blue-600 truncate"
                      >
                        {sub.company_name}
                      </Link>
                    )}
                    {/* Source badge */}
                    {sub._source === 'org' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        <Building2 size={12} /> Your Database
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <Database size={12} /> Procuvex Network
                      </span>
                    )}
                    {sub.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                    {sub.small_business && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Star size={12} /> Small Biz
                      </span>
                    )}
                    {/* Contact method badge */}
                    {sub.contact_email ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <Send size={11} /> RFQ Ready
                      </span>
                    ) : sub.contact_phone ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        <Phone size={11} /> Phone Only
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 flex-wrap">
                    {(sub.city || sub.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {[sub.city, sub.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {sub.website && (
                      <a href={sub.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-700">
                        <Globe size={13} /> Website
                      </a>
                    )}
                    {sub.contact_email && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Mail size={13} /> {isConnected(sub.id) ? sub.contact_email : maskEmail(sub.contact_email)}
                      </span>
                    )}
                    {sub.contact_phone && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Phone size={13} /> {isConnected(sub.id) ? sub.contact_phone : maskPhone(sub.contact_phone)}
                      </span>
                    )}
                  </div>

                  {sub.trade_categories && sub.trade_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sub.trade_categories.slice(0, 4).map(trade => (
                        <span key={trade} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">
                          {trade}
                        </span>
                      ))}
                      {sub.trade_categories.length > 4 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-md text-xs">
                          +{sub.trade_categories.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {sub.small_business_types && sub.small_business_types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {sub.small_business_types.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-xs font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 ml-4">
                  <Link
                    to={`/sub/${sub.slug}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <Eye size={14} /> View Profile
                  </Link>
                  {!isAdmin && !isConnected(sub.id) ? (
                    isTrialUser ? (
                      <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-lg">
                        <Lock size={12} /> Subscribe to Connect
                      </span>
                    ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        setConnectingId(sub.id)
                        setConnectError(null)
                        const result = await connect(sub.id)
                        if (!result.success) setConnectError(result.error || 'Failed')
                        setConnectingId(null)
                      }}
                      disabled={!canConnect || connectingId === sub.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {connectingId === sub.id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                      Reveal Contact
                    </button>
                    )
                  ) : !isAdmin ? (
                    <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg">
                      <CheckCircle size={12} /> Connected
                    </span>
                  ) : null}
                  {(() => {
                    const quality = computeDataQuality(sub)
                    return (
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Data Quality</div>
                        <div className={`text-sm font-semibold ${
                          quality.color === 'green' ? 'text-green-600' :
                          quality.color === 'blue' ? 'text-blue-600' :
                          quality.color === 'amber' ? 'text-amber-600' : 'text-gray-500'
                        }`}>{quality.score}% {quality.label}</div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          ))}

          {/* Trial user upsell after results */}
          {isTrialUser && searched && results.length > 0 && (
            <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-blue-800 font-semibold">
                <Lock size={16} />
                Showing {TRIAL_RESULT_LIMIT} of {stats?.total.toLocaleString() || '18,000+'} subcontractors
              </div>
              <p className="text-sm text-blue-700">
                Subscribe to a Growth or Enterprise plan to unlock the full database, including advanced AI matching,
                contact reveal capabilities, and RFQ distribution to matched subcontractors.
              </p>
              <a href="/pricing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                View Plans & Unlock Full Access
              </a>
            </div>
          )}

          {/* Pagination — hidden for trial users */}
          {totalPages > 1 && !isTrialUser && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => performSearch(page - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => performSearch(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* RFQ Compose Modal */}
      <RfqComposeModal
        open={showRfqCompose}
        onClose={() => setShowRfqCompose(false)}
        selectedCount={selectedAiSubs.size}
        project={projects.find(pr => pr.id === selectedProject) || null}
        sowCategories={Object.keys(aiTradeCounts)}
        onSend={async (rfqTemplate, rfqSubject, customMessage) => {
          if (!user) return
          setSendingAiRfqs(true)
          try {
            const proj = projects.find(p => p.id === selectedProject)
            const res = await fetch('/.netlify/functions/sub-auto-match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
              body: JSON.stringify({
                action: 'invite-all',
                sub_ids: Array.from(selectedAiSubs),
                task_order_id: selectedProject,
                rfq_template: rfqTemplate,
                rfq_subject: rfqSubject,
                custom_message: customMessage,
                project_data: proj ? {
                  title: proj.title,
                  location_city: proj.location_city,
                  location_state: proj.location_state,
                  site_name: proj.site_name,
                  due_date: proj.due_date,
                  solicitation_number: proj.solicitation_number,
                  sow_categories: Object.keys(aiTradeCounts).join(', '),
                } : undefined,
              }),
            })
            if (res.ok) {
              const data = await res.json()
              setAiRfqResult({ sent: data.sent, failed: data.failed })
            }
          } catch (err) {
            console.error('RFQ send error:', err)
          }
          setSendingAiRfqs(false)
        }}
      />
    </div>
  )
}
