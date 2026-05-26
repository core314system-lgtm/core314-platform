import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder } from '../lib/types'
import { getWorkflowStages, getStageColor, getProjectTypeLabel } from '../lib/projectTypes'
import { LayoutGrid, List, MapPin, Clock, FileStack } from 'lucide-react'

export default function PipelineView() {
  const [taskOrders, setTaskOrders] = useState<TaskOrder[]>([])
  const [contractMap, setContractMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      supabase.from('task_orders').select('*').order('updated_at', { ascending: false }),
      supabase.from('contracts').select('id, title'),
    ]).then(([toRes, contractRes]) => {
      setTaskOrders(toRes.data || [])
      const cMap: Record<string, string> = {}
      for (const c of (contractRes.data || [])) { cMap[c.id] = c.title }
      setContractMap(cMap)
      setLoading(false)
    })
  }, [])

  // Determine which stages to show based on filter
  const effectiveType = filterType === 'all' ? 'government_task_order' : filterType
  const stages = getWorkflowStages(effectiveType)

  // Group projects by stage
  const byStage: Record<string, TaskOrder[]> = {}
  for (const stage of stages) {
    byStage[stage.id] = taskOrders.filter(to => {
      if (filterType !== 'all' && to.project_type !== filterType) return false
      return to.status === stage.id
    })
  }

  // Get unique project types in use
  const typesInUse = [...new Set(taskOrders.map(t => t.project_type || 'government_task_order'))]

  if (loading) return <div className="text-center py-12 text-gray-500">Loading pipeline...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Track project progress across workflow stages</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Project type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Project Types</option>
            {typesInUse.map(t => (
              <option key={t} value={t}>{getProjectTypeLabel(t)}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-2 text-sm ${viewMode === 'board' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {taskOrders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No projects yet. Create a project to see it in the pipeline.</p>
          <Link to="/projects/new" className="inline-flex mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            New Project
          </Link>
        </div>
      ) : viewMode === 'board' ? (
        /* Kanban Board View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const colors = getStageColor(stage.color)
            const projects = byStage[stage.id] || []

            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                <div className={`rounded-t-lg px-3 py-2 ${colors.bg} border-b-2 ${colors.border}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold ${colors.text}`}>{stage.label}</h3>
                    <span className={`text-xs font-bold ${colors.text} bg-white/60 px-2 py-0.5 rounded-full`}>
                      {projects.length}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-b-lg min-h-[200px] p-2 space-y-2 border border-t-0 border-gray-200">
                  {projects.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No projects</p>
                  ) : (
                    projects.map(to => (
                      <Link
                        key={to.id}
                        to={`/projects/${to.id}`}
                        className="block bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{to.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                            {getProjectTypeLabel(to.project_type)}
                          </span>
                          {(to as TaskOrder & { contract_id?: string }).contract_id && contractMap[(to as TaskOrder & { contract_id?: string }).contract_id!] && (
                            <span className="flex items-center gap-0.5 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                              <FileStack size={9} /> {contractMap[(to as TaskOrder & { contract_id?: string }).contract_id!]}
                            </span>
                          )}
                          {to.site_name && (
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin size={10} /> {to.site_name}
                            </span>
                          )}
                        </div>
                        {to.due_date && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                            <Clock size={10} />
                            Due: {new Date(to.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Contract</th>
                <th className="text-left px-4 py-3">Stage</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Due Date</th>
                <th className="text-left px-4 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {taskOrders
                .filter(to => filterType === 'all' || to.project_type === filterType)
                .map(to => {
                  const stage = getWorkflowStages(to.project_type).find(s => s.id === to.status)
                  const colors = stage ? getStageColor(stage.color) : getStageColor('gray')

                  return (
                    <tr key={to.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/projects/${to.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {to.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {getProjectTypeLabel(to.project_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(to as TaskOrder & { contract_id?: string }).contract_id && contractMap[(to as TaskOrder & { contract_id?: string }).contract_id!] ? (
                          <Link to={`/contracts/${(to as TaskOrder & { contract_id?: string }).contract_id}`} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                            <FileStack size={10} /> {contractMap[(to as TaskOrder & { contract_id?: string }).contract_id!]}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                          {stage?.label || to.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {to.site_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {to.due_date ? new Date(to.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(to.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
