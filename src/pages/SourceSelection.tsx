import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import {
  BarChart3, ArrowLeft, Plus, Trash2, Save, RefreshCw,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface EvalFactor {
  id: string
  name: string
  weight: number
  our_score: number
  competitor_scores: Record<string, number>
}

interface Competitor {
  id: string
  name: string
}

interface SavedModel {
  factors: EvalFactor[]
  competitors: Competitor[]
  updated_at: string
}

export default function SourceSelection() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [factors, setFactors] = useState<EvalFactor[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<SavedModel>(projectId, 'source_selection'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved) {
        setFactors(saved.factors || [])
        setCompetitors(saved.competitors || [])
      } else {
        setFactors([
          { id: 'f1', name: 'Technical Approach', weight: 35, our_score: 80, competitor_scores: {} },
          { id: 'f2', name: 'Management Approach', weight: 25, our_score: 75, competitor_scores: {} },
          { id: 'f3', name: 'Past Performance', weight: 20, our_score: 85, competitor_scores: {} },
          { id: 'f4', name: 'Cost/Price', weight: 20, our_score: 70, competitor_scores: {} },
        ])
        setCompetitors([
          { id: 'c1', name: 'Incumbent' },
          { id: 'c2', name: 'Competitor A' },
        ])
      }
      setLoading(false)
    })
  }, [projectId])

  async function handleSave() {
    if (!projectId) return
    setSaving(true)
    await saveAiOutput(projectId, 'source_selection', { factors, competitors, updated_at: new Date().toISOString() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function totalWeight() {
    return factors.reduce((s, f) => s + f.weight, 0)
  }

  function weightedScore(scores: Record<string, number> | 'ours'): number {
    const tw = totalWeight() || 1
    return Math.round(
      factors.reduce((s, f) => {
        const score = scores === 'ours' ? f.our_score : (f.competitor_scores[scores as unknown as string] ?? 50)
        return s + (score * f.weight / tw)
      }, 0)
    )
  }

  function ourWeightedScore(): number {
    return weightedScore('ours')
  }

  function competitorWeightedScore(compId: string): number {
    const tw = totalWeight() || 1
    return Math.round(
      factors.reduce((s, f) => s + ((f.competitor_scores[compId] ?? 50) * f.weight / tw), 0)
    )
  }

  function addFactor() {
    setFactors(prev => [...prev, {
      id: `f_${Date.now()}`,
      name: 'New Factor',
      weight: 10,
      our_score: 50,
      competitor_scores: Object.fromEntries(competitors.map(c => [c.id, 50])),
    }])
  }

  function addCompetitor() {
    const newComp = { id: `c_${Date.now()}`, name: 'New Competitor' }
    setCompetitors(prev => [...prev, newComp])
    setFactors(prev => prev.map(f => ({ ...f, competitor_scores: { ...f.competitor_scores, [newComp.id]: 50 } })))
  }

  function removeCompetitor(id: string) {
    setCompetitors(prev => prev.filter(c => c.id !== id))
    setFactors(prev => prev.map(f => {
      const { [id]: _, ...rest } = f.competitor_scores
      return { ...f, competitor_scores: rest }
    }))
  }

  function updateFactorScore(factorId: string, field: 'our_score' | string, value: number) {
    setFactors(prev => prev.map(f => {
      if (f.id !== factorId) return f
      if (field === 'our_score') return { ...f, our_score: value }
      return { ...f, competitor_scores: { ...f.competitor_scores, [field]: value } }
    }))
  }

  const rankings = [
    { name: 'Us', score: ourWeightedScore(), color: 'bg-blue-500' },
    ...competitors.map(c => ({ name: c.name, score: competitorWeightedScore(c.id), color: 'bg-gray-400' })),
  ].sort((a, b) => b.score - a.score)

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-cyan-600" size={28} />
            Source Selection Model
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Evaluation factor weighting and win probability'}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <FeatureGuidance
        title="Source Selection Criteria Weighting"
        description="Model how different evaluation factor weights affect your win probability. Compare your estimated scores against competitors to identify where to invest proposal effort."
        storageKey="source_selection"
        accentColor="cyan"
        steps={[
          { title: 'Set evaluation factors and weights', description: 'Add factors from Section M of your RFP. Assign percentage weights (should total 100%).' },
          { title: 'Score yourself and competitors', description: 'Estimate scores 0-100 for each factor. Be honest about competitor strengths.' },
          { title: 'Analyze the results', description: 'The model shows weighted scores and ranking. Adjust weights to see sensitivity — where does investment have the most impact?' },
        ]}
      />

      {/* Ranking Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Weighted Score Ranking</h3>
        <div className="space-y-2">
          {rankings.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
              <span className="text-sm font-medium text-gray-900 w-32 truncate">{r.name}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.name === 'Us' ? 'bg-blue-500' : 'bg-gray-400'}`}
                  style={{ width: `${r.score}%` }}
                />
              </div>
              <span className={`text-sm font-bold min-w-[3rem] text-right ${r.name === 'Us' ? 'text-blue-600' : 'text-gray-600'}`}>{r.score}</span>
            </div>
          ))}
        </div>
        {totalWeight() !== 100 && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <RefreshCw size={10} /> Weights total {totalWeight()}% (should be 100%)
          </p>
        )}
      </div>

      {/* Factor Scoring Matrix */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Factor</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">Weight %</th>
                <th className="text-center px-3 py-3 font-medium text-blue-600 w-20">Us</th>
                {competitors.map(c => (
                  <th key={c.id} className="text-center px-3 py-3 font-medium text-gray-600 w-28">
                    <input
                      value={c.name}
                      onChange={e => setCompetitors(prev => prev.map(pc => pc.id === c.id ? { ...pc, name: e.target.value } : pc))}
                      className="w-full text-center text-xs border-0 bg-transparent focus:ring-0 outline-none"
                    />
                    <button onClick={() => removeCompetitor(c.id)} className="text-[10px] text-red-400 hover:text-red-600">remove</button>
                  </th>
                ))}
                <th className="px-3 py-3 w-10">
                  <button onClick={addCompetitor} className="p-1 text-gray-400 hover:text-gray-600" title="Add competitor">
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {factors.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      value={f.name}
                      onChange={e => setFactors(prev => prev.map(pf => pf.id === f.id ? { ...pf, name: e.target.value } : pf))}
                      className="w-full text-sm border-0 bg-transparent focus:ring-0 outline-none font-medium"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      value={f.weight}
                      onChange={e => setFactors(prev => prev.map(pf => pf.id === f.id ? { ...pf, weight: Number(e.target.value) } : pf))}
                      className="w-16 text-center text-sm border border-gray-200 rounded px-1 py-1"
                      min={0}
                      max={100}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      value={f.our_score}
                      onChange={e => updateFactorScore(f.id, 'our_score', Number(e.target.value))}
                      className="w-16 text-center text-sm border border-blue-200 rounded px-1 py-1 bg-blue-50"
                      min={0}
                      max={100}
                    />
                  </td>
                  {competitors.map(c => (
                    <td key={c.id} className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={f.competitor_scores[c.id] ?? 50}
                        onChange={e => updateFactorScore(f.id, c.id, Number(e.target.value))}
                        className="w-16 text-center text-sm border border-gray-200 rounded px-1 py-1"
                        min={0}
                        max={100}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button onClick={() => setFactors(prev => prev.filter(pf => pf.id !== f.id))} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-2 font-semibold text-gray-700">Weighted Total</td>
                <td className="px-3 py-2 text-center font-bold text-gray-700">{totalWeight()}%</td>
                <td className="px-3 py-2 text-center font-bold text-blue-700">{ourWeightedScore()}</td>
                {competitors.map(c => (
                  <td key={c.id} className="px-3 py-2 text-center font-bold text-gray-700">{competitorWeightedScore(c.id)}</td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button onClick={addFactor} className="text-sm text-cyan-600 hover:text-cyan-800 flex items-center gap-1">
        <Plus size={14} /> Add Factor
      </button>
    </div>
  )
}
