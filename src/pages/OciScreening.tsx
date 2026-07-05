import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { supabase } from '../lib/supabase'
import {
  ShieldAlert, ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  Save, HelpCircle,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface OciQuestion {
  id: string
  category: 'unequal_access' | 'biased_ground_rules' | 'impaired_objectivity'
  question: string
  answer: 'yes' | 'no' | 'unknown' | null
  notes: string
  risk_if_yes: 'high' | 'medium' | 'low'
}

interface OciResult {
  questions: OciQuestion[]
  overall_risk: 'none' | 'low' | 'medium' | 'high'
  mitigation_plan: string
  reviewed_at: string
}

const DEFAULT_QUESTIONS: Omit<OciQuestion, 'answer' | 'notes'>[] = [
  // Unequal Access to Information
  { id: 'ua1', category: 'unequal_access', question: 'Did our company (or any team member) participate in drafting the SOW, PWS, or requirements for this procurement?', risk_if_yes: 'high' },
  { id: 'ua2', category: 'unequal_access', question: 'Do we have access to non-public source selection information (e.g., evaluation criteria details, competitor data, IGCE)?', risk_if_yes: 'high' },
  { id: 'ua3', category: 'unequal_access', question: 'Did we perform advisory or consulting work for the procuring agency on this program?', risk_if_yes: 'high' },
  { id: 'ua4', category: 'unequal_access', question: 'Do any of our employees have current or recent relationships with the contracting officer or evaluation board?', risk_if_yes: 'medium' },
  // Biased Ground Rules
  { id: 'bg1', category: 'biased_ground_rules', question: 'Did we set or influence the specifications, evaluation factors, or terms that we are now competing under?', risk_if_yes: 'high' },
  { id: 'bg2', category: 'biased_ground_rules', question: 'Did we develop or contribute to the Government estimate, budget, or funding profile for this effort?', risk_if_yes: 'high' },
  { id: 'bg3', category: 'biased_ground_rules', question: 'Are we the incumbent on a related contract that directly informed this requirement?', risk_if_yes: 'medium' },
  // Impaired Objectivity
  { id: 'io1', category: 'impaired_objectivity', question: 'Would winning this contract require us to evaluate or assess our own products, services, or performance?', risk_if_yes: 'high' },
  { id: 'io2', category: 'impaired_objectivity', question: 'Do we hold any contracts where we advise the Government on which solutions to acquire — and is this procurement for one of those solutions?', risk_if_yes: 'high' },
  { id: 'io3', category: 'impaired_objectivity', question: 'Would any subcontractor on our team face a similar objectivity conflict?', risk_if_yes: 'medium' },
  { id: 'io4', category: 'impaired_objectivity', question: 'Could a reasonable person conclude that our financial interests might bias our performance under this contract?', risk_if_yes: 'medium' },
]

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  unequal_access: { label: 'Unequal Access to Information', description: 'FAR 9.505-4 — Did we gain competitive advantage through non-public information?' },
  biased_ground_rules: { label: 'Biased Ground Rules', description: 'FAR 9.505-1/2 — Did we influence the procurement rules we\'re competing under?' },
  impaired_objectivity: { label: 'Impaired Objectivity', description: 'FAR 9.505-3 — Could our objectivity be compromised by financial interests?' },
}

