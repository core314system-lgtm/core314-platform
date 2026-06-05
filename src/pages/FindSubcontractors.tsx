import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TRADE_CATEGORIES } from '../lib/naicsTradeMapping'
import { useTier } from '../hooks/useTier'
import { useAuth } from '../contexts/AuthContext'
import {
  Search, MapPin, Mail, Phone,
  Users, BadgeCheck, Eye, Loader2,
  Database, Building, Globe, Star, Filter, Zap, Send, CheckCircle,
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
}

interface ProjectOption {
  id: string
  title: string
  location_state: string
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
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const PAGE_SIZE = 20

export default function FindSubcontractors() {
  const { isEnterprise } = useTier()
  const { user } = useAuth()
  const [results, setResults] = useState<SubResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterTrade, setFilterTrade] = useState('')
  const [filterVerified, setFilterVerified] = useState(false)
  const [filterSmallBiz, setFilterSmallBiz] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState({ total: 0, verified: 0, trades: 0 })

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

  useEffect(() => {
    fetchStats()
    if (isEnterprise) loadProjects()
  }, [isEnterprise])

  async function loadProjects() {
    const { data } = await supabase
      .from('task_orders')
      .select('id, title, location_state')
      .in('status', ['draft', 'in_progress', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(50)
    setProjects(data || [])
  }

  async function fetchStats() {
    const { count } = await supabase
      .from('master_subcontractors')
      .select('*', { count: 'exact', head: true })
    const { count: verifiedCount } = await supabase
      .from('master_subcontractors')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'verified')
    setStats({
      total: count || 0,
      verified: verifiedCount || 0,
      trades: TRADE_CATEGORIES.length,
    })
  }

  const performSearch = useCallback(async (pageNum: number = 0) => {
    setLoading(true)
    setSearched(true)

    let query = supabase
      .from('master_subcontractors')
      .select('id, company_name, slug, city, state, trade_categories, small_business, small_business_types, verification_status, profile_completeness, website, naics_codes, geographic_coverage, contact_email, contact_phone, contact_name', { count: 'exact' })

    if (search.trim()) {
      query = query.or(`company_name.ilike.%${search.trim()}%,trade_categories.cs.{${search.trim()}}`)
    }
    if (filterState) {
      query = query.eq('state', filterState)
    }
    if (filterTrade) {
      query = query.contains('trade_categories', [filterTrade])
    }
    if (filterVerified) {
      query = query.eq('verification_status', 'verified')
    }
    if (filterSmallBiz) {
      query = query.eq('small_business', true)
    }

    query = query
      .order('verification_status', { ascending: false })
      .order('profile_completeness', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (!error) {
      setResults(data || [])
      setTotalCount(count || 0)
      setPage(pageNum)
    }
    setLoading(false)
  }, [search, filterState, filterTrade, filterVerified, filterSmallBiz])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    performSearch(0)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Subcontractors</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search the Procuvex network of {stats.total.toLocaleString()} subcontractors across {stats.trades} trade categories
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Database size={14} /> Network Size</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-gray-400">registered companies</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><BadgeCheck size={14} /> Verified</div>
          <div className="text-2xl font-bold text-green-600">{stats.verified.toLocaleString()}</div>
          <div className="text-xs text-gray-400">certified & validated</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Building size={14} /> Trade Categories</div>
          <div className="text-2xl font-bold text-blue-600">{stats.trades}</div>
          <div className="text-xs text-gray-400">specializations covered</div>
        </div>
      </div>

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
        </div>
      </form>

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
              <div className="flex gap-3">
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
                    setAiLoading(true)
                    setAiSearched(true)
                    setAiRfqResult(null)
                    try {
                      const proj = projects.find(p => p.id === selectedProject)
                      const { data: sowItems } = await supabase
                        .from('sow_items')
                        .select('service_category')
                        .eq('task_order_id', selectedProject)
                      const trades = [...new Set((sowItems || []).map(s => s.service_category).filter(Boolean))]
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
                          states: proj?.location_state ? [proj.location_state] : [],
                          max_results: 50,
                          include_unclaimed: true,
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setAiMatches(data.matches || [])
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-800">{aiMatches.length} matching subcontractor{aiMatches.length !== 1 ? 's' : ''} found</span>
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
                          onClick={async () => {
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
                                  rfq_title: proj?.title || 'RFQ Invitation',
                                  rfq_description: `Request for Quote for ${proj?.title || 'project'}`,
                                  prime_company: 'Procuvex Network',
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
                          disabled={sendingAiRfqs}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {sendingAiRfqs ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Send RFQs ({selectedAiSubs.size})
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
                    {aiMatches.map(match => (
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
                              <span className="flex items-center gap-1"><MapPin size={10} /> {[match.city, match.state].filter(Boolean).join(', ')}</span>
                            )}
                            {match.contact_email && (
                              <span className="flex items-center gap-1"><Mail size={10} /> {match.contact_email}</span>
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
            <span>{totalCount.toLocaleString()} subcontractor{totalCount !== 1 ? 's' : ''} found</span>
            {totalPages > 1 && (
              <span>Page {page + 1} of {totalPages}</span>
            )}
          </div>

          {results.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/sub/${sub.slug}`}
                      className="text-base font-semibold text-gray-900 hover:text-blue-600 truncate"
                    >
                      {sub.company_name}
                    </Link>
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
                    {isEnterprise && sub.contact_email && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Mail size={13} /> {sub.contact_email}
                      </span>
                    )}
                    {isEnterprise && sub.contact_phone && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Phone size={13} /> {sub.contact_phone}
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
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Profile</div>
                    <div className="text-sm font-semibold text-gray-700">{sub.profile_completeness}%</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
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
    </div>
  )
}
