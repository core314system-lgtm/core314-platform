import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Award, Plus, Search, ChevronDown, ChevronUp,
  DollarSign, Building2, X, Edit2, Trash2,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Citation {
  id: string
  org_id: string
  contract_title: string
  contract_number: string | null
  agency: string | null
  client_name: string | null
  contract_type: string | null
  naics_code: string | null
  set_aside: string | null
  contract_value: number | null
  period_of_performance_start: string | null
  period_of_performance_end: string | null
  relevance_tags: string[]
  service_categories: string[]
  description: string | null
  our_role: string | null
  key_personnel: string[]
  cpars_rating: string | null
  past_performance_narrative: string | null
  lessons_learned: string | null
  reusable_content: Record<string, string>
  created_at: string
  updated_at: string
}

const CPARS_LABELS: Record<string, { label: string; color: string }> = {
  exceptional: { label: 'Exceptional', color: 'bg-green-100 text-green-800' },
  very_good: { label: 'Very Good', color: 'bg-blue-100 text-blue-800' },
  satisfactory: { label: 'Satisfactory', color: 'bg-yellow-100 text-yellow-800' },
  marginal: { label: 'Marginal', color: 'bg-orange-100 text-orange-800' },
  unsatisfactory: { label: 'Unsatisfactory', color: 'bg-red-100 text-red-800' },
}

const CONTRACT_TYPES = [
  { value: 'FFP', label: 'Firm Fixed Price' },
  { value: 'T&M', label: 'Time & Materials' },
  { value: 'CPFF', label: 'Cost Plus Fixed Fee' },
  { value: 'CPAF', label: 'Cost Plus Award Fee' },
  { value: 'CPIF', label: 'Cost Plus Incentive Fee' },
  { value: 'IDIQ', label: 'IDIQ' },
  { value: 'BPA', label: 'BPA' },
  { value: 'Other', label: 'Other' },
]

const ROLE_LABELS: Record<string, string> = {
  prime: 'Prime Contractor',
  subcontractor: 'Subcontractor',
  jv_partner: 'JV Partner',
  mentor: 'Mentor',
  protege: 'Protege',
}

const emptyCitation: Partial<Citation> = {
  contract_title: '',
  contract_number: '',
  agency: '',
  client_name: '',
  contract_type: '',
  naics_code: '',
  set_aside: '',
  contract_value: null,
  period_of_performance_start: null,
  period_of_performance_end: null,
  relevance_tags: [],
  service_categories: [],
  description: '',
  our_role: 'prime',
  key_personnel: [],
  cpars_rating: null,
  past_performance_narrative: '',
  lessons_learned: '',
  reusable_content: {},
}

