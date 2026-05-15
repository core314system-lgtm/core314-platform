import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { PricingRisk, TaskOrder } from '../lib/types'
import { DollarSign, ArrowLeft, AlertTriangle, Filter } from 'lucide-react'

export default function PricingRisks() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [risks, setRisks] = useState<PricingRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      loadAiOutput<{ risks: PricingRisk[] }>(id, 'pricing_risks').then(data => {
        setRisks(data?.risks || [])
        setLoading(false)
      })
    }
  }, [id])

  const categories = [...new Set(risks.map(r => r.category))]

  const filtered = risks.filter(r => {
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false
    if (filterCategory !== 'all' && r.category !== filterCategory) return false
    return true
  })

  const severityCounts = {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="text-red-600" size={24} /> Pricing Support / Risk Review
        </h1>
      </div>

      {risks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <DollarSign className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No pricing risks generated yet.</p>
          <Link to={`/task-orders/${id}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Task Order
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-700">{severityCounts.critical}</div>
              <div className="text-xs text-red-600">Critical</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">{severityCounts.high}</div>
              <div className="text-xs text-orange-600">High</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{severityCounts.medium}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{severityCounts.low}</div>
              <div className="text-xs text-green-600">Low</div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-3">
            <Filter size={16} className="text-gray-400" />
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="text-sm text-gray-500 ml-auto">{filtered.length} risks</span>
          </div>

          <div className="space-y-3">
            {filtered.map((risk, i) => (
              <div key={i} className={`bg-white rounded-xl shadow-sm border p-5 ${
                risk.severity === 'critical' ? 'border-red-300 border-l-4 border-l-red-500' :
                risk.severity === 'high' ? 'border-orange-300 border-l-4 border-l-orange-500' :
                'border-gray-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {(risk.severity === 'critical' || risk.severity === 'high') && <AlertTriangle size={16} className="text-red-500" />}
                      <h3 className="font-medium text-gray-900">{risk.risk}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        risk.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        risk.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{risk.severity}</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{risk.category.replace(/_/g, ' ')}</span>
                      <span>{risk.source_document}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Recommended Action</span>
                    <p className="text-gray-700 mt-0.5">{risk.recommended_action}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">Financial Impact</span>
                    <p className="text-gray-700 mt-0.5">{risk.financial_impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
