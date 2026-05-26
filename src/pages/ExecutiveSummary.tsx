import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput, saveAiOutput } from '../lib/aiStorage'
import { generateExecutiveSummary as generateExecSummary } from '../lib/api'
import { parseFile } from '../lib/documentParser'
import type { ExecutiveSummary as ExecSummaryType, TaskOrder, Document as Doc } from '../lib/types'
import { BarChart3, ArrowLeft, AlertTriangle, CheckCircle, Target, Brain } from 'lucide-react'

export default function ExecutiveSummaryPage() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [summary, setSummary] = useState<ExecSummaryType | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [documents, setDocuments] = useState<Doc[]>([])

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      supabase.from('documents').select('*').eq('task_order_id', id).order('uploaded_at', { ascending: false }).then(({ data }) => setDocuments(data || []))
      loadAiOutput<ExecSummaryType>(id, 'executive_summary').then(data => {
        setSummary(data)
        setLoading(false)
      })
    }
  }, [id])

  async function handleGenerate() {
    if (!id || !taskOrder || documents.length === 0) return
    setGenerating(true)

    try {
      const texts: string[] = []
      const names: string[] = []

      for (const doc of documents) {
        const { data } = await supabase.storage.from('task-order-documents').download(doc.file_path)
        if (data) {
          const file = new File([data], doc.file_name, { type: doc.file_type })
          const text = await parseFile(file)
          texts.push(text)
          names.push(doc.file_name)
        }
      }

      if (texts.length === 0) {
        alert('No document content could be extracted. Please ensure documents are uploaded.')
        return
      }

      const result = await generateExecSummary(texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined) as unknown as ExecSummaryType
      await saveAiOutput(id, 'executive_summary', result)
      setSummary(result)
    } catch (err) {
      alert('Failed to generate executive summary: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Project'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="text-indigo-600" size={24} /> Executive Bid Summary
        </h1>
      </div>

      {!summary ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500 mb-4">No executive summary generated yet.</p>
          {documents.length > 0 ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              <Brain size={18} />
              {generating ? 'Generating Executive Summary...' : 'Generate Executive Summary Now'}
            </button>
          ) : (
            <div>
              <p className="text-sm text-gray-400 mb-3">Upload documents to the project first, then generate the summary.</p>
              <Link to={`/projects/${id}`} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Go to Project
              </Link>
            </div>
          )}
          {generating && (
            <p className="text-sm text-purple-600 mt-3 animate-pulse">AI is analyzing your documents and creating the executive summary. This may take 15-30 seconds...</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Regenerate button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 text-sm bg-purple-50 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
            >
              <Brain size={14} />
              {generating ? 'Regenerating...' : 'Regenerate Summary'}
            </button>
          </div>

          {/* Confidence Rating */}
          <div className={`rounded-xl p-6 border ${
            summary.confidence_rating?.toLowerCase() === 'high' ? 'bg-green-50 border-green-200' :
            summary.confidence_rating?.toLowerCase() === 'medium' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <Target size={24} className={
                summary.confidence_rating?.toLowerCase() === 'high' ? 'text-green-600' :
                summary.confidence_rating?.toLowerCase() === 'medium' ? 'text-yellow-600' :
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
            <h3 className="font-semibold text-gray-900 mb-3">Project Overview</h3>
            <p className="text-gray-700">{summary.overview}</p>
          </div>

          {/* Site Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Site Summary</h3>
            {typeof summary.site_summary === 'string' ? (
              <p className="text-gray-700">{summary.site_summary}</p>
            ) : summary.site_summary && typeof summary.site_summary === 'object' ? (
              <div className="space-y-2 text-gray-700 text-sm">
                {summary.site_summary.site_name && <p><strong>Site:</strong> {summary.site_summary.site_name}</p>}
                {summary.site_summary.address && <p><strong>Address:</strong> {summary.site_summary.address}</p>}
                {summary.site_summary.service_period && <p><strong>Service Period:</strong> {summary.site_summary.service_period}</p>}
                {summary.site_summary.key_details && Object.entries(summary.site_summary.key_details).map(([k, v]) => (
                  <p key={k}><strong>{k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {v}</p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No site summary available.</p>
            )}
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
                    risk.severity?.toLowerCase() === 'critical' || risk.severity?.toLowerCase() === 'high' ? 'bg-red-50 border-red-500' :
                    risk.severity?.toLowerCase() === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                    'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        risk.severity?.toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' :
                        risk.severity?.toLowerCase() === 'high' ? 'bg-orange-100 text-orange-700' :
                        risk.severity?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-700' :
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
                      item.priority?.toLowerCase() === 'critical' || item.priority?.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' :
                      item.priority?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-700' :
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
