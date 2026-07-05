import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAIProxy } from '../lib/api'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import {
  ShieldAlert, ArrowLeft, Sparkles, AlertTriangle,
  CheckCircle, Scale, FileText,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface ProtestFactor {
  id: string
  factor: string
  risk_level: 'high' | 'medium' | 'low'
  description: string
  mitigation: string
}

interface ProtestAssessment {
  overall_risk: 'high' | 'medium' | 'low'
  risk_score: number
  factors: ProtestFactor[]
  recommended_actions: string[]
  gao_timeline: string
  generated_at: string
}

export default function ProtestRisk() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [assessment, setAssessment] = useState<ProtestAssessment | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<ProtestAssessment>(projectId, 'protest_risk'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved) setAssessment(saved)
      setLoading(false)
    })
  }, [projectId])

  async function generateAssessment() {
    if (!projectId) return
    setGenerating(true)
    setError(null)

    try {
      const { data: project } = await supabase.from('task_orders').select('*').eq('id', projectId).single()
      const analysis = await loadAiOutput<{ summary: string; risks: { risk: string }[] }>(projectId, 'analysis')
      const compIntel = await loadAiOutput<{ competitors: { name: string }[] }>(projectId, 'competitive_intel')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a government contracts protest expert (GAO, COFC, agency-level). Assess protest risk for this procurement. Return valid JSON:
{"overall_risk":"medium","risk_score":55,"factors":[{"id":"f1","factor":"Factor name","risk_level":"medium","description":"Why this is a risk","mitigation":"How to mitigate"}],"recommended_actions":["Action 1"],"gao_timeline":"10 calendar days after award for GAO protest filing deadline"}
Consider: number of competitors, set-aside type, evaluation methodology, incumbent advantage, procurement history, and common protest grounds (evaluation errors, unequal treatment, unstated criteria).`,
          },
          {
            role: 'user',
            content: `Project: ${project?.title}\nValue: $${project?.estimated_value}\nSet-aside: ${project?.set_aside}\nNAICS: ${project?.naics_code}\nVehicle: ${project?.contract_vehicle}\n\n${analysis?.summary || ''}\n\nKnown competitors: ${compIntel?.competitors?.map(c => c.name).join(', ') || 'Unknown'}`,
          },
        ],
        temperature: 0.3,
      })

      const content = res.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse response')
      const parsed = { ...JSON.parse(jsonMatch[0]), generated_at: new Date().toISOString() }
      setAssessment(parsed)
      await saveAiOutput(projectId, 'protest_risk', parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment failed')
    } finally {
      setGenerating(false)
    }
  }

  const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="text-violet-600" size={28} />
            Protest Risk Assessment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'AI-powered protest likelihood analysis'}</p>
        </div>
      </div>

      <FeatureGuidance
        title="Protest Risk Assessment"
        description="AI analyzes the procurement to estimate the likelihood of a GAO or COFC protest based on competitive landscape, set-aside type, procurement methodology, and common protest grounds."
        storageKey="protest_risk"
        accentColor="violet"
        steps={[
          { title: 'Generate assessment', description: 'AI evaluates protest risk factors based on your project details and competitive intelligence.' },
          { title: 'Review risk factors', description: 'Each factor is rated high/medium/low with specific mitigation strategies.' },
          { title: 'Plan accordingly', description: 'High-risk procurements may need protest-proofing strategies in your proposal approach.' },
        ]}
      />

      {!assessment ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Scale className="mx-auto text-gray-400 mb-3" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Assessment Yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            AI will analyze procurement factors to estimate protest likelihood and recommend mitigation strategies.
          </p>
          <button
            onClick={generateAssessment}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {generating ? <><Sparkles size={18} className="animate-pulse" /> Analyzing...</> : <><Sparkles size={18} /> Assess Protest Risk</>}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Risk */}
          <div className={`${RISK_STYLES[assessment.overall_risk].bg} border ${RISK_STYLES[assessment.overall_risk].border} rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {assessment.overall_risk === 'high' ? <ShieldAlert size={24} className="text-red-600" /> :
                 assessment.overall_risk === 'medium' ? <AlertTriangle size={24} className="text-amber-600" /> :
                 <CheckCircle size={24} className="text-green-600" />}
                <div>
                  <p className={`text-lg font-bold ${RISK_STYLES[assessment.overall_risk].text}`}>
                    Protest Risk: {assessment.overall_risk.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-600">{assessment.gao_timeline}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{assessment.risk_score}</p>
                <p className="text-xs text-gray-500">/100</p>
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Risk Factors</h3>
            <div className="space-y-4">
              {assessment.factors.map(factor => {
                const fs = RISK_STYLES[factor.risk_level]
                return (
                  <div key={factor.id} className={`${fs.bg} border ${fs.border} rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${fs.text} ${fs.bg}`}>{factor.risk_level.toUpperCase()}</span>
                      <h4 className="font-medium text-gray-900 text-sm">{factor.factor}</h4>
                    </div>
                    <p className="text-sm text-gray-700">{factor.description}</p>
                    <p className="text-sm text-gray-800 mt-2"><strong>Mitigation:</strong> {factor.mitigation}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommended Actions */}
          {assessment.recommended_actions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-violet-500" /> Recommended Actions
              </h3>
              <ul className="space-y-2">
                {assessment.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={14} className="text-violet-500 mt-0.5 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={generateAssessment} disabled={generating} className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1">
              <Sparkles size={14} /> {generating ? 'Re-analyzing...' : 'Re-analyze'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
