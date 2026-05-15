import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { ExecutiveSummary as ExecSummaryType, TaskOrder } from '../lib/types'
import { BarChart3, ArrowLeft, AlertTriangle, CheckCircle, Target } from 'lucide-react'

export default function ExecutiveSummaryPage() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [summary, setSummary] = useState<ExecSummaryType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      loadAiOutput<ExecSummaryType>(id, 'executive_summary').then(data => {
        setSummary(data)
        setLoading(false)
      })
    }
  }, [id])

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="text-indigo-600" size={24} /> Executive Bid Summary
        </h1>
      </div>

      {!summary ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No executive summary generated yet.</p>
          <Link to={`/task-orders/${id}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Task Order
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Confidence Rating */}
          <div className={`rounded-xl p-6 border ${
            summary.confidence_rating === 'high' ? 'bg-green-50 border-green-200' :
            summary.confidence_rating === 'medium' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Target size={24} className={
                summary.confidence_rating === 'high' ? 'text-green-600' :
                summary.confidence_rating === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              } />
              <div>
                <h3 className="font-semibold text-gray-900">
                  Bid Confidence: <span className="uppercase">{summary.confidence_rating}</span>
                </h3>
                <p className="text-sm text-gray-600">{summary.confidence_rationale}</p>
              </div>
            </div>
          </div>

          {/* Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Task Order Overview</h3>
            <p className="text-gray-700">{summary.overview}</p>
          </div>

          {/* Site Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Site Summary</h3>
            <p className="text-gray-700">{summary.site_summary}</p>
          </div>

          {/* Scope Categories */}
          {summary.scope_categories?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Major Scope Categories</h3>
              <div className="space-y-3">
                {summary.scope_categories.map((cat, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-800">{cat.category}</h4>
                    <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staffing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Staffing Requirements</h3>
            <p className="text-gray-700">{summary.staffing_requirements}</p>
          </div>

          {/* Subcontractor-Heavy Categories */}
          {summary.subcontractor_categories?.length > 0 && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Subcontractor-Heavy Categories</h3>
              <div className="flex flex-wrap gap-2">
                {summary.subcontractor_categories.map((cat, i) => (
                  <span key={i} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">{cat}</span>
                ))}
              </div>
            </div>
          )}

          {/* Major Risks */}
          {summary.major_risks?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Major Risks
              </h3>
              <div className="space-y-3">
                {summary.major_risks.map((risk, i) => (
                  <div key={i} className={`rounded-lg p-4 border-l-4 ${
                    risk.severity === 'critical' || risk.severity === 'high' ? 'bg-red-50 border-red-500' :
                    risk.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        risk.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        risk.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{risk.severity}</span>
                      <h4 className="font-medium text-gray-900">{risk.risk}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Mitigation: {risk.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Assumptions */}
          {summary.pricing_assumptions?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Key Pricing Assumptions</h3>
              <ul className="space-y-2">
                {summary.pricing_assumptions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bid Strategy */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Recommended Bid Strategy</h3>
            <p className="text-gray-700">{summary.bid_strategy}</p>
          </div>

          {/* Action Items */}
          {summary.action_items?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" /> Action Items
              </h3>
              <div className="space-y-2">
                {summary.action_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.action}</p>
                      <p className="text-xs text-gray-500">Owner: {item.owner} | {item.deadline_note}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.priority === 'critical' || item.priority === 'high' ? 'bg-red-100 text-red-700' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{item.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unanswered Questions */}
          {summary.unanswered_questions?.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Unanswered Questions</h3>
              <ul className="space-y-2">
                {summary.unanswered_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-500 mt-0.5">?</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
