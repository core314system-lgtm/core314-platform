import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Users, Plus, Shield, Handshake, Building2, UserCheck, User,
  Trash2, Star, StarOff,
} from 'lucide-react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  title: string | null
  organization: string | null
  contact_type: string
}

interface ProjectContact {
  id: string
  project_id: string
  contact_id: string
  role: string | null
  is_primary: boolean
  contact?: Contact
}

const CONTACT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  government: { label: 'Gov', color: 'bg-blue-100 text-blue-700', icon: Shield },
  partner: { label: 'Partner', color: 'bg-purple-100 text-purple-700', icon: Handshake },
  subcontractor: { label: 'Sub', color: 'bg-amber-100 text-amber-700', icon: Building2 },
  internal: { label: 'Team', color: 'bg-green-100 text-green-700', icon: UserCheck },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: User },
}

const COMMON_ROLES = [
  'Contracting Officer (KO)',
  'COTR / COR',
  'Program Manager',
  'Technical Evaluator',
  'Small Business Specialist',
  'Capture Lead',
  'Proposal Manager',
  'Technical Lead',
  'Pricing Lead',
  'Contracts Manager',
  'Teammate POC',
  'Subcontractor POC',
  'Incumbent PM',
  'Other',
]

interface Props {
  projectId: string
}

export default function ProjectContacts({ projectId }: Props) {
  const { currentOrg } = useOrg()
  const [projectContacts, setProjectContacts] = useState<ProjectContact[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg?.id) {
      loadProjectContacts()
      loadAllContacts()
    }
  }, [currentOrg?.id, projectId])

  async function loadProjectContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('project_contacts')
      .select('*, contact:contacts(*)')
      .eq('project_id', projectId)
      .order('is_primary', { ascending: false })
    setProjectContacts(data || [])
    setLoading(false)
  }

  async function loadAllContacts() {
    if (!currentOrg?.id) return
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, title, organization, contact_type')
      .eq('org_id', currentOrg.id)
      .order('last_name')
    setAllContacts(data || [])
  }

  async function handleAdd() {
    if (!selectedContactId) return
    setSaving(true)
    await supabase.from('project_contacts').insert({
      project_id: projectId,
      contact_id: selectedContactId,
      role: selectedRole || null,
      is_primary: false,
    })
    setSaving(false)
    setShowAdd(false)
    setSelectedContactId('')
    setSelectedRole('')
    loadProjectContacts()
  }

  async function handleRemove(id: string) {
    await supabase.from('project_contacts').delete().eq('id', id)
    loadProjectContacts()
  }

  async function togglePrimary(pc: ProjectContact) {
    await supabase
      .from('project_contacts')
      .update({ is_primary: !pc.is_primary })
      .eq('id', pc.id)
    loadProjectContacts()
  }

  const existingContactIds = new Set(projectContacts.map(pc => pc.contact_id))
  const availableContacts = allContacts.filter(c => !existingContactIds.has(c.id))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          Key Contacts
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <select
            value={selectedContactId}
            onChange={e => setSelectedContactId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">Select a contact...</option>
            {availableContacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name} {c.organization ? `(${c.organization})` : ''}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">Role (optional)</option>
            {COMMON_ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !selectedContactId}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add to Project'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setSelectedContactId(''); setSelectedRole('') }}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
          {availableContacts.length === 0 && allContacts.length === 0 && (
            <p className="text-xs text-gray-400">
              No contacts yet. <a href="/contacts" className="text-blue-600 hover:underline">Add contacts first</a>.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : projectContacts.length === 0 ? (
        <p className="text-xs text-gray-400">No contacts assigned to this project.</p>
      ) : (
        <div className="space-y-2">
          {projectContacts.map(pc => {
            const contact = pc.contact as unknown as Contact
            if (!contact) return null
            const typeConfig = CONTACT_TYPE_CONFIG[contact.contact_type] || CONTACT_TYPE_CONFIG.other
            const TypeIcon = typeConfig.icon
            return (
              <div key={pc.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color}`}>
                    <TypeIcon size={10} />
                    {typeConfig.label}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {contact.first_name} {contact.last_name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {pc.role || contact.title || contact.organization || ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePrimary(pc)}
                    className={`p-1 rounded ${pc.is_primary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                    title={pc.is_primary ? 'Remove primary' : 'Mark as primary'}
                  >
                    {pc.is_primary ? <Star size={12} /> : <StarOff size={12} />}
                  </button>
                  <button
                    onClick={() => handleRemove(pc.id)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
