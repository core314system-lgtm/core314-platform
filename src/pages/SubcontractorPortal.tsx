import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Building, FileText, Send, MessageSquare, CheckCircle, Clock, AlertTriangle, X, Loader2, Brain } from 'lucide-react'

interface PortalData {
  task_order: {
    title: string
    site_name: string
    location_city: string
    location_state: string
    due_date: string | null
    solicitation_number: string
    notes: string | null
  }
  sow: {
    id: string
    sow_name: string
    service_category: string
    description: string | null
  }
  subcontractor: {
    company_name: string
    contact_name: string | null
  }
  rfq_due_date: string | null
  outreach_status: string
  form_template: {
    id: string
    name: string
    fields: FormField[]
  }
  existing_quote: any | null
  questions: Question[]
  ai_questions: AIQuestion[]
  documents: any[]
  question_deadline: string | null
}

interface FormField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  is_required: boolean
  help_text: string | null
  placeholder: string | null
  options: string[] | null
  display_order: number
  is_default_field: boolean
  default_field_key: string | null
}

interface Question {
  id: string
  question_text: string
  related_section: string | null
  status: string
  answer_text: string | null
  shared_with_all: boolean
  created_at: string
  subcontractor_id: string
}

interface SourceRef {
  document_name: string
  section: string
  sub_section: string
  page: number | null
  excerpt: string
}

interface AIQuestion {
  id: string
  question_text: string
  related_section: string | null
  status: string
  ai_answer: string | null
  ai_confidence_score: number | null
  ai_source_references: SourceRef[]
  question_category: string | null
  created_at: string
  answered_at: string | null
}

