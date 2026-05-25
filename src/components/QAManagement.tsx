import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  MessageSquare, Send, Loader2, CheckCircle, Clock, AlertTriangle,
  FileText, ChevronDown, ChevronUp, Calendar, Brain
} from 'lucide-react'

interface SourceReference {
  document_name: string
  document_id: string
  section: string
  sub_section: string
  page: number | null
  excerpt: string
}

interface OpportunityQuestion {
  id: string
  task_order_id: string
  sow_subcontractor_id: string | null
  subcontractor_id: string | null
  submitted_by_type: 'subcontractor' | 'prime_team'
  question_text: string
  related_section: string | null
  ai_answer: string | null
  ai_confidence_score: number | null
  ai_source_references: SourceReference[]
  official_answer: string | null
  status: string
  question_category: string | null
  is_from_portal: boolean
  created_at: string
  answered_at: string | null
  updated_at: string
}

interface Props {
  taskOrderId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  auto_answered: { label: 'Auto-Answered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending_review: { label: 'Needs Review', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  pending_submission: { label: 'Pending Submission', color: 'bg-blue-100 text-blue-700', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-purple-100 text-purple-700', icon: Send },
  answered: { label: 'Answered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  unanswerable: { label: 'Unanswerable', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-500', icon: Clock },
}

const CATEGORY_LABELS: Record<string, string> = {
  scope: 'Scope', labor_rates: 'Labor Rates', insurance: 'Insurance',
  schedule: 'Schedule', materials: 'Materials', compliance: 'Compliance',
  safety: 'Safety', environmental: 'Environmental', technical_specs: 'Technical Specs',
  payment_terms: 'Payment Terms', subcontracting: 'Subcontracting', bonding: 'Bonding',
  certifications: 'Certifications', general: 'General',
}