export default function OciScreening() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [questions, setQuestions] = useState<OciQuestion[]>([])
  const [mitigationPlan, setMitigationPlan] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<OciResult>(projectId, 'oci_screening'),
    ]).then(([{ data: proj }, result]) => {
      if (proj) setProjectTitle(proj.title)
      if (result?.questions) {
        setQuestions(result.questions)
        setMitigationPlan(result.mitigation_plan || '')
      } else {
        setQuestions(DEFAULT_QUESTIONS.map(q => ({ ...q, answer: null, notes: '' })))
      }
      setLoading(false)
    })
  }, [projectId])

  function calculateRisk(): 'none' | 'low' | 'medium' | 'high' {
    const yesAnswers = questions.filter(q => q.answer === 'yes')
    if (yesAnswers.length === 0) return 'none'
    if (yesAnswers.some(q => q.risk_if_yes === 'high')) return 'high'
    if (yesAnswers.filter(q => q.risk_if_yes === 'medium').length >= 2) return 'high'
    if (yesAnswers.some(q => q.risk_if_yes === 'medium')) return 'medium'
    return 'low'
  }

  async function handleSave() {
    if (!projectId) return
    setSaving(true)
    await saveAiOutput(projectId, 'oci_screening', {
      questions,
      overall_risk: calculateRisk(),
      mitigation_plan: mitigationPlan,
      reviewed_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const risk = calculateRisk()
  const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    none: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  }
  const riskStyle = RISK_STYLES[risk]

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  const categories = ['unequal_access', 'biased_ground_rules', 'impaired_objectivity'] as const

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" size={28} />
            OCI Screening
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Organizational Conflict of Interest assessment'}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Assessment'}
        </button>
      </div>

      <FeatureGuidance
        title="Organizational Conflict of Interest (OCI) Screening"
        description="Before pursuing an opportunity, assess whether your organization has any conflicts of interest per FAR Subpart 9.5. This questionnaire covers the three OCI categories and helps you document findings for Gate 0/1 decisions."
        storageKey="oci_screening"
        accentColor="red"
        steps={[
          { title: 'Answer each question honestly', description: 'Review all questions across the three OCI categories. Answer Yes, No, or Unknown for each.' },
          { title: 'Add notes for any "Yes" answers', description: 'Document the specific circumstances. This helps your legal/contracts team assess whether a waiver or mitigation plan is needed.' },
          { title: 'Write a mitigation plan if needed', description: 'If any conflicts exist, outline your approach to mitigate them — firewalls, disclosure, recusal, or subcontractor changes.' },
        ]}
      />

      {/* Risk Summary */}
      <div className={`${riskStyle.bg} border ${riskStyle.border} rounded-xl p-4 mb-6`}>
        <div className="flex items-center gap-3">
          {risk === 'none' ? <CheckCircle size={20} className="text-green-600" /> :
           risk === 'high' ? <XCircle size={20} className="text-red-600" /> :
           <AlertTriangle size={20} className={riskStyle.text} />}
          <div>
            <p className={`font-semibold ${riskStyle.text}`}>
              OCI Risk Level: {risk.toUpperCase()}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {risk === 'none' && 'No conflicts of interest identified. Safe to proceed.'}
              {risk === 'low' && 'Minor potential conflicts identified. Document and monitor.'}
              {risk === 'medium' && 'Moderate conflicts detected. Consider mitigation plan before proceeding.'}
              {risk === 'high' && 'Significant conflicts identified. Mitigation plan required. Consider legal review before Gate 1.'}
            </p>
          </div>
        </div>
      </div>

      {/* Questions by Category */}
      <div className="space-y-6">
        {categories.map(cat => {
          const catInfo = CATEGORY_LABELS[cat]
          const catQuestions = questions.filter(q => q.category === cat)
          return (
            <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 text-sm">{catInfo.label}</h3>
                <p className="text-xs text-gray-500">{catInfo.description}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {catQuestions.map(q => (
                  <div key={q.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <HelpCircle size={14} className="text-gray-400 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{q.question}</p>
                        {q.risk_if_yes === 'high' && (
                          <span className="text-[10px] text-red-500 font-medium">High risk if yes</span>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {(['yes', 'no', 'unknown'] as const).map(ans => (
                          <button
                            key={ans}
                            onClick={() => {
                              setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, answer: ans } : pq))
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-medium border ${
                              q.answer === ans
                                ? ans === 'yes' ? 'bg-red-100 text-red-700 border-red-300'
                                : ans === 'no' ? 'bg-green-100 text-green-700 border-green-300'
                                : 'bg-gray-100 text-gray-700 border-gray-300'
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {ans === 'unknown' ? '?' : ans.charAt(0).toUpperCase() + ans.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {q.answer === 'yes' && (
                      <textarea
                        value={q.notes}
                        onChange={e => setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, notes: e.target.value } : pq))}
                        placeholder="Describe the specific circumstances..."
                        rows={2}
                        className="w-full mt-2 px-3 py-2 border border-red-200 rounded-lg text-sm bg-red-50/50 focus:ring-1 focus:ring-red-300 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mitigation Plan */}
      {risk !== 'none' && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Mitigation Plan</h3>
          <p className="text-xs text-gray-500 mb-3">
            Describe how you will mitigate the identified conflicts. Common strategies include: information firewalls, disclosure to the CO, recusal of conflicted personnel, organizational separation, or use of independent subcontractors.
          </p>
          <textarea
            value={mitigationPlan}
            onChange={e => setMitigationPlan(e.target.value)}
            rows={5}
            placeholder="Describe your OCI mitigation approach..."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
        </div>
      )}
    </div>
  )
}
