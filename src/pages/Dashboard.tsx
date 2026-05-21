import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TaskOrder } from '../lib/types'
import { ClipboardList, Clock, Users, Plus, FileText, Upload, Shield, Building, GitCompareArrows, Download } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft: 'New / Intake',
  in_progress: 'Evaluating',
  under_review: 'Bid Review',
  submitted: 'Bid Submitted',
  awarded: 'Awarded',
  not_awarded: 'Not Awarded',
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [taskOrders, setTaskOrders] = useState<TaskOrder[]>([])
  const [subCount, setSubCount] = useState(0)
  const [docCount, setDocCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('task_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('subcontractors').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
    ]).then(([toRes, subRes, docRes]) => {
      setTaskOrders(toRes.data || [])
      setSubCount(subRes.count || 0)
      setDocCount(docRes.count || 0)
      setLoading(false)
    })
  }, [])

  const activeBids = taskOrders.filter(t => ['draft', 'in_progress', 'under_review'].includes(t.status)).length
  const upcomingDeadlines = taskOrders.filter(t => {
    if (!t.due_date) return false
    const days = (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days > 0 && days <= 14
  }).length

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Procurement Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}. Here&#39;s your bid pipeline overview.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/task-orders" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2"><ClipboardList className="text-blue-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeBids}</p>
              <p className="text-xs text-gray-500">Active Bids</p>
            </div>
          </div>
        </Link>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2"><Clock className="text-amber-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{upcomingDeadlines}</p>
              <p className="text-xs text-gray-500">Upcoming Deadlines</p>
            </div>
          </div>
        </div>
        <Link to="/subcontractors" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-2"><Users className="text-green-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{subCount}</p>
              <p className="text-xs text-gray-500">Subcontractors</p>
            </div>
          </div>
        </Link>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 rounded-lg p-2"><FileText className="text-purple-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{docCount}</p>
              <p className="text-xs text-gray-500">Documents Uploaded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link to="/task-orders/new" className="bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors">
          <Plus className="mb-2" size={24} />
          <h3 className="font-semibold">Register Incoming RFQ</h3>
          <p className="text-xs text-blue-200 mt-1">Add a new task order for evaluation</p>
        </Link>
        <Link to="/subcontractors" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Upload className="mb-2 text-green-600" size={24} />
          <h3 className="font-semibold text-gray-900">Subcontractor Database</h3>
          <p className="text-xs text-gray-500 mt-1">Import Excel/CSV or add vendors</p>
        </Link>
        <Link to="/vendor-tracker" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Building className="mb-2 text-purple-600" size={24} />
          <h3 className="font-semibold text-gray-900">Vendor Intelligence</h3>
          <p className="text-xs text-gray-500 mt-1">Track incumbents and performance</p>
        </Link>
        <Link to="/compliance" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Shield className="mb-2 text-indigo-600" size={24} />
          <h3 className="font-semibold text-gray-900">Compliance Matrices</h3>
          <p className="text-xs text-gray-500 mt-1">View generated compliance data</p>
        </Link>
        <Link to="/comparison" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <GitCompareArrows className="mb-2 text-cyan-600" size={24} />
          <h3 className="font-semibold text-gray-900">Compare Task Orders</h3>
          <p className="text-xs text-gray-500 mt-1">Identify changes between task orders</p>
        </Link>
        <Link to="/task-orders" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Download className="mb-2 text-emerald-600" size={24} />
          <h3 className="font-semibold text-gray-900">Export Reports</h3>
          <p className="text-xs text-gray-500 mt-1">Download Excel, PDF, Word exports</p>
        </Link>
      </div>

      {/* Recent Task Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Task Orders</h2>
          <Link to="/task-orders" className="text-sm text-blue-600 hover:underline">View All &rarr;</Link>
        </div>
        {taskOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No task orders registered yet.</p>
            <Link to="/task-orders/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Register your first incoming RFQ</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {taskOrders.slice(0, 5).map(to => (
              <Link key={to.id} to={`/task-orders/${to.id}`} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <h3 className="font-medium text-gray-900">{to.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {to.site_name && <span>{to.site_name}</span>}
                    {to.location_state && <span>{to.location_city}, {to.location_state}</span>}
                    {to.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> Due: {new Date(to.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  to.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                  to.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  to.status === 'under_review' ? 'bg-yellow-100 text-yellow-700' :
                  to.status === 'submitted' ? 'bg-purple-100 text-purple-700' :
                  to.status === 'awarded' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {STATUS_LABELS[to.status] || to.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
