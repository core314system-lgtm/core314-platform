import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, Plus, Building, Percent, FileText, Trash2, Edit2, X } from 'lucide-react'

interface TeamingAgreement {
  id: string
  partner_name: string
  partner_role: 'prime' | 'sub' | 'jv_partner' | 'mentor_protege'
  our_role: 'prime' | 'sub' | 'jv_partner' | 'protege'
  workshare_percent: number
  naics_codes: string[]
  certifications: string[]
  agreement_status: 'prospective' | 'under_negotiation' | 'executed' | 'expired'
  agreement_date: string | null
  expiration_date: string | null
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string
  created_at: string
}

export default function TeamingTracker() {
  const { profile } = useAuth()
  const [agreements, setAgreements] = useState<TeamingAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<TeamingAgreement>>({})

  useEffect(() => {
    loadAgreements()
  }, [])

  async function loadAgreements() {
    const { data } = await supabase
      .from('teaming_agreements')
      .select('*')
      .order('created_at', { ascending: false })

    // If the table doesn't exist yet, that's fine
    setAgreements(data || [])
    setLoading(false)
  }

  async function saveAgreement() {
    if (!form.partner_name || !profile?.current_org_id) return

    const record = {
      partner_name: form.partner_name,
      partner_role: form.partner_role || 'prime',
      our_role: form.our_role || 'sub',
      workshare_percent: form.workshare_percent || 0,
      naics_codes: form.naics_codes || [],
      certifications: form.certifications || [],
      agreement_status: form.agreement_status || 'prospective',
      agreement_date: form.agreement_date || null,
      expiration_date: form.expiration_date || null,
      contact_name: form.contact_name || '',
      contact_email: form.contact_email || '',
      contact_phone: form.contact_phone || '',
      notes: form.notes || '',
      org_id: profile.current_org_id,
    }

    try {
      if (editingId) {
        await supabase.from('teaming_agreements').update(record).eq('id', editingId)
      } else {
        await supabase.from('teaming_agreements').insert(record)
      }
      setShowForm(false)
      setEditingId(null)
      setForm({})
      await loadAgreements()
    } catch (err) {
      alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function deleteAgreement(id: string) {
    if (!confirm('Delete this teaming agreement?')) return
    await supabase.from('teaming_agreements').delete().eq('id', id)
    await loadAgreements()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed': return 'bg-green-100 text-green-700'
      case 'under_negotiation': return 'bg-blue-100 text-blue-700'
      case 'prospective': return 'bg-gray-100 text-gray-700'
      case 'expired': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'prime': return 'Prime Contractor'
      case 'sub': return 'Subcontractor'
      case 'jv_partner': return 'JV Partner'
      case 'mentor_protege': return 'Mentor-Protégé'
      case 'protege': return 'Protégé'
      default: return role
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-blue-600" />
            Teaming & Joint Ventures
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track teaming agreements, mentor-protégé relationships, and joint venture partnerships</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({}) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} /> New Agreement
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editingId ? 'Edit' : 'New'} Teaming Agreement</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Partner Company</label>
              <input
                type="text"
                value={form.partner_name || ''}
                onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Partner Role</label>
              <select
                value={form.partner_role || 'prime'}
                onChange={e => setForm(f => ({ ...f, partner_role: e.target.value as TeamingAgreement['partner_role'] }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="prime">Prime Contractor</option>
                <option value="sub">Subcontractor</option>
                <option value="jv_partner">JV Partner</option>
                <option value="mentor_protege">Mentor-Protégé</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Our Role</label>
              <select
                value={form.our_role || 'sub'}
                onChange={e => setForm(f => ({ ...f, our_role: e.target.value as TeamingAgreement['our_role'] }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="prime">Prime Contractor</option>
                <option value="sub">Subcontractor</option>
                <option value="jv_partner">JV Partner</option>
                <option value="protege">Protégé</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Workshare %</label>
              <input
                type="number"
                value={form.workshare_percent || 0}
                onChange={e => setForm(f => ({ ...f, workshare_percent: Number(e.target.value) }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Agreement Status</label>
              <select
                value={form.agreement_status || 'prospective'}
                onChange={e => setForm(f => ({ ...f, agreement_status: e.target.value as TeamingAgreement['agreement_status'] }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="prospective">Prospective</option>
                <option value="under_negotiation">Under Negotiation</option>
                <option value="executed">Executed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">NAICS Codes (comma-separated)</label>
              <input
                type="text"
                value={(form.naics_codes || []).join(', ')}
                onChange={e => setForm(f => ({ ...f, naics_codes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="561210, 561320"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contact_name || ''}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contact_email || ''}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              onClick={saveAgreement}
              disabled={!form.partner_name}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {editingId ? 'Update' : 'Save'} Agreement
            </button>
          </div>
        </div>
      )}

      {/* Agreement Cards */}
      {agreements.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No Teaming Agreements</h3>
          <p className="text-sm text-gray-500 mt-1">Add your teaming partners, JV agreements, and mentor-protégé relationships.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agreements.map(agreement => (
            <div key={agreement.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Building size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{agreement.partner_name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(agreement.agreement_status)}`}>
                        {agreement.agreement_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>Partner: {getRoleLabel(agreement.partner_role)}</span>
                      <span>Us: {getRoleLabel(agreement.our_role)}</span>
                      <span className="flex items-center gap-1">
                        <Percent size={10} /> Workshare: {agreement.workshare_percent}%
                      </span>
                    </div>
                    {agreement.naics_codes?.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {agreement.naics_codes.map(code => (
                          <span key={code} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{code}</span>
                        ))}
                      </div>
                    )}
                    {agreement.notes && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <FileText size={10} /> {agreement.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setForm(agreement); setEditingId(agreement.id); setShowForm(true) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteAgreement(agreement.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">About Teaming Agreements</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>Prime-Sub:</strong> One company leads, the other provides specialized services</li>
          <li>• <strong>Joint Venture:</strong> Two or more companies form a new entity to bid together</li>
          <li>• <strong>Mentor-Protégé:</strong> Large business mentors a small business (SBA program)</li>
          <li>• Track workshare percentages to ensure compliance with small business requirements</li>
          <li>• NAICS codes determine which opportunities you can team on</li>
        </ul>
      </div>
    </div>
  )
}
