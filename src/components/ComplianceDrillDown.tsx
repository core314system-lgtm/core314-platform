import { useState } from 'react'
import { X, CheckCircle2, AlertTriangle, DollarSign, Lightbulb, Send, RotateCcw, Clock, ChevronDown, ChevronUp, Shield, TrendingUp } from 'lucide-react'

interface AnalysisData {
  overall_score: number
  requirements_met: string[]
  requirements_missing: string[]
  pricing_gaps: string[]
  recommendations: string[]
  summary: string
}

interface QuoteRevision {
  id: string
  total_amount: number | null
  ai_compliance_score: number | null
  ai_analyzed_at: string | null
  submitted_at: string | null
  is_revision: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  subName: string
  sowName: string
  score: number
  analysis: AnalysisData | null
  quoteId: string
  analyzedAt: string | null
  totalAmount: number | null
  revisions: QuoteRevision[]
  onReAnalyze: (quoteId: string) => void
  onSendGapResolution: (quoteId: string, gaps: string[], pricingGaps: string[], deadline: string, customMessage: string) => void
  reAnalyzing: boolean
  sendingGap: boolean
}

function scoreColor(score: number) {
  if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Fully Compliant', icon: '🟢' }
  if (score >= 70) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Minor Gaps', icon: '🟡' }
  return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Major Gaps', icon: '🔴' }
}

