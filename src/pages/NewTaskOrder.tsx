import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import type { Contract } from '../lib/types'
import { ArrowLeft, Upload, FileText, Info, Building2, Landmark, HardHat, Server, Briefcase, FileStack, AlertTriangle, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PROJECT_TYPES, getProjectType } from '../lib/projectTypes'
import { useTier } from '../hooks/useTier'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]

const TYPE_ICONS: Record<string, React.ElementType> = {
  government_task_order: Building2,
  government_rfp: Landmark,
  construction: HardHat,
  it_services: Server,
  commercial: Briefcase,
}

export default function NewTaskOrder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()
  const { getLimit, isEnterprise } = useTier()
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [selectedContractId, setSelectedContractId] = useState(searchParams.get('contract_id') || '')
  const [form, setForm] = useState({
    title: '',
    solicitation_number: '',
    task_order_number: '',
    site_name: '',
    location_city: '',
    location_state: '',
    due_date: '',
    notes: '',
    project_type: 'government_task_order',
  })

  const projectType = getProjectType(form.project_type)

  useEffect(() => {
    if (currentOrg?.id) {
      supabase.from('contracts').select('id, title, contract_number, contract_type')
        .eq('org_id', currentOrg.id).eq('status', 'active').order('title')
        .then(({ data }) => setContracts(data as Contract[] || []))
      // Count existing projects for limit check
      supabase.from('task_orders').select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .then(({ count }) => setProjectCount(count || 0))
    }
  }, [currentOrg?.id])

  const projectLimit = getLimit('max_projects')
  const atLimit = !isEnterprise && projectCount >= projectLimit
  const missingOrg = isMultiTenantEnabled && !currentOrg
  const cannotCreate = atLimit || missingOrg

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Never create an orphaned project: a task order must belong to an org.
    if (missingOrg) {
      alert('Your account is not linked to an organization yet, so a project cannot be created. Please contact support so we can finish setting up your workspace.')
      return
    }
    if (atLimit) return

    setLoading(true)

    const insertData: Record<string, unknown> = {
      title: form.title,
      solicitation_number: form.solicitation_number || null,
      task_order_number: form.task_order_number || null,
      site_name: form.site_name || null,
      location_city: form.location_city || null,
      location_state: form.location_state || null,
      due_date: form.due_date || null,
      notes: form.notes || null,
      status: 'draft',
      created_by: user?.id,
    }

    // Include project_type, org_id, and contract_id if available.
    // org_id is required whenever multi-tenancy is on (guarded above).
    const extraFields: Record<string, unknown> = { project_type: form.project_type }
    if (isMultiTenantEnabled && currentOrg) {
      extraFields.org_id = currentOrg.id
    }
    if (selectedContractId) {
      extraFields.contract_id = selectedContractId
    }

    const { data, error } = await supabase
      .from('task_orders')
      .insert({ ...insertData, ...extraFields })
      .select()
      .single()

    if (error && error.message?.includes('project_type')) {
      // Column doesn't exist yet — insert without it
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('task_orders')
        .insert(insertData)
        .select()
        .single()

      if (fallbackError) {
        alert('Error creating project: ' + fallbackError.message)
        setLoading(false)
        return
      }
      navigate(`/projects/${fallbackData.id}`)
      return
    }

    if (error) {
      alert('Error creating project: ' + error.message)
      setLoading(false)
      return
    }

    navigate(`/projects/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Project</h1>
          <p className="text-sm text-gray-500">Set up a new procurement project for analysis</p>
        </div>
      </div>

      {atLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-amber-800">Project limit reached ({projectCount}/{projectLimit})</p>
            <p className="text-xs text-amber-600 mt-1">
              Your Growth plan allows up to {projectLimit} active projects. Upgrade to Enterprise for unlimited projects.
            </p>
            <Link to="/billing" className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
              <Sparkles size={12} /> Upgrade Plan
            </Link>
          </div>
        </div>
      )}

      {missingOrg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-amber-800">Workspace not ready yet</p>
            <p className="text-xs text-amber-600 mt-1">
              Your account isn't linked to an organization yet, so projects can't be created.
              Please contact support at team@procuvex.com so we can finish setting up your workspace.
            </p>
          </div>
        </div>
      )}

      {/* Workflow Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How this works:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Choose a project type and enter details below</li>
            <li>Upload all relevant documents (scope, pricing, specs, etc.)</li>
            <li>Run AI analysis to extract requirements, risks, and compliance items</li>
            <li>Generate compliance matrices, vendor RFQs, and bid summaries</li>
          </ol>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Project Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project Type *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROJECT_TYPES.map(pt => {
              const Icon = TYPE_ICONS[pt.id] || Briefcase
              const isSelected = form.project_type === pt.id
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, project_type: pt.id }))}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} className={isSelected ? 'text-blue-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{pt.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{pt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Parent Contract (optional) */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 text-gray-700 mb-3">
            <FileStack size={18} className="text-indigo-600" />
            <span className="font-medium">Parent Contract</span>
            <span className="text-xs text-gray-400">(optional)</span>
          </div>
          {contracts.length > 0 ? (
            <>
              <select
                value={selectedContractId}
                onChange={e => setSelectedContractId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">— No parent contract —</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.contract_number ? `(${c.contract_number})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Link this project to an existing parent contract (IDIQ, BPA, etc.)</p>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">No active contracts yet</p>
              <Link to="/contracts/new" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                + Create Contract
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 text-gray-700 mb-4">
            <FileText size={18} />
            <span className="font-medium">Project Details</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Title *</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder={projectType.placeholders.title}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-400 mt-1">A descriptive name to identify this project</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation / RFP Number</label>
                <input
                  type="text"
                  name="solicitation_number"
                  value={form.solicitation_number}
                  onChange={handleChange}
                  placeholder={projectType.placeholders.solicitation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  name="task_order_number"
                  value={form.task_order_number}
                  onChange={handleChange}
                  placeholder={projectType.placeholders.referenceNumber}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site / Location Name</label>
              <input
                type="text"
                name="site_name"
                value={form.site_name}
                onChange={handleChange}
                placeholder={projectType.placeholders.siteName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="location_city"
                  value={form.location_city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  name="location_state"
                  value={form.location_state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Response Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">When is the bid / proposal response due?</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any initial observations about this project..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || cannotCreate}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={18} />
            {loading ? 'Creating...' : 'Create Project & Upload Documents'}
          </button>
          <Link
            to="/projects"
            className="px-6 py-2.5 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
