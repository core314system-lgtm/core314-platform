import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaskOrder } from '../lib/types'
import { Link } from 'react-router-dom'
import { Upload, MapPin, Search } from 'lucide-react'
import { getProjectTypeLabel, getWorkflowStage, getStageColor } from '../lib/projectTypes'

export default function TaskOrders() {
  const [taskOrders, setTaskOrders] = useState<TaskOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchTaskOrders()
  }, [])

  async function fetchTaskOrders() {
    const { data } = await supabase
      .from('task_orders')
      .select('*')
      .order('created_at', { ascending: false })

    setTaskOrders(data || [])
    setLoading(false)
  }

  const filtered = taskOrders.filter(to =>
    to.title.toLowerCase().includes(search.toLowerCase()) ||
    to.site_name?.toLowerCase().includes(search.toLowerCase()) ||
    to.solicitation_number?.toLowerCase().includes(search.toLowerCase())
  )



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">Procurement projects and bid evaluations</p>
        </div>
        <Link
          to="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Upload size={18} /> New Project
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by title, site, or solicitation number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Upload className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-700 font-medium mb-2">
            {search ? 'No projects match your search.' : 'No projects registered yet'}
          </p>
          {!search && (
            <>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Create a project to begin the document upload and AI-powered analysis workflow.
                Supports government task orders, RFPs, construction bids, IT services, and more.
              </p>
              <Link
                to="/projects/new"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700"
              >
                <Upload size={18} /> Create Your First Project
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filtered.map(to => (
            <Link
              key={to.id}
              to={`/projects/${to.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{to.title}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{getProjectTypeLabel(to.project_type)}</span>
                  {to.solicitation_number && <span>Sol: {to.solicitation_number}</span>}
                  {to.site_name && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} /> {to.site_name}
                    </span>
                  )}
                  {to.location_state && (
                    <span>{to.location_city ? `${to.location_city}, ` : ''}{to.location_state}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {to.due_date && (
                  <span className="text-sm text-gray-500">
                    Due: {new Date(to.due_date).toLocaleDateString()}
                  </span>
                )}
                {(() => {
                  const stage = getWorkflowStage(to.project_type, to.status)
                  const colors = getStageColor(stage.color)
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {stage.label}
                    </span>
                  )
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