export default function QAManagement({ taskOrderId }: Props) {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<OpportunityQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [subNames, setSubNames] = useState<Record<string, string>>({})
  const [questionDeadline, setQuestionDeadline] = useState<string | null>(null)
  const [newQuestion, setNewQuestion] = useState('')
  const [newRelatedSection, setNewRelatedSection] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [reviewAnswer, setReviewAnswer] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState('')
  const [settingDeadline, setSettingDeadline] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [taskOrderId])

  async function loadQuestions() {
    setLoading(true)
    const { data } = await supabase
      .from('opportunity_questions')
      .select('*')
      .eq('task_order_id', taskOrderId)
      .order('created_at', { ascending: false })

    setQuestions(data || [])

    // Load subcontractor names
    if (data?.length) {
      const subIds = [...new Set(data.filter(q => q.subcontractor_id).map(q => q.subcontractor_id!))]
      if (subIds.length > 0) {
        const { data: subs } = await supabase.from('subcontractors').select('id, company_name').in('id', subIds)
        const names: Record<string, string> = {}
        subs?.forEach(s => { names[s.id] = s.company_name })
        setSubNames(names)
      }
    }

    // Load question deadline
    const { data: to } = await supabase.from('task_orders').select('question_deadline').eq('id', taskOrderId).single()
    if (to?.question_deadline) {
      setQuestionDeadline(to.question_deadline)
      setDeadlineInput(to.question_deadline.split('T')[0])
    }

    setLoading(false)
  }

  async function submitPrimeQuestion() {
    if (!newQuestion.trim()) return
    setSubmittingQuestion(true)

    try {
      const res = await fetch('/.netlify/functions/submit-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_order_id: taskOrderId,
          question_text: newQuestion.trim(),
          related_section: newRelatedSection.trim() || null,
          submitted_by_type: 'prime_team',
          user_id: user?.id,
        }),
      })

      if (res.ok) {
        setNewQuestion('')
        setNewRelatedSection('')
        setShowQuestionForm(false)
        loadQuestions()
      } else {
        const err = await res.json()
        alert('Failed to submit: ' + (err.error || 'Unknown error'))
      }
    } catch {
      alert('Failed to submit question')
    } finally {
      setSubmittingQuestion(false)
    }
  }

  async function approveAIAnswer(questionId: string) {
    const { error } = await supabase
      .from('opportunity_questions')
      .update({ status: 'auto_answered', answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', questionId)

    if (!error) loadQuestions()
  }

  async function submitReviewAnswer(questionId: string) {
    if (!reviewAnswer.trim()) return
    setSavingReview(true)

    const { error } = await supabase
      .from('opportunity_questions')
      .update({
        official_answer: reviewAnswer.trim(),
        status: 'answered',
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)

    if (!error) {
      setReviewingId(null)
      setReviewAnswer('')
      loadQuestions()
    }
    setSavingReview(false)
  }

  async function dismissQuestion(questionId: string) {
    const { error } = await supabase
      .from('opportunity_questions')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', questionId)

    if (!error) loadQuestions()
  }

  async function setQuestionDeadlineDate() {
    if (!deadlineInput) return
    setSettingDeadline(true)

    const { error } = await supabase
      .from('task_orders')
      .update({ question_deadline: new Date(deadlineInput).toISOString() })
      .eq('id', taskOrderId)

    if (!error) {
      setQuestionDeadline(new Date(deadlineInput).toISOString())
    }
    setSettingDeadline(false)
  }

  const filtered = questions.filter(q => {
    if (filter === 'all') return q.status !== 'dismissed'
    return q.status === filter
  })

  const statusCounts = questions.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) return <div className="text-sm text-gray-500">Loading Q&A management...</div>

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">AI Q&A Management</h3>
          <span className="text-sm text-gray-500">({questions.length} questions)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuestionForm(!showQuestionForm)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask Question
          </button>
        </div>
      </div>

      {/* Status Summary Badges */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-xs rounded-full font-medium ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All ({questions.filter(q => q.status !== 'dismissed').length})
        </button>
        {Object.entries(statusCounts).filter(([s]) => s !== 'dismissed').map(([status, count]) => {
          const config = STATUS_CONFIG[status]
          if (!config) return null
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-xs rounded-full font-medium ${filter === status ? config.color + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Question Deadline */}
      <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Question Submission Deadline:</span>
          {questionDeadline ? (
            <span className="text-sm text-blue-700 font-medium">
              {new Date(questionDeadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          ) : (
            <span className="text-sm text-gray-400 italic">Not set</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deadlineInput}
            onChange={e => setDeadlineInput(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={setQuestionDeadlineDate}
            disabled={!deadlineInput || settingDeadline}
            className="bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {settingDeadline ? 'Saving...' : 'Set'}
          </button>
        </div>
      </div>

      {/* Prime Team Question Form */}
      {showQuestionForm && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Ask a Question (Prime Team)</h4>
          <p className="text-xs text-blue-600 mb-3">AI will analyze all uploaded documents to find an answer.</p>
          <textarea
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            placeholder="Type your question about the opportunity..."
            rows={3}
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm mb-2"
            autoFocus
          />
          <input
            value={newRelatedSection}
            onChange={e => setNewRelatedSection(e.target.value)}
            placeholder="Related section (optional, e.g., 'Section 3.2 - HVAC Maintenance')"
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setShowQuestionForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              onClick={submitPrimeQuestion}
              disabled={submittingQuestion || !newQuestion.trim()}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submittingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              Analyze & Submit
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {questions.length === 0 ? 'No questions yet. Subcontractors can ask questions through the RFQ portal, or add questions from the prime team above.' : 'No questions match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const config = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending_review
            const isExpanded = expandedQuestion === q.id
            const sourceRefs = (q.ai_source_references || []) as SourceReference[]

            return (
              <div key={q.id} className={`border rounded-lg overflow-hidden ${q.status === 'pending_review' ? 'border-amber-300 bg-amber-50/30' : q.status === 'auto_answered' || q.status === 'answered' ? 'border-green-200' : 'border-gray-200'}`}>
                {/* Question Header */}
                <button
                  onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                  className="w-full text-left p-4 hover:bg-gray-50/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {q.ai_confidence_score !== null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            q.ai_confidence_score >= 95 ? 'bg-green-100 text-green-700' :
                            q.ai_confidence_score >= 70 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {q.ai_confidence_score}%
                          </span>
                        )}
                        {q.question_category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {CATEGORY_LABELS[q.question_category] || q.question_category}
                          </span>
                        )}
                        {q.submitted_by_type === 'prime_team' && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Prime Team</span>
                        )}
                        {q.is_from_portal && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Portal</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 truncate">{q.question_text}</p>
                      {q.subcontractor_id && subNames[q.subcontractor_id] && (
                        <p className="text-xs text-gray-400 mt-0.5">From: {subNames[q.subcontractor_id]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Full Question */}
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Question:</p>
                      <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">{q.question_text}</p>
                      {q.related_section && (
                        <p className="text-xs text-gray-500 mt-1">Related to: {q.related_section}</p>
                      )}
                    </div>

                    {/* AI Answer */}
                    {q.ai_answer && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-blue-600" />
                          AI Answer (Confidence: {q.ai_confidence_score}%):
                        </p>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.ai_answer}</p>
                        </div>
                      </div>
                    )}

                    {/* Source References */}
                    {sourceRefs.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          Source References:
                        </p>
                        <div className="space-y-2">
                          {sourceRefs.map((ref, i) => (
                            <div key={i} className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                              <p className="font-medium text-amber-800">
                                {ref.document_name} &mdash; Section {ref.section}
                                {ref.sub_section !== 'N/A' && ` "${ref.sub_section}"`}
                                {ref.page && `, Page ${ref.page}`}
                              </p>
                              {ref.excerpt && (
                                <p className="text-gray-600 mt-1 italic">&ldquo;{ref.excerpt}&rdquo;</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Official Answer */}
                    {q.official_answer && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Official Answer:</p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.official_answer}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions for pending_review */}
                    {q.status === 'pending_review' && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {q.ai_answer && (
                          <button
                            onClick={() => approveAIAnswer(q.id)}
                            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve AI Answer
                          </button>
                        )}
                        <button
                          onClick={() => { setReviewingId(q.id); setReviewAnswer(q.ai_answer || '') }}
                          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Write Custom Answer
                        </button>
                        <button
                          onClick={() => dismissQuestion(q.id)}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* Review Answer Form */}
                    {reviewingId === q.id && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <textarea
                          value={reviewAnswer}
                          onChange={e => setReviewAnswer(e.target.value)}
                          placeholder="Write or edit the answer..."
                          rows={4}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setReviewingId(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                          <button
                            onClick={() => submitReviewAnswer(q.id)}
                            disabled={savingReview || !reviewAnswer.trim()}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Send Answer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
