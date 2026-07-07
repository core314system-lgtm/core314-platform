import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Users, Plus, Search, Edit2, Trash2, X, Building2, Shield,
  Handshake, UserCheck, User, Mail, Phone, Tag, Filter,
  ChevronDown, ChevronUp, FolderOpen, Upload,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Contact {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  organization: string | null
  contact_type: string
  agency: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

interface ProjectContact {
  id: string
  project_id: string
  contact_id: string
  role: string | null
  is_primary: boolean
  created_at: string
  project?: { title: string }
}

const CONTACT_TYPES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  government: { label: 'Government', color: 'bg-blue-100 text-blue-700', icon: Shield },
  partner: { label: 'Partner', color: 'bg-purple-100 text-purple-700', icon: Handshake },
  subcontractor: { label: 'Subcontractor', color: 'bg-amber-100 text-amber-700', icon: Building2 },
  internal: { label: 'Internal', color: 'bg-green-100 text-green-700', icon: UserCheck },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: User },
}

const emptyContact: Partial<Contact> = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  organization: '',
  contact_type: 'government',
  agency: '',
  notes: '',
  tags: [],
}

export default function Contacts() {
  const { currentOrg } = useOrg()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Contact>>(emptyContact)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [projectContacts, setProjectContacts] = useState<ProjectContact[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState('')

  useEffect(() => {
    if (currentOrg?.id) fetchContacts()
  }, [currentOrg?.id])

  async function fetchContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('last_name', { ascending: true })
    setContacts(data || [])
    setLoading(false)
  }

  async function fetchProjectContacts(contactId: string) {
    const { data } = await supabase
      .from('project_contacts')
      .select('*, project:task_orders(title)')
      .eq('contact_id', contactId)
    setProjectContacts(data || [])
  }

  function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setProjectContacts([])
    } else {
      setExpandedId(id)
      fetchProjectContacts(id)
    }
  }

  async function handleSave() {
    if (!currentOrg?.id || !form.first_name || !form.last_name) return
    setSaving(true)

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      title: form.title || null,
      organization: form.organization || null,
      contact_type: form.contact_type || 'other',
      agency: form.agency || null,
      notes: form.notes || null,
      tags: form.tags || [],
      org_id: currentOrg.id,
    }

    if (editingId) {
      await supabase.from('contacts').update(payload).eq('id', editingId)
    } else {
      await supabase.from('contacts').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyContact)
    fetchContacts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact? This will also remove them from all project associations.')) return
    await supabase.from('project_contacts').delete().eq('contact_id', id)
    await supabase.from('contacts').delete().eq('id', id)
    if (expandedId === id) setExpandedId(null)
    fetchContacts()
  }

  function handleEdit(contact: Contact) {
    setForm(contact)
    setEditingId(contact.id)
    setShowForm(true)
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !(form.tags || []).includes(tag)) {
      setForm({ ...form, tags: [...(form.tags || []), tag] })
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm({ ...form, tags: (form.tags || []).filter(t => t !== tag) })
  }

  async function handleCsvImport() {
    if (!currentOrg?.id || !importData.trim()) return
    setSaving(true)

    const lines = importData.trim().split('\n')
    const contacts: Partial<Contact>[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length >= 2) {
        contacts.push({
          first_name: cols[0],
          last_name: cols[1],
          email: cols[2] || null,
          phone: cols[3] || null,
          title: cols[4] || null,
          organization: cols[5] || null,
          contact_type: cols[6] && CONTACT_TYPES[cols[6]] ? cols[6] : 'other',
          agency: cols[7] || null,
          tags: [],
          org_id: currentOrg.id,
        })
      }
    }

    if (contacts.length > 0) {
      await supabase.from('contacts').insert(contacts)
    }

    setSaving(false)
    setShowImport(false)
    setImportData('')
    fetchContacts()
  }

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      const matchesType = filterType === 'all' || c.contact_type === filterType
      const matchesSearch = !search ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.organization || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.agency || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.title || '').toLowerCase().includes(search.toLowerCase())
      return matchesType && matchesSearch
    })
  }, [contacts, search, filterType])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contacts.length }
    contacts.forEach(c => { counts[c.contact_type] = (counts[c.contact_type] || 0) + 1 })
    return counts
  }, [contacts])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Manage government, partner, and team contacts across your captures</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <button
            onClick={() => { setForm(emptyContact); setEditingId(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Contact
          </button>
        </div>
      </div>

      <FeatureGuidance
        title="Contacts"
        description="Manage government officials, partners, subcontractor POCs, and internal team members. Link contacts to projects and assign roles."
        storageKey="contacts"
        accentColor="teal"
        steps={[
          { title: 'Add contacts', description: 'Track government officials, partners, subcontractor POCs, and internal team members.' },
          { title: 'Link to projects', description: 'Associate contacts with specific projects and assign roles (COTR, KO, Capture Lead, etc.).' },
          { title: 'Build relationships', description: 'Use tags and notes to track relationship context across all your captures.' },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, organization, or title..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types ({typeCounts.all || 0})</option>
            {Object.entries(CONTACT_TYPES).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label} ({typeCounts[key] || 0})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">
            {contacts.length === 0 ? 'No Contacts Yet' : 'No Matching Contacts'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {contacts.length === 0
              ? 'Add government officials, partners, and team members to track relationships across your captures.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Tags</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => {
                const typeConfig = CONTACT_TYPES[contact.contact_type] || CONTACT_TYPES.other
                const TypeIcon = typeConfig.icon
                const isExpanded = expandedId === contact.id
                return (
                  <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => handleExpand(contact.id)} className="text-left">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                          <div>
                            <div className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</div>
                            {contact.email && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail size={10} /> {contact.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                        <TypeIcon size={12} />
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      {contact.organization || contact.agency || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                      {contact.title || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(contact.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                        ))}
                        {(contact.tags || []).length > 3 && (
                          <span className="text-xs text-gray-400">+{contact.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(contact)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(contact.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded Contact Detail */}
      {expandedId && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
          {(() => {
            const contact = contacts.find(c => c.id === expandedId)
            if (!contact) return null
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{contact.first_name} {contact.last_name}</h3>
                    {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                    {contact.organization && <p className="text-sm text-gray-500">{contact.organization}</p>}
                  </div>
                  <button onClick={() => { setExpandedId(null); setProjectContacts([]) }} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-gray-400" />
                      <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-gray-400" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.agency && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield size={14} className="text-gray-400" />
                      <span>{contact.agency}</span>
                    </div>
                  )}
                </div>

                {contact.notes && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">{contact.notes}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FolderOpen size={14} />
                    Associated Projects
                  </h4>
                  {projectContacts.length === 0 ? (
                    <p className="text-sm text-gray-400">Not associated with any projects yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {projectContacts.map(pc => (
                        <div key={pc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {(pc.project as any)?.title || 'Unknown Project'}
                            </span>
                            {pc.role && <span className="ml-2 text-xs text-gray-500">({pc.role})</span>}
                          </div>
                          {pc.is_primary && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Primary</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Add/Edit Form Slide-over */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyContact) }} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyContact) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={form.first_name || ''}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={form.last_name || ''}
                    onChange={e => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type</label>
                <select
                  value={form.contact_type || 'government'}
                  onChange={e => setForm({ ...form, contact_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(CONTACT_TYPES).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="jane.smith@agency.gov"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone || ''}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title / Role</label>
                <input
                  type="text"
                  value={form.title || ''}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Contracting Officer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input
                  type="text"
                  value={form.organization || ''}
                  onChange={e => setForm({ ...form, organization: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="US Army PEO EIS"
                />
              </div>

              {(form.contact_type === 'government') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                  <input
                    type="text"
                    value={form.agency || ''}
                    onChange={e => setForm({ ...form, agency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Department of Defense"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {(form.tags || []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      <Tag size={10} />
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-blue-900">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a tag..."
                  />
                  <button onClick={addTag} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Add</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Relationship context, meeting notes, preferences..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.first_name || !form.last_name}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Contact' : 'Add Contact'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyContact) }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowImport(false); setImportData('') }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Contacts from CSV</h2>
              <button onClick={() => { setShowImport(false); setImportData('') }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Paste CSV data with columns: first_name, last_name, email, phone, title, organization, contact_type, agency
            </p>
            <p className="text-xs text-gray-400 mb-3">
              First row should be headers. Contact type values: government, partner, subcontractor, internal, other
            </p>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
              placeholder={'first_name,last_name,email,phone,title,organization,contact_type,agency\nJane,Smith,jane@army.mil,(555) 123-4567,Contracting Officer,PEO EIS,government,US Army'}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCsvImport}
                disabled={saving || !importData.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Importing...' : 'Import Contacts'}
              </button>
              <button
                onClick={() => { setShowImport(false); setImportData('') }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
