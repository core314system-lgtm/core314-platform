import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAIProxy } from '../lib/api'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import {
  Users, ArrowLeft, Sparkles, Star, CheckCircle, AlertTriangle,
  Building, Award, Shield,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface PartnerMatch {
  id: string
  company_name: string
  relevance_score: number
  strengths: string[]
  gaps_filled: string[]
  certifications: string[]
  risk_factors: string[]
  recommendation: 'highly_recommended' | 'recommended' | 'conditional' | 'not_recommended'
}

interface SavedEvaluation {
  matches: PartnerMatch[]
  generated_at: string
}

export default function TeamingEvaluator() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [matches, setMatches] = useState<PartnerMatch[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title, naics_code, set_aside, estimated_value').eq('id', projectId).single(),
      loadAiOutput<SavedEvaluation>(projectId, 'teaming_evaluation'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved?.matches) setMatches(saved.matches)
      setLoading(false)
    })
  }, [projectId])

  async function evaluatePartners() {
    if (!projectId) return
    setGenerating(true)
    setError(null)

    try {
      const [{ data: project }, { data: subs }, { data: teamingAgreements }] = await Promise.all([
        supabase.from('task_orders').select('*').eq('id', projectId).single(),
        supabase.from('subcontractors').select('*').limit(50),
        supabase.from('teaming_agreements').select('*').limit(20),
      ])

      const analysis = await loadAiOutput<{ requirements: { text: string; category: string }[]; summary: string }>(projectId, 'analysis')

      const subsText = (subs || []).map(s =>
        `- ${s.company_name}: services=[${(s.service_categories || []).join(',')}], certs=[${(s.certifications || []).join(',')}], SB=${s.small_business ? 'Yes' : 'No'}, preferred=${s.preferred}`
      ).join('\n')

      const teamingText = (teamingAgreements || []).map(t =>
        `- ${t.partner_name}: role=${t.partner_role}, status=${t.agreement_status}, workshare=${t.workshare_percent}%`
      ).join('\n')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a GovCon teaming strategy expert. Evaluate subcontractors as potential teaming partners for this project. Return valid JSON:
{"matches":[{"id":"p1","company_name":"Name","relevance_score":85,"strengths":["Why good"],"gaps_filled":["What gap they fill"],"certifications":["8(a)","HUBZone"],"risk_factors":["Potential issues"],"recommendation":"highly_recommended"}]}
Score 0-100. recommendation: highly_recommended (80+), recommended (60-79), conditional (40-59), not_recommended (<40).`,
          },
          {
            role: 'user',
            content: `Project: ${project?.title}\nNAICS: ${project?.naics_code}\nSet-aside: ${project?.set_aside}\nValue: $${project?.estimated_value}\n\n${analysis?.summary ? `Summary: ${analysis.summary}` : ''}\n\nAvailable Subcontractors:\n${subsText}\n\nExisting Teaming Agreements:\n${teamingText}`,
          },
        ],
        temperature: 0.3,
      })

      const content = res.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse response')
      const parsed = JSON.parse(jsonMatch[0])
      const sorted = (parsed.matches || []).sort((a: PartnerMatch, b: PartnerMatch) => b.relevance_score - a.relevance_score)
      setMatches(sorted)
      await saveAiOutput(projectId, 'teaming_evaluation', { matches: sorted, generated_at: new Date().toISOString() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed')
    } finally {
      setGenerating(false)
    }
  }

  const REC_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    highly_recommended: { bg: 'bg-green-100', text: 'text-green-700', label: 'Highly Recommended' },
    recommended: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Recommended' },
    conditional: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Conditional' },
    not_recommended: { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Recommended' },
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-teal-600" size={28} />
            Teaming Partner Evaluator
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'AI-scored partner recommendations'}</p>
        </div>
      </div>

      <FeatureGuidance
        title="AI Teaming Partner Evaluator"
        description="Evaluates your subcontractor database against the project requirements to recommend optimal teaming partners. Considers NAICS overlap, certifications, set-aside eligibility, and past performance relevance."
        storageKey="teaming_evaluator"
        accentColor="teal"
        steps={[
          { title: 'Click "Evaluate Partners"', description: 'AI analyzes your subcontractor database against this project\'s requirements, NAICS codes, and set-aside type.' },
          { title: 'Review scored recommendations', description: 'Each partner is scored 0-100 on relevance with specific strengths, gaps filled, and risk factors.' },
          { title: 'Initiate teaming agreements', description: 'For recommended partners, navigate to the Teaming Tracker to formalize the relationship.' },
        ]}
      />

      {matches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users className="mx-auto text-gray-400 mb-3" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Evaluations Yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            AI will evaluate your subcontractor database to find the best teaming partners for this project.
          </p>
          <button
            onClick={evaluatePartners}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {generating ? <><Sparkles size={18} className="animate-pulse" /> Evaluating...</> : <><Sparkles size={18} /> Evaluate Partners</>}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={evaluatePartners} disabled={generating} className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1">
              <Sparkles size={14} /> {generating ? 'Re-evaluating...' : 'Re-evaluate'}
            </button>
          </div>
          {matches.map(match => {
            const rec = REC_STYLES[match.recommendation]
            return (
              <div key={match.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Building size={20} className="text-teal-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{match.company_name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${rec.bg} ${rec.text}`}>{rec.label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-amber-500" />
                      <span className="text-lg font-bold text-gray-900">{match.relevance_score}</span>
                      <span className="text-xs text-gray-400">/100</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {match.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><CheckCircle size={10} className="text-green-500" /> Strengths</p>
                      <ul className="text-gray-700 space-y-0.5">{match.strengths.map((s, i) => <li key={i}>&bull; {s}</li>)}</ul>
                    </div>
                  )}
                  {match.gaps_filled.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Shield size={10} className="text-blue-500" /> Gaps Filled</p>
                      <ul className="text-gray-700 space-y-0.5">{match.gaps_filled.map((g, i) => <li key={i}>&bull; {g}</li>)}</ul>
                    </div>
                  )}
                  {match.certifications.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Award size={10} className="text-purple-500" /> Certifications</p>
                      <div className="flex flex-wrap gap-1">{match.certifications.map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">{c}</span>
                      ))}</div>
                    </div>
                  )}
                  {match.risk_factors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500" /> Risk Factors</p>
                      <ul className="text-gray-700 space-y-0.5">{match.risk_factors.map((r, i) => <li key={i}>&bull; {r}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
