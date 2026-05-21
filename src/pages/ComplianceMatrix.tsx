import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { ComplianceItem, TaskOrder } from '../lib/types'
import { Shield, ArrowLeft, Filter } from 'lucide-react'
import CitationBadge from '../components/CitationBadge'

export default function ComplianceMatrix() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [items, setItems] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      loadAiOutput<{ items: ComplianceItem[] }>(id, 'compliance_matrix').then(data => {
        setItems(data?.items || [])
        setLoading(false)
      })
    }
  }, [id])

  const filtered = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterRisk !== 'all' && item.risk_level !== filterRisk) return false
    return true
  })

  const statusCounts = {
    covered: items.filter(i => i.status === 'covered').length,
    unclear: items.filter(i => i.status === 'unclear').length,
    missing: items.filter(i => i.status === 'missing').length,
    needs_review: items.filter(i => i.status === 'needs_review').length,
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={24} /> Compliance Matrix
          </h1>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No compliance matrix generated yet.</p>
          <p className="text-sm text-gray-400 mt-1">Upload documents and run AI analysis from the task order page.</p>
          <Link to={`/task-orders/${id}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Task Order
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{statusCounts.covered}</div>
              <div className="text-xs text-green-600">Covered</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{statusCounts.unclear}</div>
              <div className="text-xs text-yellow-600">Unclear</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-700">{statusCounts.missing}</div>
              <div className="text-xs text-red-600">Missing</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{statusCounts.needs_review}</div>
              <div className="text-xs text-blue-600">Needs Review</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-3">
            <Filter size={16} className="text-gray-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Statuses</option>
              <option value="covered">Covered</option>
              <option value="unclear">Unclear</option>
              <option value="missing">Missing</option>
              <option value="needs_review">Needs Review</option>
            </select>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-sm text-gray-500 ml-auto">{filtered.length} of {items.length} items</span>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Requirement</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Responsible</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Risk</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 max-w-xs">{item.requirement}</td>
                      <td className="px-4 py-3">
                        <CitationBadge sourceDocument={item.source_document} pageSection={item.page_section} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.service_category}</td>
                      <td className="px-4 py-3 text-gray-600">{item.responsible_party}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                          item.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                          item.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'covered' ? 'bg-green-100 text-green-700' :
                          item.status === 'unclear' ? 'bg-yellow-100 text-yellow-700' :
                          item.status === 'missing' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
