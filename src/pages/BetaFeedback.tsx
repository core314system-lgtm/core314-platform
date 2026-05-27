import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle, Clock, Star, Loader2, AlertCircle, ChevronRight, Gift } from 'lucide-react'

interface FeedbackEntry {
  week_number: number
  responses: Record<string, string | number | string[]>
  submitted_at: string
}

interface BetaStatus {
  feedback: FeedbackEntry[]
  beta_start_date: string | null
  beta_program_status: string | null
  beta_coupon_code: string | null
  beta_coupon_expires_at: string | null
  current_week: number
  days_remaining: number
}

interface FormField {
  key: string
  label: string
  type: 'rating' | 'text' | 'textarea' | 'yesno' | 'nps' | 'checklist' | 'rank'
  options?: string[]
  required?: boolean
}

const WEEK_FORMS: Record<number, { title: string; subtitle: string; fields: FormField[] }> = {
  1: {
    title: 'Week 1 — First Impressions & Onboarding',
    subtitle: 'Tell us about your initial experience with Procuvex',
    fields: [
      { key: 'setup_rating', label: 'How would you rate your initial setup experience?', type: 'rating', required: true },
      { key: 'first_project', label: 'Were you able to create your first project successfully?', type: 'yesno', required: true },
      { key: 'first_project_details', label: 'Details about your first project experience', type: 'textarea' },
      { key: 'navigation_rating', label: 'How intuitive was the navigation?', type: 'rating', required: true },
      { key: 'first_impression', label: 'What was your first impression of the platform?', type: 'textarea', required: true },
      { key: 'onboarding_issues', label: 'Did you encounter any issues during onboarding?', type: 'textarea' },
      { key: 'features_explored', label: 'Which features did you explore this week?', type: 'checklist',
        options: ['Document Upload', 'Compliance Matrix', 'Subcontractor Search', 'Q&A Management', 'RFQ Builder', 'Task Orders', 'Analytics', 'Export Center'] },
    ],
  },
  2: {
    title: 'Week 2 — Core Feature Evaluation',
    subtitle: 'How are the core features working for your needs?',
    fields: [
      { key: 'features_used', label: 'Which features did you use this week?', type: 'checklist',
        options: ['Document Upload', 'Compliance Matrix', 'Subcontractor Search', 'Q&A Management', 'RFQ Builder', 'Task Orders', 'Analytics', 'Export Center', 'Teaming Tracker', 'Bid Decision Engine'] },
      { key: 'ai_analysis_rating', label: 'Rate the AI document analysis quality', type: 'rating', required: true },
      { key: 'sub_search_rating', label: 'Rate the subcontractor search usefulness', type: 'rating', required: true },
      { key: 'compliance_rating', label: 'Rate the compliance matrix accuracy', type: 'rating', required: true },
      { key: 'unexpected_behavior', label: 'Did any feature not work as expected?', type: 'textarea' },
      { key: 'comparison', label: 'How does Procuvex compare to your current workflow/tools?', type: 'textarea', required: true },
      { key: 'nps_early', label: 'Would you recommend Procuvex to a colleague at this point? (1-10)', type: 'nps', required: true },
    ],
  },
  3: {
    title: 'Week 3 — Advanced Workflows & Pain Points',
    subtitle: 'Diving deeper into platform capabilities',
    fields: [
      { key: 'rfq_used', label: 'Have you used the RFQ/bid management features?', type: 'yesno', required: true },
      { key: 'rfq_details', label: 'Details about your RFQ/bid management experience', type: 'textarea' },
      { key: 'team_invited', label: 'Have you invited any team members to collaborate?', type: 'yesno' },
      { key: 'most_valuable', label: "What's the single most valuable feature for your work?", type: 'textarea', required: true },
      { key: 'biggest_pain', label: "What's the biggest pain point or missing feature?", type: 'textarea', required: true },
      { key: 'reliability_rating', label: 'Rate overall platform reliability/speed', type: 'rating', required: true },
      { key: 'bugs_found', label: 'Have you encountered any bugs?', type: 'textarea' },
      { key: 'bug_severity', label: 'If yes, how severe?', type: 'yesno', options: ['Minor', 'Moderate', 'Critical'] },
    ],
  },
  4: {
    title: 'Week 4 — Final Assessment & Program Completion',
    subtitle: 'Your comprehensive evaluation — completing this unlocks your 25% lifetime discount!',
    fields: [
      { key: 'overall_satisfaction', label: 'Overall satisfaction rating (1-10)', type: 'nps', required: true },
      { key: 'continue_using', label: 'Would you continue using Procuvex after the beta?', type: 'yesno',
        options: ['Definitely', 'Probably', 'Unsure', 'Probably not', 'Definitely not'] },
      { key: 'paying_customer', label: 'What would make you a paying customer?', type: 'textarea', required: true },
      { key: 'nps_final', label: 'How likely are you to recommend Procuvex? (0-10)', type: 'nps', required: true },
      { key: 'priority_features', label: 'What features should be prioritized next? (Top 3)', type: 'textarea', required: true },
      { key: 'final_feedback', label: 'Any final feedback or suggestions?', type: 'textarea' },
      { key: 'testimonial', label: 'Would you provide a quote we can use? (Optional — greatly appreciated!)', type: 'textarea' },
    ],
  },
}

