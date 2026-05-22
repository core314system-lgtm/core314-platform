import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import { Search, Star, Building, ChevronDown, ChevronUp, MapPin, Users, Briefcase, Edit2, Check, X } from 'lucide-react'

interface VendorProjectLink {
  projectId: string
  projectTitle: string
  projectType: string | null
  projectStatus: string
  sowItemNames: string[]
  outreachStatus: string
  incumbentStatus: string
  sowSubIds: string[]
}

interface VendorSummary {
  id: string
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  serviceCategories: string[]
  geographicCoverage: string[]
  preferred: boolean
  projects: VendorProjectLink[]
}

const incumbentOptions = [
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-50 text-gray-400' },
  { value: 'known', label: 'Known Incumbent', color: 'bg-green-100 text-green-700' },
  { value: 'suspected', label: 'Suspected', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'not_incumbent', label: 'Not Incumbent', color: 'bg-gray-100 text-gray-600' },
]

function getIncumbentStyle(status: string) {
  return incumbentOptions.find(o => o.value === status)?.color || 'bg-gray-50 text-gray-400'
}

function getIncumbentLabel(status: string) {
  return incumbentOptions.find(o => o.value === status)?.label || 'Unknown'
}

export default function VendorTracker() {
  const { currentOrg } = useOrg()
  const [vendors, setVendors] = useState<VendorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterIncumbent, setFilterIncumbent] = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [editingIncumbent, setEditingIncumbent] = useState<{ vendorId: string; projectId: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [allProjects, setAllProjects] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (currentOrg?.id) fetchVendorIntelligence()
  }, [currentOrg?.id])

  async function fetchVendorIntelligence() {
    setLoading(true)

    const { data: projects } = await supabase
      .from('task_orders')
      .select('id, title, status, project_type')
      .eq('org_id', currentOrg!.id)
      .order('title')

    setAllProjects((projects || []).map(p => ({ id: p.id, title: p.title })))

    const { data: sowItems } = await supabase
      .from('sow_items')
      .select('id, task_order_id, service_category')
      .in('task_order_id', (projects || []).map(p => p.id))

    if (!sowItems || sowItems.length === 0) {
      setVendors([])
      setLoading(false)
      return
    }

    const { data: sowSubs } = await supabase
      .from('sow_subcontractors')
      .select('id, sow_item_id, subcontractor_id, outreach_status, incumbent_status')
      .in('sow_item_id', sowItems.map(s => s.id))

    const subIds = [...new Set((sowSubs || []).map(ss => ss.subcontractor_id))]
    if (subIds.length === 0) {
      setVendors([])
      setLoading(false)
      return
    }

    const { data: subs } = await supabase
      .from('subcontractors')
      .select('*')
      .in('id', subIds)

    const sowItemMap = new Map<string, { taskOrderId: string; serviceCategory: string }>()
    for (const si of sowItems) {
      sowItemMap.set(si.id, { taskOrderId: si.task_order_id, serviceCategory: si.service_category })
    }

    const projectMap = new Map<string, { title: string; type: string | null; status: string }>()
    for (const p of (projects || [])) {
      projectMap.set(p.id, { title: p.title, type: p.project_type, status: p.status })
    }

    const vendorMap = new Map<string, VendorSummary>()

    for (const sub of (subs || [])) {
      vendorMap.set(sub.id, {
        id: sub.id,
        companyName: sub.company_name,
        contactName: sub.contact_name,
        contactEmail: sub.contact_email,
        contactPhone: sub.contact_phone,
        serviceCategories: sub.service_categories || [],
        geographicCoverage: sub.geographic_coverage || [],
        preferred: sub.preferred,
        projects: [],
      })
    }

    const projectGrouping = new Map<string, Map<string, { sowNames: string[]; outreach: string; incumbent: string; sowSubIds: string[] }>>()

    for (const ss of (sowSubs || [])) {
      const sowInfo = sowItemMap.get(ss.sow_item_id)
      if (!sowInfo) continue

      const vendorId = ss.subcontractor_id
      const projectId = sowInfo.taskOrderId

      if (!projectGrouping.has(vendorId)) projectGrouping.set(vendorId, new Map())
      const vendorProjects = projectGrouping.get(vendorId)!

      if (!vendorProjects.has(projectId)) {
        vendorProjects.set(projectId, {
          sowNames: [],
          outreach: ss.outreach_status || 'identified',
          incumbent: ss.incumbent_status || 'unknown',
          sowSubIds: [],
        })
      }

      const entry = vendorProjects.get(projectId)!
      entry.sowNames.push(sowInfo.serviceCategory)
      entry.sowSubIds.push(ss.id)
      if (ss.incumbent_status && ss.incumbent_status !== 'unknown') {
        entry.incumbent = ss.incumbent_status
      }
    }

    for (const [vendorId, projectEntries] of projectGrouping) {
      const vendor = vendorMap.get(vendorId)
      if (!vendor) continue

      for (const [projectId, entry] of projectEntries) {
        const proj = projectMap.get(projectId)
        if (!proj) continue

        vendor.projects.push({
          projectId,
          projectTitle: proj.title,
          projectType: proj.type,
          projectStatus: proj.status,
          sowItemNames: [...new Set(entry.sowNames)],
          outreachStatus: entry.outreach,
          incumbentStatus: entry.incumbent,
          sowSubIds: entry.sowSubIds,
        })
      }
    }

    setVendors(Array.from(vendorMap.values()).sort((a, b) => b.projects.length - a.projects.length))
    setLoading(false)
  }

  async function saveIncumbentStatus(vendorId: string, projectId: string, status: string) {
    const vendor = vendors.find(v => v.id === vendorId)
    if (!vendor) return

    const projectLink = vendor.projects.find(p => p.projectId === projectId)
    if (!projectLink) return

    for (const sowSubId of projectLink.sowSubIds) {
      await supabase.from('sow_subcontractors').update({ incumbent_status: status }).eq('id', sowSubId)
    }

    setEditingIncumbent(null)
    fetchVendorIntelligence()
  }

  const uniqueProjects = allProjects
  const totalAssignments = vendors.reduce((acc, v) => acc + v.projects.length, 0)
  const knownIncumbents = vendors.filter(v => v.projects.some(p => p.incumbentStatus === 'known')).length
  const suspectedIncumbents = vendors.filter(v => v.projects.some(p => p.incumbentStatus === 'suspected')).length

  const filtered = vendors.filter(v => {
    if (search) {
      const q = search.toLowerCase()
      if (!v.companyName.toLowerCase().includes(q) &&
          !v.serviceCategories.some(c => c.toLowerCase().includes(q)) &&
          !v.contactName?.toLowerCase().includes(q)) return false
    }
    if (filterIncumbent !== 'all') {
      if (!v.projects.some(p => p.incumbentStatus === filterIncumbent)) return false
    }
    if (filterProject !== 'all') {
      if (!v.projects.some(p => p.projectId === filterProject)) return false
    }
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
          <p className="text-sm text-gray-500 mt-1">Track vendor relationships and incumbent status per project</p>
        </div>
        <Link to="/subcontractors" className="text-sm text-blue-600 hover:underline">Manage Subcontractor Database &rarr;</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{vendors.length}</div>
          <div className="text-xs text-gray-500">Vendors Assigned</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{totalAssignments}</div>
          <div className="text-xs text-blue-600">Project Assignments</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{knownIncumbents}</div>
          <div className="text-xs text-green-600">Known Incumbents</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{suspectedIncumbents}</div>
          <div className="text-xs text-yellow-600">Suspected Incumbents</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">All Projects</option>
          {uniqueProjects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
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
          <p className="text-gray-500 mb-2">No vendor assignments found.</p>
          <p className="text-sm text-gray-400 mb-4">Vendors appear here when assigned to project SOW items via the SOW Tracker.</p>
          <Link to="/projects" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vendor => {
            const isExpanded = expandedVendor === vendor.id
            return (
              <div key={vendor.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedVendor(isExpanded ? null : vendor.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{vendor.companyName}</h3>
                        {vendor.preferred && <Star className="text-amber-500 fill-amber-500" size={16} />}
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {vendor.projects.length} project{vendor.projects.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        {vendor.contactName && <span>{vendor.contactName}</span>}
                        {vendor.contactEmail && <span>{vendor.contactEmail}</span>}
                      </div>
                      {vendor.serviceCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {vendor.serviceCategories.slice(0, 4).map(cat => (
                            <span key={cat} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{cat}</span>
                          ))}
                          {vendor.serviceCategories.length > 4 && (
                            <span className="text-xs text-gray-400">+{vendor.serviceCategories.length - 4} more</span>
                          )}
                        </div>
                      )}
                      {vendor.geographicCoverage.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <MapPin size={12} /> {vendor.geographicCoverage.slice(0, 3).join(', ')}
                          {vendor.geographicCoverage.length > 3 && ` +${vendor.geographicCoverage.length - 3}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {[...new Set(vendor.projects.map(p => p.incumbentStatus))].map(status => (
                          <span key={status} className={`px-2 py-0.5 rounded text-xs font-medium ${getIncumbentStyle(status)}`}>
                            {getIncumbentLabel(status)}
                          </span>
                        ))}
                      </div>
                      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5">
                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <Briefcase size={14} /> Project Assignments
                      </h4>
                      {vendor.projects.map(proj => (
                        <div key={proj.projectId} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="flex items-start justify-between">
                            <div>
                              <Link
                                to={`/projects/${proj.projectId}`}
                                className="font-medium text-blue-600 hover:underline text-sm"
                                onClick={e => e.stopPropagation()}
                              >
                                {proj.projectTitle}
                              </Link>
                              {proj.projectType && (
                                <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{proj.projectType}</span>
                              )}
                              <div className="mt-1 text-xs text-gray-500">
                                SOW Areas: {proj.sowItemNames.join(', ') || 'General'}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                Outreach: <span className="capitalize">{proj.outreachStatus.replace('_', ' ')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {editingIncumbent?.vendorId === vendor.id && editingIncumbent?.projectId === proj.projectId ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    className="text-xs border border-gray-300 rounded px-2 py-1"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {incumbentOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={e => { e.stopPropagation(); saveIncumbentStatus(vendor.id, proj.projectId, editValue) }}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditingIncumbent(null) }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getIncumbentStyle(proj.incumbentStatus)}`}>
                                    {getIncumbentLabel(proj.incumbentStatus)}
                                  </span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      setEditingIncumbent({ vendorId: vendor.id, projectId: proj.projectId })
                                      setEditValue(proj.incumbentStatus)
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit incumbent status for this project"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
