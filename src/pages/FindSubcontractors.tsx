import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TRADE_CATEGORIES } from '../lib/naicsTradeMapping'
import {
  Search, MapPin,
  Users, BadgeCheck, Eye, Loader2,
  Database, Building, Globe, Star, Filter,
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
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const PAGE_SIZE = 20

export default function FindSubcontractors() {
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

  useEffect(() => {
    fetchStats()
  }, [])

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
      .select('id, company_name, slug, city, state, trade_categories, small_business, small_business_types, verification_status, profile_completeness, website, naics_codes, geographic_coverage', { count: 'exact' })

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

                  <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
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