function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`p-1 transition-colors ${n <= value ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}>
          <Star className="w-6 h-6" fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-gray-500 self-center">{value}/5</span>}
    </div>
  )
}

function NpsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: 11 }, (_, i) => i).map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
            n === value
              ? n >= 9 ? 'bg-green-500 text-white' : n >= 7 ? 'bg-blue-500 text-white' : n >= 5 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {n}
        </button>
      ))}
    </div>
  )
}

export default function BetaFeedback() {
  const { user } = useAuth()
  const [status, setStatus] = useState<BetaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeWeek, setActiveWeek] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<string, string | number | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completionResult, setCompletionResult] = useState<{ coupon_code?: string; coupon_expires_at?: string } | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/.netlify/functions/beta-feedback', {
      headers: { 'x-user-id': user.id },
    })
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => setError('Failed to load feedback status'))
      .finally(() => setLoading(false))
  }, [user])

  const completedWeeks = useMemo(() => {
    if (!status) return new Set<number>()
    return new Set(status.feedback.map(f => f.week_number))
  }, [status])

  function updateResponse(key: string, value: string | number | string[]) {
    setResponses(prev => ({ ...prev, [key]: value }))
  }

  function toggleChecklist(key: string, option: string) {
    setResponses(prev => {
      const current = (prev[key] as string[]) || []
      return { ...prev, [key]: current.includes(option) ? current.filter(o => o !== option) : [...current, option] }
    })
  }

  function openWeek(week: number) {
    setActiveWeek(week)
    setResponses({})
    setSuccess(null)
    setError(null)
    // Pre-fill if already submitted
    const existing = status?.feedback.find(f => f.week_number === week)
    if (existing) {
      setResponses(existing.responses)
    }
  }

  async function submitFeedback() {
    if (!user || !activeWeek) return
    const form = WEEK_FORMS[activeWeek]
    const missing = form.fields.filter(f => f.required && !responses[f.key] && responses[f.key] !== 0)
    if (missing.length > 0) {
      setError(`Please complete required fields: ${missing.map(f => f.label.slice(0, 40)).join(', ')}`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/beta-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, week_number: activeWeek, responses }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.program_completed) {
          setCompletionResult({ coupon_code: data.coupon_code, coupon_expires_at: data.coupon_expires_at })
        }
        setSuccess(`Week ${activeWeek} feedback submitted successfully!`)
        // Refresh status
        const refreshRes = await fetch('/.netlify/functions/beta-feedback', { headers: { 'x-user-id': user.id } })
        const refreshData = await refreshRes.json()
        setStatus(refreshData)
        if (!data.program_completed) setActiveWeek(null)
      } else {
        setError(data.error || 'Failed to submit feedback')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
  }

  if (!status) return null

  // Completion celebration
  if (completionResult?.coupon_code) {
    const expiresAt = completionResult.coupon_expires_at ? new Date(completionResult.coupon_expires_at) : null
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Gift className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Congratulations!</h1>
        <p className="text-gray-600 mb-6">You've completed the Founding Partner Program. Thank you for your invaluable feedback!</p>
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6">
          <p className="text-sm text-green-700 mb-2">Your Exclusive 25% Lifetime Discount Code:</p>
          <p className="text-3xl font-bold text-green-800 font-mono tracking-wider">{completionResult.coupon_code}</p>
          {expiresAt && (
            <p className="text-sm text-green-600 mt-2">Expires: {expiresAt.toLocaleDateString()} — claim within 5 days!</p>
          )}
        </div>
        <a href="/billing" className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
          Claim My Discount
        </a>
      </div>
    )
  }

  // Week list view
  if (activeWeek === null) {
    const programComplete = completedWeeks.size === 4
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Founding Partner Feedback</h1>
          <p className="text-gray-500 text-sm mt-1">
            {status.beta_start_date
              ? `${status.days_remaining} days remaining in your program • ${completedWeeks.size}/4 weeks completed`
              : 'Submit your first feedback to start your 30-day program'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Program Progress</span>
            <span className="text-sm text-gray-500">{completedWeeks.size}/4 weeks</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
              style={{ width: `${(completedWeeks.size / 4) * 100}%` }} />
          </div>
          {programComplete && (
            <p className="text-green-600 text-sm mt-2 font-medium">Program complete — check your email for your discount code!</p>
          )}
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-800 text-sm">{success}</span>
          </div>
        )}

        {/* Week cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map(week => {
            const form = WEEK_FORMS[week]
            const isComplete = completedWeeks.has(week)
            const isAvailable = !status.beta_start_date || week <= (status.current_week || 1)
            const isLocked = !isAvailable && !isComplete

            return (
              <button
                key={week}
                onClick={() => !isLocked && openWeek(week)}
                disabled={isLocked}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isComplete
                    ? 'bg-green-50 border-green-200 hover:border-green-300'
                    : isLocked
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : isLocked ? (
                      <Clock className="w-5 h-5 text-gray-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-blue-400" />
                    )}
                    <div>
                      <p className={`font-medium text-sm ${isComplete ? 'text-green-800' : isLocked ? 'text-gray-400' : 'text-gray-900'}`}>
                        {form.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${isComplete ? 'text-green-600' : isLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isComplete ? 'Completed' : isLocked ? `Available in week ${week}` : form.subtitle}
                      </p>
                    </div>
                  </div>
                  {!isLocked && <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Active form view
  const form = WEEK_FORMS[activeWeek]
  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => setActiveWeek(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to overview
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{form.subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {form.fields.map(field => (
          <div key={field.key} className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-800 mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === 'rating' && (
              <RatingInput value={(responses[field.key] as number) || 0} onChange={v => updateResponse(field.key, v)} />
            )}

            {field.type === 'nps' && (
              <NpsInput value={responses[field.key] as number ?? -1} onChange={v => updateResponse(field.key, v)} />
            )}

            {field.type === 'text' && (
              <input type="text" value={(responses[field.key] as string) || ''}
                onChange={e => updateResponse(field.key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            )}

            {field.type === 'textarea' && (
              <textarea value={(responses[field.key] as string) || ''}
                onChange={e => updateResponse(field.key, e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
            )}

            {field.type === 'yesno' && (
              <div className="flex flex-wrap gap-2">
                {(field.options || ['Yes', 'No']).map(opt => (
                  <button key={opt} type="button" onClick={() => updateResponse(field.key, opt)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      responses[field.key] === opt
                        ? 'bg-blue-100 text-blue-700 border-blue-300 border'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {field.type === 'checklist' && field.options && (
              <div className="grid grid-cols-2 gap-2">
                {field.options.map(opt => {
                  const checked = ((responses[field.key] as string[]) || []).includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleChecklist(field.key, opt)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={() => setActiveWeek(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button onClick={submitFeedback} disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting...' : activeWeek === 4 ? 'Submit & Complete Program' : 'Submit Week ' + activeWeek + ' Feedback'}
        </button>
      </div>
    </div>
  )
}
