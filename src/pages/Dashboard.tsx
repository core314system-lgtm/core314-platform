import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaskOrder } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  AlertTriangle,
  Users,
  CheckCircle,
  Plus,
  MapPin,
} from 'lucide-react'

interface DashboardStats {
  totalTaskOrders: number
  activeTaskOrders: number
  pendingDueDates: number
  totalSubcontractors: number
  quotesReceived: number
  quotesPending: number
  highRiskItems: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalTaskOrders: 0,
    activeTaskOrders: 0,
    pendingDueDates: 0,
    totalSubcontractors: 0,
    quotesReceived: 0,
    quotesPending: 0,
    highRiskItems: 0,
  })
  const [recentTaskOrders, setRecentTaskOrders] = useState<TaskOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    const [taskOrdersRes, subsRes] = await Promise.all([
      supabase.from('task_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('subcontractors').select('id', { count: 'exact' }),
    ])

    const taskOrders = taskOrdersRes.data || []
    const activeStatuses = ['draft', 'in_progress', 'under_review']
    const active = taskOrders.filter(to => activeStatuses.includes(to.status))
    const withDueDates = taskOrders.filter(to => to.due_date && new Date(to.due_date) > new Date())

    setStats({
      totalTaskOrders: taskOrders.length,
      activeTaskOrders: active.length,
      pendingDueDates: withDueDates.length,
      totalSubcontractors: subsRes.count || 0,
      quotesReceived: 0,
      quotesPending: 0,
      highRiskItems: 0,
    })

    setRecentTaskOrders(taskOrders.slice(0, 5))
    setLoading(false)
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}</p>
        </div>
        <Link
          to="/task-orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> New Task Order
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="text-blue-600" size={24} />}
          label="Active Task Orders"
          value={stats.activeTaskOrders}
          sublabel={`${stats.totalTaskOrders} total`}
        />
        <StatCard
          icon={<Clock className="text-amber-600" size={24} />}
          label="Pending Due Dates"
          value={stats.pendingDueDates}
          sublabel="upcoming deadlines"
        />
        <StatCard
          icon={<Users className="text-green-600" size={24} />}
          label="Subcontractors"
          value={stats.totalSubcontractors}
          sublabel="in database"
        />
        <StatCard
          icon={<AlertTriangle className="text-red-600" size={24} />}
          label="High-Risk Items"
          value={stats.highRiskItems}
          sublabel="need attention"
        />
      </div>

      {/* Recent Task Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Task Orders</h2>
        </div>
        {recentTaskOrders.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 mb-4">No task orders yet. Create your first one to get started.</p>
            <Link
              to="/task-orders/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus size={18} /> Create Task Order
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentTaskOrders.map(to => (
              <Link
                key={to.id}
                to={`/task-orders/${to.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{to.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          icon={<FileText size={20} />}
          title="View All Task Orders"
          description="Manage and track all task order responses"
          to="/task-orders"
        />
        <QuickAction
          icon={<Users size={20} />}
          title="Subcontractor Database"
          description="Search and manage subcontractor partners"
          to="/subcontractors"
        />
        <QuickAction
          icon={<CheckCircle size={20} />}
          title="Compliance Matrices"
          description="Review generated compliance outputs"
          to="/task-orders"
        />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sublabel }: { icon: React.ReactNode; label: string; value: number; sublabel: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{sublabel}</p>
    </div>
  )
}

function QuickAction({ icon, title, description, to }: { icon: React.ReactNode; title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-3 mb-2 text-blue-600">
        {icon}
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  )
}
