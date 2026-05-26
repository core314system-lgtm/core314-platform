import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, Clock, DollarSign, Star, MessageSquare, AlertCircle } from 'lucide-react'

interface RelationshipMetrics {
  total_rfqs_sent: number
  total_quotes_received: number
  response_rate: number
  avg_response_days: number
  total_awards: number
  total_projects: number
  win_rate: number
  avg_quote_competitiveness: number // vs other quotes on same SOW
  last_interaction_date: string | null
  relationship_score: number
  tier: 'platinum' | 'gold' | 'silver' | 'new'
}

interface Props {
  subcontractorId: string
  compact?: boolean
}

export default function RelationshipScore({ subcontractorId, compact = false }: Props) {
  const [metrics, setMetrics] = useState<RelationshipMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [subcontractorId])

  async function loadMetrics() {
    try {
      // Get all SOW assignments for this sub
      const { data: sowAssignments } = await supabase
        .from('sow_subcontractors')
        .select('*, sow_items(task_order_id)')
        .eq('subcontractor_id', subcontractorId)

      // Get project-level data
      const { data: projectSubs } = await supabase
        .from('project_subcontractors')
        .select('status, match_score, created_at')
        .eq('subcontractor_id', subcontractorId)

      const assignments = sowAssignments || []
      const projects = projectSubs || []

      const rfqsSent = assignments.filter(a => a.rfq_sent_date).length
      const quotesReceived = assignments.filter(a => a.outreach_status === 'quote_submitted').length
      const responseRate = rfqsSent > 0 ? Math.round((quotesReceived / rfqsSent) * 100) : 0

      // Calculate avg response time
      let totalDays = 0
      let responseCount = 0
      for (const a of assignments) {
        if (a.rfq_sent_date && a.quote_submitted_at) {
          const days = Math.ceil(
            (new Date(a.quote_submitted_at).getTime() - new Date(a.rfq_sent_date).getTime()) / (1000 * 60 * 60 * 24)
          )
          totalDays += days
          responseCount++
        }
      }
      const avgResponseDays = responseCount > 0 ? Math.round(totalDays / responseCount) : 0

      const awards = projects.filter(p => p.status === 'awarded').length
      const totalProjects = projects.length
      const winRate = totalProjects > 0 ? Math.round((awards / totalProjects) * 100) : 0

      // Find last interaction
      const dates = [
        ...assignments.map(a => a.rfq_sent_date).filter(Boolean),
        ...assignments.map(a => a.quote_submitted_at).filter(Boolean),
        ...projects.map(p => p.created_at).filter(Boolean),
      ].sort().reverse()

      const lastInteraction = dates[0] || null

      // Calculate relationship score (0-100)
      let score = 30 // Base score for being in the system
      if (responseRate >= 80) score += 20
      else if (responseRate >= 50) score += 10
      if (avgResponseDays > 0 && avgResponseDays <= 3) score += 15
      else if (avgResponseDays <= 7) score += 8
      if (winRate >= 50) score += 15
      else if (winRate > 0) score += 8
      if (totalProjects >= 3) score += 10
      else if (totalProjects >= 1) score += 5
      if (quotesReceived >= 3) score += 10
      score = Math.min(score, 100)

      // Determine tier
      let tier: RelationshipMetrics['tier'] = 'new'
      if (score >= 80 && totalProjects >= 3) tier = 'platinum'
      else if (score >= 60 && totalProjects >= 2) tier = 'gold'
      else if (score >= 40 || totalProjects >= 1) tier = 'silver'

      setMetrics({
        total_rfqs_sent: rfqsSent,
        total_quotes_received: quotesReceived,
        response_rate: responseRate,
        avg_response_days: avgResponseDays,
        total_awards: awards,
        total_projects: totalProjects,
        win_rate: winRate,
        avg_quote_competitiveness: 0,
        last_interaction_date: lastInteraction,
        relationship_score: score,
        tier,
      })
    } catch {
      // Silently fail for non-critical UI component
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) return null

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'gold': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'silver': return 'bg-gray-100 text-gray-700 border-gray-300'
      default: return 'bg-blue-50 text-blue-700 border-blue-200'
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium capitalize ${getTierColor(metrics.tier)}`}>
          {metrics.tier}
        </span>
        <span className="text-xs text-gray-500">{metrics.relationship_score}pts</span>
        {metrics.response_rate > 0 && (
          <span className="text-xs text-gray-400">{metrics.response_rate}% response</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-2 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
          <Star size={12} className="text-amber-500" /> Relationship Score
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${getTierColor(metrics.tier)}`}>
          {metrics.tier} — {metrics.relationship_score}/100
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{metrics.response_rate}%</p>
          <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
            <MessageSquare size={10} /> Response
          </p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{metrics.avg_response_days || '—'}</p>
          <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
            <Clock size={10} /> Avg Days
          </p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{metrics.total_awards}</p>
          <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
            <TrendingUp size={10} /> Awards
          </p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{metrics.win_rate}%</p>
          <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
            <DollarSign size={10} /> Win Rate
          </p>
        </div>
      </div>
      {!metrics.total_rfqs_sent && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <AlertCircle size={10} /> No RFQ history yet — score will improve with engagement
        </p>
      )}
    </div>
  )
}
