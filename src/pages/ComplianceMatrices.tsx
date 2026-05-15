import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { TaskOrder, ComplianceItem } from '../lib/types'
import { Shield, ArrowRight, CheckCircle, Clock } from 'lucide-react'

interface TOWithMatrix {
  taskOrder: TaskOrder
  hasMatrix: boolean
  itemCount: number
}

export default function ComplianceMatrices() {
  const [items, setItems] = useState<TOWithMatrix[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: taskOrders } = await supabase.from('task_orders').select('*').order('created_at', { ascending: false })

      const results: TOWithMatrix[] = []
      for (const to of taskOrders || []) {
        const matrix = await loadAiOutput<{ items: ComplianceItem[] }>(to.id, 'compliance_matrix')
        results.push({
          taskOrder: to,
          hasMatrix: !!matrix?.items?.length,
          itemCount: matrix?.items?.length || 0,
        })
      }
      setItems(results)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="text-blue-600" size={24} /> Compliance Matrices
        </h1>
        <p className="text-sm text-gray-500 mt-1">View compliance matrices for all task orders</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No task orders registered yet.</p>
          <Link to="/task-orders/new" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Register Incoming RFQ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ taskOrder: to, hasMatrix, itemCount }) => (
            <Link
              key={to.id}
              to={hasMatrix ? `/task-orders/${to.id}/compliance` : `/task-orders/${to.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between hover:shadow-md transition-shadow block"
            >
              <div className="flex items-center gap-4">
                {hasMatrix ? (
                  <CheckCircle size={24} className="text-green-500" />
                ) : (
                  <Clock size={24} className="text-gray-400" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{to.title}</h3>
                  <p className="text-sm text-gray-500">
                    {to.site_name && `${to.site_name} | `}
                    {hasMatrix ? `${itemCount} compliance items` : 'No matrix generated - run AI analysis'}
                  </p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
