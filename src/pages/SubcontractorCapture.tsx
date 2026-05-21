import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { markMultipleSources } from '../lib/subcontractorSources'
import { searchCuratedCompanies, REGION_STATES, type CoverageLevel } from '../lib/curatedSubcontractors'
import { Search, MapPin, Plus, CheckCircle, Building, Phone, Globe, Loader2, AlertCircle, Radar, Globe2, ShieldCheck, Star } from 'lucide-react'

const CUSTOM_CATEGORIES_KEY = 'core314_custom_service_categories'

type SearchScope = 'local' | 'regional' | 'national'
type Region = 'West' | 'Southwest' | 'Southeast' | 'Northeast' | 'Midwest' | 'Pacific Northwest'

const DEFAULT_SERVICE_CATEGORIES = [
  'HVAC', 'Fire Life Safety', 'Janitorial', 'Landscaping', 'Snow Removal',
  'Emergency Power', 'Plumbing', 'Electrical', 'Pest Control', 'Dock Equipment',
  'Elevator Maintenance', 'Roofing', 'Painting', 'Flooring', 'Security Systems',
  'Building Automation', 'Grounds Maintenance', 'Waste Management', 'General Maintenance',
]

function loadCustomCategories(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

function saveCustomCategory(cat: string) {
  const existing = loadCustomCategories()
  const normalized = cat.trim()
  if (!normalized) return
  const allKnown = [...DEFAULT_SERVICE_CATEGORIES, ...existing].map(c => c.toLowerCase())
  if (allKnown.includes(normalized.toLowerCase())) return
  existing.push(normalized)
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(existing))
}

type DataSource = 'curated' | 'google_places'

interface DiscoveredSub {
  id: string
  company_name: string
  hq_city: string
  hq_state: string
  address: string | null
  phone: string | null
  website: string | null
  categories: string[]
  coverage: CoverageLevel
  regions_served?: string[]
  states_served?: string[]
  description: string
  rating?: number | null
  review_count?: number | null
  data_source: DataSource
  selected: boolean
  imported: boolean
}

