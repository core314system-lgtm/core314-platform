import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder, TaskOrderComparison as ComparisonType } from '../lib/types'
import { parseFile } from '../lib/documentParser'
import { compareTaskOrders } from '../lib/api'
import { GitCompareArrows, ArrowRight } from 'lucide-react'

export default function TaskOrderComparisonPage() {
  const [taskOrders, setTaskOrders] = useState<TaskOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentId, setCurrentId] = useState('')
  const [priorId, setPriorId] = useState('')
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<ComparisonType | null>(null)

  useEffect(() => {
    supabase.from('task_orders').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setTaskOrders(data || [])
      setLoading(false)
    })
  }, [])

  async function getDocumentTexts(taskOrderId: string): Promise<string[]> {
    const { data: docs } = await supabase.from('documents').select('*').eq('task_order_id', taskOrderId)
    const texts: string[] = []
    for (const doc of docs || []) {
      const { data } = await supabase.storage.from('task-order-documents').download(doc.file_path)
      if (data) {
        const file = new File([data], doc.file_name, { type: doc.file_type })
        texts.push(await parseFile(file))
      }
    }
    return texts
  }

  async function handleCompare() {
    if (!currentId || !priorId) return
    setComparing(true)

    try {
      const currentTO = taskOrders.find(t => t.id === currentId)
      const priorTO = taskOrders.find(t => t.id === priorId)

      const [currentTexts, priorTexts] = await Promise.all([
        getDocumentTexts(currentId),
        getDocumentTexts(priorId),
      ])

      const res = await compareTaskOrders(
        currentTexts, currentTO?.title || '',
        priorTexts, priorTO?.title || '',
      )
      setResult(res as unknown as ComparisonType)
    } catch (err) {
      alert('Comparison failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setComparing(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitCompareArrows className="text-cyan-600" size={24} /> Task Order Comparison
        </h1>
        <p className="text-sm text-gray-500 mt-1">Compare a new task order against a prior task order to identify changes</p>
      </div>

      {taskOrders.length < 2 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <GitCompareArrows className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">You need at least 2 task orders to compare.</p>
          <Link to="/task-orders/new" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Register Task Order
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Task Order</label>
                <select value={currentId} onChange={e => setCurrentId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select task order...</option>
                  {taskOrders.map(to => (
                    <option key={to.id} value={to.id}>{to.title} ({to.site_name})</option>
                  ))}
                </select>
              </div>
              <ArrowRight size={20} className="text-gray-400 mt-6" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prior Task Order</label>
                <select value={priorId} onChange={e => setPriorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select task order...</option>
                  {taskOrders.filter(t => t.id !== currentId).map(to => (
                    <option key={to.id} value={to.id}>{to.title} ({to.site_name})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCompare}
                disabled={!currentId || !priorId || comparing}
                className="mt-6 bg-cyan-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
              >
                {comparing ? 'Comparing...' : 'Compare'}
              </button>
            </div>
          </div>

          {result && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Comparison Summary</h3>
                <p className="text-gray-700">{result.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Added Services */}
                {result.added_services?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
                    <h3 className="font-semibold text-green-700 mb-3">Added Services ({result.added_services.length})</h3>
                    <div className="space-y-2">
                      {result.added_services.map((s, i) => (
                        <div key={i} className="bg-green-50 rounded p-3">
                          <p className="font-medium text-gray-800">{s.service}</p>
                          <p className="text-sm text-gray-600">{s.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Services */}
                {result.removed_services?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                    <h3 className="font-semibold text-red-700 mb-3">Removed Services ({result.removed_services.length})</h3>
                    <div className="space-y-2">
                      {result.removed_services.map((s, i) => (
                        <div key={i} className="bg-red-50 rounded p-3">
                          <p className="font-medium text-gray-800">{s.service}</p>
                          <p className="text-sm text-gray-600">{s.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Changed Requirements */}
              {result.changed_requirements?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Changed Requirements ({result.changed_requirements.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Requirement</th>
                          <th className="px-4 py-2 text-left">Current</th>
                          <th className="px-4 py-2 text-left">Prior</th>
                          <th className="px-4 py-2 text-left">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.changed_requirements.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{r.requirement}</td>
                            <td className="px-4 py-2 text-gray-600">{r.current_version}</td>
                            <td className="px-4 py-2 text-gray-600">{r.prior_version}</td>
                            <td className="px-4 py-2">
                              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">{r.change_type}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Staffing Changes */}
              {result.staffing_changes?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Staffing Changes</h3>
                  <div className="space-y-2">
                    {result.staffing_changes.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded p-3">
                        <span className="font-medium">{s.role}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">Prior: {s.prior}</span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span className="text-gray-900">Current: {s.current}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{s.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Requirements */}
              {result.similar_requirements?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Similar Requirements ({result.similar_requirements.length})</h3>
                  <div className="space-y-1">
                    {result.similar_requirements.slice(0, 10).map((s, i) => (
                      <div key={i} className="text-sm text-gray-600 py-1">{s.requirement}</div>
                    ))}
                    {result.similar_requirements.length > 10 && (
                      <p className="text-xs text-gray-400">...and {result.similar_requirements.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
