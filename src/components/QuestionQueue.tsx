import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Send, Loader2, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface SubQuestion {
  id: string
  question_text: string
  related_section: string | null
  status: string
  answer_text: string | null
  answered_by: string | null
  answered_at: string | null
  shared_with_all: boolean
  created_at: string
  subcontractor_id: string
  sow_item_id: string
  task_order_id: string
  sow_subcontractor_id: string
}

interface Props {
  taskOrderId: string
  sowItemId?: string
}

export default function QuestionQueue({ taskOrderId, sowItemId }: Props) {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<SubQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [shareWithAll, setShareWithAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all')
  const [subNames, setSubNames] = useState<Record<string, string>>({})
  const [sowNames, setSowNames] = useState<Record<string, string>>({})

  useEffect(() => {
    loadQuestions()
  }, [taskOrderId, sowItemId])

  async function loadQuestions() {
    let query = supabase
      .from('subcontractor_questions')
      .select('*')
      .eq('task_order_id', taskOrderId)
      .order('created_at', { ascending: false })

    if (sowItemId) {
      query = query.eq('sow_item_id', sowItemId)
    }

    const { data } = await query
    setQuestions(data || [])

    // Load subcontractor names
    if (data?.length) {
      const subIds = [...new Set(data.map(q => q.subcontractor_id))]
      const { data: subs } = await supabase.from('subcontractors').select('id, company_name').in('id', subIds)
      const names: Record<string, string> = {}
      subs?.forEach(s => { names[s.id] = s.company_name })
      setSubNames(names)

      const sowIds = [...new Set(data.map(q => q.sow_item_id))]
      const { data: sows } = await supabase.from('sow_items').select('id, sow_name').in('id', sowIds)
      const sn: Record<string, string> = {}
      sows?.forEach(s => { sn[s.id] = s.sow_name })
      setSowNames(sn)
    }

    setLoading(false)
  }

  async function submitAnswer(questionId: string) {
    if (!answerText.trim()) return
    setSubmitting(true)

    try {
      const resp = await fetch('/api/answer-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionId,
          answer_text: answerText,
          share_with_all: shareWithAll,
          user_id: user?.id || null,
        }),
      })

      if (resp.ok) {
        setAnswering(null)
        setAnswerText('')
        setShareWithAll(false)
        loadQuestions()
      }
    } catch {
      alert('Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = questions.filter(q => {
    if (filter === 'pending') return q.status === 'pending'
    if (filter === 'answered') return q.status === 'answered' || q.status === 'shared'
    return true
  })

  const pendingCount = questions.filter(q => q.status === 'pending').length

  if (loading) return <div className="text-sm text-gray-500">Loading questions...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Questions from Subcontractors</h3>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'answered'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                filter === f ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? `All (${questions.length})` : f === 'pending' ? `Pending (${pendingCount})` : `Answered (${questions.length - pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {questions.length === 0 ? 'No questions received yet.' : 'No questions match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <div key={q.id} className={`border rounded-lg p-4 ${q.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{subNames[q.subcontractor_id] || 'Unknown'}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{sowNames[q.sow_item_id] || ''}</span>
                    {q.shared_with_all && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Users className="w-3 h-3" /> Shared
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{q.question_text}</p>
                  {q.related_section && (
                    <p className="text-xs text-gray-400 mt-1">Re: {q.related_section}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    q.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    q.status === 'shared' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {q.status === 'pending' ? 'Pending' : q.status === 'shared' ? 'Shared' : 'Answered'}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Answer display */}
              {q.answer_text && (
                <div className="mt-3 ml-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <p className="text-sm text-gray-700">{q.answer_text}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Answered {q.answered_at ? new Date(q.answered_at).toLocaleDateString() : ''}
                    {q.shared_with_all ? ' • Shared with all bidders' : ' • Private response'}
                  </p>
                </div>
              )}

              {/* Answer form */}
              {q.status === 'pending' && answering !== q.id && (
                <button
                  onClick={() => { setAnswering(q.id); setAnswerText(''); setShareWithAll(false) }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Reply to this question
                </button>
              )}

              {answering === q.id && (
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <textarea
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={shareWithAll}
                        onChange={e => setShareWithAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      Share answer with all bidders for this SOW
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAnswering(null)}
                        className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => submitAnswer(q.id)}
                        disabled={submitting || !answerText.trim()}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Send Answer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
