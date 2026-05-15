import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Subcontractor } from '../lib/types'
import { Users, Search, Star, MapPin, Building } from 'lucide-react'

export default function VendorTracker() {
  const [vendors, setVendors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterIncumbent, setFilterIncumbent] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    incumbent_status: '' as string,
    performance_notes: '',
    preferred: false,
  })

  useEffect(() => {
    fetchVendors()
  }, [])

  async function fetchVendors() {
    const { data } = await supabase.from('subcontractors').select('*').order('company_name')
    setVendors(data || [])
    setLoading(false)
  }

  async function handleSave(id: string) {
    await supabase.from('subcontractors').update({
      incumbent_status: editForm.incumbent_status,
      performance_notes: editForm.performance_notes,
      preferred: editForm.preferred,
    }).eq('id', id)
    setEditingId(null)
    fetchVendors()
  }

  function startEdit(vendor: Subcontractor) {
    setEditingId(vendor.id)
    setEditForm({
      incumbent_status: vendor.incumbent_status,
      performance_notes: vendor.performance_notes || '',
      preferred: vendor.preferred,
    })
  }

  const filtered = vendors.filter(v => {
    if (search && !v.company_name.toLowerCase().includes(search.toLowerCase()) &&
        !v.service_categories?.some(c => c.toLowerCase().includes(search.toLowerCase()))) return false
    if (filterIncumbent !== 'all' && v.incumbent_status !== filterIncumbent) return false
    return true
  })

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="text-purple-600" size={24} /> Vendor / Incumbent Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track vendor relationships, incumbent status, and performance</p>
        </div>
        <Link to="/subcontractors" className="text-sm text-blue-600 hover:underline">Manage Subcontractor Database &rarr;</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{vendors.length}</div>
          <div className="text-xs text-gray-500">Total Vendors</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{vendors.filter(v => v.preferred).length}</div>
          <div className="text-xs text-green-600">Preferred</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{vendors.filter(v => v.incumbent_status === 'known').length}</div>
          <div className="text-xs text-blue-600">Known Incumbents</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{vendors.filter(v => v.incumbent_status === 'suspected').length}</div>
          <div className="text-xs text-yellow-600">Suspected Incumbents</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select value={filterIncumbent} onChange={e => setFilterIncumbent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          <option value="known">Known Incumbent</option>
          <option value="suspected">Suspected Incumbent</option>
          <option value="not_incumbent">Not Incumbent</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      {/* Vendor List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No vendors found.</p>
          <Link to="/subcontractors" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Add Subcontractors
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vendor => (
            <div key={vendor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{vendor.company_name}</h3>
                    {vendor.preferred && <Star className="text-amber-500 fill-amber-500" size={16} />}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    {vendor.contact_name && <span>{vendor.contact_name}</span>}
                    {vendor.contact_email && <span>{vendor.contact_email}</span>}
                    {vendor.contact_phone && <span>{vendor.contact_phone}</span>}
                  </div>
                  {vendor.service_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {vendor.service_categories.map(cat => (
                        <span key={cat} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{cat}</span>
                      ))}
                    </div>
                  )}
                  {vendor.geographic_coverage?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <MapPin size={12} /> {vendor.geographic_coverage.join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    vendor.incumbent_status === 'known' ? 'bg-green-100 text-green-700' :
                    vendor.incumbent_status === 'suspected' ? 'bg-yellow-100 text-yellow-700' :
                    vendor.incumbent_status === 'not_incumbent' ? 'bg-gray-100 text-gray-600' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {vendor.incumbent_status === 'known' ? 'Known Incumbent' :
                     vendor.incumbent_status === 'suspected' ? 'Suspected' :
                     vendor.incumbent_status === 'not_incumbent' ? 'Not Incumbent' : 'Unknown'}
                  </span>
                  <button onClick={() => startEdit(vendor)} className="text-sm text-blue-600 hover:underline">Edit</button>
                </div>
              </div>

              {vendor.performance_notes && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Performance Notes</p>
                  <p className="text-sm text-gray-700">{vendor.performance_notes}</p>
                </div>
              )}

              {editingId === vendor.id && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Incumbent Status</label>
                      <select
                        value={editForm.incumbent_status}
                        onChange={e => setEditForm(prev => ({ ...prev, incumbent_status: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="unknown">Unknown</option>
                        <option value="known">Known Incumbent</option>
                        <option value="suspected">Suspected Incumbent</option>
                        <option value="not_incumbent">Not Incumbent</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        checked={editForm.preferred}
                        onChange={e => setEditForm(prev => ({ ...prev, preferred: e.target.checked }))}
                        className="rounded"
                      />
                      <label className="text-sm text-gray-700">Preferred Subcontractor</label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Performance Notes</label>
                    <textarea
                      value={editForm.performance_notes}
                      onChange={e => setEditForm(prev => ({ ...prev, performance_notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="Pricing competitiveness, responsiveness, quality of work..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(vendor.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-1.5 rounded text-sm text-gray-700 border border-gray-300">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
