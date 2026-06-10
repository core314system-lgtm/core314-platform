import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAIProxy } from '../lib/api'
import { logAiCall } from '../lib/aiAuditLog'
import type { TaskOrder } from '../lib/types'
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Users, DollarSign, Shield, Calendar, ArrowLeft, Loader2 } from 'lucide-react'

interface BidDecision {
  recommendation: 'bid' | 'no_bid' | 'conditional_bid'
  confidence_score: number
  overall_score: number
  factors: {
    category: string
    score: number
    weight: number
    reasoning: string
    risk_level: 'low' | 'medium' | 'high'
  }[]
  strengths: string[]
  weaknesses: string[]
  conditions?: string[]
  estimated_win_probability: number
  suggested_markup_range: { min: number; max: number }
  competitive_landscape: string
  resource_assessment: string
}

export default function BidDecisionEngine() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [decision, setDecision] = useState<BidDecision | null>(null)
  const [historicalData, setHistoricalData] = useState<{
    totalBids: number
    wonBids: number
    avgMarkup: number
    similarProjects: number
  }>({ totalBids: 0, wonBids: 0, avgMarkup: 0, similarProjects: 0 })

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    const [toRes, allProjectsRes] = await Promise.all([
      supabase.from('task_orders').select('*').eq('id', id).single(),
      supabase.from('task_orders').select('status, estimated_value, project_type, naics_code'),
    ])
    setTaskOrder(toRes.data)

    // Calculate historical win rate
    const allProjects = allProjectsRes.data || []
    const total = allProjects.filter(p => ['submitted', 'awarded', 'not_awarded'].includes(p.status)).length
    const won = allProjects.filter(p => p.status === 'awarded').length
    const similar = allProjects.filter(p =>
      p.project_type === toRes.data?.project_type || p.naics_code === toRes.data?.naics_code
    ).length

    setHistoricalData({
      totalBids: total,
      wonBids: won,
      avgMarkup: 10, // Default
      similarProjects: similar,
    })

    // Load saved decision if any
    const { data: saved } = await supabase
      .from('ai_outputs')
      .select('output_data')
      .eq('task_order_id', id)
      .eq('output_type', 'bid_decision')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (saved?.output_data) {
      try { setDecision(JSON.parse(saved.output_data)) } catch { /* ignore */ }
    }

    setLoading(false)
  }

  async function runAnalysis() {
    if (!taskOrder || !id) return
    setAnalyzing(true)

    try {
      // Get project documents/analysis
      const { data: analysisData } = await supabase
        .from('ai_outputs')
        .select('output_data')
        .eq('task_order_id', id)
        .eq('output_type', 'analysis')
        .limit(1)
        .single()

      const { count: subCount } = await supabase
        .from('subcontractors')
        .select('id', { count: 'exact', head: true })

      const { count: masterSubCount } = await supabase
        .from('master_subcontractors')
        .select('id', { count: 'exact', head: true })

      // Query SOW items for trade coverage data
      const { data: sowItems } = await supabase
        .from('sow_items')
        .select('id, sow_name, service_category, status')
        .eq('task_order_id', id)

      // Query sow_subcontractors for assigned/invited subs per SOW
      const sowSubCoverage: { trade: string; assigned: number; invited: number; quoted: number }[] = []
      if (sowItems?.length) {
        const sowIds = sowItems.map(s => s.id)
        const { data: sowSubs } = await supabase
          .from('sow_subcontractors')
          .select('sow_item_id, outreach_status')
          .in('sow_item_id', sowIds)

        for (const sow of sowItems) {
          const relatedSubs = (sowSubs || []).filter(ss => ss.sow_item_id === sow.id)
          sowSubCoverage.push({
            trade: sow.service_category || sow.sow_name,
            assigned: relatedSubs.length,
            invited: relatedSubs.filter(s => s.outreach_status === 'invited').length,
            quoted: relatedSubs.filter(s => s.outreach_status === 'quote_submitted').length,
          })
        }
      }

      // Query project_subcontractors (both old and new schema)
      const { data: projectSubs } = await supabase
        .from('project_subcontractors')
        .select('match_score')
        .eq('task_order_id', id)

      const totalMatchedSubs = (projectSubs?.length || 0) + sowSubCoverage.reduce((sum, s) => sum + s.assigned, 0)
      const avgMatchScore = projectSubs?.length
        ? Math.round(projectSubs.reduce((a, b) => a + (b.match_score || 0), 0) / projectSubs.length)
        : 0

      const winRate = historicalData.totalBids > 0
        ? Math.round((historicalData.wonBids / historicalData.totalBids) * 100)
        : 0

      // Build SOW coverage summary for the prompt
      const sowCoverageText = sowSubCoverage.length > 0
        ? `\nSOW TRADE COVERAGE (from AI Project Matching):\n${sowSubCoverage.map(s =>
            `- ${s.trade}: ${s.assigned} subs assigned, ${s.invited} invited, ${s.quoted} quotes received`
          ).join('\n')}\n- Total SOW trades: ${sowItems?.length || 0}\n- Trades with subs assigned: ${sowSubCoverage.filter(s => s.assigned > 0).length}/${sowItems?.length || 0}`
        : '\nNo SOW trade coverage data available (AI Project Matching has not been run).'

      const prompt = `You are a bid decision analyst for a government facilities management contractor. Analyze this opportunity and provide a data-driven bid/no-bid recommendation.

PROJECT DETAILS:
- Title: ${taskOrder.title}
- Solicitation: ${taskOrder.solicitation_number || 'Not specified'}
- Location: ${taskOrder.location_city}, ${taskOrder.location_state}
- Due Date: ${taskOrder.due_date || 'Not specified'}
- Estimated Value: ${taskOrder.estimated_value || 'Unknown'}
- NAICS Code: ${taskOrder.naics_code || 'Not specified'}
- Set-Aside: ${taskOrder.set_aside || 'Full and open'}
- Project Type: ${taskOrder.project_type || 'government_task_order'}

ORGANIZATIONAL CONTEXT:
- Historical win rate: ${winRate}% (${historicalData.wonBids} wins out of ${historicalData.totalBids} bids)
- Total subcontractors in org database: ${subCount || 0}
- Total subcontractors in master network: ${masterSubCount || 0}
- Subcontractors matched to this project: ${totalMatchedSubs}
- Average match score: ${avgMatchScore}%
- Similar past projects: ${historicalData.similarProjects}
${sowCoverageText}

${analysisData?.output_data ? `AI ANALYSIS SUMMARY:\n${analysisData.output_data.substring(0, 2000)}` : 'No AI analysis available yet.'}

Respond with ONLY valid JSON matching this structure:
{
  "recommendation": "bid" | "no_bid" | "conditional_bid",
  "confidence_score": 0-100,
  "overall_score": 0-100,
  "factors": [
    { "category": "string", "score": 0-100, "weight": 0.0-1.0, "reasoning": "string", "risk_level": "low|medium|high" }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "conditions": ["string (only if conditional_bid)"],
  "estimated_win_probability": 0-100,
  "suggested_markup_range": { "min": number, "max": number },
  "competitive_landscape": "brief assessment",
  "resource_assessment": "brief assessment"
}

Include factors for: Capability Alignment, Geographic Proximity, Workforce Capacity, Competitive Position, Risk Profile, Timeline Feasibility, Financial Viability, Past Performance Relevance. Be honest and data-driven.`

      const bidStart = Date.now()
      const resp = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      })

      const content = resp.choices[0]?.message?.content || '{}'
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed: BidDecision = JSON.parse(cleaned)
      setDecision(parsed)

      const bidUsage = resp.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      const { data: { user: bidUser } } = await supabase.auth.getUser()
      logAiCall({
        user_id: bidUser?.id || 'anonymous',
        request_type: 'bid_decision',
        model: resp.model || 'gpt-4o-mini',
        prompt_tokens: bidUsage.prompt_tokens,
        completion_tokens: bidUsage.completion_tokens,
        total_tokens: bidUsage.total_tokens,
        task_order_id: id || null,
        task_order_title: taskOrder?.title || null,
        response_summary: content.slice(0, 200),
        latency_ms: Date.now() - bidStart,
        status: 'success',
      })

      // Save to DB
      await supabase.from('ai_outputs').upsert({
        task_order_id: id,
        output_type: 'bid_decision',
        output_data: JSON.stringify(parsed),
        created_at: new Date().toISOString(),
      }, { onConflict: 'task_order_id,output_type' })

    } catch (err) {
      console.error('Bid decision analysis failed:', err)
      alert('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Project not found</div>

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'bid': return 'bg-green-100 text-green-800 border-green-300'
      case 'no_bid': return 'bg-red-100 text-red-800 border-red-300'
      case 'conditional_bid': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRecommendationLabel = (rec: string) => {
    switch (rec) {
      case 'bid': return 'RECOMMEND: BID'
      case 'no_bid': return 'RECOMMEND: NO BID'
      case 'conditional_bid': return 'RECOMMEND: CONDITIONAL BID'
      default: return rec
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="text-purple-600" size={24} />
            Bid/No-Bid Decision Engine
          </h1>
          <p className="text-sm text-gray-500">{taskOrder.title}</p>
        </div>
      </div>

      {/* Historical Context Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Target size={16} />
            <span>Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {historicalData.totalBids > 0 ? Math.round((historicalData.wonBids / historicalData.totalBids) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-400">{historicalData.wonBids}/{historicalData.totalBids} bids won</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>Similar Projects</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{historicalData.similarProjects}</p>
          <p className="text-xs text-gray-400">Same type/NAICS</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <DollarSign size={16} />
            <span>Est. Value</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{taskOrder.estimated_value || 'N/A'}</p>
          <p className="text-xs text-gray-400">{taskOrder.set_aside || 'Full & open'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={16} />
            <span>Days to Due</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {taskOrder.due_date ? Math.max(0, Math.ceil((new Date(taskOrder.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 'N/A'}
          </p>
          <p className="text-xs text-gray-400">{taskOrder.due_date ? new Date(taskOrder.due_date).toLocaleDateString() : 'No deadline set'}</p>
        </div>
      </div>

      {/* Run Analysis Button */}
      {!decision && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Brain size={48} className="mx-auto text-purple-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Bid Decision Analysis</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-lg mx-auto">
            The AI will evaluate this opportunity against your organizational capabilities, historical win rate,
            subcontractor availability, geographic proximity, risk factors, and competitive positioning.
          </p>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {analyzing ? <><Loader2 size={18} className="animate-spin" /> Analyzing opportunity...</> : <><Brain size={18} /> Run Bid Decision Analysis</>}
          </button>
        </div>
      )}

      {/* Decision Results */}
      {decision && (
        <>
          {/* Main Recommendation */}
          <div className={`rounded-xl border-2 p-6 ${getRecommendationColor(decision.recommendation)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {decision.recommendation === 'bid' ? <CheckCircle size={28} /> :
                 decision.recommendation === 'no_bid' ? <TrendingDown size={28} /> :
                 <AlertTriangle size={28} />}
                <div>
                  <h2 className="text-xl font-bold">{getRecommendationLabel(decision.recommendation)}</h2>
                  <p className="text-sm opacity-80">Confidence: {decision.confidence_score}% | Win Probability: {decision.estimated_win_probability}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{decision.overall_score}</p>
                <p className="text-xs opacity-70">Overall Score</p>
              </div>
            </div>
            {decision.conditions && decision.conditions.length > 0 && (
              <div className="mt-4 border-t border-current border-opacity-20 pt-3">
                <p className="font-medium text-sm mb-1">Conditions for bidding:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {decision.conditions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Suggested Markup */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-green-600" />
                <span className="font-medium text-gray-900">Suggested Markup Range</span>
              </div>
              <span className="text-lg font-bold text-green-700">
                {decision.suggested_markup_range.min}% — {decision.suggested_markup_range.max}%
              </span>
            </div>
          </div>

          {/* Factor Scores */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Factors</h3>
            <div className="space-y-4">
              {decision.factors.map((factor, i) => (
                <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{factor.category}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        factor.risk_level === 'low' ? 'bg-green-50 text-green-700' :
                        factor.risk_level === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}>{factor.risk_level} risk</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{factor.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                    <div
                      className={`h-2 rounded-full ${
                        factor.score >= 70 ? 'bg-green-500' : factor.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{factor.reasoning}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-green-200 p-5">
              <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
                <TrendingUp size={18} /> Strengths
              </h4>
              <ul className="space-y-2">
                {decision.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-5">
              <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                <TrendingDown size={18} /> Weaknesses
              </h4>
              <ul className="space-y-2">
                {decision.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Competitive & Resource Assessment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <Shield size={18} className="text-blue-600" /> Competitive Landscape
              </h4>
              <p className="text-sm text-gray-600">{decision.competitive_landscape}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <Users size={18} className="text-purple-600" /> Resource Assessment
              </h4>
              <p className="text-sm text-gray-600">{decision.resource_assessment}</p>
            </div>
          </div>

          {/* Re-run */}
          <div className="text-center">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {analyzing ? 'Re-analyzing...' : '↻ Re-run Analysis'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