export default function ComplianceDrillDown({
  open, onClose, subName, sowName, score, analysis, quoteId,
  analyzedAt, totalAmount, revisions,
  onReAnalyze, onSendGapResolution, reAnalyzing, sendingGap,
}: Props) {
  const [showGapForm, setShowGapForm] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [metExpanded, setMetExpanded] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  if (!open) return null

  const sc = scoreColor(score)
  const hasGaps = analysis && (analysis.requirements_missing.length > 0 || analysis.pricing_gaps.length > 0)
  const totalGaps = (analysis?.requirements_missing.length || 0) + (analysis?.pricing_gaps.length || 0)

  function handleSendGap() {
    if (!analysis) return
    onSendGapResolution(
      quoteId,
      analysis.requirements_missing,
      analysis.pricing_gaps,
      deadline,
      customMessage
    )
    setShowGapForm(false)
    setCustomMessage('')
    setDeadline('')
  }

  // Default deadline: 5 business days from now
  function getDefaultDeadline() {
    const d = new Date()
    let bizDays = 0
    while (bizDays < 5) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++
    }
    return d.toISOString().split('T')[0]
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Compliance Analysis</h2>
              <p className="text-sm text-gray-500 mt-0.5">{subName} — {sowName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Score Card */}
          <div className={`${sc.bg} ${sc.border} border rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{sc.icon}</span>
                  <span className={`text-4xl font-black ${sc.text}`}>{score}%</span>
                </div>
                <p className={`text-sm font-semibold ${sc.text} mt-1`}>{sc.label}</p>
              </div>
              <div className="text-right">
                {totalAmount && (
                  <div className="text-sm text-gray-600">
                    Quote: <span className="font-bold">${totalAmount.toLocaleString()}</span>
                  </div>
                )}
                {analyzedAt && (
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end">
                    <Clock size={11} />
                    {new Date(analyzedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
            {analysis?.summary && (
              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{analysis.summary}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onReAnalyze(quoteId)}
              disabled={reAnalyzing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <RotateCcw size={14} className={reAnalyzing ? 'animate-spin' : ''} />
              {reAnalyzing ? 'Analyzing...' : 'Re-Analyze Quote'}
            </button>
            {hasGaps && (
              <button
                onClick={() => {
                  setShowGapForm(true)
                  if (!deadline) setDeadline(getDefaultDeadline())
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
              >
                <Send size={14} />
                Request Gap Resolution
              </button>
            )}
          </div>

          {/* Gap Resolution Form */}
          {showGapForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <Send size={14} /> Send Clarification Request to {subName}
              </h4>
              <p className="text-xs text-blue-700">
                This will email the subcontractor a formal clarification request listing all compliance gaps, with a link to revise their quote.
              </p>

              <div>
                <label className="text-xs font-medium text-gray-700">Response Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Additional Message (optional)</label>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="e.g., Please also include proof of current certifications..."
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="bg-white border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Gaps to be included ({totalGaps}):</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {analysis?.requirements_missing.map((g, i) => (
                    <li key={`m-${i}`} className="flex items-start gap-1.5">
                      <AlertTriangle size={11} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{g}</span>
                    </li>
                  ))}
                  {analysis?.pricing_gaps.map((g, i) => (
                    <li key={`p-${i}`} className="flex items-start gap-1.5">
                      <DollarSign size={11} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowGapForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendGap}
                  disabled={sendingGap || !deadline}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={13} />
                  {sendingGap ? 'Sending...' : 'Send Clarification Request'}
                </button>
              </div>
            </div>
          )}

          {/* Requirements Missing */}
          {analysis && analysis.requirements_missing.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-600" />
                <h4 className="text-sm font-semibold text-red-900">
                  SOW Requirements Not Addressed ({analysis.requirements_missing.length})
                </h4>
              </div>
              <ul className="px-4 pb-4 space-y-2">
                {analysis.requirements_missing.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                    <span className="bg-red-200 text-red-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pricing Gaps */}
          {analysis && analysis.pricing_gaps.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2">
                <DollarSign size={16} className="text-yellow-700" />
                <h4 className="text-sm font-semibold text-yellow-900">
                  Pricing Gaps ({analysis.pricing_gaps.length})
                </h4>
              </div>
              <ul className="px-4 pb-4 space-y-2">
                {analysis.pricing_gaps.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-yellow-800">
                    <span className="bg-yellow-200 text-yellow-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {analysis && analysis.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2">
                <Lightbulb size={16} className="text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">
                  Recommendations ({analysis.recommendations.length})
                </h4>
              </div>
              <ul className="px-4 pb-4 space-y-2">
                {analysis.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="bg-blue-200 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements Met (collapsible) */}
          {analysis && analysis.requirements_met.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setMetExpanded(!metExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <h4 className="text-sm font-semibold text-green-900">
                    Requirements Met ({analysis.requirements_met.length})
                  </h4>
                </div>
                {metExpanded ? <ChevronUp size={16} className="text-green-600" /> : <ChevronDown size={16} className="text-green-600" />}
              </button>
              {metExpanded && (
                <ul className="px-4 pb-4 space-y-1.5">
                  {analysis.requirements_met.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                      <CheckCircle2 size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Revision History (compliance trend) */}
          {revisions.length > 1 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-600" />
                  <h4 className="text-sm font-semibold text-gray-900">
                    Quote History & Compliance Trend ({revisions.length} submissions)
                  </h4>
                </div>
                {historyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {historyExpanded && (
                <div className="px-4 pb-4">
                  <div className="space-y-2">
                    {revisions.map((rev, i) => {
                      const revSc = rev.ai_compliance_score != null ? scoreColor(rev.ai_compliance_score) : null
                      return (
                        <div key={rev.id} className={`flex items-center justify-between p-2.5 rounded-lg ${rev.id === quoteId ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-gray-100'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-4">{i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {rev.total_amount ? `$${rev.total_amount.toLocaleString()}` : 'N/A'}
                                {rev.is_revision && <span className="text-xs text-indigo-500 ml-1.5">(revision)</span>}
                                {rev.id === quoteId && <span className="text-xs text-indigo-600 font-bold ml-1.5">← current</span>}
                              </div>
                              <div className="text-xs text-gray-400">
                                {rev.submitted_at ? new Date(rev.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </div>
                            </div>
                          </div>
                          {revSc ? (
                            <span className={`${revSc.bg} ${revSc.text} px-2.5 py-1 rounded-full text-xs font-bold`}>
                              {rev.ai_compliance_score}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const scored = revisions.filter(r => r.ai_compliance_score != null)
                    if (scored.length < 2) return null
                    const first = scored[scored.length - 1].ai_compliance_score!
                    const last = scored[0].ai_compliance_score!
                    const diff = last - first
                    return (
                      <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${diff > 0 ? 'bg-green-50 text-green-700' : diff < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                        <TrendingUp size={12} className="inline mr-1" />
                        {diff > 0 ? `+${diff}% improvement` : diff < 0 ? `${diff}% decline` : 'No change'} from first to latest submission
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* No analysis data */}
          {!analysis && (
            <div className="text-center py-8 text-gray-400">
              <Shield size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No compliance analysis data available.</p>
              <p className="text-xs mt-1">Click "Re-Analyze Quote" to run the AI compliance check.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
