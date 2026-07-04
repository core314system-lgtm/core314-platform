import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Palette, Plus, ArrowLeft, CheckCircle, AlertTriangle, XCircle,
  Calendar, X, Save, ChevronDown, ChevronUp,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Finding {
  section: string
  finding: string
  severity: string
  recommendation: string
  status: string
}

interface ActionItem {
  item: string
  assignee: string
  due_date: string
  status: string
}

interface ColorTeamReview {
  id: string
  task_order_id: string
  review_type: string
  status: string
  scheduled_date: string | null
  completed_date: string | null
  lead_reviewer: string | null
  reviewers: string[]
  overall_rating: string | null
  findings: Finding[]
  action_items: ActionItem[]
  summary: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const REVIEW_TYPES: Record<string, { label: string; color: string; description: string }> = {
  pink_team: {
    label: 'Pink Team',
    color: 'bg-pink-100 text-pink-800 border-pink-300',
    description: 'Early compliance review — verify outline completeness and section assignments',
  },
  red_team: {
    label: 'Red Team',
    color: 'bg-red-100 text-red-800 border-red-300',
    description: 'Final quality review — simulate evaluator scoring, identify weaknesses',
  },
  gold_team: {
    label: 'Gold Team',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'Executive review — final sign-off on pricing, strategy, and submission readiness',
  },
  blue_team: {
    label: 'Blue Team',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Production review — formatting, page counts, submission compliance',
  },
  black_hat: {
    label: 'Black Hat',
    color: 'bg-gray-800 text-white border-gray-600',
    description: 'Competitive analysis — evaluate from competitor\'s perspective',
  },
}

const RATING_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  green: { label: 'Green — Ready', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  yellow: { label: 'Yellow — Needs Work', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  red: { label: 'Red — Major Issues', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled']

export default function ColorTeamReviews() {
  const { id: projectId } = useParams<{ id: string }>()
  const [reviews, setReviews] = useState<ColorTeamReview[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newType, setNewType] = useState('pink_team')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (projectId) fetchReviews()
  }, [projectId])

  async function fetchReviews() {
    setLoading(true)
    const { data } = await supabase
      .from('color_team_reviews')
      .select('*')
      .eq('task_order_id', projectId)
      .order('created_at', { ascending: true })
    setReviews((data as ColorTeamReview[]) || [])
    setLoading(false)
  }

  async function createReview() {
    setSaving(true)
    await supabase.from('color_team_reviews').insert({
      task_order_id: projectId,
      review_type: newType,
      status: 'scheduled',
      findings: [],
      action_items: [],
      reviewers: [],
    })
    setSaving(false)
    setShowCreateForm(false)
    fetchReviews()
  }

  async function updateReview(review: ColorTeamReview) {
    setSaving(true)
    await supabase.from('color_team_reviews').update({
      status: review.status,
      scheduled_date: review.scheduled_date,
      completed_date: review.completed_date,
      lead_reviewer: review.lead_reviewer,
      reviewers: review.reviewers,
      overall_rating: review.overall_rating,
      findings: review.findings,
      action_items: review.action_items,
      summary: review.summary,
      notes: review.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', review.id)
    setSaving(false)
  }

  async function deleteReview(id: string) {
    if (!confirm('Delete this review?')) return
    await supabase.from('color_team_reviews').delete().eq('id', id)
    fetchReviews()
  }

  function updateLocal(id: string, updates: Partial<ColorTeamReview>) {
    setReviews(reviews.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function addFinding(id: string) {
    const review = reviews.find(r => r.id === id)
    if (!review) return
    const newFindings = [...review.findings, { section: '', finding: '', severity: 'medium', recommendation: '', status: 'open' }]
    updateLocal(id, { findings: newFindings })
  }

  function updateFinding(reviewId: string, idx: number, updates: Partial<Finding>) {
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return
    const newFindings = [...review.findings]
    newFindings[idx] = { ...newFindings[idx], ...updates }
    updateLocal(reviewId, { findings: newFindings })
  }

  function removeFinding(reviewId: string, idx: number) {
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return
    updateLocal(reviewId, { findings: review.findings.filter((_, i) => i !== idx) })
  }

  function addActionItem(id: string) {
    const review = reviews.find(r => r.id === id)
    if (!review) return
    const newItems = [...review.action_items, { item: '', assignee: '', due_date: '', status: 'open' }]
    updateLocal(id, { action_items: newItems })
  }

  function updateActionItem(reviewId: string, idx: number, updates: Partial<ActionItem>) {
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return
    const newItems = [...review.action_items]
    newItems[idx] = { ...newItems[idx], ...updates }
    updateLocal(reviewId, { action_items: newItems })
  }

  function removeActionItem(reviewId: string, idx: number) {
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return
    updateLocal(reviewId, { action_items: review.action_items.filter((_, i) => i !== idx) })
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading reviews...</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Palette className="text-blue-600" size={28} />
              Color Team Reviews
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage proposal quality reviews — Pink, Red, Gold, Blue, Black Hat</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Schedule Review
        </button>
      </div>

      <FeatureGuidance
        title="Color Team Reviews"
        description="Schedule and track proposal quality reviews following the industry-standard color team methodology. Each review type serves a specific purpose in the proposal lifecycle."
        storageKey="color_team_reviews"
        accentColor="pink"
        steps={[
          { title: 'Schedule a Pink Team first', description: 'Click "Schedule Review" and select Pink Team. This is your earliest compliance check — verify the outline is complete and writing assignments are clear.' },
          { title: 'Progress through review colors', description: 'Pink → Red → Gold → Blue. Red Team simulates evaluator scoring. Gold Team is executive sign-off. Blue Team checks formatting and submission compliance.' },
          { title: 'Use Black Hat for competitive analysis', description: 'Schedule a Black Hat review to evaluate your proposal from a competitor\'s perspective. Identify where competitors might outscore you.' },
          { title: 'Track findings and action items', description: 'Expand each review to add findings with severity levels, assign action items to team members, and record the overall rating (Green/Yellow/Red).' },
        ]}
      />

      {/* Timeline View */}
      {reviews.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-200">
          <Palette className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Reviews Scheduled</h3>
          <p className="text-sm text-gray-500 mb-4">Schedule color team reviews to ensure proposal quality.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} className="inline mr-1" /> Schedule First Review
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const typeConfig = REVIEW_TYPES[review.review_type] || REVIEW_TYPES.pink_team
            const isExpanded = expandedId === review.id
            const ratingConfig = review.overall_rating ? RATING_CONFIG[review.overall_rating] : null

            return (
              <div key={review.id} className={`bg-white border-2 rounded-xl transition-all ${isExpanded ? 'border-blue-300' : 'border-gray-200'}`}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : review.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <div>
                      <p className="text-xs text-gray-500">{typeConfig.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="capitalize">{review.status.replace('_', ' ')}</span>
                        {review.scheduled_date && (
                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(review.scheduled_date).toLocaleDateString()}</span>
                        )}
                        {review.findings.length > 0 && (
                          <span>{review.findings.length} finding{review.findings.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ratingConfig && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ratingConfig.color}`}>
                        <ratingConfig.icon size={12} /> {ratingConfig.label}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Status & Dates */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select
                          value={review.status}
                          onChange={e => updateLocal(review.id, { status: e.target.value })}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm outline-none"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled</label>
                        <input
                          type="date"
                          value={review.scheduled_date || ''}
                          onChange={e => updateLocal(review.id, { scheduled_date: e.target.value || null })}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Completed</label>
                        <input
                          type="date"
                          value={review.completed_date || ''}
                          onChange={e => updateLocal(review.id, { completed_date: e.target.value || null })}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Overall Rating</label>
                        <select
                          value={review.overall_rating || ''}
                          onChange={e => updateLocal(review.id, { overall_rating: e.target.value || null })}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm outline-none"
                        >
                          <option value="">Not rated</option>
                          {Object.entries(RATING_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Lead & Reviewers */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Lead Reviewer</label>
                      <input
                        type="text"
                        value={review.lead_reviewer || ''}
                        onChange={e => updateLocal(review.id, { lead_reviewer: e.target.value })}
                        placeholder="Name of lead reviewer"
                        className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none"
                      />
                    </div>

                    {/* Summary */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Summary</label>
                      <textarea
                        value={review.summary || ''}
                        onChange={e => updateLocal(review.id, { summary: e.target.value })}
                        rows={2}
                        placeholder="Overall assessment from this review..."
                        className="w-full px-3 py-1.5 border rounded-lg text-sm outline-none resize-none"
                      />
                    </div>

                    {/* Findings */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Findings</h4>
                        <button onClick={() => addFinding(review.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          <Plus size={12} /> Add Finding
                        </button>
                      </div>
                      {review.findings.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No findings recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {review.findings.map((f, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded-lg">
                              <input
                                value={f.section}
                                onChange={e => updateFinding(review.id, i, { section: e.target.value })}
                                placeholder="Section"
                                className="col-span-2 px-2 py-1 border rounded text-xs outline-none"
                              />
                              <input
                                value={f.finding}
                                onChange={e => updateFinding(review.id, i, { finding: e.target.value })}
                                placeholder="Finding description"
                                className="col-span-4 px-2 py-1 border rounded text-xs outline-none"
                              />
                              <select
                                value={f.severity}
                                onChange={e => updateFinding(review.id, i, { severity: e.target.value })}
                                className="col-span-2 px-2 py-1 border rounded text-xs outline-none"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                              <select
                                value={f.status}
                                onChange={e => updateFinding(review.id, i, { status: e.target.value })}
                                className="col-span-2 px-2 py-1 border rounded text-xs outline-none"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">Working</option>
                                <option value="resolved">Resolved</option>
                              </select>
                              <button onClick={() => removeFinding(review.id, i)} className="col-span-1 p-1 hover:bg-red-50 rounded">
                                <X size={12} className="text-gray-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Action Items</h4>
                        <button onClick={() => addActionItem(review.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          <Plus size={12} /> Add Action
                        </button>
                      </div>
                      {review.action_items.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No action items yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {review.action_items.map((a, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded-lg">
                              <input
                                value={a.item}
                                onChange={e => updateActionItem(review.id, i, { item: e.target.value })}
                                placeholder="Action item"
                                className="col-span-4 px-2 py-1 border rounded text-xs outline-none"
                              />
                              <input
                                value={a.assignee}
                                onChange={e => updateActionItem(review.id, i, { assignee: e.target.value })}
                                placeholder="Assignee"
                                className="col-span-3 px-2 py-1 border rounded text-xs outline-none"
                              />
                              <input
                                type="date"
                                value={a.due_date}
                                onChange={e => updateActionItem(review.id, i, { due_date: e.target.value })}
                                className="col-span-2 px-2 py-1 border rounded text-xs outline-none"
                              />
                              <select
                                value={a.status}
                                onChange={e => updateActionItem(review.id, i, { status: e.target.value })}
                                className="col-span-2 px-2 py-1 border rounded text-xs outline-none"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">Working</option>
                                <option value="done">Done</option>
                              </select>
                              <button onClick={() => removeActionItem(review.id, i)} className="col-span-1 p-1 hover:bg-red-50 rounded">
                                <X size={12} className="text-gray-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between pt-3 border-t">
                      <button onClick={() => deleteReview(review.id)} className="text-xs text-red-500 hover:text-red-700">
                        Delete Review
                      </button>
                      <button
                        onClick={() => updateReview(review)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Schedule Review</h2>
            <div className="space-y-3">
              {Object.entries(REVIEW_TYPES).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setNewType(key)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    newType === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mb-1 ${config.color}`}>
                    {config.label}
                  </span>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={createReview}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
