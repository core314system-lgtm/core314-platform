import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { ArrowLeft, FileStack } from 'lucide-react'

const CONTRACT_TYPES = [
  { value: 'idiq', label: 'IDIQ — Indefinite Delivery, Indefinite Quantity' },
  { value: 'bpa', label: 'BPA — Blanket Purchase Agreement' },
  { value: 'gwac', label: 'GWAC — Government-Wide Acquisition Contract' },
  { value: 'gsa_schedule', label: 'GSA Schedule' },
  { value: 'prime', label: 'Prime Contract' },
  { value: 'subcontract', label: 'Subcontract' },
  { value: 'msa', label: 'Master Services Agreement (MSA)' },
  { value: 'other', label: 'Other' },
]

const SET_ASIDES = [
  '', 'Small Business (SB)', 'Service-Disabled Veteran-Owned (SDVOSB)',
  'Women-Owned (WOSB)', 'HUBZone', '8(a)', 'Economically Disadvantaged WOSB',
  'Full and Open', 'Unrestricted',
]

export default function NewContract() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    contract_number: '',
    contract_type: 'idiq',
    status: 'active',
    vehicle: '',
    agency: '',
    contracting_officer: '',
    co_email: '',
    co_phone: '',
    period_of_performance_start: '',
    period_of_performance_end: '',
    ceiling_value: '',
    funded_value: '',
    naics_code: '',
    set_aside: '',
    description: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        title: form.title,
        contract_number: form.contract_number || null,
        contract_type: form.contract_type,
        status: form.status,
        vehicle: form.vehicle || null,
        agency: form.agency || null,
        contracting_officer: form.contracting_officer || null,
        co_email: form.co_email || null,
        co_phone: form.co_phone || null,
        period_of_performance_start: form.period_of_performance_start || null,
        period_of_performance_end: form.period_of_performance_end || null,
        ceiling_value: form.ceiling_value || null,
        funded_value: form.funded_value || null,
        naics_code: form.naics_code || null,
        set_aside: form.set_aside || null,
        description: form.description || null,
        org_id: currentOrg?.id,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) {
      alert('Error creating contract: ' + error.message)
      setLoading(false)
      return
    }

    navigate(`/contracts/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/contracts" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileStack className="text-indigo-600" size={24} /> New Contract
          </h1>
          <p className="text-sm text-gray-500">Create a parent contract to group related task orders and projects</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Contract Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type *</label>
          <select
            name="contract_type"
            value={form.contract_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {CONTRACT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Title & Contract Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Title *</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., OASIS Pool 1 — IT Services"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
            <input
              type="text"
              name="contract_number"
              value={form.contract_number}
              onChange={handleChange}
              placeholder="e.g., GS-00F-1234X"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        {/* Status & Vehicle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Vehicle</label>
            <input
              type="text"
              name="vehicle"
              value={form.vehicle}
              onChange={handleChange}
              placeholder="e.g., GSA OASIS, CIO-SP3, SEWP V"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Agency & NAICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Agency</label>
            <input
              type="text"
              name="agency"
              value={form.agency}
              onChange={handleChange}
              placeholder="e.g., GSA, DoD, VA, DHS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Code</label>
            <input
              type="text"
              name="naics_code"
              value={form.naics_code}
              onChange={handleChange}
              placeholder="e.g., 541512"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        {/* Set-Aside */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Set-Aside Type</label>
          <select
            name="set_aside"
            value={form.set_aside}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {SET_ASIDES.map(sa => (
              <option key={sa} value={sa}>{sa || '— None —'}</option>
            ))}
          </select>
        </div>

        {/* Period of Performance */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Period of Performance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                name="period_of_performance_start"
                value={form.period_of_performance_start}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                name="period_of_performance_end"
                value={form.period_of_performance_end}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Value */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Contract Value</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ceiling Value ($)</label>
              <input
                type="number"
                name="ceiling_value"
                value={form.ceiling_value}
                onChange={handleChange}
                placeholder="Maximum contract value"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Funded Value ($)</label>
              <input
                type="number"
                name="funded_value"
                value={form.funded_value}
                onChange={handleChange}
                placeholder="Currently funded amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Contracting Officer */}
        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Contracting Officer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                name="contracting_officer"
                value={form.contracting_officer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                name="co_email"
                value={form.co_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input
                type="tel"
                name="co_phone"
                value={form.co_phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="border-t border-gray-100 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Scope of the contract, key terms, special instructions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !form.title.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Contract'}
          </button>
          <Link to="/contracts" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
