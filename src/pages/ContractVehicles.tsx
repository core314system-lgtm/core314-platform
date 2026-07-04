import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Truck, Plus, Search, Calendar, DollarSign, Edit2, Trash2, X,
  CheckCircle, AlertTriangle, Clock,
} from 'lucide-react'

interface ContractVehicle {
  id: string
  org_id: string
  vehicle_name: string
  vehicle_type: string
  contract_number: string | null
  ordering_period_start: string | null
  ordering_period_end: string | null
  ceiling_value: number | null
  naics_codes: string[]
  sin_numbers: string[]
  scope_description: string | null
  contracting_agency: string | null
  status: string
  renewal_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const VEHICLE_TYPES: Record<string, string> = {
  gsa_schedule: 'GSA Schedule (MAS)',
  gwac: 'GWAC',
  bpa: 'BPA',
  idiq: 'IDIQ',
  agency_idiq: 'Agency IDIQ',
  other: 'Other',
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  active: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  expired: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  under_renewal: { color: 'bg-blue-100 text-blue-700', icon: Clock },
}

const emptyVehicle: Partial<ContractVehicle> = {
  vehicle_name: '',
  vehicle_type: 'idiq',
  contract_number: '',
  ordering_period_start: null,
  ordering_period_end: null,
  ceiling_value: null,
  naics_codes: [],
  sin_numbers: [],
  scope_description: '',
  contracting_agency: '',
  status: 'active',
  renewal_date: null,
  notes: '',
}

export default function ContractVehicles() {
  const { currentOrg } = useOrg()
  const [vehicles, setVehicles] = useState<ContractVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<ContractVehicle>>(emptyVehicle)
  const [saving, setSaving] = useState(false)
  const [naicsInput, setNaicsInput] = useState('')
  const [sinInput, setSinInput] = useState('')

  useEffect(() => {
    if (currentOrg?.id) fetchVehicles()
  }, [currentOrg?.id])

  async function fetchVehicles() {
    setLoading(true)
    const { data } = await supabase
      .from('contract_vehicles')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('created_at', { ascending: false })
    setVehicles((data as ContractVehicle[]) || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!currentOrg?.id || !form.vehicle_name?.trim()) return
    setSaving(true)

    const payload = {
      org_id: currentOrg.id,
      vehicle_name: form.vehicle_name,
      vehicle_type: form.vehicle_type || 'other',
      contract_number: form.contract_number || null,
      ordering_period_start: form.ordering_period_start || null,
      ordering_period_end: form.ordering_period_end || null,
      ceiling_value: form.ceiling_value || null,
      naics_codes: form.naics_codes || [],
      sin_numbers: form.sin_numbers || [],
      scope_description: form.scope_description || null,
      contracting_agency: form.contracting_agency || null,
      status: form.status || 'active',
      renewal_date: form.renewal_date || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (editingId) {
      await supabase.from('contract_vehicles').update(payload).eq('id', editingId)
    } else {
      await supabase.from('contract_vehicles').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyVehicle)
    fetchVehicles()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contract vehicle?')) return
    await supabase.from('contract_vehicles').delete().eq('id', id)
    fetchVehicles()
  }

  function addArrayItem(value: string, field: 'naics_codes' | 'sin_numbers', setter: (v: string) => void) {
    if (!value.trim()) return
    const current = (form[field] as string[]) || []
    if (!current.includes(value.trim())) {
      setForm({ ...form, [field]: [...current, value.trim()] })
    }
    setter('')
  }

  function removeArrayItem(index: number, field: 'naics_codes' | 'sin_numbers') {
    const current = (form[field] as string[]) || []
    setForm({ ...form, [field]: current.filter((_, i) => i !== index) })
  }

  function daysUntilExpiry(dateStr: string | null): number | null {
    if (!dateStr) return null
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const filtered = vehicles.filter(v => {
    const matchesSearch = !search ||
      v.vehicle_name.toLowerCase().includes(search.toLowerCase()) ||
      v.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      v.contracting_agency?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-blue-600" size={28} />
            Contract Vehicles
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track GSA Schedules, GWACs, IDIQs, and BPAs — {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyVehicle); setEditingId(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="under_renewal">Under Renewal</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Vehicle List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading vehicles...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
          <Truck className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {vehicles.length === 0 ? 'No Contract Vehicles Yet' : 'No Matching Vehicles'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {vehicles.length === 0
              ? 'Add your GSA Schedules, GWACs, IDIQs, and other contract vehicles.'
              : 'Try adjusting your search or filters.'}
          </p>
          {vehicles.length === 0 && (
            <button
              onClick={() => { setForm(emptyVehicle); setEditingId(null); setShowForm(true) }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} className="inline mr-1" /> Add Your First Vehicle
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(v => {
            const days = daysUntilExpiry(v.ordering_period_end)
            const expiringSoon = days !== null && days > 0 && days <= 90
            const expired = days !== null && days <= 0
            const statusConfig = STATUS_CONFIG[v.status] || STATUS_CONFIG.active
            const StatusIcon = statusConfig.icon

            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{v.vehicle_name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon size={12} /> {v.status.replace('_', ' ')}
                      </span>
                      {expiringSoon && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <AlertTriangle size={12} /> Expires in {days} days
                        </span>
                      )}
                      {expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-medium">{VEHICLE_TYPES[v.vehicle_type] || v.vehicle_type}</span>
                      {v.contract_number && <span>#{v.contract_number}</span>}
                      {v.contracting_agency && <span>{v.contracting_agency}</span>}
                      {v.ceiling_value && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} /> ${(v.ceiling_value / 1000000).toFixed(1)}M ceiling
                        </span>
                      )}
                    </div>
                    {v.naics_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {v.naics_codes.map((n, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">NAICS: {n}</span>
                        ))}
                      </div>
                    )}
                    {v.ordering_period_start && v.ordering_period_end && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                        <Calendar size={12} />
                        {new Date(v.ordering_period_start).toLocaleDateString()} — {new Date(v.ordering_period_end).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => { setForm(v); setEditingId(v.id); setShowForm(true) }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(v.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-10 overflow-y-auto pb-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Vehicle' : 'Add Contract Vehicle'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyVehicle) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name *</label>
                  <input
                    type="text"
                    value={form.vehicle_name || ''}
                    onChange={e => setForm({ ...form, vehicle_name: e.target.value })}
                    placeholder="e.g. GSA MAS, OASIS SB, SEWP V"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <select
                    value={form.vehicle_type || 'other'}
                    onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    {Object.entries(VEHICLE_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
                  <input
                    type="text"
                    value={form.contract_number || ''}
                    onChange={e => setForm({ ...form, contract_number: e.target.value })}
                    placeholder="e.g. 47QRAA21D0001"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contracting Agency</label>
                  <input
                    type="text"
                    value={form.contracting_agency || ''}
                    onChange={e => setForm({ ...form, contracting_agency: e.target.value })}
                    placeholder="e.g. GSA, NASA, NIH"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status || 'active'}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="under_renewal">Under Renewal</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ceiling Value ($)</label>
                  <input
                    type="number"
                    value={form.ceiling_value || ''}
                    onChange={e => setForm({ ...form, ceiling_value: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordering Period Start</label>
                  <input
                    type="date"
                    value={form.ordering_period_start || ''}
                    onChange={e => setForm({ ...form, ordering_period_start: e.target.value || null })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordering Period End</label>
                  <input
                    type="date"
                    value={form.ordering_period_end || ''}
                    onChange={e => setForm({ ...form, ordering_period_end: e.target.value || null })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
              </div>

              {/* NAICS Codes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Codes</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.naics_codes || []).map((n, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {n} <button onClick={() => removeArrayItem(i, 'naics_codes')}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={naicsInput}
                    onChange={e => setNaicsInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem(naicsInput, 'naics_codes', setNaicsInput))}
                    placeholder="e.g. 561210"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button onClick={() => addArrayItem(naicsInput, 'naics_codes', setNaicsInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>

              {/* SIN Numbers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SIN Numbers (GSA)</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(form.sin_numbers || []).map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      {s} <button onClick={() => removeArrayItem(i, 'sin_numbers')}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sinInput}
                    onChange={e => setSinInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem(sinInput, 'sin_numbers', setSinInput))}
                    placeholder="e.g. 561210FAC"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button onClick={() => addArrayItem(sinInput, 'sin_numbers', setSinInput)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope Description</label>
                <textarea
                  value={form.scope_description || ''}
                  onChange={e => setForm({ ...form, scope_description: e.target.value })}
                  rows={3}
                  placeholder="Description of the vehicle scope and eligible work..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyVehicle) }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.vehicle_name?.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