export default function SubcontractorPortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'quote' | 'questions' | 'documents'>('quote')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [questionSection, setQuestionSection] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [aiResult, setAiResult] = useState<{ status: string; ai_analysis?: { answer_text?: string; confidence_score?: number; source_references?: SourceRef[]; question_category?: string } } | null>(null)

  useEffect(() => {
    if (!token) return
    fetchPortalData()
  }, [token])

  async function fetchPortalData() {
    try {
      const resp = await fetch(`/api/portal-api?token=${token}`)
      if (!resp.ok) {
        const err = await resp.json()
        setError(err.error || 'Failed to load portal data')
        return
      }
      const portalData = await resp.json()
      setData(portalData)
      if (portalData.existing_quote) setSubmitted(true)
      if (portalData.outreach_status === 'declined') setDeclined(true)
    } catch {
      setError('Failed to load portal. Please check your link and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitQuote() {
    if (!data || !token) return

    const requiredFields = data.form_template.fields.filter(f => f.is_required)
    for (const field of requiredFields) {
      const key = field.default_field_key || field.id
      if (!formValues[key]?.trim()) {
        setError(`"${field.field_label}" is required.`)
        return
      }
    }

    setSubmitting(true)
    setError('')

    try {
      const quoteData: Record<string, any> = {}
      const customFields: Record<string, any> = {}

      for (const field of data.form_template.fields) {
        const key = field.default_field_key || field.id
        const val = formValues[key]
        if (!val) continue

        if (field.is_default_field && field.default_field_key) {
          quoteData[field.default_field_key] = field.field_type === 'currency' || field.field_type === 'number'
            ? parseFloat(val)
            : val
        } else {
          customFields[field.id] = val
        }
      }

      const resp = await fetch('/api/portal-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'submit_quote',
          quote_data: quoteData,
          custom_fields: customFields,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        setError(err.error || 'Failed to submit quote')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Failed to submit quote. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitQuestion() {
    if (!token || !questionText.trim()) return
    setSubmittingQuestion(true)

    try {
      const resp = await fetch('/api/portal-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'submit_question',
          question_text: questionText,
          related_section: questionSection || null,
        }),
      })

      if (resp.ok) {
        const result = await resp.json()
        setAiResult(result)
        setQuestionText('')
        setQuestionSection('')
        fetchPortalData()
      }
    } catch {
      // silent fail
    } finally {
      setSubmittingQuestion(false)
    }
  }

  async function handleDecline() {
    if (!token) return
    try {
      await fetch('/api/portal-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'decline', reason: declineReason }),
      })
      setDeclined(true)
      setShowDeclineModal(false)
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your RFQ...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Error</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400 mt-4">If you believe this is an error, please contact the sender of your RFQ email.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  if (declined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <X className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">RFQ Declined</h1>
          <p className="text-gray-600">You have declined this request for quote. Thank you for letting us know.</p>
        </div>
      </div>
    )
  }

  const dueDate = data.rfq_due_date || data.task_order.due_date
  const formattedDue = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Building className="w-6 h-6" />
            <span className="text-sm font-medium opacity-80">Procuvex — A Core314 Technologies LLC Product</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Request for Quote</h1>
          <p className="text-blue-200">{data.task_order.title}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome & Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <p className="text-gray-800 mb-4">
            Dear <strong>{data.subcontractor.contact_name || data.subcontractor.company_name}</strong>,
            you are invited to submit a quote for the following scope of work.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Scope of Work</div>
              <div className="font-semibold text-gray-900">{data.sow.sow_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Service Category</div>
              <div className="font-semibold text-gray-900">{data.sow.service_category}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Site Location</div>
              <div className="font-semibold text-gray-900">{data.task_order.site_name}, {data.task_order.location_city}, {data.task_order.location_state}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Response Due</div>
              <div className="font-semibold text-red-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formattedDue}
              </div>
            </div>
          </div>
          {data.sow.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-1">Scope Description</div>
              <p className="text-sm text-gray-600">{data.sow.description}</p>
            </div>
          )}
          {data.task_order.notes && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="text-sm font-medium text-blue-800 mb-1">Additional Notes</div>
              <p className="text-sm text-blue-700">{data.task_order.notes}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {[
            { key: 'quote' as const, label: 'Submit Quote', icon: FileText },
            { key: 'questions' as const, label: `Questions${(data.ai_questions?.length || data.questions.length) ? ` (${data.ai_questions?.length || data.questions.length})` : ''}`, icon: MessageSquare },
            { key: 'documents' as const, label: `Documents${data.documents.length ? ` (${data.documents.length})` : ''}`, icon: FileText },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quote Form Tab */}
        {activeTab === 'quote' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Submitted!</h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  Thank you for your submission. The team will review your quote and follow up if they have any questions.
                </p>
                {data.existing_quote && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg inline-block">
                    <div className="text-sm text-green-700">
                      Submitted Amount: <strong>${Number(data.existing_quote.total_amount || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Quote Details</h2>
                <p className="text-sm text-gray-500 mb-6">Complete the fields below to submit your quote. Required fields are marked with *</p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {data.form_template.fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
                      </label>
                      {field.help_text && (
                        <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>
                      )}
                      {field.field_type === 'textarea' ? (
                        <textarea
                          value={formValues[field.default_field_key || field.id] || ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.default_field_key || field.id]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : field.field_type === 'select' && field.options ? (
                        <select
                          value={formValues[field.default_field_key || field.id] || ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.default_field_key || field.id]: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.field_type === 'checkbox' ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formValues[field.default_field_key || field.id] === 'true'}
                            onChange={e => setFormValues(prev => ({ ...prev, [field.default_field_key || field.id]: e.target.checked ? 'true' : 'false' }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">{field.placeholder || 'Yes'}</span>
                        </label>
                      ) : (
                        <input
                          type={field.field_type === 'currency' || field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          value={formValues[field.default_field_key || field.id] || ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.default_field_key || field.id]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                          step={field.field_type === 'currency' ? '0.01' : undefined}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowDeclineModal(true)}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Decline to Quote
                  </button>
                  <button
                    onClick={handleSubmitQuote}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Quote
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* AI Result Banner */}
            {aiResult && (
              <div className={`rounded-xl shadow-sm border p-6 ${
                aiResult.status === 'auto_answered' ? 'bg-green-50 border-green-200' :
                aiResult.status === 'pending_review' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  <Brain className={`w-5 h-5 mt-0.5 ${
                    aiResult.status === 'auto_answered' ? 'text-green-600' :
                    aiResult.status === 'pending_review' ? 'text-amber-600' :
                    'text-blue-600'
                  }`} />
                  <div className="flex-1">
                    {aiResult.status === 'auto_answered' && aiResult.ai_analysis?.answer_text ? (
                      <>
                        <h3 className="font-bold text-green-800 mb-2">Answer Found in Documentation</h3>
                        <p className="text-sm text-gray-800 mb-3">{aiResult.ai_analysis.answer_text}</p>
                        {aiResult.ai_analysis.source_references?.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-green-200">
                            <p className="text-xs font-medium text-gray-600 mb-1">Source:</p>
                            {aiResult.ai_analysis.source_references.map((ref: SourceRef, i: number) => (
                              <p key={i} className="text-xs text-gray-600">
                                <span className="font-medium">{ref.document_name}</span> &mdash; Section {ref.section}
                                {ref.sub_section !== 'N/A' && ` "${ref.sub_section}"`}
                                {ref.page && `, Page ${ref.page}`}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : aiResult.status === 'pending_review' ? (
                      <>
                        <h3 className="font-bold text-amber-800 mb-1">Question Under Review</h3>
                        <p className="text-sm text-gray-700">We found some related information but want to verify before sharing. We will follow up shortly.</p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-blue-800 mb-1">Question Submitted for Clarification</h3>
                        <p className="text-sm text-gray-700">
                          Your question has been added to our formal clarification request
                          {data.question_deadline && (
                            <>, which will be submitted on <strong>{new Date(data.question_deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></>
                          )}.
                          You will be notified when an answer is available.
                        </p>
                      </>
                    )}
                  </div>
                  <button onClick={() => setAiResult(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {/* AI-Analyzed Q&A */}
            {(data.ai_questions?.length > 0 || data.questions.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Questions & Answers</h2>
                <div className="space-y-4">
                  {/* AI-analyzed questions first */}
                  {data.ai_questions?.map(q => (
                    <div key={q.id} className={`border rounded-lg p-4 ${
                      q.status === 'auto_answered' || q.status === 'answered' ? 'border-green-200 bg-green-50/30' :
                      q.status === 'pending_submission' || q.status === 'submitted' ? 'border-blue-200 bg-blue-50/30' :
                      'border-gray-200'
                    }`}>
                      <div className="flex items-start gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                          {q.related_section && (
                            <span className="text-xs text-gray-400">Re: {q.related_section}</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          q.status === 'auto_answered' || q.status === 'answered' ? 'bg-green-100 text-green-700' :
                          q.status === 'pending_submission' || q.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {q.status === 'auto_answered' ? 'Answered' :
                           q.status === 'answered' ? 'Answered' :
                           q.status === 'pending_submission' ? 'Pending Submission' :
                           q.status === 'submitted' ? 'Submitted' :
                           q.status === 'pending_review' ? 'Under Review' : 'Pending'}
                        </span>
                      </div>
                      {q.ai_answer && (q.status === 'auto_answered' || q.status === 'answered') && (
                        <div className="ml-6 mt-2">
                          <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm text-gray-700">{q.ai_answer}</p>
                          </div>
                          {q.ai_source_references?.length > 0 && (
                            <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                              <p className="text-xs font-medium text-amber-800 mb-1">Source Documentation:</p>
                              {q.ai_source_references.map((ref: SourceRef, i: number) => (
                                <p key={i} className="text-xs text-gray-600">
                                  <span className="font-medium">{ref.document_name}</span> &mdash; Section {ref.section}
                                  {ref.sub_section !== 'N/A' && ` "${ref.sub_section}"`}
                                  {ref.page && `, Page ${ref.page}`}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {q.status === 'pending_submission' && data.question_deadline && (
                        <div className="ml-6 mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                          Will be submitted for clarification on {new Date(data.question_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Legacy questions that are not in AI system */}
                  {data.questions.filter(q => !data.ai_questions?.find(aq => aq.question_text === q.question_text)).map(q => (
                    <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                          {q.related_section && (
                            <span className="text-xs text-gray-400">Re: {q.related_section}</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          q.status === 'answered' || q.status === 'shared' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {q.status === 'answered' || q.status === 'shared' ? 'Answered' : 'Pending'}
                        </span>
                      </div>
                      {q.answer_text && (
                        <div className="ml-6 mt-2 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm text-gray-700">{q.answer_text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ask a Question */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Submit a Question</h2>
              <p className="text-sm text-gray-500 mb-4">Ask questions about the scope of work, requirements, or anything else you need clarified to complete your quote.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Related Section (optional)</label>
                  <input
                    type="text"
                    value={questionSection}
                    onChange={e => setQuestionSection(e.target.value)}
                    placeholder="e.g., Section 3.2 - Equipment Requirements"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Question *</label>
                  <textarea
                    value={questionText}
                    onChange={e => setQuestionText(e.target.value)}
                    placeholder="Type your question here..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitQuestion}
                    disabled={submittingQuestion || !questionText.trim()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Question
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">SOW Documents & Flow-Downs</h2>
            <p className="text-sm text-gray-500 mb-4">Review these documents before preparing your quote. All documents are available for download.</p>
            {data.documents.length > 0 ? (
              <div className="space-y-2">
                {data.documents.map(doc => {
                  const categoryLabel = doc.category === 'flowdown' ? 'Flow-Down Clause' : doc.category === 'site_info' ? 'Site Information' : doc.category === 'exhibit' ? 'Exhibit' : doc.category === 'amendment' ? 'Amendment' : doc.category === 'pricing_sheet' ? 'Pricing Sheet' : 'SOW Document'
                  const categoryColor = doc.category === 'flowdown' ? 'bg-red-100 text-red-700' : doc.category === 'amendment' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  return (
                    <a
                      key={doc.id}
                      href={doc.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                    >
                      <FileText className="w-5 h-5 text-blue-500 group-hover:text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 truncate">{doc.file_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${categoryColor}`}>{categoryLabel}</span>
                          {doc.file_size && <span className="text-xs text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB</span>}
                        </div>
                      </div>
                      <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Download →</span>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No documents have been shared for this RFQ yet.</p>
                <p className="text-xs text-gray-400 mt-1">Check back later or contact the contracting team for scope documents.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Decline to Quote</h3>
            <p className="text-sm text-gray-600 mb-4">Please let us know why you're declining (optional):</p>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g., Outside our service area, capacity constraints, timeline too tight..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleDecline} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Confirm Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        <p>Procuvex — AI-Powered Procurement Intelligence | A product of Core314 Technologies LLC</p>
        <p className="mt-1">This portal is unique to your organization. Please do not share this link.</p>
      </div>
    </div>
  )
}
