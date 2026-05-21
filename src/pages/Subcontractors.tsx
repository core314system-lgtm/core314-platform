import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Subcontractor } from '../lib/types'
import { parseExcelForSubcontractors } from '../lib/documentParser'
import { loadSourceRegistry, type SubSource } from '../lib/subcontractorSources'
import { Plus, Search, MapPin, Star, Upload, X, FileSpreadsheet, Edit2, Trash2, Globe, Building, ChevronDown, ChevronUp, Download, Radar, Phone } from 'lucide-react'

const US_REGIONS: Record<string, string[]> = {
  'Northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'Southeast': ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  'Midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'Southwest': ['AZ', 'NM', 'OK', 'TX'],
  'West': ['CO', 'ID', 'MT', 'NV', 'UT', 'WY'],
  'Pacific': ['AK', 'CA', 'HI', 'OR', 'WA'],
  'Mid-Atlantic': ['DC', 'DE', 'MD'],
}

const ALL_STATES = Object.values(US_REGIONS).flat().sort()

const SERVICE_CATEGORY_OPTIONS = [
  'HVAC', 'Fire Life Safety', 'Janitorial', 'Landscaping', 'Snow Removal',
  'Emergency Power', 'Plumbing', 'Electrical', 'Pest Control', 'Dock Equipment',
  'Elevator Maintenance', 'Roofing', 'Painting', 'Flooring', 'Security Systems',
  'Building Automation', 'Grounds Maintenance', 'Waste Management', 'General Maintenance',
]


const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', color: 'bg-green-100 text-green-700' },
  { value: 'busy', label: 'Busy', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'unavailable', label: 'Unavailable', color: 'bg-red-100 text-red-700' },
  { value: 'seasonal', label: 'Seasonal', color: 'bg-blue-100 text-blue-700' },
]

interface SubForm {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  service_categories: string[]
  geographic_coverage: string[]
  incumbent_status: string
  availability: string
  nationwide: boolean
  regions: string[]
  certifications: string
  preferred: boolean
  performance_notes: string
  website: string
  small_business: boolean
}

const emptyForm: SubForm = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  service_categories: [],
  geographic_coverage: [],
  incumbent_status: 'unknown',
  availability: 'available',
  nationwide: false,
  regions: [],
  certifications: '',
  preferred: false,
  performance_notes: '',
  website: '',
  small_business: false,
}

