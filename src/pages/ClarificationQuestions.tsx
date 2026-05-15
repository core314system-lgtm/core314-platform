import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { ClarificationQuestion, TaskOrder } from '../lib/types'
import { HelpCircle, ArrowLeft, Filter, Copy, Wrench } from 'lucide-react'

export default function ClarificationQuestions() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterTrade, setFilterTrade] = useState('all')

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      loadAiOutput<{ questions: ClarificationQuestion[] }>(id, 'clarification_questions').then(data => {
        setQuestions(data?.questions || [])
        setLoading(false)
      })
    }
  }, [id])

  const categories = [...new Set(questions.map(q => q.category))]
  const trades = [...new Set(questions.map(q => q.subcontractor_trade).filter(Boolean))]

  const filtered = questions.filter(q => {
    if (filterCategory !== 'all' && q.category !== filterCategory) return false
    if (filterPriority !== 'all' && q.priority?.toLowerCase() !== filterPriority) return false
    if (filterTrade !== 'all' && q.subcontractor_trade !== filterTrade) return false
    return true
  })

  const criticalCount = questions.filter(q => q.priority?.toLowerCase() === 'critical').length
  const highCount = questions.filter(q => q.priority?.toLowerCase() === 'high').length

  function copyAll() {
    const text = filtered.map((q, i) =>
      `${i + 1}. ${q.question}\n   Trade: ${q.subcontractor_trade || 'General'}\n   Category: ${q.category?.replace(/_/g, ' ')}\n   Priority: ${q.priority}\n   Reference: ${q.source_document} - ${q.section_reference}\n   Impact: ${q.impact || 'Not specified'}`
    ).join('\n\n')
    navigator.clipboard.writeText(text)
    alert('Copied all questions to clipboard!')
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="text-amber-600" size={24} /> Clarification Questions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {questions.length} questions generated from subcontractor perspective
            {criticalCount > 0 && <span className="ml-2 text-red-600 font-medium">({criticalCount} critical, {highCount} high priority)</span>}
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={copyAll} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Copy size={16} /> Copy All
          </button>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <HelpCircle className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No clarification questions generated yet.</p>
          <Link to={`/task-orders/${id}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Task Order
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg border border-gray-200 p-3">
            <Filter size={16} className="text-gray-400" />
            {trades.length > 0 && (
              <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
                <option value="all">All Trades</option>
                {trades.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-sm text-gray-500 ml-auto">{filtered.length} questions</span>
          </div>

          <div className="space-y-3">
            {filtered.map((q, i) => (
              <div key={i} className={`bg-white rounded-xl shadow-sm border p-5 ${
                q.priority?.toLowerCase() === 'critical' ? 'border-red-300 border-l-4 border-l-red-500' :
                q.priority?.toLowerCase() === 'high' ? 'border-orange-200 border-l-4 border-l-orange-400' :
                'border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-sm font-mono min-w-[2rem] text-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium">{q.question}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        q.priority?.toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' :
                        q.priority?.toLowerCase() === 'high' ? 'bg-orange-100 text-orange-700' :
                        q.priority?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{q.priority}</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.category?.replace(/_/g, ' ')}</span>
                      {q.subcontractor_trade && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Wrench size={10} /> {q.subcontractor_trade}
                        </span>
                      )}
                      <span>{q.source_document} - {q.section_reference}</span>
                    </div>
                    {q.impact && (
                      <p className="text-xs text-gray-500 mt-2 bg-amber-50 rounded px-3 py-1.5 border border-amber-100">
                        <strong className="text-amber-700">Impact if not clarified:</strong> {q.impact}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
