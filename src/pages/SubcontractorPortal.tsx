import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Building, FileText, Send, MessageSquare, CheckCircle, Clock, AlertTriangle, X, Loader2, Brain, Plus, Trash2, MapPin, RefreshCw, Shield } from 'lucide-react'

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
  custom_field_values: Record<string, any> | null
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
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'quote' | 'questions' | 'documents'>('quote')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [questions, setQuestions] = useState<Array<{ section: string; text: string }>>([{ section: '', text: '' }])
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [batchResults, setBatchResults] = useState<Array<{ status: string; ai_analysis?: { answer_text?: string; confidence_score?: number; source_references?: SourceRef[]; question_category?: string } }> | null>(null)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [incumbentAtThisLocation, setIncumbentAtThisLocation] = useState<'yes' | 'no' | ''>('')
  const [activeLocations, setActiveLocations] = useState<Array<{ location: string; client: string; years: string; contract_type: string }>>([{ location: '', client: '', years: '', contract_type: '' }])
  const [serviceStates, setServiceStates] = useState('')
  const [activeContractCount, setActiveContractCount] = useState('')
  const [locationsSaved, setLocationsSaved] = useState(false)
  const [savingLocations, setSavingLocations] = useState(false)
  const [showReviseQuote, setShowReviseQuote] = useState(false)

  useEffect(() => {
    if (!token) return
    fetchPortalData()
  }, [token])

  function prefillFormFromQuote(portalData: PortalData) {
    const quote = portalData.existing_quote
    if (!quote) return {}

    const values: Record<string, string> = {}

    // Pre-fill standard fields from the existing quote
    const standardFields = [
      'total_amount', 'monthly_amount', 'annual_amount',
      'labor_cost', 'materials_cost', 'equipment_cost', 'overhead_markup',
      'scope_inclusions', 'scope_exclusions', 'assumptions',
      'timeline', 'payment_terms', 'validity_period',
    ]
    for (const key of standardFields) {
      if (quote[key] !== undefined && quote[key] !== null && quote[key] !== '') {
        values[key] = String(quote[key])
      }
    }

    // Pre-fill custom field values
    if (portalData.custom_field_values) {
      for (const [fieldId, val] of Object.entries(portalData.custom_field_values)) {
        if (val !== undefined && val !== null && val !== '') {
          values[fieldId] = String(val)
        }
      }
    }

    return values
  }

  function getComplianceGaps(portalData: PortalData): { requirements: string[]; pricing: string[]; score: number | null } {
    const analysis = portalData.existing_quote?.ai_compliance_analysis
    if (!analysis) return { requirements: [], pricing: [], score: null }
    return {
      requirements: analysis.requirements_missing || [],
      pricing: analysis.pricing_gaps || [],
      score: analysis.overall_score ?? null,
    }
  }

  async function fetchPortalData() {
    try {
      const resp = await fetch(`/api/portal-api?token=${token}`)
      if (!resp.ok) {
        try {
          const err = await resp.json()
          setError(err.error || 'Failed to load portal data')
        } catch {
          setError(`Failed to load portal data (${resp.status})`)
        }
        return
      }
      const portalData = await resp.json()
      setData(portalData)
      if (portalData.existing_quote) setSubmitted(true)
      if (portalData.outreach_status === 'declined') setDeclined(true)

      // Auto-enter revision mode if ?revise=true (from gap resolution email link)
      if (searchParams.get('revise') === 'true' && portalData.existing_quote) {
        setShowReviseQuote(true)
        setSubmitted(false)
        setFormValues(prefillFormFromQuote(portalData))
      }
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

    // Scope Inclusions must be detailed — reject vague/insufficient responses
    const scopeVal = formValues['scope_inclusions']?.trim() || ''
    if (scopeVal) {
      const vaguePatterns = [
        /^everything\s+(in|per|from|as)\s+(the|this)?\s*(scope|sow|statement|rfp|rfq|solicitation|contract|work)/i,
        /^as\s+(per|described|stated|outlined|noted|specified)/i,
        /^see\s+(scope|sow|statement|attached|above|rfp)/i,
        /^per\s+(the|this)?\s*(scope|sow|statement|rfp|contract)/i,
        /^all\s+(work|items|services|tasks)\s+(in|per|from|as)/i,
        /^included$/i,
        /^yes$/i,
        /^n\/a$/i,
        /^same\s+as/i,
        /^refer\s+to/i,
      ]
      if (vaguePatterns.some(p => p.test(scopeVal))) {
        setError('"Scope Inclusions" must detail your specific understanding of the scope of work. Generic responses like "Everything in the SOW" are not sufficient. Please list the specific services, tasks, and deliverables your quote covers.')
        return
      }
      if (scopeVal.length < 100) {
        setError('"Scope Inclusions" requires a detailed response (minimum 100 characters). Please describe the specific services, tasks, deliverables, and requirements your quote addresses so your pricing accurately reflects the scope of work.')
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

      const payload = {
        token,
        action: 'submit_quote',
        quote_data: quoteData,
        custom_fields: customFields,
        incumbent_data: incumbentAtThisLocation ? {
          is_incumbent: incumbentAtThisLocation === 'yes',
        } : undefined,
        is_revision: showReviseQuote,
      }

      let resp: Response | null = null
      let lastErr = ''
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          resp = await fetch('/api/portal-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          break
        } catch {
          lastErr = 'Network error — please check your connection and try again.'
          if (attempt === 0) await new Promise(r => setTimeout(r, 1000))
        }
      }

      if (!resp) {
        setError(lastErr)
        return
      }

      if (!resp.ok) {
        try {
          const err = await resp.json()
          setError(err.error || `Server error (${resp.status}). Please try again.`)
        } catch {
          setError(`Server error (${resp.status}). Please try again.`)
        }
        return
      }

      const result = await resp.json()

      // Update displayed quote with new values
      if (data) {
        setData({
          ...data,
          existing_quote: {
            ...data.existing_quote,
            ...quoteData,
            id: result.quote_id,
            is_revision: showReviseQuote,
            submitted_at: new Date().toISOString(),
          },
        })
      }

      setSubmitted(true)
      setShowReviseQuote(false)
    } catch (e) {
      setError(`Failed to submit quote: ${e instanceof Error ? e.message : 'Unknown error'}. Please try again.`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveLocations() {
    if (!token) return
    const validLocations = activeLocations.filter(l => l.location.trim())
    if (validLocations.length === 0 && !incumbentAtThisLocation) {
      setError('Please provide at least your incumbent status or one active location.')
      return
    }
    setSavingLocations(true)
    setError('')
    try {
      await fetch('/api/portal-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'save_experience_locations',
          experience_data: {
            is_incumbent_here: incumbentAtThisLocation === 'yes',
            active_locations: validLocations.map(l => ({
              location_name: l.location.trim(),
              client_agency: l.client.trim() || null,
              years_at_location: l.years.trim() || null,
              contract_type: l.contract_type || null,
            })),
            service_states: serviceStates.trim() || null,
            active_contract_count: activeContractCount.trim() || null,
          },
        }),
      })
      setLocationsSaved(true)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSavingLocations(false)
    }
  }

  function addQuestion() {
    setQuestions(prev => [...prev, { section: '', text: '' }])
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function updateQuestion(index: number, field: 'section' | 'text', value: string) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q))
  }

  async function handleSubmitQuestions() {
    const validQuestions = questions.filter(q => q.text.trim())
    if (!token || validQuestions.length === 0) return
    setSubmittingQuestion(true)
    setBatchResults(null)

    try {
      const resp = await fetch('/api/portal-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'submit_questions_batch',
          questions: validQuestions.map(q => ({
            question_text: q.text.trim(),
            related_section: q.section.trim() || null,
          })),
        }),
      })

      if (resp.ok) {
        const result = await resp.json()
        setBatchResults(result.results || [])
        setQuestions([{ section: '', text: '' }])
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

        {/* AI Compliance Notice */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-indigo-900">AI-Verified Quote Compliance</h3>
              <p className="text-xs text-indigo-700 mt-1">
                All quotes submitted through this portal are automatically reviewed by our AI compliance system against the 
                Statement of Work requirements. If your quote does not explicitly address all SOW requirements, you will receive 
                an email identifying specific gaps so you can submit a revised, fully compliant quote. <strong>Tip:</strong> Ensure 
                your quote clearly addresses every requirement listed in the scope description above.
              </p>
            </div>
          </div>
        </div>

        {/* Experience & Active Locations Section — REQUIRED */}
        {!locationsSaved && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">Experience & Active Locations</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Required</span>
            </div>
            <p className="text-sm text-gray-600 mb-1">Please provide your incumbent status for this location and any other locations where you currently perform similar work.</p>
            <p className="text-xs text-amber-700 mb-4 font-medium">⚠ This section must be completed before you can submit your quote.</p>
            
            <div className="space-y-5">
              {/* Q1: Incumbent at this location */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-800 mb-2">1. Are you the incumbent for this work at this location? *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="incumbent_here" value="yes" checked={incumbentAtThisLocation === 'yes'} onChange={() => setIncumbentAtThisLocation('yes')} className="text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm text-gray-700">Yes, we are the incumbent</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="incumbent_here" value="no" checked={incumbentAtThisLocation === 'no'} onChange={() => setIncumbentAtThisLocation('no')} className="text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {/* Q2: Active contract locations (always shown) */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-800 mb-1">2. Active & Recent Contract Locations *</label>
                <p className="text-xs text-gray-500 mb-3">List locations where you currently perform or have recently performed similar work. This is used for evaluation scoring.</p>
                
                {activeLocations.map((loc, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Location/Facility Name *</label>
                      <input
                        type="text"
                        value={loc.location}
                        onChange={e => { const n = [...activeLocations]; n[idx].location = e.target.value; setActiveLocations(n) }}
                        placeholder="e.g., Atlanta P&DC"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Client/Agency</label>
                      <input
                        type="text"
                        value={loc.client}
                        onChange={e => { const n = [...activeLocations]; n[idx].client = e.target.value; setActiveLocations(n) }}
                        placeholder="e.g., USPS"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Years at Location</label>
                      <input
                        type="text"
                        value={loc.years}
                        onChange={e => { const n = [...activeLocations]; n[idx].years = e.target.value; setActiveLocations(n) }}
                        placeholder="e.g., 5"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-0.5">Contract Type</label>
                        <select
                          value={loc.contract_type}
                          onChange={e => { const n = [...activeLocations]; n[idx].contract_type = e.target.value; setActiveLocations(n) }}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="">Select...</option>
                          <option value="prime">Prime Contractor</option>
                          <option value="subcontractor">Subcontractor</option>
                          <option value="jv">Joint Venture</option>
                          <option value="teaming">Teaming Partner</option>
                        </select>
                      </div>
                      {activeLocations.length > 1 && (
                        <button
                          onClick={() => setActiveLocations(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600 p-1.5"
                          title="Remove location"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={() => setActiveLocations(prev => [...prev, { location: '', client: '', years: '', contract_type: '' }])}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Another Location
                </button>
              </div>

              {/* Q3: Geographic service area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Geographic Service Area</label>
                  <input
                    type="text"
                    value={serviceStates}
                    onChange={e => setServiceStates(e.target.value)}
                    placeholder="e.g., GA, FL, TN, SC (states you service)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Active Contracts</label>
                  <input
                    type="text"
                    value={activeContractCount}
                    onChange={e => setActiveContractCount(e.target.value)}
                    placeholder="e.g., 8"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveLocations}
                  disabled={!incumbentAtThisLocation || savingLocations}
                  className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingLocations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Save Experience & Locations
                </button>
              </div>
            </div>
          </div>
        )}
        {locationsSaved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Experience & locations saved — {incumbentAtThisLocation === 'yes' ? 'Incumbent at this location' : 'Not incumbent here'}</p>
              {activeLocations.filter(l => l.location.trim()).length > 0 && (
                <p className="text-xs text-green-700">{activeLocations.filter(l => l.location.trim()).length} active location(s) recorded</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {[
            { key: 'quote' as const, label: submitted ? 'Quote Submitted' : 'Submit Quote', icon: FileText },
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
            {submitted && !showReviseQuote ? (
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
                <div className="mt-6">
                  <button
                    onClick={() => { setShowReviseQuote(true); setSubmitted(false); setFormValues(prefillFormFromQuote(data)) }}
                    className="flex items-center gap-2 mx-auto bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 border border-amber-200"
                  >
                    <RefreshCw className="w-4 h-4" /> Submit Revised Quote
                  </button>
                  <p className="text-xs text-gray-400 mt-2">If there have been amendments or changes, you can submit an updated quote.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-1">
                  {showReviseQuote ? '📝 Revised Quote' : 'Quote Details'}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {showReviseQuote
                    ? 'Your previous quote has been pre-filled below. Edit the fields that need updating — you only need to change what\'s necessary to address the identified gaps.'
                    : 'Complete the fields below to submit your quote. Required fields are marked with *'}
                </p>

                {/* Gap Resolution Banner — shows identified gaps when in revision mode */}
                {showReviseQuote && (() => {
                  const gaps = getComplianceGaps(data)
                  if (gaps.requirements.length === 0 && gaps.pricing.length === 0) return null
                  return (
                    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-amber-900">Items to Address in Your Revision</h3>
                          <p className="text-xs text-amber-700 mt-1">
                            The following gaps were identified in your previous submission. Please update the relevant fields below to address them.
                          </p>
                        </div>
                      </div>
                      {gaps.requirements.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-red-800 mb-1">SOW Requirements Not Addressed ({gaps.requirements.length}):</p>
                          <ul className="list-disc list-inside space-y-1">
                            {gaps.requirements.map((gap, i) => (
                              <li key={i} className="text-xs text-red-700">{gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {gaps.pricing.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">Pricing Gaps ({gaps.pricing.length}):</p>
                          <ul className="list-disc list-inside space-y-1">
                            {gaps.pricing.map((gap, i) => (
                              <li key={i} className="text-xs text-amber-700">{gap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {gaps.score !== null && (
                        <div className="mt-3 pt-2 border-t border-amber-200">
                          <p className="text-xs text-amber-800">Previous Compliance Score: <strong className={gaps.score >= 80 ? 'text-green-700' : gaps.score >= 60 ? 'text-amber-700' : 'text-red-700'}>{gaps.score}%</strong></p>
                        </div>
                      )}
                    </div>
                  )
                })()}

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
                      {field.default_field_key === 'scope_inclusions' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                          <p className="text-xs text-amber-800 font-medium mb-1">⚠ Detailed Response Required</p>
                          <p className="text-xs text-amber-700">You must describe your specific understanding of the scope of work in detail. Responses such as &quot;Everything in the statement of work&quot; or &quot;Per the SOW&quot; will not be accepted. Your description should demonstrate a clear understanding of the requirements and list the specific services, tasks, and deliverables your pricing covers. This ensures your quote is compliant and accurately reflects the scope.</p>
                        </div>
                      ) : field.help_text ? (
                        <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>
                      ) : null}
                      {field.field_type === 'textarea' ? (
                        <>
                        <textarea
                          value={formValues[field.default_field_key || field.id] || ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.default_field_key || field.id]: e.target.value }))}
                          placeholder={field.default_field_key === 'scope_inclusions'
                            ? 'Detail your understanding of the scope of work. List specific services, tasks, deliverables, staffing requirements, equipment, schedules, and any other items your pricing includes. Be specific — vague responses will be rejected.'
                            : (field.placeholder || '')}
                          rows={field.default_field_key === 'scope_inclusions' ? 6 : 3}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            field.default_field_key === 'scope_inclusions' ? 'border-amber-300' : 'border-gray-300'
                          }`}
                        />
                        {field.default_field_key === 'scope_inclusions' && (
                          <p className={`text-xs mt-1 ${
                            (formValues['scope_inclusions']?.length || 0) < 100 ? 'text-red-500' : 'text-green-600'
                          }`}>
                            {formValues['scope_inclusions']?.length || 0} / 100 characters minimum
                          </p>
                        )}
                        </>
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
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={handleSubmitQuote}
                      disabled={submitting || !locationsSaved}
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit Quote
                    </button>
                    {!locationsSaved && (
                      <p className="text-xs text-red-500">Complete "Experience & Active Locations" above first</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
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

            {/* Batch Results */}
            {batchResults && batchResults.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Submission Results</h2>
                  <button onClick={() => setBatchResults(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  {batchResults.map((result, i) => (
                    <div key={i} className={`rounded-lg p-4 border ${
                      result.status === 'auto_answered' ? 'border-green-200 bg-green-50' :
                      result.status === 'pending_review' ? 'border-amber-200 bg-amber-50' :
                      'border-blue-200 bg-blue-50'
                    }`}>
                      {result.status === 'auto_answered' && result.ai_analysis ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-800">Answered from Documents</span>
                            <span className="text-xs text-green-600">({result.ai_analysis.confidence_score}% confidence)</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{result.ai_analysis.answer_text}</p>
                          {result.ai_analysis.source_references && result.ai_analysis.source_references.length > 0 && (
                            <div className="bg-white rounded-lg p-2 border border-green-200">
                              <p className="text-xs font-medium text-gray-600 mb-1">Source:</p>
                              {result.ai_analysis.source_references.map((ref: SourceRef, j: number) => (
                                <p key={j} className="text-xs text-gray-600">
                                  <span className="font-medium">{ref.document_name}</span> &mdash; Section {ref.section}
                                  {ref.sub_section !== 'N/A' && ` "${ref.sub_section}"`}
                                  {ref.page && `, Page ${ref.page}`}
                                </p>
                              ))}
                            </div>
                          )}
                        </>
                      ) : result.status === 'pending_review' ? (
                        <>
                          <h3 className="font-bold text-amber-800 mb-1 text-sm">Question Under Review</h3>
                          <p className="text-sm text-gray-700">We found related info but need to verify. We will follow up shortly.</p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-bold text-blue-800 mb-1 text-sm">Submitted for Clarification</h3>
                          <p className="text-sm text-gray-700">Added to our formal clarification request. You will be notified when an answer is available.</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Questions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Submit Questions</h2>
              <p className="text-sm text-gray-500 mb-4">Ask questions about the scope of work, requirements, or anything else you need clarified. You can submit multiple questions at once.</p>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={index} className={`space-y-2 ${index > 0 ? 'pt-4 border-t border-gray-200' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Question {index + 1}</span>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(index)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove this question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Related Section (optional)</label>
                      <input
                        type="text"
                        value={q.section}
                        onChange={e => updateQuestion(index, 'section', e.target.value)}
                        placeholder="e.g., Section 3.2 - Equipment Requirements"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Your Question *</label>
                      <textarea
                        value={q.text}
                        onChange={e => updateQuestion(index, 'text', e.target.value)}
                        placeholder="Type your question here..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addQuestion}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium py-2"
                >
                  <Plus className="w-4 h-4" /> Add Another Question
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">{questions.filter(q => q.text.trim()).length} question{questions.filter(q => q.text.trim()).length !== 1 ? 's' : ''} ready to submit</span>
                  <button
                    onClick={handleSubmitQuestions}
                    disabled={submittingQuestion || questions.filter(q => q.text.trim()).length === 0}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit {questions.filter(q => q.text.trim()).length > 1 ? `${questions.filter(q => q.text.trim()).length} Questions` : 'Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Documents for {data.sow?.sow_name || 'Your Scope of Work'}</h2>
            <p className="text-sm text-gray-500 mb-4">Review these documents relevant to your scope before preparing your quote. All documents are available for download.</p>
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
        <p className="mt-1">This portal is unique to your organization and remains active for the duration of this project.</p>
        <p className="mt-1">Bookmark this page to return at any time for updates, revised quotes, or new questions.</p>
      </div>
    </div>
  )
}
