import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import {
  Calendar, ArrowLeft, Plus, Trash2, Edit2, Check, Save,
  AlertTriangle, CheckCircle, Clock,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Milestone {
  id: string
  title: string
  date: string
  category: 'rfp' | 'internal' | 'review' | 'submission' | 'post_submission'
  completed: boolean
  notes: string
  owner: string
}

interface SavedSchedule {
  milestones: Milestone[]
  updated_at: string
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  rfp: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'RFP Deadline' },
  internal: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Internal' },
  review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Review' },
  submission: { bg: 'bg-red-100', text: 'text-red-700', label: 'Submission' },
  post_submission: { bg: 'bg-green-100', text: 'text-green-700', label: 'Post-Submission' },
}

function defaultMilestones(dueDate: string | null): Milestone[] {
  const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000)
  const d = (offset: number) => {
    const dt = new Date(due.getTime() + offset * 86400000)
    return dt.toISOString().split('T')[0]
  }

  return [
    { id: 'm1', title: 'RFP Release', date: d(-60), category: 'rfp', completed: false, notes: '', owner: '' },
    { id: 'm2', title: 'Site Visit / Industry Day', date: d(-50), category: 'rfp', completed: false, notes: '', owner: '' },
    { id: 'm3', title: 'Questions Due to CO', date: d(-40), category: 'rfp', completed: false, notes: '', owner: '' },
    { id: 'm4', title: 'Government Answers Published', date: d(-30), category: 'rfp', completed: false, notes: '', owner: '' },
    { id: 'm5', title: 'Kickoff Meeting — Proposal Team', date: d(-55), category: 'internal', completed: false, notes: '', owner: 'Proposal Manager' },
    { id: 'm6', title: 'Annotated Outline Complete', date: d(-45), category: 'internal', completed: false, notes: '', owner: 'Volume Leads' },
    { id: 'm7', title: 'Storyboards / Section Drafts Due', date: d(-35), category: 'internal', completed: false, notes: '', owner: 'Volume Leads' },
    { id: 'm8', title: 'Pink Team Review', date: d(-30), category: 'review', completed: false, notes: 'Initial compliance & completeness review', owner: 'Review Team' },
    { id: 'm9', title: 'Pink Team Debrief & Revisions', date: d(-27), category: 'review', completed: false, notes: '', owner: 'Volume Leads' },
    { id: 'm10', title: 'Red Team Review', date: d(-18), category: 'review', completed: false, notes: 'Full proposal review against evaluation criteria', owner: 'Review Team' },
    { id: 'm11', title: 'Red Team Debrief & Revisions', date: d(-15), category: 'review', completed: false, notes: '', owner: 'Volume Leads' },
    { id: 'm12', title: 'Gold Team Review (Executive)', date: d(-10), category: 'review', completed: false, notes: 'Final pricing & strategy review', owner: 'Executive Team' },
    { id: 'm13', title: 'Final Production & QC', date: d(-5), category: 'internal', completed: false, notes: 'Formatting, pagination, compliance check', owner: 'Production Team' },
    { id: 'm14', title: 'Proposal Submission', date: d(0), category: 'submission', completed: false, notes: '', owner: 'Proposal Manager' },
    { id: 'm15', title: 'Oral Presentations (if required)', date: d(14), category: 'post_submission', completed: false, notes: '', owner: '' },
    { id: 'm16', title: 'Award Decision (estimated)', date: d(60), category: 'post_submission', completed: false, notes: '', owner: '' },
  ]
}

export default function ProposalSchedule() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Milestone>>({})

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title, due_date').eq('id', projectId).single(),
      loadAiOutput<SavedSchedule>(projectId, 'proposal_schedule'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved?.milestones?.length) {
        setMilestones(saved.milestones)
      } else {
        setMilestones(defaultMilestones(proj?.due_date || null))
      }
      setLoading(false)
    })
  }, [projectId])

  async function handleSave() {
    if (!projectId) return
    setSaving(true)
    await saveAiOutput(projectId, 'proposal_schedule', { milestones, updated_at: new Date().toISOString() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addMilestone() {
    const newMs: Milestone = {
      id: `m_${Date.now()}`,
      title: '',
      date: new Date().toISOString().split('T')[0],
      category: 'internal',
      completed: false,
      notes: '',
      owner: '',
    }
    setMilestones(prev => [...prev, newMs].sort((a, b) => a.date.localeCompare(b.date)))
    setEditingId(newMs.id)
    setEditForm(newMs)
  }

  function removeMilestone(id: string) {
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  function toggleComplete(id: string) {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m))
  }

  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))
  const today = new Date().toISOString().split('T')[0]
  const completedCount = milestones.filter(m => m.completed).length

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-emerald-600" size={28} />
            Proposal Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Milestones and deadlines'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{completedCount}/{milestones.length} complete</span>
          <button onClick={addMilestone} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50">
            <Plus size={14} /> Add
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <FeatureGuidance
        title="Proposal Schedule & Milestone Tracker"
        description="A Shipley-aligned proposal timeline from RFP release through submission and award. Track internal deadlines, color team reviews, and external milestones."
        storageKey="proposal_schedule"
        accentColor="emerald"
        steps={[
          { title: 'Review auto-generated milestones', description: 'A default Shipley schedule is created based on your proposal due date. Adjust dates as needed.' },
          { title: 'Add custom milestones', description: 'Add milestones for your specific process — teaming agreement deadlines, pricing workshops, client meetings.' },
          { title: 'Track completion', description: 'Check off milestones as they are completed. Overdue items are highlighted in red.' },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {sorted.map(ms => {
            const style = CATEGORY_STYLES[ms.category]
            const isOverdue = !ms.completed && ms.date < today
            const isToday = ms.date === today
            const isEditing = editingId === ms.id

            return (
              <div key={ms.id} className={`px-5 py-3 ${ms.completed ? 'bg-gray-50/50' : isOverdue ? 'bg-red-50/30' : ''}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={editForm.title || ''}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Milestone title"
                      />
                      <input
                        type="date"
                        value={editForm.date || ''}
                        onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={editForm.category || 'internal'}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value as Milestone['category'] })}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="rfp">RFP Deadline</option>
                        <option value="internal">Internal</option>
                        <option value="review">Review</option>
                        <option value="submission">Submission</option>
                        <option value="post_submission">Post-Submission</option>
                      </select>
                      <input
                        value={editForm.owner || ''}
                        onChange={e => setEditForm({ ...editForm, owner: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Owner / assigned to"
                      />
                    </div>
                    <input
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      placeholder="Notes"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMilestones(prev => prev.map(m => m.id === ms.id ? { ...m, ...editForm } as Milestone : m))
                          setEditingId(null)
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs flex items-center gap-1"
                      >
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 text-gray-500 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleComplete(ms.id)} className="flex-shrink-0">
                      {ms.completed ? (
                        <CheckCircle size={18} className="text-green-500" />
                      ) : isOverdue ? (
                        <AlertTriangle size={18} className="text-red-500" />
                      ) : (
                        <Clock size={18} className="text-gray-300" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${ms.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {ms.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                        {isToday && <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] font-medium">TODAY</span>}
                        {isOverdue && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">OVERDUE</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{new Date(ms.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {ms.owner && <span>→ {ms.owner}</span>}
                        {ms.notes && <span className="text-gray-400 truncate max-w-xs">{ms.notes}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingId(ms.id); setEditForm(ms) }} className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => removeMilestone(ms.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
