import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import {
  Search, MapPin, Mail, Phone, Plus, Upload, Download,
  Users, Star, Trash2, Edit3, X, Check, Loader2,
  AlertCircle, Shield, FileUp,
} from 'lucide-react'

interface OrgSub {
  id: string
  company_name: string
  dba_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  trade_categories: string[]
  naics_codes: string[]
  small_business: boolean
  small_business_types: string[]
  sam_uei: string | null
  cage_code: string | null
  notes: string | null
  internal_rating: number | null
  tags: string[]
  data_source: string
  outreach_count: number
  project_count: number
  created_at: string
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const TRADE_OPTIONS = [
  'HVAC', 'Electrical', 'Plumbing', 'Fire & Life Safety', 'Roofing',
  'Painting & Coatings', 'Concrete', 'Janitorial & Custodial',
  'Landscaping & Grounds', 'Security Systems', 'Elevator & Escalator',
  'General Construction', 'IT & Cybersecurity', 'Engineering',
  'Environmental', 'Demolition', 'Flooring', 'Drywall & Insulation',
  'Snow & Ice Removal', 'Pest Control', 'Other',
]

export default function OrgSubcontractors() {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [subs, setSubs] = useState<OrgSub[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Add/Edit modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSub, setEditingSub] = useState<OrgSub | null>(null)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tags for filter
  const [allTags, setAllTags] = useState<string[]>([])

  const fetchSubs = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)