export default function PastPerformance() {
  const { currentOrg } = useOrg()
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRating, setFilterRating] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Citation>>(emptyCitation)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [catInput, setCatInput] = useState('')
  const [personnelInput, setPersonnelInput] = useState('')

  useEffect(() => {
    if (currentOrg?.id) fetchCitations()
  }, [currentOrg?.id])

  async function fetchCitations() {
    setLoading(true)
    const { data } = await supabase
      .from('past_performance_citations')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('created_at', { ascending: false })
    setCitations((data as Citation[]) || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!currentOrg?.id || !form.contract_title?.trim()) return
    setSaving(true)

    const payload = {
      org_id: currentOrg.id,
      contract_title: form.contract_title,
      contract_number: form.contract_number || null,
      agency: form.agency || null,
      client_name: form.client_name || null,
      contract_type: form.contract_type || null,
      naics_code: form.naics_code || null,
      set_aside: form.set_aside || null,
      contract_value: form.contract_value || null,
      period_of_performance_start: form.period_of_performance_start || null,
      period_of_performance_end: form.period_of_performance_end || null,
      relevance_tags: form.relevance_tags || [],
      service_categories: form.service_categories || [],
      description: form.description || null,
      our_role: form.our_role || null,
      key_personnel: form.key_personnel || [],
      cpars_rating: form.cpars_rating || null,
      past_performance_narrative: form.past_performance_narrative || null,
      lessons_learned: form.lessons_learned || null,
      reusable_content: form.reusable_content || {},
      updated_at: new Date().toISOString(),
    }

    if (editingId) {
      await supabase.from('past_performance_citations').update(payload).eq('id', editingId)
    } else {
      await supabase.from('past_performance_citations').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyCitation)
    fetchCitations()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this past performance citation?')) return
    await supabase.from('past_performance_citations').delete().eq('id', id)
    fetchCitations()
  }

  function startEdit(c: Citation) {
    setForm(c)
    setEditingId(c.id)
    setShowForm(true)
  }

  function addTag(value: string, field: 'relevance_tags' | 'service_categories' | 'key_personnel', setter: (v: string) => void) {
    if (!value.trim()) return
    const current = (form[field] as string[]) || []
    if (!current.includes(value.trim())) {
      setForm({ ...form, [field]: [...current, value.trim()] })
    }
    setter('')
  }

  function removeTag(index: number, field: 'relevance_tags' | 'service_categories' | 'key_personnel') {
    const current = (form[field] as string[]) || []
    setForm({ ...form, [field]: current.filter((_, i) => i !== index) })
  }

  const filtered = citations.filter(c => {
    const matchesSearch = !search ||
      c.contract_title.toLowerCase().includes(search.toLowerCase()) ||
      c.agency?.toLowerCase().includes(search.toLowerCase()) ||
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.naics_code?.toLowerCase().includes(search.toLowerCase())
    const matchesRating = filterRating === 'all' || c.cpars_rating === filterRating
    const matchesType = filterType === 'all' || c.contract_type === filterType
    return matchesSearch && matchesRating && matchesType
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="text-blue-600" size={28} />
            Past Performance Library
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage past performance citations for proposals — {citations.length} citation{citations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyCitation); setEditingId(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Add Citation
        </button>
      </div>

      <FeatureGuidance
        title="Getting Started with Past Performance"
        description="Build a library of your contract performance history to quickly reference in future proposals. Strong past performance is typically 25–40% of the evaluation score."
        storageKey="past_performance"
        accentColor="green"
        steps={[
          { title: 'Add your completed contracts', description: 'Click "Add Citation" and fill in the contract details — title, agency, NAICS, contract value, and your role (prime, sub, JV partner).' },
          { title: 'Include CPARS ratings', description: 'Select the CPARS rating from the dropdown (Exceptional through Unsatisfactory). Color-coded badges make it easy to identify your strongest citations.' },
          { title: 'Write reusable narratives', description: 'Add a performance narrative and lessons learned. These can be directly reused when writing past performance volumes for new proposals.' },
          { title: 'Tag for easy searching', description: 'Add relevance tags and service categories so you can quickly find the right citations when matching to new RFP requirements.' },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by title, agency, contract #, NAICS..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
        </div>
        <select
          value={filterRating}
          onChange={e => setFilterRating(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
        >
          <option value="all">All Ratings</option>
          {Object.entries(CPARS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
        >
          <option value="all">All Types</option>
          {CONTRACT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Citation List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading citations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
          <Award className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {citations.length === 0 ? 'No Past Performance Citations Yet' : 'No Matching Citations'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {citations.length === 0
              ? 'Add your past contract performance to reference in future proposals.'
              : 'Try adjusting your search or filters.'}
          </p>
          {citations.length === 0 && (
            <button
              onClick={() => { setForm(emptyCitation); setEditingId(null); setShowForm(true) }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} className="inline mr-1" /> Add Your First Citation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl hover:border-blue-200 transition-colors">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 truncate">{c.contract_title}</h3>
                    {c.cpars_rating && CPARS_LABELS[c.cpars_rating] && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CPARS_LABELS[c.cpars_rating].color}`}>
                        {CPARS_LABELS[c.cpars_rating].label}
                      </span>
                    )}
                    {c.our_role && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {ROLE_LABELS[c.our_role] || c.our_role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {c.agency && <span className="flex items-center gap-1"><Building2 size={12} /> {c.agency}</span>}
                    {c.contract_number && <span>#{c.contract_number}</span>}
                    {c.contract_type && <span>{c.contract_type}</span>}
                    {c.contract_value && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} /> ${(c.contract_value / 1000000).toFixed(1)}M
                      </span>
                    )}
                    {c.naics_code && <span>NAICS: {c.naics_code}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={e => { e.stopPropagation(); startEdit(c) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Edit2 size={14} className="text-gray-400" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(c.id) }} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                  {expandedId === c.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {c.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
                      <p className="text-sm text-gray-700">{c.description}</p>
                    </div>
                  )}
                  {c.past_performance_narrative && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Performance Narrative</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{c.past_performance_narrative}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {c.period_of_performance_start && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">POP Start</h4>
                        <p className="text-sm text-gray-700">{new Date(c.period_of_performance_start).toLocaleDateString()}</p>
                      </div>
                    )}
                    {c.period_of_performance_end && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">POP End</h4>
                        <p className="text-sm text-gray-700">{new Date(c.period_of_performance_end).toLocaleDateString()}</p>
                      </div>
                    )}
                    {c.set_aside && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Set-Aside</h4>
                        <p className="text-sm text-gray-700">{c.set_aside}</p>
                      </div>
                    )}
                    {c.client_name && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Client</h4>
                        <p className="text-sm text-gray-700">{c.client_name}</p>
                      </div>
                    )}
                  </div>
                  {c.relevance_tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {c.relevance_tags.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.service_categories.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Service Categories</h4>
                      <div className="flex flex-wrap gap-1">
                        {c.service_categories.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.key_personnel.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Personnel</h4>
                      <div className="flex flex-wrap gap-1">
                        {c.key_personnel.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.lessons_learned && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Lessons Learned</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{c.lessons_learned}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-10 overflow-y-auto pb-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Citation' : 'Add Past Performance Citation'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyCitation) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Contract Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Title *</label>
                  <input
                    type="text"
                    value={form.contract_title || ''}
                    onChange={e => setForm({ ...form, contract_title: e.target.value })}
                    placeholder="e.g. USAF Base Facility Maintenance"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
                  <input
                    type="text"
                    value={form.contract_number || ''}
                    onChange={e => setForm({ ...form, contract_number: e.target.value })}
                    placeholder="e.g. FA8732-21-D-0005"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                  <input
                    type="text"
                    value={form.agency || ''}
                    onChange={e => setForm({ ...form, agency: e.target.value })}
                    placeholder="e.g. Department of the Air Force"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.client_name || ''}
                    onChange={e => setForm({ ...form, client_name: e.target.value })}
                    placeholder="e.g. 88th Civil Engineer Group"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                  <select
                    value={form.contract_type || ''}
                    onChange={e => setForm({ ...form, contract_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="">Select...</option>
                    {CONTRACT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Financial & Codes */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Value ($)</label>
                  <input
                    type="number"
                    value={form.contract_value || ''}
                    onChange={e => setForm({ ...form, contract_value: e.target.value ? Number(e.target.value) : null })}
                    placeholder="e.g. 5000000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Code</label>
                  <input
                    type="text"
                    value={form.naics_code || ''}
                    onChange={e => setForm({ ...form, naics_code: e.target.value })}
                    placeholder="e.g. 561210"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Set-Aside</label>
                  <input
                    type="text"
                    value={form.set_aside || ''}
                    onChange={e => setForm({ ...form, set_aside: e.target.value })}
                    placeholder="e.g. Small Business, 8(a)"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Period of Performance */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">POP Start</label>
                  <input
                    type="date"
                    value={form.period_of_performance_start || ''}
                    onChange={e => setForm({ ...form, period_of_performance_start: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">POP End</label>
                  <input
                    type="date"
                    value={form.period_of_performance_end || ''}
                    onChange={e => setForm({ ...form, period_of_performance_end: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Role & Rating */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Our Role</label>
                  <select
                    value={form.our_role || ''}
                    onChange={e => setForm({ ...form, our_role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="">Select...</option>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPARS Rating</label>
                  <select
                    value={form.cpars_rating || ''}
                    onChange={e => setForm({ ...form, cpars_rating: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="">Select...</option>
                    {Object.entries(CPARS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the contract scope and our performance..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                />
              </div>

              {/* Performance Narrative */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Past Performance Narrative</label>
                <textarea
                  value={form.past_performance_narrative || ''}
                  onChange={e => setForm({ ...form, past_performance_narrative: e.target.value })}
                  rows={4}
                  placeholder="Detailed narrative suitable for inclusion in proposal past performance volumes..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relevance Tags</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.relevance_tags || []).map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {t} <button onClick={() => removeTag(i, 'relevance_tags')}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput, 'relevance_tags', setTagInput))}
                    placeholder="e.g. facility maintenance, HVAC, O&M"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button onClick={() => addTag(tagInput, 'relevance_tags', setTagInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>

              {/* Service Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Categories</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.service_categories || []).map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      {s} <button onClick={() => removeTag(i, 'service_categories')}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={catInput}
                    onChange={e => setCatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(catInput, 'service_categories', setCatInput))}
                    placeholder="e.g. Janitorial, Grounds Maintenance, Pest Control"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button onClick={() => addTag(catInput, 'service_categories', setCatInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>

              {/* Key Personnel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Personnel</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.key_personnel || []).map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                      {p} <button onClick={() => removeTag(i, 'key_personnel')}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={personnelInput}
                    onChange={e => setPersonnelInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(personnelInput, 'key_personnel', setPersonnelInput))}
                    placeholder="e.g. John Smith - PM, Jane Doe - QC Manager"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button onClick={() => addTag(personnelInput, 'key_personnel', setPersonnelInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lessons Learned</label>
                <textarea
                  value={form.lessons_learned || ''}
                  onChange={e => setForm({ ...form, lessons_learned: e.target.value })}
                  rows={3}
                  placeholder="What worked well, what would you do differently..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyCitation) }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.contract_title?.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Update Citation' : 'Add Citation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
