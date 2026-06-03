import { useEffect, useState } from 'react'
import { Brain, Users, FolderOpen, TrendingUp, Zap, FileText, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchAiStats } from '../lib/aiAuditLog'

interface UsageMetrics {
  totalProjects: number
  totalDocuments: number
  totalSubcontractors: number
  totalAiCalls: number
  totalTokens: number
  activeUsers: number
  projectsByStatus: Record<string, number>
  documentsAnalyzed: number
  avgAnalysisTime: number
  estimatedTimeSaved: number
  estimatedCostPerAnalysis: number
}

export default function AiUsageMetrics() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [])

  async function loadMetrics() {
    setLoading(true)
    try {
      const [
        projectsRes,
        docsRes,
        subsRes,
        aiRes,
        usersRes,
        outputsRes,
      ] = await Promise.all([
        supabase.from('task_orders').select('status', { count: 'exact' }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('subcontractors').select('id', { count: 'exact', head: true }),
        fetchAiStats(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('ai_outputs').select('id', { count: 'exact', head: true }),
      ])

      const projects = projectsRes.data || []
      const projectsByStatus: Record<string, number> = {}
      for (const p of projects) {
        const status = (p as { status: string }).status || 'unknown'
        projectsByStatus[status] = (projectsByStatus[status] || 0) + 1
      }

      // Estimate time saved: ~4 hours per document analysis manually, ~30 seconds with AI
      const documentsAnalyzed = outputsRes.count || 0
      const manualHoursPerAnalysis = 4
      const estimatedTimeSaved = documentsAnalyzed * manualHoursPerAnalysis

      // Estimate cost: GPT-4o-mini is ~$0.15/1M input + $0.60/1M output tokens
      const avgCostPer1kTokens = 0.0003
      const estimatedCostPerAnalysis = aiRes.totalCalls > 0
        ? (aiRes.totalTokens * avgCostPer1kTokens / 1000) / aiRes.totalCalls
        : 0

      setMetrics({
        totalProjects: projectsRes.count || 0,
        totalDocuments: docsRes.count || 0,
        totalSubcontractors: subsRes.count || 0,
        totalAiCalls: aiRes.totalCalls,
        totalTokens: aiRes.totalTokens,
        activeUsers: usersRes.count || 0,
        projectsByStatus,
        documentsAnalyzed,
        avgAnalysisTime: aiRes.avgLatency,
        estimatedTimeSaved,
        estimatedCostPerAnalysis,
      })
    } catch (err) {
      console.error('Failed to load usage metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Brain size={24} className="animate-pulse mr-2" /> Loading metrics...
      </div>
    )
  }

  if (!metrics) return null

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    submitted: 'Submitted',
    awarded: 'Awarded',
    not_awarded: 'Not Awarded',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Usage & ROI</h1>
        <p className="text-sm text-gray-500 mt-1">Productivity metrics, usage statistics, and estimated ROI</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <FolderOpen size={14} /> Projects
          </div>
          <div className="text-3xl font-bold text-gray-900">{metrics.totalProjects}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <FileText size={14} /> Documents
          </div>
          <div className="text-3xl font-bold text-gray-900">{metrics.totalDocuments.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Users size={14} /> Subcontractors
          </div>
          <div className="text-3xl font-bold text-gray-900">{metrics.totalSubcontractors.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Users size={14} /> Active Users
          </div>
          <div className="text-3xl font-bold text-gray-900">{metrics.activeUsers}</div>
        </div>
      </div>

      {/* AI Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Brain size={16} /> AI Usage Summary
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total AI Calls</span>
              <span className="text-sm font-bold text-gray-900">{metrics.totalAiCalls.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total Tokens Used</span>
              <span className="text-sm font-bold text-gray-900">
                {metrics.totalTokens >= 1000000 ? `${(metrics.totalTokens / 1000000).toFixed(1)}M` : `${(metrics.totalTokens / 1000).toFixed(1)}K`}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Documents AI-Analyzed</span>
              <span className="text-sm font-bold text-gray-900">{metrics.documentsAnalyzed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Avg. Analysis Time</span>
              <span className="text-sm font-bold text-gray-900">{(metrics.avgAnalysisTime / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} /> Project Pipeline
          </h2>
          <div className="space-y-2">
            {Object.entries(metrics.projectsByStatus).map(([status, count]) => {
              const maxCount = Math.max(...Object.values(metrics.projectsByStatus))
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600">{STATUS_LABELS[status] || status}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${width}%` }} />
                  </div>
                  <div className="text-xs font-bold text-gray-900 w-8 text-right">{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ROI Estimates */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign size={20} className="text-green-600" /> Estimated ROI
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-green-700">{metrics.estimatedTimeSaved.toLocaleString()} hrs</div>
            <div className="text-sm text-gray-600 mt-1">Estimated time saved</div>
            <div className="text-xs text-gray-400 mt-0.5">Based on ~4 hrs manual analysis per document</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-700">${(metrics.estimatedTimeSaved * 75).toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">Labor cost savings</div>
            <div className="text-xs text-gray-400 mt-0.5">At $75/hr avg. analyst rate</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-700">${metrics.estimatedCostPerAnalysis.toFixed(3)}</div>
            <div className="text-sm text-gray-600 mt-1">Avg. AI cost per analysis</div>
            <div className="text-xs text-gray-400 mt-0.5">GPT-4o-mini token cost</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-200 text-sm text-gray-600">
          <Zap size={14} className="inline mr-1 text-green-600" />
          <strong>Productivity multiplier:</strong> AI completes in {(metrics.avgAnalysisTime / 1000).toFixed(0)}s what takes a human analyst ~4 hours — a {metrics.avgAnalysisTime > 0 ? Math.round((4 * 3600 * 1000) / metrics.avgAnalysisTime) : 'N/A'}x speedup.
        </div>
      </div>

      {/* Compliance Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <h3 className="font-semibold mb-1">Reporting for IM3.0 Business Case</h3>
        <p>These metrics support Section D (AI Application Evaluation) of the IM3.0 policy by demonstrating measurable productivity gains, cost efficiency, and responsible AI usage. Time savings and ROI calculations are based on industry benchmarks for manual government contract analysis.</p>
      </div>
    </div>
  )
}
