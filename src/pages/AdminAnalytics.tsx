import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  BarChart3, Users, Activity, TrendingDown, FileText, Mail, Brain,
  RefreshCw, Shield
} from 'lucide-react'

interface BetaTester {
  id: string
  email: string
  full_name: string
  created_at: string
  last_sign_in_at: string | null
  beta_agreement_accepted_at: string | null
  current_org_id: string | null
}

interface UsageMetric {
  action_type: string
  count: number
}

interface EmailMetric {
  event_type: string
  count: number
}

export default function AdminAnalytics() {
  const { currentOrg: org } = useOrg()
  const [loading, setLoading] = useState(true)
  const [testers, setTesters] = useState<BetaTester[]>([])
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([])
  const [emailMetrics, setEmailMetrics] = useState<EmailMetric[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [documentCount, setDocumentCount] = useState(0)
  const [aiOutputCount, setAiOutputCount] = useState(0)
  const [subcontractorCount, setSubcontractorCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAnalytics() {
    if (!org?.id) return

    setRefreshing(true)

    // Fetch org members with their profiles
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role, joined_at')
      .eq('org_id', org.id)

    // Get user profiles for those members
    const userIds = (members || []).map(m => m.user_id)
    let profiles: BetaTester[] = []
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, created_at, last_sign_in_at, beta_agreement_accepted_at, current_org_id')
        .in('id', userIds)
      profiles = (data || []) as BetaTester[]
    }
    setTesters(profiles)

    // Fetch usage metrics (rate limiter records)
    const { data: usage } = await supabase
      .from('account_usage')
      .select('action_type')
      .eq('org_id', org.id)

    // Aggregate by action_type
    const usageMap: Record<string, number> = {}
    for (const u of usage || []) {
      usageMap[u.action_type] = (usageMap[u.action_type] || 0) + 1
    }
    setUsageMetrics(Object.entries(usageMap).map(([action_type, count]) => ({ action_type, count })))

    // Fetch email tracking metrics
    const { data: emails } = await supabase
      .from('email_tracking')
      .select('event_type')

    const emailMap: Record<string, number> = {}
    for (const e of emails || []) {
      emailMap[e.event_type] = (emailMap[e.event_type] || 0) + 1
    }
    setEmailMetrics(Object.entries(emailMap).map(([event_type, count]) => ({ event_type, count })))

    // Count projects, documents, AI outputs, subcontractors
    const [
      { count: pCount },
      { count: dCount },
      { count: aCount },
      { count: sCount },
    ] = await Promise.all([
      supabase.from('task_orders').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      supabase.from('ai_outputs').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      supabase.from('subcontractors').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
    ])

    setProjectCount(pCount || 0)
    setDocumentCount(dCount || 0)
    setAiOutputCount(aCount || 0)
    setSubcontractorCount(sCount || 0)

    setRefreshing(false)
    setLoading(false)
  }

  useEffect(() => {
    fetchAnalytics()
  }, [org?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500">
        Loading analytics...
      </div>
    )
  }

  const activeTesters = testers.filter(t => {
    if (!t.last_sign_in_at) return false
    const lastLogin = new Date(t.last_sign_in_at)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return lastLogin > sevenDaysAgo
  })

  const betaAccepted = testers.filter(t => t.beta_agreement_accepted_at)
  const totalUsageActions = usageMetrics.reduce((sum, m) => sum + m.count, 0)
  const totalEmails = emailMetrics.reduce((sum, m) => sum + m.count, 0)
  const bounceRate = emailMetrics.find(m => m.event_type === 'bounced')?.count || 0
  const deliveredCount = emailMetrics.find(m => m.event_type === 'delivered')?.count || 0

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Beta Analytics Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Monitor beta tester activity, feature usage, and platform health</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={refreshing}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Top-level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="Total Beta Testers"
          value={testers.length}
          sub={`${activeTesters.length} active in last 7 days`}
        />
        <MetricCard
          icon={<Shield className="h-5 w-5 text-green-600" />}
          label="Agreement Accepted"
          value={betaAccepted.length}
          sub={`${testers.length - betaAccepted.length} pending`}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5 text-purple-600" />}
          label="Total API Actions"
          value={totalUsageActions}
          sub={`${usageMetrics.length} action types`}
        />
        <MetricCard
          icon={<Mail className="h-5 w-5 text-amber-600" />}
          label="Emails Tracked"
          value={totalEmails}
          sub={`${deliveredCount} delivered, ${bounceRate} bounced`}
        />
      </div>

      {/* Feature Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Feature Usage
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FeatureStat icon={<FileText className="h-4 w-4" />} label="Projects Created" value={projectCount} />
            <FeatureStat icon={<FileText className="h-4 w-4" />} label="Documents Uploaded" value={documentCount} />
            <FeatureStat icon={<Brain className="h-4 w-4" />} label="AI Analyses Run" value={aiOutputCount} />
            <FeatureStat icon={<Users className="h-4 w-4" />} label="Subcontractors Added" value={subcontractorCount} />
          </div>

          {usageMetrics.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">API Usage Breakdown</h3>
              <div className="space-y-2">
                {usageMetrics.sort((a, b) => b.count - a.count).slice(0, 8).map(m => (
                  <div key={m.action_type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate">{m.action_type.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Email Deliverability */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-500" />
            Email Deliverability
          </h2>
          {emailMetrics.length > 0 ? (
            <div className="space-y-3">
              {emailMetrics.sort((a, b) => b.count - a.count).map(m => {
                const colorMap: Record<string, string> = {
                  delivered: 'bg-green-100 text-green-800',
                  opened: 'bg-blue-100 text-blue-800',
                  clicked: 'bg-indigo-100 text-indigo-800',
                  bounced: 'bg-red-100 text-red-800',
                  dropped: 'bg-red-100 text-red-800',
                  sent: 'bg-gray-100 text-gray-800',
                  deferred: 'bg-amber-100 text-amber-800',
                  spam_report: 'bg-red-100 text-red-800',
                }
                return (
                  <div key={m.event_type} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colorMap[m.event_type] || 'bg-gray-100 text-gray-700'}`}>
                      {m.event_type}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{m.count}</span>
                  </div>
                )
              })}
              {deliveredCount > 0 && bounceRate > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    Bounce rate: {((bounceRate / (deliveredCount + bounceRate)) * 100).toFixed(1)}%
                    {bounceRate / (deliveredCount + bounceRate) > 0.05 && ' ⚠️ Above 5% threshold'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No email events tracked yet. Email metrics will appear after RFQs and invites are sent.</p>
          )}
        </div>
      </div>

      {/* Beta Tester List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Beta Testers ({testers.length})
        </h2>
        {testers.length === 0 ? (
          <p className="text-sm text-gray-500">No beta testers onboarded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Joined</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Last Active</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Agreement</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {testers.map(t => {
                  const isActive = t.last_sign_in_at &&
                    new Date(t.last_sign_in_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{t.full_name || '—'}</td>
                      <td className="py-2 px-3 text-gray-600">{t.email}</td>
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-gray-500">
                        {t.last_sign_in_at ? new Date(t.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-2 px-3">
                        {t.beta_agreement_accepted_at ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Accepted</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {isActive ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Inactive</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drop-off Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-red-500" />
          Funnel & Drop-off Analysis
        </h2>
        <div className="space-y-4">
          <FunnelStep step={1} label="Signed Up" count={testers.length} total={testers.length} />
          <FunnelStep step={2} label="Accepted Beta Agreement" count={betaAccepted.length} total={testers.length} />
          <FunnelStep step={3} label="Created First Project" count={projectCount > 0 ? Math.min(testers.length, projectCount) : 0} total={testers.length} />
          <FunnelStep step={4} label="Uploaded Documents" count={documentCount > 0 ? Math.min(testers.length, documentCount) : 0} total={testers.length} />
          <FunnelStep step={5} label="Ran AI Analysis" count={aiOutputCount > 0 ? Math.min(testers.length, aiOutputCount) : 0} total={testers.length} />
          <FunnelStep step={6} label="Active in Last 7 Days" count={activeTesters.length} total={testers.length} />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

function FeatureStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1 text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function FunnelStep({ step, label, count, total }: { step: number; label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-4">
      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-blue-700">{step}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">{count}/{total} ({pct}%)</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