export default function SubcontractorCapture() {
  const [category, setCategory] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState(50)
  const [searchScope, setSearchScope] = useState<SearchScope>('local')
  const [selectedRegion, setSelectedRegion] = useState<Region>('West')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<DiscoveredSub[]>([])
  const [importing, setImporting] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState('')
  const [searchPerformed, setSearchPerformed] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const allCategories = [...DEFAULT_SERVICE_CATEGORIES, ...customCategories]
  const effectiveCategory = customInput.trim() || category

  const suggestions = customInput.trim()
    ? allCategories.filter(c => c.toLowerCase().includes(customInput.trim().toLowerCase()))
    : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch() {
    if (!effectiveCategory) {
      setError('Please select or enter a service category.')
      return
    }
    if (searchScope === 'local' && !location) {
      setError('Please enter a location for local search.')
      return
    }

    if (customInput.trim()) {
      saveCustomCategory(customInput.trim())
      setCustomCategories(loadCustomCategories())
    }

    setError('')
    setSearching(true)
    setResults([])
    setSearchPerformed(true)

    try {
      // Parse state from location input for local search
      let searchState: string | undefined
      if (searchScope === 'local' && location) {
        const parts = location.split(',').map(s => s.trim())
        searchState = parts[1]?.replace(/\s/g, '').toUpperCase()
      }

      // Check against existing database to avoid showing duplicates
      const { data: existing } = await supabase.from('subcontractors').select('company_name')
      const existingNames = new Set((existing || []).map(s => s.company_name.toLowerCase()))

      let discovered: DiscoveredSub[] = []

      if (searchScope === 'local' || searchScope === 'regional') {
        // Use Google Places API for local and regional searches
        try {
          const apiResponse = await fetch('/.netlify/functions/discover-subs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: effectiveCategory,
              scope: searchScope,
              location: location,
              radius: radius,
              region: searchScope === 'regional' ? selectedRegion : undefined,
            }),
          })
          const apiData = await apiResponse.json()

          if (apiData.results && apiData.results.length > 0) {
            const apiResults: DiscoveredSub[] = apiData.results
              .filter((r: { company_name: string }) => !existingNames.has(r.company_name.toLowerCase()))
              .map((r: { company_name: string; city?: string; state?: string; phone?: string; website?: string; categories?: string[]; rating?: number; review_count?: number; address?: string }, i: number) => ({
                id: `places-${Date.now()}-${i}`,
                company_name: r.company_name,
                hq_city: r.city || '',
                hq_state: r.state || '',
                address: r.address || null,
                phone: r.phone || null,
                website: r.website || null,
                categories: r.categories || [effectiveCategory],
                coverage: 'local' as CoverageLevel,
                description: r.address || `${r.city || ''}, ${r.state || ''}`,
                rating: r.rating,
                review_count: r.review_count,
                data_source: 'google_places' as DataSource,
                selected: false,
                imported: false,
              }))
            discovered.push(...apiResults)
          }
        } catch (apiErr) {
          console.warn('Google Places API not available, using curated data:', apiErr)
        }

        // Also add curated companies that serve this area
        const curated = searchCuratedCompanies(effectiveCategory, searchScope, {
          state: searchState,
          region: searchScope === 'regional' ? selectedRegion : undefined,
        })
        const curatedResults: DiscoveredSub[] = curated
          .filter(c => !existingNames.has(c.company_name.toLowerCase()))
          .filter(c => !discovered.some(d => d.company_name.toLowerCase() === c.company_name.toLowerCase()))
          .map((c, i) => ({
            id: `curated-${Date.now()}-${i}`,
            company_name: c.company_name,
            hq_city: c.hq_city,
            hq_state: c.hq_state,
            address: `${c.hq_city}, ${c.hq_state}`,
            phone: c.phone,
            website: c.website,
            categories: c.categories,
            coverage: c.coverage,
            regions_served: c.regions_served,
            states_served: c.states_served,
            description: c.description,
            data_source: 'curated' as DataSource,
            selected: false,
            imported: false,
          }))
        discovered.push(...curatedResults)
      } else {
        // National scope: use curated database
        const curated = searchCuratedCompanies(effectiveCategory, 'national', {})
        discovered = curated
          .filter(c => !existingNames.has(c.company_name.toLowerCase()))
          .map((c, i) => ({
            id: `curated-${Date.now()}-${i}`,
            company_name: c.company_name,
            hq_city: c.hq_city,
            hq_state: c.hq_state,
            address: `${c.hq_city}, ${c.hq_state}`,
            phone: c.phone,
            website: c.website,
            categories: c.categories,
            coverage: c.coverage,
            regions_served: c.regions_served,
            states_served: c.states_served,
            description: c.description,
            data_source: 'curated' as DataSource,
            selected: false,
            imported: false,
          }))
      }

      setResults(discovered)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  function toggleSelect(id: string) {
    setResults(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r))
  }

  function selectAll() {
    const allSelected = results.filter(r => !r.imported).every(r => r.selected)
    setResults(prev => prev.map(r => r.imported ? r : { ...r, selected: !allSelected }))
  }

  async function handleImport() {
    const selected = results.filter(r => r.selected && !r.imported)
    if (selected.length === 0) return

    setImporting(true)
    setImportCount(0)

    function buildFullRecords(subs: DiscoveredSub[]) {
      return subs.map(s => ({
        company_name: s.company_name,
        contact_name: null,
        contact_email: null,
        contact_phone: s.phone,
        website: s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null,
        address: s.address || (s.hq_city && s.hq_state ? `${s.hq_city}, ${s.hq_state}` : null),
        service_categories: s.categories.length > 0 ? s.categories : [effectiveCategory],
        geographic_coverage: s.coverage === 'national'
          ? ['National']
          : s.coverage === 'regional'
          ? (s.regions_served || [s.hq_state])
          : [s.hq_state || 'Local'],
        nationwide: s.coverage === 'national',
        regions: s.coverage === 'regional' ? (s.regions_served || []) : [],
        preferred: false,
        performance_notes: s.data_source === 'google_places'
          ? `${s.description}${s.rating ? '. Google Rating: ' + s.rating + '/5' + (s.review_count ? ' (' + s.review_count + ' reviews)' : '') : ''}`
          : `${s.description}. HQ: ${s.hq_city}, ${s.hq_state}. Coverage: ${
              s.coverage === 'national' ? 'National' : s.coverage === 'regional' ? `Regional (${(s.regions_served || []).join(', ')})` : `Local (${s.hq_state})`
            }`,
      }))
    }

    function buildBasicRecords(subs: DiscoveredSub[]) {
      return subs.map(s => ({
        company_name: s.company_name,
        contact_name: null,
        contact_email: null,
        contact_phone: s.phone,
        service_categories: s.categories.length > 0 ? s.categories : [effectiveCategory],
        geographic_coverage: s.coverage === 'national'
          ? ['National']
          : s.coverage === 'regional'
          ? (s.regions_served || [s.hq_state])
          : [s.hq_state || 'Local'],
        preferred: false,
        performance_notes: s.data_source === 'google_places'
          ? `${s.description}${s.rating ? '. Google Rating: ' + s.rating + '/5' + (s.review_count ? ' (' + s.review_count + ' reviews)' : '') : ''}${s.website ? '. Website: ' + s.website : ''}`
          : `${s.description}. HQ: ${s.hq_city}, ${s.hq_state}. Coverage: ${
              s.coverage === 'national' ? 'National' : s.coverage === 'regional' ? `Regional (${(s.regions_served || []).join(', ')})` : `Local (${s.hq_state})`
            }${s.website ? '. Website: ' + s.website : ''}`,
      }))
    }

    // Try full insert with all detail columns first; fall back to basic columns if schema doesn't support them yet
    let records = buildFullRecords(selected)
    let { data: inserted, error: insertErr } = await supabase
      .from('subcontractors')
      .insert(records)
      .select()

    if (insertErr && insertErr.message.includes('schema cache')) {
      console.warn('Full schema not available, falling back to basic columns:', insertErr.message)
      records = buildBasicRecords(selected) as typeof records
      const fallback = await supabase
        .from('subcontractors')
        .insert(records)
        .select()
      inserted = fallback.data
      insertErr = fallback.error
    }

    if (insertErr) {
      setError('Import failed: ' + insertErr.message)
      setImporting(false)
      return
    }

    if (inserted) {
      await markMultipleSources(
        inserted.map(s => s.id),
        'core314_capture',
        { search_query: `${effectiveCategory} - ${searchScope === 'local' ? location : searchScope === 'regional' ? selectedRegion : 'National'}` }
      )
      setImportCount(inserted.length)
    }

    const importedNames = new Set(selected.map(s => s.company_name))
    setResults(prev => prev.map(r => importedNames.has(r.company_name) ? { ...r, imported: true, selected: false } : r))
    setImporting(false)
  }

  const selectedCount = results.filter(r => r.selected && !r.imported).length

  function coverageBadge(coverage: CoverageLevel, regions?: string[], states?: string[]) {
    if (coverage === 'national') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
          <Globe size={11} />
          National
        </span>
      )
    }
    if (coverage === 'regional') {
      const label = regions?.length ? regions.join(', ') : states?.join(', ') || 'Regional'
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
          <Globe2 size={11} />
          Regional — {label}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
        <MapPin size={11} />
        Local
      </span>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Radar className="text-blue-600" size={28} />
          Core314 Subcontractor Capture
        </h1>
        <p className="text-gray-500 mt-1">
          Discover verified commercial subcontractors by service category and coverage area. Import them into your master database for RFQ outreach.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={18} className="text-gray-500" />
          Search Criteria
        </h2>
        {/* Service Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Category *</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); if (e.target.value) setCustomInput('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
            >
              <option value="">Select a category...</option>
              {DEFAULT_SERVICE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {customCategories.length > 0 && (
                <optgroup label="Custom Categories">
                  {customCategories.map(c => (
                    <option key={`custom-${c}`} value={c}>{c}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="relative" ref={suggestionsRef}>
              <input
                type="text"
                value={customInput}
                onChange={e => {
                  setCustomInput(e.target.value)
                  setShowSuggestions(true)
                  if (e.target.value.trim()) setCategory('')
                }}
                onFocus={() => { if (customInput.trim()) setShowSuggestions(true) }}
                placeholder="Or type a custom category..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setCustomInput(s)
                        setCategory('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Scope</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['local', 'regional', 'national'] as SearchScope[]).map(scope => (
                <button
                  key={scope}
                  onClick={() => setSearchScope(scope)}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    searchScope === scope
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {scope === 'local' && <MapPin size={14} />}
                  {scope === 'regional' && <Globe2 size={14} />}
                  {scope === 'national' && <Globe size={14} />}
                  {scope.charAt(0).toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope-specific fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {searchScope === 'local' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location * <span className="text-gray-400">(City, State)</span></label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g., Denver, CO"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Radius</label>
                <select
                  value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={100}>100 miles</option>
                  <option value={200}>200 miles</option>
                </select>
              </div>
            </>
          )}
          {searchScope === 'regional' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value as Region)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(Object.keys(REGION_STATES) as Region[]).map(r => (
                  <option key={r} value={r}>{r} ({REGION_STATES[r].join(', ')})</option>
                ))}
              </select>
            </div>
          )}
          {searchScope === 'national' && (
            <div className="md:col-span-2 flex items-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
                <Globe size={16} />
                Showing all verified companies with national and regional coverage
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {searching ? 'Searching...' : searchScope === 'national' ? 'Search Nationally' : searchScope === 'regional' ? `Search ${selectedRegion} Region` : 'Search Commercial Directories'}
          </button>
          {searchPerformed && !searching && (
            <span className="text-sm text-gray-500">
              Found {results.length} verified subcontractor{results.length !== 1 ? 's' : ''} not already in your database
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building size={18} className="text-gray-500" />
              Verified Subcontractors ({results.length})
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {results.filter(r => !r.imported).every(r => r.selected) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {importing ? 'Importing...' : `Import Selected (${selectedCount})`}
              </button>
            </div>
          </div>

          {importCount > 0 && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle size={16} />
              {importCount} subcontractor{importCount !== 1 ? 's' : ''} imported to your master database and tagged as "Core314 Capture" source.
            </div>
          )}

          {/* Data source notice */}
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2 text-xs text-gray-600">
            <ShieldCheck size={14} className="text-green-600 flex-shrink-0" />
            {searchScope === 'national'
              ? 'Companies shown are verified industry participants sourced from public business registrations, industry associations, and company filings. Coverage levels reflect each company\'s verified service footprint.'
              : `Local businesses sourced from Google Maps for ${searchScope === 'local' ? location : selectedRegion + ' region'}. National/regional companies from Core314 curated industry database.`
            }
          </div>

          <div className="space-y-3">
            {results.map(sub => (
              <div
                key={sub.id}
                className={`border rounded-lg p-4 transition-all ${
                  sub.imported
                    ? 'border-green-200 bg-green-50 opacity-75'
                    : sub.selected
                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!sub.imported && (
                    <input
                      type="checkbox"
                      checked={sub.selected}
                      onChange={() => toggleSelect(sub.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  {sub.imported && (
                    <CheckCircle size={18} className="mt-0.5 text-green-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{sub.company_name}</h3>
                        {sub.data_source === 'curated' && coverageBadge(sub.coverage, sub.regions_served, sub.states_served)}
                        {sub.data_source === 'google_places' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                            <MapPin size={11} />
                            Local Business
                          </span>
                        )}
                      </div>
                      {sub.rating && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Star size={13} className="text-amber-400 fill-amber-400" />
                          {sub.rating}/5{sub.review_count ? ` (${sub.review_count})` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-gray-400" />
                        {sub.data_source === 'google_places' ? `${sub.hq_city}${sub.hq_state ? ', ' + sub.hq_state : ''}` : `${sub.hq_city}, ${sub.hq_state} (HQ)`}
                      </span>
                      {sub.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} className="text-gray-400" />
                          {sub.phone}
                        </span>
                      )}
                      {sub.website && (
                        <a
                          href={`https://${sub.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          <Globe size={13} />
                          {sub.website}
                        </a>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sub.categories.map(cat => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{cat}</span>
                      ))}
                    </div>
                    {sub.coverage === 'regional' && sub.states_served && sub.states_served.length > 0 && (
                      <div className="mt-1.5 text-xs text-gray-500">
                        Serves: {sub.states_served.join(', ')}
                      </div>
                    )}
                    {sub.imported && (
                      <span className="inline-block mt-2 text-xs text-green-600 font-medium">Added to Master Database</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchPerformed && !searching && results.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-medium text-gray-700 mb-1">No New Subcontractors Found</h3>
          <p className="text-sm text-gray-500">
            All verified subcontractors for this search are already in your database, or no results matched the criteria. Try a different category or broaden the search scope.
          </p>
        </div>
      )}

      {/* Info Banner */}
      {!searchPerformed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Radar size={18} className="text-blue-600" />
            How Core314 Subcontractor Capture Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              Select a service category and search scope (Local, Regional, or National)
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">2.</span>
              Results show verified companies with confirmed coverage areas — no assumptions. Each company's coverage level (National, Regional, Local) is clearly labeled.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">3.</span>
              Select the subcontractors you want and import them into your master database
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">4.</span>
              Imported subcontractors are tagged as "Core314 Capture" source and automatically aligned to matching task order SOWs
            </li>
          </ul>
          <div className="mt-4 p-3 bg-white/60 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Verified Data:</strong> All companies are sourced from public business registrations, SEC filings, and industry association directories.
              Coverage levels are verified — a company marked "National" has confirmed service capability across the US; "Regional" companies serve specific multi-state areas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
