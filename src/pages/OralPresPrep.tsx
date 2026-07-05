import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAIProxy } from '../lib/api'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import {
  Mic, ArrowLeft, Sparkles, Plus, Trash2, Edit2, Check,
  Users, Clock, AlertTriangle, CheckCircle, Save,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Presenter {
  id: string
  name: string
  role: string
  topics: string[]
  time_minutes: number
}

interface ScenarioQuestion {
  id: string
  question: string
  category: string
  suggested_answer: string
  assigned_to: string
  practiced: boolean
}

interface OralPrepData {
  presenters: Presenter[]
  scenario_questions: ScenarioQuestion[]
  logistics: {
    date: string
    time: string
    location: string
    duration_minutes: number
    format: string
  }
  dry_run_dates: string[]
  checklist: { item: string; completed: boolean }[]
  updated_at: string
}

const DEFAULT_CHECKLIST = [
  'Confirm oral presentation date, time, and location',
  'Review RFP oral presentation instructions and constraints',
  'Assign presentation roles and topics',
  'Prepare slide deck / visual aids (if allowed)',
  'Generate and practice scenario questions',
  'Conduct first dry run with internal reviewers',
  'Debrief dry run — identify weak spots',
  'Conduct final dry run with executive reviewers',
  'Prepare backup materials and data books',
  'Confirm A/V equipment and technical requirements',
  'Brief all presenters on logistics and Q&A protocol',
  'Prepare opening and closing statements',
]

export default function OralPresPrep() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [data, setData] = useState<OralPrepData>({
    presenters: [],
    scenario_questions: [],
    logistics: { date: '', time: '', location: '', duration_minutes: 60, format: 'In-person' },
    dry_run_dates: [],
    checklist: DEFAULT_CHECKLIST.map(item => ({ item, completed: false })),
    updated_at: '',
  })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'team' | 'questions' | 'checklist'>('team')

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<OralPrepData>(projectId, 'oral_prep'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved) setData(saved)
      setLoading(false)
    })
  }, [projectId])

  async function handleSave() {
    if (!projectId) return
    setSaving(true)
    await saveAiOutput(projectId, 'oral_prep', { ...data, updated_at: new Date().toISOString() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function generateQuestions() {
    if (!projectId) return
    setGenerating(true)
    setError(null)

    try {
      const analysis = await loadAiOutput<{ summary: string; requirements: { text: string }[]; risks: { risk: string }[] }>(projectId, 'analysis')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a GovCon oral presentation coach. Generate realistic scenario questions that a government evaluation panel would ask during oral presentations. Return valid JSON:
{"questions":[{"id":"q1","question":"Question text","category":"Technical","suggested_answer":"Key points to cover in response","assigned_to":"","practiced":false}]}
Include categories: Technical, Management, Past Performance, Staffing, Transition, Risk, Cost/Price. Focus on probing questions about weaknesses and differentiators.`,
          },
          {
            role: 'user',
            content: analysis?.summary
              ? `Project: ${analysis.summary}\n\nKey requirements: ${analysis.requirements?.slice(0, 8).map(r => r.text).join('; ')}\n\nKey risks: ${analysis.risks?.slice(0, 5).map(r => r.risk).join('; ')}`
              : 'Generate typical oral presentation scenario questions for a federal services contract. Include technical, management, staffing, and cost questions.',
          },
        ],
        temperature: 0.4,
      })

      const content = res.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse response')
      const parsed = JSON.parse(jsonMatch[0])
      setData(prev => ({ ...prev, scenario_questions: parsed.questions || [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function addPresenter() {
    setData(prev => ({
      ...prev,
      presenters: [...prev.presenters, { id: `p_${Date.now()}`, name: '', role: '', topics: [], time_minutes: 10 }],
    }))
  }

  const completedChecklist = data.checklist.filter(c => c.completed).length

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mic className="text-pink-600" size={28} />
            Oral Presentation Prep
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Team assignments, scenario questions, and dry-run checklist'}</p>
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
        title="Oral Presentation Prep"
        description="Structured preparation for oral proposal presentations including team assignments, AI-generated scenario questions, and a dry-run readiness checklist."
        storageKey="oral_prep"
        accentColor="pink"
        steps={[
          { title: 'Assign your presentation team', description: 'Define who presents which topics, with time allocations per person.' },
          { title: 'Generate scenario questions', description: 'AI creates realistic questions the evaluation panel might ask, with suggested answers.' },
          { title: 'Complete the readiness checklist', description: 'Track dry runs, logistics, and preparation tasks to ensure your team is ready.' },
        ]}
      />

      {/* Logistics */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Presentation Logistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input type="date" value={data.logistics.date} onChange={e => setData(prev => ({ ...prev, logistics: { ...prev.logistics, date: e.target.value } }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Time</label>
            <input type="time" value={data.logistics.time} onChange={e => setData(prev => ({ ...prev, logistics: { ...prev.logistics, time: e.target.value } }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Duration (min)</label>
            <input type="number" value={data.logistics.duration_minutes} onChange={e => setData(prev => ({ ...prev, logistics: { ...prev.logistics, duration_minutes: Number(e.target.value) } }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Format</label>
            <select value={data.logistics.format} onChange={e => setData(prev => ({ ...prev, logistics: { ...prev.logistics, format: e.target.value } }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>In-person</option>
              <option>Virtual</option>
              <option>Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
        {[
          { id: 'team' as const, label: 'Presentation Team', count: data.presenters.length },
          { id: 'questions' as const, label: 'Scenario Questions', count: data.scenario_questions.length },
          { id: 'checklist' as const, label: 'Readiness Checklist', count: `${completedChecklist}/${data.checklist.length}` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm rounded-md ${activeTab === tab.id ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === 'team' && (
        <div className="space-y-3">
          {data.presenters.map((p, idx) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={p.name} onChange={e => { const next = [...data.presenters]; next[idx] = { ...p, name: e.target.value }; setData(prev => ({ ...prev, presenters: next })) }} placeholder="Name" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input value={p.role} onChange={e => { const next = [...data.presenters]; next[idx] = { ...p, role: e.target.value }; setData(prev => ({ ...prev, presenters: next })) }} placeholder="Role (e.g., PM, Tech Lead)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input value={p.topics.join(', ')} onChange={e => { const next = [...data.presenters]; next[idx] = { ...p, topics: e.target.value.split(',').map(t => t.trim()) }; setData(prev => ({ ...prev, presenters: next })) }} placeholder="Topics (comma-separated)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <div className="flex items-center gap-2">
                  <input type="number" value={p.time_minutes} onChange={e => { const next = [...data.presenters]; next[idx] = { ...p, time_minutes: Number(e.target.value) }; setData(prev => ({ ...prev, presenters: next })) }} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" /> min
                  <button onClick={() => setData(prev => ({ ...prev, presenters: prev.presenters.filter(x => x.id !== p.id) }))} className="p-1 text-gray-400 hover:text-red-500 ml-auto">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addPresenter} className="w-full py-3 text-sm text-pink-600 hover:bg-pink-50 border border-dashed border-pink-200 rounded-xl flex items-center gap-2 justify-center">
            <Plus size={14} /> Add Presenter
          </button>
          {data.presenters.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={12} />
              Total: {data.presenters.reduce((s, p) => s + p.time_minutes, 0)} min allocated / {data.logistics.duration_minutes} min available
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={generateQuestions} disabled={generating} className="text-sm text-pink-600 hover:text-pink-800 flex items-center gap-1">
              <Sparkles size={14} /> {generating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
          {data.scenario_questions.map((q, idx) => (
            <div key={q.id} className={`bg-white border rounded-xl p-4 ${q.practiced ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => {
                    const next = [...data.scenario_questions]
                    next[idx] = { ...q, practiced: !q.practiced }
                    setData(prev => ({ ...prev, scenario_questions: next }))
                  }}
                  className="flex-shrink-0 mt-0.5"
                >
                  {q.practiced ? <CheckCircle size={16} className="text-green-500" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">{q.category}</span>
                    {q.practiced && <span className="text-[10px] text-green-600 font-medium">Practiced</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{q.question}</p>
                  {q.suggested_answer && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">{q.suggested_answer}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {data.scenario_questions.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Click &ldquo;Generate with AI&rdquo; to create scenario questions based on your project.
            </div>
          )}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-100">
            {data.checklist.map((item, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                <button
                  onClick={() => {
                    const next = [...data.checklist]
                    next[idx] = { ...item, completed: !item.completed }
                    setData(prev => ({ ...prev, checklist: next }))
                  }}
                >
                  {item.completed ? <CheckCircle size={16} className="text-green-500" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />}
                </button>
                <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
