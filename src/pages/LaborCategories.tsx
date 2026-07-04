import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Users, Plus, Search, Edit2, Trash2, X,
  Briefcase, GraduationCap, Shield, DollarSign, UserCheck,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface LaborCategory {
  id: string
  org_id: string
  category_name: string
  labor_category_code: string | null
  description: string | null
  min_years_experience: number | null
  education_requirement: string | null
  certifications: string[]
  clearance_required: string | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  annual_salary_min: number | null
  annual_salary_max: number | null
  notes: string | null
  created_at: string
}

interface KeyPerson {
  id: string
  org_id: string
  full_name: string
  email: string | null
  phone: string | null
  labor_category_id: string | null
  title: string | null
  years_experience: number | null
  education: string | null
  certifications: string[]
  clearance_level: string | null
  clearance_expiry: string | null
  availability: string
  resume_path: string | null
  bio: string | null
  skills: string[]
  created_at: string
}

const CLEARANCE_LABELS: Record<string, string> = {
  none: 'None',
  public_trust: 'Public Trust',
  secret: 'Secret',
  top_secret: 'Top Secret',
  ts_sci: 'TS/SCI',
}

const AVAILABILITY_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-100 text-green-700' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  on_leave: { label: 'On Leave', color: 'bg-yellow-100 text-yellow-700' },
  departed: { label: 'Departed', color: 'bg-gray-100 text-gray-500' },
}

const EDUCATION_OPTIONS = [
  { value: 'none', label: 'None Required' },
  { value: 'high_school', label: 'High School / GED' },
  { value: 'associates', label: "Associate's Degree" },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'phd', label: 'PhD / Doctorate' },
  { value: 'equivalent', label: 'Degree or Equivalent Experience' },
]

type Tab = 'categories' | 'personnel'

