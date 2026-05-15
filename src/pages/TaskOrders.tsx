import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaskOrder } from '../lib/types'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Search } from 'lucide-react'

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

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-green-100 text-green-700',
    awarded: 'bg-emerald-100 text-emerald-700',
    not_awarded: 'bg-red-100 text-red-700',
  }

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    submitted: 'Submitted',
    awarded: 'Awarded',
    not_awarded: 'Not Awarded',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Task Orders</h1>
        <Link
          to="/task-orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> New Task Order
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
          <p className="text-gray-500 mb-4">
            {search ? 'No task orders match your search.' : 'No task orders yet.'}
          </p>
          {!search && (
            <Link
              to="/task-orders/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus size={18} /> Create Your First Task Order
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filtered.map(to => (
            <Link
              key={to.id}
              to={`/task-orders/${to.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{to.title}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[to.status]}`}>
                  {statusLabel[to.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
