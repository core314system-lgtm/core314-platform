import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder } from '../lib/types'
import { loadAllDebriefs, loadIntelligence, type Debrief, type IntelligenceSummary } from '../lib/debriefStorage'
import { getProjectTypeLabel, getWorkflowStage } from '../lib/projectTypes'
import {
  BarChart3, TrendingUp, Target, DollarSign, Clock,
  Award, XCircle, Activity, PieChart, ArrowRight,
  Building2, MapPin, Percent, FileStack
} from 'lucide-react'

interface ProjectStats {
  total: number
  byType: Record<string, number>
  byStage: Record<string, number>
  byState: Record<string, number>
  awarded: number
  notAwarded: number
  active: number
  avgDaysToClose: number
  totalEstimatedValue: number
  upcomingDeadlines: Array<{ id: string; title: string; due_date: string; daysLeft: number }>
  recentProjects: TaskOrder[]
  monthlyCreated: Array<{ month: string; count: number }>
}

function parseValue(val: string | null | undefined): number {
  if (!val) return 0
  const cleaned = val.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export default function Analytics() {
  const [projects, setProjects] = useState<TaskOrder[]>([])
  const [debriefs, setDebriefs] = useState<Debrief[]>([])
  const [intelligence, setIntelligence] = useState<IntelligenceSummary | null>(null)
  const [contractMap, setContractMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('task_orders').select('*').order('created_at', { ascending: false }),
      loadAllDebriefs(),
      loadIntelligence(),
      supabase.from('contracts').select('id, title'),
    ]).then(([toRes, allDebriefs, intel, contractRes]) => {
      setProjects(toRes.data || [])
      setDebriefs(allDebriefs)
      setIntelligence(intel)
      const cMap: Record<string, string> = {}
      for (const c of (contractRes.data || [])) { cMap[c.id] = c.title }
      setContractMap(cMap)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">Loading analytics...</div>

  // Compute stats
  const stats: ProjectStats = {
    total: projects.length,
    byType: {},
    byStage: {},
    byState: {},
    awarded: projects.filter(p => p.status === 'awarded').length,
    notAwarded: projects.filter(p => p.status === 'not_awarded').length,
    active: projects.filter(p => !['awarded', 'not_awarded'].includes(p.status)).length,
    avgDaysToClose: 0,
    totalEstimatedValue: 0,
    upcomingDeadlines: [],
    recentProjects: projects.slice(0, 5),
    monthlyCreated: [],
  }

  // By type
  for (const p of projects) {
    const type = p.project_type || 'government_task_order'
    stats.byType[type] = (stats.byType[type] || 0) + 1
  }

  // By stage
  for (const p of projects) {
    const stage = getWorkflowStage(p.project_type, p.status)
    stats.byStage[stage.label] = (stats.byStage[stage.label] || 0) + 1
  }

  // By state
  for (const p of projects) {
    if (p.location_state) {
      stats.byState[p.location_state] = (stats.byState[p.location_state] || 0) + 1
    }
  }

  // Total estimated value
  stats.totalEstimatedValue = projects.reduce((sum, p) => sum + parseValue(p.estimated_value), 0)

  // Upcoming deadlines (next 30 days)
  const now = Date.now()
  stats.upcomingDeadlines = projects
    .filter(p => p.due_date && !['awarded', 'not_awarded'].includes(p.status))
    .map(p => ({
      id: p.id,
      title: p.title,
      due_date: p.due_date!,
      daysLeft: Math.ceil((new Date(p.due_date!).getTime() - now) / (1000 * 60 * 60 * 24)),
    }))
    .filter(d => d.daysLeft > 0 && d.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Monthly created (last 6 months)
  const monthMap: Record<string, number> = {}
  for (const p of projects) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = (monthMap[key] || 0) + 1
  }
  const sortedMonths = Object.entries(monthMap).sort().slice(-6)
  stats.monthlyCreated = sortedMonths.map(([month, count]) => ({
    month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    count,
  }))

  // Win rate from intelligence or compute from debriefs
  const winRate = intelligence?.win_rate ?? (debriefs.length > 0
    ? Math.round((debriefs.filter(d => d.outcome === 'awarded').length / debriefs.filter(d => ['awarded', 'not_awarded'].includes(d.outcome)).length) * 100) || 0
    : 0)

  const decidedBids = debriefs.filter(d => ['awarded', 'not_awarded'].includes(d.outcome)).length

  // Bar chart helper
  function BarChart({ data, maxVal }: { data: Array<{ label: string; value: number; color?: string }>; maxVal?: number }) {
    const max = maxVal || Math.max(...data.map(d => d.value), 1)
    return (
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-32 truncate text-right">{d.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full ${d.color || 'bg-blue-500'}`}
                style={{ width: `${Math.max((d.value / max) * 100, 2)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="text-blue-600" size={28} />
          Analytics & Intelligence
        </h1>
        <p className="text-sm text-gray-500">Cross-project metrics, win rates, and market trends</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2"><Target className="text-blue-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Projects</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-2"><Percent className="text-green-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{winRate}%</p>
              <p className="text-xs text-gray-500">Win Rate {decidedBids > 0 ? `(${decidedBids} decided)` : '(no debriefs yet)'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2"><Activity className="text-amber-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-xs text-gray-500">Active Projects</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 rounded-lg p-2"><DollarSign className="text-purple-600" size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalEstimatedValue > 0 ? `$${(stats.totalEstimatedValue / 1000000).toFixed(1)}M` : '$0'}
              </p>
              <p className="text-xs text-gray-500">Total Pipeline Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project type distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-blue-600" /> By Project Type
          </h3>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm text-gray-400">No projects yet</p>
          ) : (
            <BarChart
              data={Object.entries(stats.byType).map(([type, count]) => ({
                label: getProjectTypeLabel(type),
                value: count,
                color: 'bg-blue-500',
              }))}
            />
          )}
        </div>

        {/* Stage distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-amber-600" /> By Workflow Stage
          </h3>
          {Object.keys(stats.byStage).length === 0 ? (
            <p className="text-sm text-gray-400">No projects yet</p>
          ) : (
            <BarChart
              data={Object.entries(stats.byStage).map(([stage, count]) => ({
                label: stage,
                value: count,
                color: 'bg-amber-500',
              }))}
            />
          )}
        </div>

        {/* Geographic distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-green-600" /> By State
          </h3>
          {Object.keys(stats.byState).length === 0 ? (
            <p className="text-sm text-gray-400">No location data yet</p>
          ) : (
            <BarChart
              data={Object.entries(stats.byState)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([state, count]) => ({
                  label: state,
                  value: count,
                  color: 'bg-green-500',
                }))}
            />
          )}
        </div>

        {/* By Contract */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileStack size={16} className="text-indigo-600" /> By Contract
          </h3>
          {(() => {
            const byContract: Record<string, number> = { 'Standalone (no contract)': 0 }
            for (const p of projects) {
              const cId = (p as TaskOrder & { contract_id?: string }).contract_id
              if (cId && contractMap[cId]) {
                byContract[contractMap[cId]] = (byContract[contractMap[cId]] || 0) + 1
              } else {
                byContract['Standalone (no contract)'] += 1
              }
            }
            const entries = Object.entries(byContract).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
            return entries.length <= 1 && entries[0]?.[0] === 'Standalone (no contract)' ? (
              <p className="text-sm text-gray-400">No contracts created yet</p>
            ) : (
              <BarChart data={entries.map(([label, value]) => ({ label, value, color: label === 'Standalone (no contract)' ? 'bg-gray-400' : 'bg-indigo-500' }))} />
            )
          })()}
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-600" /> Projects Created (Monthly)
          </h3>
          {stats.monthlyCreated.length === 0 ? (
            <p className="text-sm text-gray-400">No trend data yet</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {stats.monthlyCreated.map(m => {
                const max = Math.max(...stats.monthlyCreated.map(x => x.count), 1)
                const height = Math.max((m.count / max) * 100, 8)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center">
                    <span className="text-xs font-medium text-gray-700 mb-1">{m.count}</span>
                    <div className="w-full bg-purple-500 rounded-t" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-gray-400 mt-1">{m.month}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Win/Loss Analysis (from Intelligence Library data) */}
      {intelligence && decidedBids > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={16} className="text-green-600" /> Win/Loss Summary
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-2xl font-bold text-green-600">{intelligence.wins}</p>
                <p className="text-xs text-gray-500">Wins</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{intelligence.losses}</p>
                <p className="text-xs text-gray-500">Losses</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-500">{intelligence.no_bids}</p>
                <p className="text-xs text-gray-500">No Bids</p>
              </div>
            </div>
            {/* Win rate gauge */}
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full" style={{ width: `${winRate}%` }} />
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">{winRate}% win rate</p>

            {intelligence.pricing_insights.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-gray-500">Pricing Insights:</p>
                {intelligence.pricing_insights.map((ins, i) => (
                  <p key={i} className="text-xs text-gray-600">• {ins}</p>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle size={16} className="text-red-600" /> Top Loss Reasons
            </h3>
            {intelligence.top_loss_reasons.length === 0 ? (
              <p className="text-sm text-gray-400">No loss data yet</p>
            ) : (
              <BarChart
                data={intelligence.top_loss_reasons.slice(0, 6).map(r => ({
                  label: r.reason,
                  value: r.count,
                  color: 'bg-red-500',
                }))}
              />
            )}

            {intelligence.top_strengths.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Top Strengths:</h4>
                <div className="flex flex-wrap gap-1">
                  {intelligence.top_strengths.slice(0, 6).map(s => (
                    <span key={s.strength} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                      {s.strength} ({s.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming deadlines */}
      {stats.upcomingDeadlines.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-red-600" /> Upcoming Deadlines (Next 30 Days)
          </h3>
          <div className="space-y-2">
            {stats.upcomingDeadlines.map(d => (
              <Link
                key={d.id}
                to={`/projects/${d.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  <p className="text-xs text-gray-500">Due: {new Date(d.due_date).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  d.daysLeft <= 3 ? 'bg-red-100 text-red-700' :
                  d.daysLeft <= 7 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {d.daysLeft} day{d.daysLeft !== 1 ? 's' : ''} left
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Competitors (from Intelligence Library) */}
      {intelligence && intelligence.competitors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-indigo-600" /> Competitor Landscape
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Competitor</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">Beat Us</th>
                  <th className="text-center py-2 px-3 text-xs text-gray-500 font-medium">We Won</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Services</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Regions</th>
                </tr>
              </thead>
              <tbody>
                {intelligence.competitors.slice(0, 8).map(c => (
                  <tr key={c.name} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-900">{c.name}</td>
                    <td className="py-2 px-3 text-center text-red-600 font-medium">{c.wins_against_us}</td>
                    <td className="py-2 px-3 text-center text-green-600 font-medium">{c.losses_against_us}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{c.known_services.slice(0, 3).join(', ')}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{c.known_regions.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CTA to Intelligence Library for more */}
      <div className="text-center py-4">
        <Link
          to="/intelligence"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 justify-center"
        >
          View full Intelligence Library for detailed win/loss debriefs <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
