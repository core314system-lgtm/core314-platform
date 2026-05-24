import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface CapacityMetrics {
  active_projects: number
  projects_in_progress: number
  projects_awarded: number
  total_estimated_value: number
  unique_subs_engaged: number
  upcoming_deadlines: { title: string; due_date: string; days_left: number }[]
  capacity_level: 'green' | 'yellow' | 'red'
  recommendation: string
}

interface Props {
  compact?: boolean
}

export default function ResourceCapacity({ compact = false }: Props) {
  const [metrics, setMetrics] = useState<CapacityMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCapacity()
  }, [])

  async function loadCapacity() {
    try {
      const { data: projects } = await supabase
        .from('task_orders')
        .select('id, title, status, due_date, estimated_value')
        .in('status', ['draft', 'in_progress', 'under_review', 'submitted', 'awarded'])

      const allProjects = projects || []
      const inProgress = allProjects.filter(p => ['in_progress', 'under_review'].includes(p.status))
      const awarded = allProjects.filter(p => p.status === 'awarded')

      // Upcoming deadlines
      const now = Date.now()
      const upcoming = allProjects
        .filter(p => p.due_date)
        .map(p => ({
          title: p.title,
          due_date: p.due_date!,
          days_left: Math.ceil((new Date(p.due_date!).getTime() - now) / (1000 * 60 * 60 * 24)),
        }))
        .filter(d => d.days_left > 0 && d.days_left <= 30)
        .sort((a, b) => a.days_left - b.days_left)

      // Total estimated value
      const totalValue = allProjects.reduce((sum: number, p) => {
        const val = parseFloat(p.estimated_value || '0')
        return sum + (isNaN(val) ? 0 : val)
      }, 0)

      // Unique subcontractors
      const { count: subCount } = await supabase
        .from('project_subcontractors')
        .select('subcontractor_id', { count: 'exact', head: true })

      // Determine capacity level
      let level: 'green' | 'yellow' | 'red' = 'green'
      let recommendation = 'Capacity available — good position to take on new work.'

      if (inProgress.length >= 5 || awarded.length >= 3) {
        level = 'red'
        recommendation = 'At capacity — consider deferring new bids until current projects complete or adding team resources.'
      } else if (inProgress.length >= 3 || (upcoming.length > 0 && upcoming[0].days_left <= 7)) {
        level = 'yellow'
        recommendation = 'Moderate load — can take on selective new work. Prioritize opportunities with high win probability.'
      }

      setMetrics({
        active_projects: allProjects.length,
        projects_in_progress: inProgress.length,
        projects_awarded: awarded.length,
        total_estimated_value: totalValue,
        unique_subs_engaged: subCount || 0,
        upcoming_deadlines: upcoming.slice(0, 5),
        capacity_level: level,
        recommendation,
      })
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) return null

  const levelColors = {
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  }

  const colors = levelColors[metrics.capacity_level]

  if (compact) {
    return (
      <div className={`rounded-lg ${colors.bg} ${colors.border} border p-3 flex items-center gap-3`}>
        <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
        <div>
          <span className={`text-sm font-medium ${colors.text}`}>
            {metrics.capacity_level === 'green' ? 'Available' : metrics.capacity_level === 'yellow' ? 'Moderate' : 'At Capacity'}
          </span>
          <span className="text-xs text-gray-500 ml-2">{metrics.projects_in_progress} active bids, {metrics.projects_awarded} awarded</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          Resource Capacity
        </h3>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className={`text-xs font-medium ${colors.text}`}>
            {metrics.capacity_level === 'green' ? 'Capacity Available' : metrics.capacity_level === 'yellow' ? 'Moderate Load' : 'At Capacity'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{metrics.active_projects}</p>
          <p className="text-xs text-gray-500">Active Projects</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-700">{metrics.projects_in_progress}</p>
          <p className="text-xs text-gray-500">Bids In Progress</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-700">{metrics.projects_awarded}</p>
          <p className="text-xs text-gray-500">Currently Awarded</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-700">{metrics.unique_subs_engaged}</p>
          <p className="text-xs text-gray-500">Subs Engaged</p>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-3 rounded-lg ${colors.bg} ${colors.border} border`}>
        <p className={`text-sm ${colors.text}`}>
          {metrics.capacity_level === 'red' && <AlertTriangle size={14} className="inline mr-1" />}
          {metrics.capacity_level === 'green' && <CheckCircle size={14} className="inline mr-1" />}
          {metrics.recommendation}
        </p>
      </div>

      {/* Upcoming Deadlines */}
      {metrics.upcoming_deadlines.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Clock size={12} /> Upcoming Deadlines
          </h4>
          <div className="space-y-1">
            {metrics.upcoming_deadlines.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">{d.title}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  d.days_left <= 3 ? 'bg-red-100 text-red-700' :
                  d.days_left <= 7 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {d.days_left}d left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