export default function LaborCategories() {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState<Tab>('categories')
  const [categories, setCategories] = useState<LaborCategory[]>([])
  const [personnel, setPersonnel] = useState<KeyPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Category form
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [catForm, setCatForm] = useState<Partial<LaborCategory>>({})
  const [catCertInput, setCatCertInput] = useState('')

  // Personnel form
  const [showPersonForm, setShowPersonForm] = useState(false)
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [personForm, setPersonForm] = useState<Partial<KeyPerson>>({})
  const [personSkillInput, setPersonSkillInput] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg?.id) fetchAll()
  }, [currentOrg?.id])

  async function fetchAll() {
    setLoading(true)
    const [catRes, perRes] = await Promise.all([
      supabase.from('labor_categories').select('*').eq('org_id', currentOrg!.id).order('category_name'),
      supabase.from('key_personnel').select('*').eq('org_id', currentOrg!.id).order('full_name'),
    ])
    setCategories((catRes.data as LaborCategory[]) || [])
    setPersonnel((perRes.data as KeyPerson[]) || [])
    setLoading(false)
  }

  // Category CRUD
  async function saveCat() {
    if (!currentOrg?.id || !catForm.category_name?.trim()) return
    setSaving(true)
    const payload = {
      org_id: currentOrg.id,
      category_name: catForm.category_name,
      labor_category_code: catForm.labor_category_code || null,
      description: catForm.description || null,
      min_years_experience: catForm.min_years_experience || null,
      education_requirement: catForm.education_requirement || null,
      certifications: catForm.certifications || [],
      clearance_required: catForm.clearance_required || null,
      hourly_rate_min: catForm.hourly_rate_min || null,
      hourly_rate_max: catForm.hourly_rate_max || null,
      annual_salary_min: catForm.annual_salary_min || null,
      annual_salary_max: catForm.annual_salary_max || null,
      notes: catForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    if (editingCatId) {
      await supabase.from('labor_categories').update(payload).eq('id', editingCatId)
    } else {
      await supabase.from('labor_categories').insert(payload)
    }
    setSaving(false)
    setShowCatForm(false)
    setEditingCatId(null)
    setCatForm({})
    fetchAll()
  }

  async function deleteCat(id: string) {
    if (!confirm('Delete this labor category?')) return
    await supabase.from('labor_categories').delete().eq('id', id)
    fetchAll()
  }

  // Personnel CRUD
  async function savePerson() {
    if (!currentOrg?.id || !personForm.full_name?.trim()) return
    setSaving(true)
    const payload = {
      org_id: currentOrg.id,
      full_name: personForm.full_name,
      email: personForm.email || null,
      phone: personForm.phone || null,
      labor_category_id: personForm.labor_category_id || null,
      title: personForm.title || null,
      years_experience: personForm.years_experience || null,
      education: personForm.education || null,
      certifications: personForm.certifications || [],
      clearance_level: personForm.clearance_level || null,
      clearance_expiry: personForm.clearance_expiry || null,
      availability: personForm.availability || 'available',
      bio: personForm.bio || null,
      skills: personForm.skills || [],
      updated_at: new Date().toISOString(),
    }
    if (editingPersonId) {
      await supabase.from('key_personnel').update(payload).eq('id', editingPersonId)
    } else {
      await supabase.from('key_personnel').insert(payload)
    }
    setSaving(false)
    setShowPersonForm(false)
    setEditingPersonId(null)
    setPersonForm({})
    fetchAll()
  }

  async function deletePerson(id: string) {
    if (!confirm('Remove this person?')) return
    await supabase.from('key_personnel').delete().eq('id', id)
    fetchAll()
  }

  function addArrayItem(value: string, arr: string[] | undefined, setter: (newArr: string[]) => void, inputSetter: (v: string) => void) {
    if (!value.trim()) return
    const current = arr || []
    if (!current.includes(value.trim())) setter([...current, value.trim()])
    inputSetter('')
  }

  const filteredCats = categories.filter(c =>
    !search || c.category_name.toLowerCase().includes(search.toLowerCase()) || c.labor_category_code?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPersonnel = personnel.filter(p =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Labor Categories & Key Personnel
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {categories.length} labor categor{categories.length !== 1 ? 'ies' : 'y'} &middot; {personnel.length} key personnel
          </p>
        </div>
        <button
          onClick={() => {
            if (tab === 'categories') { setCatForm({}); setEditingCatId(null); setShowCatForm(true) }
            else { setPersonForm({}); setEditingPersonId(null); setShowPersonForm(true) }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> {tab === 'categories' ? 'Add Category' : 'Add Person'}
        </button>
      </div>

      <FeatureGuidance
        title="Labor Categories & Key Personnel"
        description="Define your labor categories with rate ranges and clearance requirements, then track key personnel who can be proposed on contracts."
        storageKey="labor_categories"
        accentColor="indigo"
        steps={[
          { title: 'Define labor categories first', description: 'Start on the "Labor Categories" tab. Add categories like Program Manager, Systems Engineer, etc. with hourly rate ranges, experience requirements, and clearance levels.' },
          { title: 'Then add your key personnel', description: 'Switch to the "Key Personnel" tab and add team members. Link each person to their labor category, set their clearance level, and mark their availability.' },
          { title: 'Use for proposal staffing', description: 'When building a proposal, reference this database to quickly identify available personnel who meet the RFP requirements and clearance needs.' },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('categories')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'categories' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Briefcase size={14} className="inline mr-1.5" /> Labor Categories
        </button>
        <button
          onClick={() => setTab('personnel')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'personnel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <UserCheck size={14} className="inline mr-1.5" /> Key Personnel
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder={tab === 'categories' ? 'Search categories...' : 'Search personnel...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : tab === 'categories' ? (
        /* Labor Categories Tab */
        filteredCats.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
            <Briefcase className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Labor Categories</h3>
            <p className="text-sm text-gray-500 mb-4">Define your labor categories for proposal staffing plans.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredCats.map(cat => (
              <div key={cat.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{cat.category_name}</h3>
                      {cat.labor_category_code && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{cat.labor_category_code}</span>
                      )}
                      {cat.clearance_required && cat.clearance_required !== 'none' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                          <Shield size={10} /> {CLEARANCE_LABELS[cat.clearance_required]}
                        </span>
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-gray-500 mt-1">{cat.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {cat.min_years_experience && <span>{cat.min_years_experience}+ years</span>}
                      {cat.education_requirement && <span className="flex items-center gap-1"><GraduationCap size={10} /> {EDUCATION_OPTIONS.find(e => e.value === cat.education_requirement)?.label || cat.education_requirement}</span>}
                      {(cat.hourly_rate_min || cat.hourly_rate_max) && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} />
                          {cat.hourly_rate_min ? `$${cat.hourly_rate_min}` : ''}
                          {cat.hourly_rate_min && cat.hourly_rate_max ? '–' : ''}
                          {cat.hourly_rate_max ? `$${cat.hourly_rate_max}/hr` : '/hr'}
                        </span>
                      )}
                    </div>
                    {cat.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cat.certifications.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setCatForm(cat); setEditingCatId(cat.id); setShowCatForm(true) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => deleteCat(cat.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Key Personnel Tab */
        filteredPersonnel.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
            <UserCheck className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Key Personnel</h3>
            <p className="text-sm text-gray-500 mb-4">Add your key personnel for proposal staffing.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredPersonnel.map(person => {
              const avail = AVAILABILITY_LABELS[person.availability] || AVAILABILITY_LABELS.available
              const cat = categories.find(c => c.id === person.labor_category_id)
              return (
                <div key={person.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{person.full_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${avail.color}`}>{avail.label}</span>
                        {person.clearance_level && person.clearance_level !== 'none' && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                            <Shield size={10} /> {CLEARANCE_LABELS[person.clearance_level]}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        {person.title && <span>{person.title}</span>}
                        {cat && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{cat.category_name}</span>}
                        {person.years_experience && <span>{person.years_experience} years exp.</span>}
                        {person.education && <span className="flex items-center gap-1"><GraduationCap size={10} /> {person.education}</span>}
                      </div>
                      {person.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {person.skills.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setPersonForm(person); setEditingPersonId(person.id); setShowPersonForm(true) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                      <button onClick={() => deletePerson(person.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-10 overflow-y-auto pb-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingCatId ? 'Edit' : 'Add'} Labor Category</h2>
              <button onClick={() => { setShowCatForm(false); setCatForm({}); setEditingCatId(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                  <input type="text" value={catForm.category_name || ''} onChange={e => setCatForm({ ...catForm, category_name: e.target.value })} placeholder="e.g. Program Manager" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category Code</label>
                  <input type="text" value={catForm.labor_category_code || ''} onChange={e => setCatForm({ ...catForm, labor_category_code: e.target.value })} placeholder="e.g. SCA 01020" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min. Years Experience</label>
                  <input type="number" value={catForm.min_years_experience || ''} onChange={e => setCatForm({ ...catForm, min_years_experience: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                  <select value={catForm.education_requirement || ''} onChange={e => setCatForm({ ...catForm, education_requirement: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clearance Required</label>
                  <select value={catForm.clearance_required || ''} onChange={e => setCatForm({ ...catForm, clearance_required: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    <option value="">Select...</option>
                    {Object.entries(CLEARANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate Min ($)</label>
                  <input type="number" value={catForm.hourly_rate_min || ''} onChange={e => setCatForm({ ...catForm, hourly_rate_min: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate Max ($)</label>
                  <input type="number" value={catForm.hourly_rate_max || ''} onChange={e => setCatForm({ ...catForm, hourly_rate_max: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={catForm.description || ''} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Certifications</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(catForm.certifications || []).map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {c} <button onClick={() => setCatForm({ ...catForm, certifications: (catForm.certifications || []).filter((_, j) => j !== i) })}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={catCertInput} onChange={e => setCatCertInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem(catCertInput, catForm.certifications, (v) => setCatForm({ ...catForm, certifications: v }), setCatCertInput))} placeholder="e.g. PMP, ITIL" className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none" />
                  <button onClick={() => addArrayItem(catCertInput, catForm.certifications, (v) => setCatForm({ ...catForm, certifications: v }), setCatCertInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => { setShowCatForm(false); setCatForm({}); setEditingCatId(null) }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveCat} disabled={saving || !catForm.category_name?.trim()} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingCatId ? 'Update' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personnel Form Modal */}
      {showPersonForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-10 overflow-y-auto pb-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingPersonId ? 'Edit' : 'Add'} Key Person</h2>
              <button onClick={() => { setShowPersonForm(false); setPersonForm({}); setEditingPersonId(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" value={personForm.full_name || ''} onChange={e => setPersonForm({ ...personForm, full_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={personForm.title || ''} onChange={e => setPersonForm({ ...personForm, title: e.target.value })} placeholder="e.g. Senior Program Manager" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Labor Category</label>
                  <select value={personForm.labor_category_id || ''} onChange={e => setPersonForm({ ...personForm, labor_category_id: e.target.value || null })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={personForm.email || ''} onChange={e => setPersonForm({ ...personForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years Experience</label>
                  <input type="number" value={personForm.years_experience || ''} onChange={e => setPersonForm({ ...personForm, years_experience: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                  <input type="text" value={personForm.education || ''} onChange={e => setPersonForm({ ...personForm, education: e.target.value })} placeholder="e.g. MBA, George Washington University" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clearance</label>
                  <select value={personForm.clearance_level || ''} onChange={e => setPersonForm({ ...personForm, clearance_level: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    <option value="">Select...</option>
                    {Object.entries(CLEARANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                  <select value={personForm.availability || 'available'} onChange={e => setPersonForm({ ...personForm, availability: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    {Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea value={personForm.bio || ''} onChange={e => setPersonForm({ ...personForm, bio: e.target.value })} rows={3} placeholder="Professional summary for proposals..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(personForm.skills || []).map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      {s} <button onClick={() => setPersonForm({ ...personForm, skills: (personForm.skills || []).filter((_, j) => j !== i) })}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={personSkillInput} onChange={e => setPersonSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem(personSkillInput, personForm.skills, (v) => setPersonForm({ ...personForm, skills: v }), setPersonSkillInput))} placeholder="e.g. Project Management, HVAC" className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none" />
                  <button onClick={() => addArrayItem(personSkillInput, personForm.skills, (v) => setPersonForm({ ...personForm, skills: v }), setPersonSkillInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => { setShowPersonForm(false); setPersonForm({}); setEditingPersonId(null) }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={savePerson} disabled={saving || !personForm.full_name?.trim()} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingPersonId ? 'Update' : 'Add Person'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
