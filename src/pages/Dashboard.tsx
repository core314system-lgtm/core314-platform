import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TaskOrder } from '../lib/types'
import { ClipboardList, Clock, Users, Plus, FileText, Upload, Shield, Building, GitCompareArrows, Kanban, Plug, BarChart3, FileStack, PartyPopper, Rocket, X, ArrowRight, Compass, FolderOpen, AlertTriangle } from 'lucide-react'
import { getWorkflowStage, getStageColor } from '../lib/projectTypes'
import ResourceCapacity from '../components/ResourceCapacity'
import OnboardingGuide from '../components/OnboardingGuide'
import BetaClaimBanner from '../components/BetaClaimBanner'

export default function Dashboard() {
  const { profile } = useAuth()
  const [taskOrders, setTaskOrders] = useState<TaskOrder[]>([])
  const [subCount, setSubCount] = useState(0)
  const [docCount, setDocCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [recentDocs, setRecentDocs] = useState<{ id: string; file_name: string; project_title: string; task_order_id: string }[]>([])

  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      setShowWelcome(true)
      searchParams.delete('subscription')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

      // Load recently viewed documents
      try {
        const recentIds: string[] = JSON.parse(localStorage.getItem('procuvex_recent_docs') || '[]')
        if (recentIds.length > 0) {
          supabase.from('documents').select('id, file_name, task_order_id').in('id', recentIds.slice(0, 5)).then(({ data: rdocs }) => {
            if (rdocs) {
              const projMap = new Map((toRes.data || []).map((p: any) => [p.id, p.title]))
              const ordered = recentIds
                .map(rid => rdocs.find((d: any) => d.id === rid))
                .filter((d): d is any => !!d)
                .map(d => ({ id: d.id, file_name: d.file_name, task_order_id: d.task_order_id, project_title: projMap.get(d.task_order_id) || 'Unknown Project' }))
              setRecentDocs(ordered)
            }
          })
        }
      } catch { /* ignore */ }
    })
  }, [])

  const activeBids = taskOrders.filter(t => ['draft', 'in_progress', 'under_review'].includes(t.status)).length
  const upcomingDeadlines = taskOrders.filter(t => {
    if (!t.due_date) return false
    const days = (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days > 0 && days <= 14
  }).length

  const urgentProjects = taskOrders
    .filter(t => {
      if (!t.due_date) return false
      const days = (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return days > 0 && days <= 7 && !['awarded', 'not_awarded', 'submitted'].includes(t.status)
    })
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Post-checkout welcome modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white text-center relative">
              <button
                onClick={() => setShowWelcome(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
              <PartyPopper size={48} className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Welcome to Procuvex!</h2>
              <p className="text-blue-100 mt-2">Your free trial is now active</p>
            </div>
            <div className="px-8 py-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800 font-medium">Your 7-day free trial has started. You have full access to all features.</p>
              </div>
              <p className="text-sm text-gray-600 mb-6">Here are some things you can do to get started:</p>
              <div className="space-y-3">
                <Link
                  to="/projects/new"
                  onClick={() => setShowWelcome(false)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <div className="bg-blue-100 rounded-lg p-2"><Plus size={16} className="text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Create your first project</p>
                    <p className="text-xs text-gray-500">Upload a SOW or RFP to get started</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </Link>
                <Link
                  to="/opportunities"
                  onClick={() => setShowWelcome(false)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-cyan-50 hover:border-cyan-200 transition-colors"
                >
                  <div className="bg-cyan-100 rounded-lg p-2"><Compass size={16} className="text-cyan-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Find opportunities</p>
                    <p className="text-xs text-gray-500">Browse SAM.gov federal contract opportunities</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </Link>
                <Link
                  to="/subcontractors"
                  onClick={() => setShowWelcome(false)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-colors"
                >
                  <div className="bg-green-100 rounded-lg p-2"><Users size={16} className="text-green-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Import subcontractors</p>
                    <p className="text-xs text-gray-500">Upload your vendor database (Excel/CSV)</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </Link>
                <button
                  onClick={() => { setShowWelcome(false); setShowOnboarding(true) }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-200 transition-colors w-full text-left"
                >
                  <div className="bg-purple-100 rounded-lg p-2"><Rocket size={16} className="text-purple-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Take a guided tour</p>
                    <p className="text-xs text-gray-500">Learn what Procuvex can do for you</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </button>
              </div>
              <button
                onClick={() => setShowWelcome(false)}
                className="w-full mt-6 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip for now — go to dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding guide modal */}
      {showOnboarding && <OnboardingGuide onClose={() => setShowOnboarding(false)} />}
      <BetaClaimBanner />
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
        <Link to="/projects" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
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

      {/* Deadline Alerts */}
      {urgentProjects.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            Upcoming Deadlines ({urgentProjects.length} project{urgentProjects.length !== 1 ? 's' : ''} due within 7 days)
          </h3>
          <div className="space-y-2">
            {urgentProjects.map(p => {
              const daysLeft = Math.ceil((new Date(p.due_date!).getTime() - Date.now()) / 86400000)
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-red-100/60 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-500">Due {new Date(p.due_date!).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    daysLeft <= 1 ? 'bg-red-200 text-red-800' : daysLeft <= 3 ? 'bg-amber-200 text-amber-800' : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {daysLeft <= 1 ? 'TOMORROW' : `${daysLeft} days`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Resource Capacity */}
      <ResourceCapacity />

      {/* Recently Viewed Documents */}
      {recentDocs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock size={14} /> Recently Viewed Documents
            </h3>
            <Link to="/documents" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              <FolderOpen size={12} /> Document Library →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentDocs.map(doc => (
              <Link
                key={doc.id}
                to={`/projects/${doc.task_order_id}`}
                className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors min-w-0 shrink-0"
              >
                <FileText size={14} className="text-blue-500" />
                <span className="truncate max-w-[180px] text-gray-700">{doc.file_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{doc.project_title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link to="/projects/new" className="bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors">
          <Plus className="mb-2" size={24} />
          <h3 className="font-semibold">New Project</h3>
          <p className="text-xs text-blue-200 mt-1">Start a new procurement project</p>
        </Link>
        <Link to="/opportunities" className="bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-xl p-5 hover:from-cyan-700 hover:to-blue-700 transition-colors">
          <Compass className="mb-2" size={24} />
          <h3 className="font-semibold">Opportunity Feed</h3>
          <p className="text-xs text-cyan-200 mt-1">Find & import SAM.gov opportunities</p>
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
          <h3 className="font-semibold text-gray-900">Compare Projects</h3>
          <p className="text-xs text-gray-500 mt-1">Identify changes between projects</p>
        </Link>
        <Link to="/pipeline" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Kanban className="mb-2 text-emerald-600" size={24} />
          <h3 className="font-semibold text-gray-900">Pipeline</h3>
          <p className="text-xs text-gray-500 mt-1">Track projects across workflow stages</p>
        </Link>
        <Link to="/integrations" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <Plug className="mb-2 text-orange-600" size={24} />
          <h3 className="font-semibold text-gray-900">Integrations</h3>
          <p className="text-xs text-gray-500 mt-1">SAM.gov search, bulk import, API</p>
        </Link>
        <Link to="/analytics" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <BarChart3 className="mb-2 text-blue-600" size={24} />
          <h3 className="font-semibold text-gray-900">Analytics</h3>
          <p className="text-xs text-gray-500 mt-1">Cross-project metrics and trends</p>
        </Link>
        <Link to="/contracts" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <FileStack className="mb-2 text-indigo-600" size={24} />
          <h3 className="font-semibold text-gray-900">Contracts</h3>
          <p className="text-xs text-gray-500 mt-1">Manage parent contracts and task orders</p>
        </Link>
      </div>

      {/* Recent Task Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Projects</h2>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">View All &rarr;</Link>
        </div>
        {taskOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No projects registered yet.</p>
            <Link to="/projects/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create your first project</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {taskOrders.slice(0, 5).map(to => (
              <Link key={to.id} to={`/projects/${to.id}`} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
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
                {(() => {
                  const stage = getWorkflowStage(to.project_type, to.status)
                  const colors = getStageColor(stage.color)
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {stage.label}
                    </span>
                  )
                })()}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
