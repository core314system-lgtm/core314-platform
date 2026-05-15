import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subcontractor } from '../lib/types'
import { Plus, Search, MapPin, Star } from 'lucide-react'

export default function Subcontractors() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    service_categories: '',
    geographic_coverage: '',
  })

  useEffect(() => {
    fetchSubcontractors()
  }, [])

  async function fetchSubcontractors() {
    const { data } = await supabase
      .from('subcontractors')
      .select('*')
      .order('company_name')

    setSubcontractors(data || [])
    setLoading(false)
  }

  async function handleAddSubcontractor(e: React.FormEvent) {
    e.preventDefault()

    await supabase.from('subcontractors').insert({
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      service_categories: form.service_categories.split(',').map(s => s.trim()).filter(Boolean),
      geographic_coverage: form.geographic_coverage.split(',').map(s => s.trim()).filter(Boolean),
      preferred: false,
      incumbent_status: 'unknown',
    })

    setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', service_categories: '', geographic_coverage: '' })
    setShowAdd(false)
    fetchSubcontractors()
  }

  const filtered = subcontractors.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    s.service_categories?.some(c => c.toLowerCase().includes(search.toLowerCase())) ||
    s.geographic_coverage?.some(g => g.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subcontractors</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> Add Subcontractor
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddSubcontractor} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Add New Subcontractor</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                value={form.company_name}
                onChange={e => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => setForm(prev => ({ ...prev, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Categories (comma-separated)</label>
            <input
              type="text"
              value={form.service_categories}
              onChange={e => setForm(prev => ({ ...prev, service_categories: e.target.value }))}
              placeholder="e.g., HVAC, Janitorial, Grounds Maintenance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geographic Coverage (comma-separated states)</label>
            <input
              type="text"
              value={form.geographic_coverage}
              onChange={e => setForm(prev => ({ ...prev, geographic_coverage: e.target.value }))}
              placeholder="e.g., GA, FL, SC, NC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
              Save Subcontractor
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by name, service category, or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {search ? 'No subcontractors match your search.' : 'No subcontractors in the database yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{sub.company_name}</h3>
                    {sub.preferred && <Star className="text-amber-500 fill-amber-500" size={16} />}
                  </div>
                  {sub.contact_name && <p className="text-sm text-gray-600 mt-1">{sub.contact_name}</p>}
                  {sub.contact_email && <p className="text-sm text-gray-500">{sub.contact_email}</p>}
                </div>
              </div>
              {sub.service_categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {sub.service_categories.map(cat => (
                    <span key={cat} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
              {sub.geographic_coverage?.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <MapPin size={12} />
                  {sub.geographic_coverage.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
