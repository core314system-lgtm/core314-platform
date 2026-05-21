import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { ArrowLeft, Upload, FileText, Info, Building2, Landmark, HardHat, Server, Briefcase } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PROJECT_TYPES, getProjectType } from '../lib/projectTypes'

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
  const { user } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()
  const [loading, setLoading] = useState(false)
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

    // Include project_type and org_id if available
    const extraFields: Record<string, unknown> = { project_type: form.project_type }
    if (isMultiTenantEnabled && currentOrg) {
      extraFields.org_id = currentOrg.id
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
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
