import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { fetchAIProxy } from '../lib/api'
import {
  Target, ArrowLeft, Sparkles, Plus, Trash2, Edit2, Check,
  AlertTriangle, Star, Zap, Shield, X,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface WinTheme {
  id: string
  theme: string
  discriminator: string
  evidence: string[]
  eval_factor: string
  strength: 'strong' | 'moderate' | 'developing'
}

interface GhostTheme {
  id: string
  competitor: string
  likely_theme: string
  counter_strategy: string
}

interface SavedWinThemes {
  win_themes: WinTheme[]
  ghost_themes: GhostTheme[]
  generated_at: string
}

export default function WinThemes() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [winThemes, setWinThemes] = useState<WinTheme[]>([])
  const [ghostThemes, setGhostThemes] = useState<GhostTheme[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<WinTheme>>({})
  const [activeTab, setActiveTab] = useState<'themes' | 'ghosts'>('themes')

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<SavedWinThemes>(projectId, 'win_themes'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved) {
        setWinThemes(saved.win_themes || [])
        setGhostThemes(saved.ghost_themes || [])
      }
      setLoading(false)
    })
  }, [projectId])

  async function generateThemes() {
    if (!projectId) return
    setGenerating(true)
    setError(null)

    try {
      const analysis = await loadAiOutput<{ requirements: { text: string }[]; summary: string; risks: { risk: string }[] }>(projectId, 'analysis')
      const compIntel = await loadAiOutput<{ competitors: { name: string; strengths: string[] }[] }>(projectId, 'competitive_intel')
      const pastPerf = await loadAiOutput<{ citations: { title: string; agency: string }[] }>(projectId, 'past_performance_matches')

      const context = [
        analysis?.summary ? `Project: ${analysis.summary}` : '',
        analysis?.requirements ? `Requirements:\n${analysis.requirements.slice(0, 10).map(r => `- ${r.text}`).join('\n')}` : '',
        compIntel?.competitors ? `Known Competitors:\n${compIntel.competitors.map(c => `- ${c.name}: ${c.strengths.join(', ')}`).join('\n')}` : '',
        pastPerf?.citations ? `Our Past Performance:\n${pastPerf.citations.slice(0, 5).map(c => `- ${c.title} (${c.agency})`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert GovCon capture strategist. Generate win themes (discriminators) and ghost themes (counter-competitor strategies). Return valid JSON:
{"win_themes":[{"id":"wt1","theme":"Theme statement","discriminator":"What makes us different","evidence":["Evidence point 1"],"eval_factor":"Technical Approach","strength":"strong"}],"ghost_themes":[{"id":"gt1","competitor":"Competitor name or 'Incumbent'","likely_theme":"What they'll likely claim","counter_strategy":"How to neutralize their advantage"}]}
Win themes should be specific, evidence-backed discriminators. Ghost themes should identify competitor advantages and provide counter-strategies.`,
          },
          {
            role: 'user',
            content: context || 'Generate win themes for a federal facilities management contract. We are a mid-size firm with strong past performance in base operations.',
          },
        ],
        temperature: 0.4,
      })

      const content = res.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse AI response')
      const parsed = JSON.parse(jsonMatch[0])
      setWinThemes(parsed.win_themes || [])
      setGhostThemes(parsed.ghost_themes || [])
      await saveAiOutput(projectId, 'win_themes', { ...parsed, generated_at: new Date().toISOString() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function saveThemes(themes: WinTheme[], ghosts: GhostTheme[]) {
    if (projectId) saveAiOutput(projectId, 'win_themes', { win_themes: themes, ghost_themes: ghosts, generated_at: new Date().toISOString() })
  }

  function addTheme() {
    const newTheme: WinTheme = {
      id: `wt_${Date.now()}`,
      theme: '',
      discriminator: '',
      evidence: [],
      eval_factor: '',
      strength: 'developing',
    }
    const next = [...winThemes, newTheme]
    setWinThemes(next)
    setEditingId(newTheme.id)
    setEditForm(newTheme)
    saveThemes(next, ghostThemes)
  }

  function removeTheme(id: string) {
    const next = winThemes.filter(t => t.id !== id)
    setWinThemes(next)
    saveThemes(next, ghostThemes)
  }

  const STRENGTH_STYLES: Record<string, { bg: string; text: string; icon: typeof Star }> = {
    strong: { bg: 'bg-green-100', text: 'text-green-700', icon: Star },
    moderate: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Zap },
    developing: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Shield },
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
            <Target className="text-orange-600" size={28} />
            Win Themes & Discriminators
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Capture strategy differentiators'}</p>
        </div>
      </div>

      <FeatureGuidance
        title="Win Themes & Ghost Themes"
        description="Define what makes your proposal stand out (win themes) and how to neutralize competitor advantages (ghost themes). AI generates initial themes from your project data, competitive intelligence, and past performance."
        storageKey="win_themes"
        accentColor="orange"
        steps={[
          { title: 'Generate themes with AI', description: 'AI analyzes your project, competitive intelligence, and past performance to suggest discriminators.' },
          { title: 'Refine win themes', description: 'Edit themes, add evidence points, and rate their strength. Strong themes should appear in your executive summary and section introductions.' },
          { title: 'Build ghost themes', description: 'Identify what competitors will claim and create counter-strategies to neutralize their advantages without naming them.' },
        ]}
      />

      {winThemes.length === 0 && ghostThemes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Target className="mx-auto text-gray-400 mb-3" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Win Themes Yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Win themes are your proposal&apos;s key differentiators. AI will analyze your project data and competitive landscape to suggest themes.
          </p>
          <button
            onClick={generateThemes}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            {generating ? <><Sparkles size={18} className="animate-pulse" /> Generating...</> : <><Sparkles size={18} /> Generate Win Themes</>}
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
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('themes')}
                className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'themes' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
              >
                Win Themes ({winThemes.length})
              </button>
              <button
                onClick={() => setActiveTab('ghosts')}
                className={`px-3 py-1.5 text-sm rounded-md ${activeTab === 'ghosts' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
              >
                Ghost Themes ({ghostThemes.length})
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateThemes}
                disabled={generating}
                className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1"
              >
                <Sparkles size={14} /> {generating ? 'Generating...' : 'Regenerate'}
              </button>
              {activeTab === 'themes' && (
                <button onClick={addTheme} className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1">
                  <Plus size={14} /> Add Theme
                </button>
              )}
            </div>
          </div>

          {activeTab === 'themes' ? (
            <div className="space-y-3">
              {winThemes.map(theme => {
                const style = STRENGTH_STYLES[theme.strength]
                const StrengthIcon = style.icon
                const isEditing = editingId === theme.id

                return (
                  <div key={theme.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          value={editForm.theme || ''}
                          onChange={e => setEditForm({ ...editForm, theme: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                          placeholder="Win theme statement"
                        />
                        <input
                          value={editForm.discriminator || ''}
                          onChange={e => setEditForm({ ...editForm, discriminator: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="What makes us different"
                        />
                        <div className="flex gap-2">
                          <input
                            value={editForm.eval_factor || ''}
                            onChange={e => setEditForm({ ...editForm, eval_factor: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Evaluation factor"
                          />
                          <select
                            value={editForm.strength || 'developing'}
                            onChange={e => setEditForm({ ...editForm, strength: e.target.value as WinTheme['strength'] })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="strong">Strong</option>
                            <option value="moderate">Moderate</option>
                            <option value="developing">Developing</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const next = winThemes.map(t => t.id === theme.id ? { ...t, ...editForm } as WinTheme : t)
                              setWinThemes(next)
                              saveThemes(next, ghostThemes)
                              setEditingId(null)
                            }}
                            className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs flex items-center gap-1"
                          >
                            <Check size={12} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-gray-500 text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <StrengthIcon size={14} className={style.text} />
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>{theme.strength}</span>
                              {theme.eval_factor && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">{theme.eval_factor}</span>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900">{theme.theme}</h3>
                            <p className="text-sm text-gray-600 mt-1">{theme.discriminator}</p>
                            {theme.evidence.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Supporting Evidence</p>
                                <ul className="text-xs text-gray-600 space-y-0.5">
                                  {theme.evidence.map((e, i) => <li key={i}>&bull; {e}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingId(theme.id); setEditForm(theme) }} className="p-1 text-gray-400 hover:text-gray-600">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => removeTheme(theme.id)} className="p-1 text-gray-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {ghostThemes.map(ghost => (
                <div key={ghost.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <X size={14} className="text-red-500" />
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{ghost.competitor}</span>
                  </div>
                  <p className="text-sm text-gray-600"><strong>Their likely claim:</strong> {ghost.likely_theme}</p>
                  <p className="text-sm text-gray-800 mt-1"><strong>Our counter:</strong> {ghost.counter_strategy}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