    let query = supabase
      .from('org_subcontractors')
      .select('*', { count: 'exact' })
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search) {
      query = query.ilike('company_name', `%${search}%`)
    }
    if (stateFilter) {
      query = query.eq('state', stateFilter)
    }
    if (tradeFilter) {
      query = query.contains('trade_categories', [tradeFilter])
    }
    if (tagFilter) {
      query = query.contains('tags', [tagFilter])
    }

    const { data, count, error } = await query
    if (!error && data) {
      setSubs(data)
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [currentOrg, search, stateFilter, tradeFilter, tagFilter, page])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  // Fetch all unique tags for filter
  useEffect(() => {
    if (!currentOrg) return
    supabase
      .from('org_subcontractors')
      .select('tags')
      .eq('org_id', currentOrg.id)
      .not('tags', 'eq', '{}')
      .limit(500)
      .then(({ data }) => {
        const tagSet = new Set<string>()
        data?.forEach(row => row.tags?.forEach((t: string) => tagSet.add(t)))
        setAllTags(Array.from(tagSet).sort())
      })
  }, [currentOrg])

  const handleExport = async () => {
    if (!currentOrg) return
    const { data } = await supabase
      .from('org_subcontractors')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('company_name')

    if (!data || data.length === 0) return

    const csvHeaders = ['Company Name', 'DBA', 'Contact Name', 'Email', 'Phone', 'Website', 'Address', 'City', 'State', 'Zip', 'Trades', 'NAICS', 'SBA Types', 'SAM UEI', 'CAGE', 'Tags', 'Rating', 'Notes']
    const csvRows = data.map(s => [
      s.company_name || '',
      s.dba_name || '',
      s.contact_name || '',
      s.contact_email || '',
      s.contact_phone || '',
      s.website || '',
      s.address_line1 || '',
      s.city || '',
      s.state || '',
      s.zip_code || '',
      (s.trade_categories || []).join('; '),
      (s.naics_codes || []).join('; '),
      (s.small_business_types || []).join('; '),
      s.sam_uei || '',
      s.cage_code || '',
      (s.tags || []).join('; '),
      s.internal_rating || '',
      s.notes || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

    const csv = [csvHeaders.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-subcontractors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subcontractor? This cannot be undone.')) return
    await supabase.from('org_subcontractors').delete().eq('id', id)
    fetchSubs()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrg || !user) return

    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) {
        setImportResult({ error: 'File must have at least a header row and one data row' })
        setImporting(false)
        return
      }

      // Parse CSV (basic — handles quoted fields)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      const columns = parseCSVLine(lines[0])
      const rows = lines.slice(1).map(l => parseCSVLine(l)).filter(r => r.some(c => c.trim()))

      // Send to import function
      const response = await fetch('/.netlify/functions/org-sub-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: currentOrg.id,
          user_id: user.id,
          columns,
          rows,
        }),
      })

      const result = await response.json()
      setImportResult(result)
      if (result.success) {
        fetchSubs()
      }
    } catch (err: any) {
      setImportResult({ error: err.message || 'Failed to parse file' })
    }

    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Subcontractors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your private subcontractor database — this data is never shared with or ingested into the Procuvex network.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={() => { setEditingSub(null); setShowAddModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} />
            Add Subcontractor
          </button>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
        <Shield className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
        <div className="text-sm text-blue-800">
          <strong>Your data stays yours.</strong> Subcontractors you add here are private to your organization.
          They are never blended into the Procuvex Master Subcontractor Database, never shared with other users,
          and never used for Procuvex outreach. You can use them alongside the Procuvex network or independently —
          the system tracks everything regardless of source.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search company name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={stateFilter}
          onChange={e => { setStateFilter(e.target.value); setPage(0) }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All States</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={tradeFilter}
          onChange={e => { setTradeFilter(e.target.value); setPage(0) }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Trades</option>
          {TRADE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={e => { setTagFilter(e.target.value); setPage(0) }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span className="text-sm text-gray-500 ml-auto">{totalCount} subcontractor{totalCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed">
          <Users className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="text-lg font-medium text-gray-700">No subcontractors yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Add your subcontractors manually or import them from a CSV/Excel file.
            Your data stays completely private.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => { setEditingSub(null); setShowAddModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} />
              Add Manually
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              <Upload size={14} />
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trades</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rating</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subs.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{sub.company_name}</div>
                    {sub.dba_name && <div className="text-xs text-gray-500">DBA: {sub.dba_name}</div>}
                    {sub.small_business && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">SB</span>
                        {sub.small_business_types.slice(0, 2).map(t => (
                          <span key={t} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sub.contact_name && <div className="text-gray-700">{sub.contact_name}</div>}
                    {sub.contact_email && (
                      <a href={`mailto:${sub.contact_email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Mail size={10} />{sub.contact_email}
                      </a>
                    )}
                    {sub.contact_phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={10} />{sub.contact_phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(sub.city || sub.state) && (
                      <div className="text-gray-600 flex items-center gap-1">
                        <MapPin size={12} />
                        {[sub.city, sub.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sub.trade_categories.slice(0, 2).map(t => (
                        <span key={t} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      {sub.trade_categories.length > 2 && (
                        <span className="text-xs text-gray-400">+{sub.trade_categories.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sub.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {sub.internal_rating && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < sub.internal_rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingSub(sub); setShowAddModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-sm px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-sm px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import Panel */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Import Subcontractors</h2>
              <button onClick={() => { setShowImport(false); setImportResult(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Privacy guarantee:</strong> Imported subcontractors are stored exclusively in your
              organization's private database. They are never shared, sold, or ingested into the
              Procuvex network.
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Upload a CSV or Excel file with your subcontractor data. The system will automatically
                map common column names (Company Name, Email, Phone, State, Trades, etc.).
              </p>
              <p className="text-sm text-gray-500">
                Required: <strong>Company Name</strong> column. All other fields are optional.
              </p>
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <FileUp className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm font-medium text-gray-700">Click to upload CSV file</p>
                <p className="text-xs text-gray-400 mt-1">CSV, TSV, or TXT — max 10,000 rows</p>
              </label>
            </div>

            {importing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="animate-spin" size={16} />
                Importing...
              </div>
            )}

            {importResult && (
              <div className={`rounded-lg p-3 text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {importResult.error ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    {importResult.error}
                  </div>
                ) : (
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Check size={16} />
                      Import complete!
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p>Imported: <strong>{importResult.imported}</strong> subcontractors</p>
                      {importResult.duplicates > 0 && <p>Skipped (duplicates): {importResult.duplicates}</p>}
                      {importResult.errors?.length > 0 && <p>Errors: {importResult.errors.length} rows</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AddEditModal
          sub={editingSub}
          orgId={currentOrg?.id || ''}
          userId={user?.id || ''}
          onClose={() => { setShowAddModal(false); setEditingSub(null) }}
          onSaved={() => { setShowAddModal(false); setEditingSub(null); fetchSubs() }}
        />
      )}
    </div>
  )
}

function AddEditModal({ sub, orgId, userId, onClose, onSaved }: {
  sub: OrgSub | null
  orgId: string
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: sub?.company_name || '',
    dba_name: sub?.dba_name || '',
    contact_name: sub?.contact_name || '',
    contact_email: sub?.contact_email || '',
    contact_phone: sub?.contact_phone || '',
    website: sub?.website || '',
    address_line1: '',
    city: sub?.city || '',
    state: sub?.state || '',
    zip_code: sub?.zip_code || '',
    trade_categories: sub?.trade_categories?.join(', ') || '',
    naics_codes: sub?.naics_codes?.join(', ') || '',
    small_business_types: sub?.small_business_types?.join(', ') || '',
    sam_uei: sub?.sam_uei || '',
    cage_code: sub?.cage_code || '',
    notes: sub?.notes || '',
    tags: sub?.tags?.join(', ') || '',
    internal_rating: sub?.internal_rating || 0,
  })

  const handleSave = async () => {
    if (!form.company_name.trim()) return
    setSaving(true)

    const record: any = {
      company_name: form.company_name.trim(),
      dba_name: form.dba_name.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      website: form.website.trim() || null,
      address_line1: form.address_line1.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip_code: form.zip_code.trim() || null,
      trade_categories: form.trade_categories.split(',').map(s => s.trim()).filter(Boolean),
      naics_codes: form.naics_codes.split(',').map(s => s.trim()).filter(Boolean),
      small_business_types: form.small_business_types.split(',').map(s => s.trim()).filter(Boolean),
      sam_uei: form.sam_uei.trim() || null,
      cage_code: form.cage_code.trim() || null,
      notes: form.notes.trim() || null,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      internal_rating: form.internal_rating || null,
      small_business: form.small_business_types.trim().length > 0,
    }

    if (sub) {
      // Update
      await supabase.from('org_subcontractors').update(record).eq('id', sub.id)
    } else {
      // Insert
      record.org_id = orgId
      record.created_by = userId
      record.data_source = 'manual'
      await supabase.from('org_subcontractors').insert(record)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{sub ? 'Edit' : 'Add'} Subcontractor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Company name (required)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DBA Name</label>
            <input
              type="text"
              value={form.dba_name}
              onChange={e => setForm(f => ({ ...f, dba_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Doing business as..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SAM UEI</label>
            <input
              type="text"
              value={form.sam_uei}
              onChange={e => setForm(f => ({ ...f, sam_uei: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Unique Entity ID"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Trades (comma-separated)</label>
            <input
              type="text"
              value={form.trade_categories}
              onChange={e => setForm(f => ({ ...f, trade_categories: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. HVAC, Electrical, Plumbing"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SBA Certifications (comma-separated)</label>
            <input
              type="text"
              value={form.small_business_types}
              onChange={e => setForm(f => ({ ...f, small_business_types: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 8(a), SDVOSB, HUBZone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. preferred, local, reliable"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Internal notes about this subcontractor..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, internal_rating: f.internal_rating === n ? 0 : n }))}
                  className="p-0.5"
                >
                  <Star size={20} className={n <= form.internal_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.company_name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            {sub ? 'Save Changes' : 'Add Subcontractor'}
          </button>
        </div>
      </div>
    </div>
  )
}