export default function Subcontractors() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [sourceRegistry, setSourceRegistry] = useState<Record<string, { source: SubSource }>>({})
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SubForm>({ ...emptyForm })

  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterSource, setFilterSource] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchSubcontractors()
    loadSourceRegistry().then(setSourceRegistry)
  }, [])

  async function fetchSubcontractors() {
    const { data } = await supabase
      .from('subcontractors')
      .select('*')
      .order('company_name')
    setSubcontractors(data || [])
    setLoading(false)
  }

  function getSubSource(id: string): SubSource {
    return sourceRegistry[id]?.source || 'user_database'
  }

  function handleRegionToggle(region: string) {
    const states = US_REGIONS[region] || []
    const currentStates = form.geographic_coverage
    const allIncluded = states.every(s => currentStates.includes(s))
    if (allIncluded) {
      setForm(prev => ({ ...prev, geographic_coverage: prev.geographic_coverage.filter(s => !states.includes(s)) }))
    } else {
      const newStates = [...new Set([...currentStates, ...states])]
      setForm(prev => ({ ...prev, geographic_coverage: newStates }))
    }
  }

  function handleNationwideToggle() {
    if (form.nationwide) {
      setForm(prev => ({ ...prev, nationwide: false, geographic_coverage: [] }))
    } else {
      setForm(prev => ({ ...prev, nationwide: true, geographic_coverage: [...ALL_STATES] }))
    }
  }

  function handleServiceCategoryToggle(cat: string) {
    setForm(prev => ({
      ...prev,
      service_categories: prev.service_categories.includes(cat)
        ? prev.service_categories.filter(c => c !== cat)
        : [...prev.service_categories, cat],
    }))
  }

  function isDuplicate(name: string, email: string | null, excludeId?: string): Subcontractor | undefined {
    const normName = name.trim().toLowerCase()
    return subcontractors.find(s => {
      if (excludeId && s.id === excludeId) return false
      if (s.company_name.trim().toLowerCase() === normName) return true
      if (email && s.contact_email && s.contact_email.trim().toLowerCase() === email.trim().toLowerCase()) return true
      return false
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const record = {
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      service_categories: form.service_categories,
      geographic_coverage: form.nationwide ? ['Nationwide'] : form.geographic_coverage,
      preferred: form.preferred,
      incumbent_status: form.incumbent_status,
      performance_notes: form.performance_notes || null,
    }

    if (editingId) {
      const dup = isDuplicate(form.company_name, form.contact_email, editingId)
      if (dup) {
        if (!confirm(`A subcontractor with a matching name or email already exists: "${dup.company_name}". Save anyway?`)) return
      }
      await supabase.from('subcontractors').update(record).eq('id', editingId)
    } else {
      const dup = isDuplicate(form.company_name, form.contact_email)
      if (dup) {
        alert(`Duplicate detected: "${dup.company_name}" already exists in the database.\n\nMatched by: ${dup.company_name.trim().toLowerCase() === form.company_name.trim().toLowerCase() ? 'Company Name' : 'Email'}\n\nPlease edit the existing entry instead of creating a duplicate.`)
        return
      }
      await supabase.from('subcontractors').insert(record)
    }

    setForm({ ...emptyForm })
    setShowAdd(false)
    setEditingId(null)
    fetchSubcontractors()
  }

  function handleEdit(sub: Subcontractor) {
    const isNationwide = sub.geographic_coverage?.includes('Nationwide')
    setForm({
      company_name: sub.company_name,
      contact_name: sub.contact_name || '',
      contact_email: sub.contact_email || '',
      contact_phone: sub.contact_phone || '',
      service_categories: sub.service_categories || [],
      geographic_coverage: isNationwide ? [...ALL_STATES] : (sub.geographic_coverage || []),
      incumbent_status: sub.incumbent_status || 'unknown',
      availability: sub.availability || 'available',
      nationwide: isNationwide,
      regions: sub.regions || [],
      certifications: sub.certifications?.join(', ') || '',
      preferred: sub.preferred,
      performance_notes: sub.performance_notes || '',
      website: sub.website || '',
      small_business: sub.small_business || false,
    })
    setEditingId(sub.id)
    setShowAdd(true)
    setShowImport(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this subcontractor from the database?')) return
    await supabase.from('subcontractors').delete().eq('id', id)
    fetchSubcontractors()
  }

  async function handleClearAll() {
    if (!confirm(`DELETE ALL ${subcontractors.length} SUBCONTRACTORS?\n\nThis will permanently remove every subcontractor from the database.\n\nThis action cannot be undone.`)) return
    if (!confirm('Are you absolutely sure? This removes ALL subcontractor data.')) return
    await supabase.from('subcontractors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    fetchSubcontractors()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseExcelForSubcontractors(file)
      setImportPreview(rows)
    } catch (err) {
      alert('Error reading file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    e.target.value = ''
  }

  async function handleImportConfirm() {
    setImporting(true)
    const columnMap = detectColumns(importPreview[0] || {})
    // Build a set of existing names and emails for fast duplicate checking
    const existingNames = new Set(subcontractors.map(s => s.company_name.trim().toLowerCase()))
    const existingEmails = new Set(subcontractors.filter(s => s.contact_email).map(s => s.contact_email!.trim().toLowerCase()))
    // Also track names added during this import to prevent intra-import duplicates
    const importedNames = new Set<string>()
    let skipped = 0
    let imported = 0

    for (const row of importPreview) {
      const companyName = row[columnMap.company_name] || ''
      if (!companyName) continue
      const normName = companyName.trim().toLowerCase()
      const email = (row[columnMap.contact_email] || '').trim().toLowerCase()

      // Skip duplicates
      if (existingNames.has(normName) || importedNames.has(normName) || (email && existingEmails.has(email))) {
        skipped++
        continue
      }

      const serviceCategories = (row[columnMap.service_categories] || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      const geoCoverage = (row[columnMap.geographic_coverage] || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      const incumbentRaw = (row[columnMap.incumbent_status] || '').toLowerCase()
      let incumbentStatus = 'unknown'
      if (incumbentRaw.includes('incumbent') || incumbentRaw.includes('yes') || incumbentRaw === 'known') incumbentStatus = 'known'
      else if (incumbentRaw.includes('suspect')) incumbentStatus = 'suspected'
      else if (incumbentRaw.includes('no') || incumbentRaw.includes('not')) incumbentStatus = 'not_incumbent'

      await supabase.from('subcontractors').insert({
        company_name: companyName,
        contact_name: row[columnMap.contact_name] || null,
        contact_email: row[columnMap.contact_email] || null,
        contact_phone: row[columnMap.contact_phone] || null,
        service_categories: serviceCategories,
        geographic_coverage: geoCoverage.length === 0 ? ['Nationwide'] : geoCoverage,
        preferred: false,
        incumbent_status: incumbentStatus,
      })
      importedNames.add(normName)
      if (email) existingEmails.add(email)
      imported++
    }

    setImporting(false)
    setShowImport(false)
    setImportPreview([])
    fetchSubcontractors()
    if (skipped > 0) {
      alert(`Import complete: ${imported} new subcontractors added, ${skipped} duplicates skipped.`)
    }
  }

  function detectColumns(row: Record<string, string>) {
    const keys = Object.keys(row).map(k => k.toLowerCase())
    const original = Object.keys(row)
    function find(patterns: string[]): string {
      for (const p of patterns) {
        const idx = keys.findIndex(k => k.includes(p))
        if (idx >= 0) return original[idx]
      }
      return original[0] || ''
    }
    return {
      company_name: find(['company', 'vendor', 'name', 'subcontractor', 'firm']),
      contact_name: find(['contact', 'person', 'rep']),
      contact_email: find(['email', 'e-mail', 'mail']),
      contact_phone: find(['phone', 'tel', 'mobile', 'cell']),
      service_categories: find(['service', 'category', 'trade', 'specialty', 'scope']),
      geographic_coverage: find(['state', 'region', 'geographic', 'location', 'coverage', 'area']),
      incumbent_status: find(['incumbent', 'status']),
    }
  }

  function exportToCSV() {
    const headers = ['Company Name', 'Contact Name', 'Email', 'Phone', 'Service Categories', 'Geographic Coverage', 'Incumbent Status', 'Preferred']
    const rows = subcontractors.map(s => [
      s.company_name,
      s.contact_name || '',
      s.contact_email || '',
      s.contact_phone || '',
      s.service_categories?.join('; ') || '',
      s.geographic_coverage?.join('; ') || '',
      s.incumbent_status,
      s.preferred ? 'Yes' : 'No',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subcontractors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = subcontractors.filter(s => {
    if (search && !s.company_name.toLowerCase().includes(search.toLowerCase()) &&
      !s.service_categories?.some(c => c.toLowerCase().includes(search.toLowerCase())) &&
      !s.geographic_coverage?.some(g => g.toLowerCase().includes(search.toLowerCase()))) return false
    if (filterCategory && !s.service_categories?.some(c => c.toLowerCase().includes(filterCategory.toLowerCase()))) return false
    if (filterSource && getSubSource(s.id) !== filterSource) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Subcontractor Database</h1>
          <p className="text-sm text-gray-500">{subcontractors.length} subcontractors in database</p>
        </div>
        <div className="flex gap-2">
          <Link to="/subcontractor-capture" className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
            <Radar size={18} /> Procuvex Capture
          </Link>
          {subcontractors.length > 0 && (
            <button onClick={handleClearAll} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg font-medium hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-2 text-sm">
              <Trash2 size={16} /> Clear All ({subcontractors.length})
            </button>
          )}
          <button onClick={exportToCSV} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm">
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowAdd(false); setEditingId(null) }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Upload size={18} /> Import Excel/CSV
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowImport(false); setEditingId(null); setForm({ ...emptyForm }) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={18} /> Add Subcontractor
          </button>
        </div>
      </div>

      {/* Excel/CSV Import */}
      {showImport && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-green-600" />
              <h3 className="font-semibold text-gray-900">Import Subcontractor List</h3>
            </div>
            <button onClick={() => { setShowImport(false); setImportPreview([]) }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Upload an Excel (.xlsx, .xls) or CSV file. The system will auto-detect columns for company name, contact info, service categories, geographic coverage, and incumbent status.
          </p>
          {importPreview.length === 0 ? (
            <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 transition-colors">
              <FileSpreadsheet className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600">Click to select your Excel or CSV file</p>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
            </label>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview: {importPreview.length} rows detected</p>
              <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(importPreview[0] || {}).slice(0, 6).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).slice(0, 6).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700">{String(val).substring(0, 40)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.length > 10 && <p className="text-xs text-gray-400 mt-1">Showing first 10 of {importPreview.length} rows</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={handleImportConfirm} disabled={importing} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${importPreview.length} Subcontractors`}
                </button>
                <button onClick={() => setImportPreview([])} className="px-4 py-2 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd && (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Subcontractor' : 'Add New Subcontractor'}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input type="text" value={form.company_name} onChange={e => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={form.contact_name} onChange={e => setForm(prev => ({ ...prev, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.contact_email} onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={form.contact_phone} onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="url" value={form.website} onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))} placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certifications (comma-separated)</label>
              <input type="text" value={form.certifications} onChange={e => setForm(prev => ({ ...prev, certifications: e.target.value }))}
                placeholder="e.g., EPA Lead, OSHA 30, 8(a), HUBZone"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
            <div className="flex gap-2">
              {AVAILABILITY_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(prev => ({ ...prev, availability: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                    form.availability === opt.value ? opt.color + ' border-current' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Service Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Categories</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORY_OPTIONS.map(cat => (
                <button key={cat} type="button"
                  onClick={() => handleServiceCategoryToggle(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    form.service_categories.includes(cat) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Geographic Coverage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Geographic Coverage</label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.nationwide} onChange={handleNationwideToggle}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <Globe size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Nationwide Coverage</span>
              </label>
              {!form.nationwide && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Select by region or individual states:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {Object.keys(US_REGIONS).map(region => {
                      const states = US_REGIONS[region]
                      const allSelected = states.every(s => form.geographic_coverage.includes(s))
                      const someSelected = states.some(s => form.geographic_coverage.includes(s))
                      return (
                        <button key={region} type="button" onClick={() => handleRegionToggle(region)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            allSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-300' :
                            someSelected ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                            'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}>
                          {region}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_STATES.map(st => (
                      <button key={st} type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          geographic_coverage: prev.geographic_coverage.includes(st)
                            ? prev.geographic_coverage.filter(s => s !== st)
                            : [...prev.geographic_coverage, st]
                        }))}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                          form.geographic_coverage.includes(st) ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                        }`}>
                        {st}
                      </button>
                    ))}
                  </div>
                  {form.geographic_coverage.length > 0 && (
                    <p className="text-xs text-indigo-600 mt-1">{form.geographic_coverage.length} states selected</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.preferred} onChange={e => setForm(prev => ({ ...prev, preferred: e.target.checked }))}
                className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500" />
              <Star size={16} className="text-amber-500" />
              <span className="text-sm text-gray-700">Preferred Vendor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.small_business} onChange={e => setForm(prev => ({ ...prev, small_business: e.target.checked }))}
                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
              <Building size={16} className="text-green-600" />
              <span className="text-sm text-gray-700">Small Business</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Performance Notes</label>
            <textarea value={form.performance_notes} onChange={e => setForm(prev => ({ ...prev, performance_notes: e.target.value }))}
              rows={2} placeholder="Quality notes, past performance, reliability..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
              {editingId ? 'Update Subcontractor' : 'Save Subcontractor'}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); setForm({ ...emptyForm }) }}
              className="px-4 py-2 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search by name, service category, or location..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">All Categories</option>
          {SERVICE_CATEGORY_OPTIONS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">All Sources</option>
          <option value="user_database">User Database</option>
          <option value="core314_capture">Procuvex Capture</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">
            {search || filterCategory ? 'No subcontractors match your filters.' : 'No subcontractors in the database yet.'}
          </p>
          {!search && !filterCategory && (
            <p className="text-sm text-gray-400">Use &quot;Import Excel/CSV&quot; to upload your existing vendor list, or add subcontractors one at a time.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{filtered.length} of {subcontractors.length} subcontractors shown</p>
          {filtered.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{sub.company_name}</h3>
                    {sub.preferred && <Star className="text-amber-500 fill-amber-500" size={16} />}
                    {sub.small_business && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">SB</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      getSubSource(sub.id) === 'core314_capture'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      {getSubSource(sub.id) === 'core314_capture' ? 'Procuvex Capture' : 'User Database'}
                    </span>
                  </div>
                  {sub.address && (
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                      {sub.address}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1">
                    {sub.contact_name && <p className="text-sm text-gray-600">{sub.contact_name}</p>}
                    {sub.contact_email && <p className="text-sm text-gray-500">{sub.contact_email}</p>}
                    {sub.contact_phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone size={12} /> {sub.contact_phone}</p>}
                    {sub.website && <a href={sub.website.startsWith('http') ? sub.website : `https://${sub.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Globe size={12} /> {sub.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(sub)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="text-gray-400 hover:text-red-600 p-1" title="Remove">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)} className="text-gray-400 hover:text-gray-600 p-1">
                    {expandedId === sub.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {sub.service_categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {sub.service_categories.map(cat => (
                    <span key={cat} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{cat}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                {sub.geographic_coverage?.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} />
                    {sub.geographic_coverage.includes('Nationwide') ? (
                      <span className="text-indigo-600 font-medium">Nationwide</span>
                    ) : sub.geographic_coverage.length > 5 ? (
                      <span>{sub.geographic_coverage.length} states</span>
                    ) : (
                      sub.geographic_coverage.join(', ')
                    )}
                  </div>
                )}
              </div>

              {expandedId === sub.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600 space-y-2">
                  {sub.performance_notes && <p><strong>Notes:</strong> {sub.performance_notes}</p>}
                  {sub.geographic_coverage && !sub.geographic_coverage.includes('Nationwide') && sub.geographic_coverage.length > 5 && (
                    <p><strong>States:</strong> {sub.geographic_coverage.join(', ')}</p>
                  )}
                  {sub.website && <p><strong>Website:</strong> <a href={sub.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{sub.website}</a></p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
