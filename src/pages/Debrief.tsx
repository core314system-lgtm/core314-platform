import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveDebrief, loadDebrief, type Debrief as DebriefType } from '../lib/debriefStorage'
import { CheckCircle, XCircle, MinusCircle, AlertTriangle, Save, ArrowLeft, Plus, X } from 'lucide-react'

const LOSS_REASON_OPTIONS = [
  'Price too high',
  'Technical weakness',
  'Past performance gap',
  'Compliance issue',
  'Insufficient staffing plan',
  'Missing certifications',
  'Late submission',
  'Subcontractor concerns',
  'Incumbent advantage',
  'Better transition plan by competitor',
  'Scope misunderstanding',
  'Weak management approach',
]

const STRENGTH_OPTIONS = [
  'Competitive pricing',
  'Strong technical approach',
  'Experienced staff',
  'Incumbent knowledge',
  'Strong subcontractor team',
  'Compliance thoroughness',
  'Past performance record',
  'Transition plan quality',
  'Local presence',
  'Innovation / value-adds',
  'Quality management plan',
  'Safety record',
]

export default function DebriefPage() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<{ id: string; title: string; location_state: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [outcome, setOutcome] = useState<DebriefType['outcome']>('awarded')
  const [awardDate, setAwardDate] = useState('')
  const [finalAwardPrice, setFinalAwardPrice] = useState('')
  const [ourProposedPrice, setOurProposedPrice] = useState('')
  const [govEstimate, setGovEstimate] = useState('')
  const [winningCompetitor, setWinningCompetitor] = useState('')
  const [winningCompetitorPrice, setWinningCompetitorPrice] = useState('')
  const [lossReasons, setLossReasons] = useState<string[]>([])
  const [strengths, setStrengths] = useState<string[]>([])
  const [weaknesses, setWeaknesses] = useState<string[]>([])
  const [customWeakness, setCustomWeakness] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')
  const [pricingNotes, setPricingNotes] = useState('')
  const [subPerformanceNotes, setSubPerformanceNotes] = useState('')
  const [whatToRepeat, setWhatToRepeat] = useState('')
  const [whatToChange, setWhatToChange] = useState('')
  const [evaluatorFeedback, setEvaluatorFeedback] = useState('')
  const [serviceCategories, setServiceCategories] = useState<string[]>([])

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  async function fetchData() {
    const { data: to } = await supabase.from('task_orders').select('id, title, location_state, status').eq('id', id).single()
    setTaskOrder(to)

    // Load SOW categories for tagging
    const { data: sows } = await supabase.from('sow_items').select('service_category').eq('task_order_id', id)
    if (sows) {
      const cats = [...new Set(sows.map(s => s.service_category).filter(Boolean))]
      setServiceCategories(cats)
    }

    // Load existing debrief
    const existing = await loadDebrief(id!)
    if (existing) {
      setOutcome(existing.outcome)
      setAwardDate(existing.award_date || '')
      setFinalAwardPrice(existing.final_award_price?.toString() || '')
      setOurProposedPrice(existing.our_proposed_price?.toString() || '')
      setGovEstimate(existing.government_estimate?.toString() || '')
      setWinningCompetitor(existing.winning_competitor || '')
      setWinningCompetitorPrice(existing.winning_competitor_price?.toString() || '')
      setLossReasons(existing.loss_reasons || [])
      setStrengths(existing.strengths || [])
      setWeaknesses(existing.weaknesses || [])
      setLessonsLearned(existing.lessons_learned || '')
      setPricingNotes(existing.pricing_notes || '')
      setSubPerformanceNotes(existing.sub_performance_notes || '')
      setWhatToRepeat(existing.what_to_repeat || '')
      setWhatToChange(existing.what_to_change || '')
      setEvaluatorFeedback(existing.evaluator_feedback || '')
      if (existing.service_categories?.length) setServiceCategories(existing.service_categories)
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!id || !taskOrder) return
    setSaving(true)
    setSaved(false)

    const debrief: DebriefType = {
      id: crypto.randomUUID(),
      task_order_id: id,
      task_order_title: taskOrder.title,
      outcome,
      award_date: awardDate || undefined,
      final_award_price: finalAwardPrice ? parseFloat(finalAwardPrice) : undefined,
      our_proposed_price: ourProposedPrice ? parseFloat(ourProposedPrice) : undefined,
      government_estimate: govEstimate ? parseFloat(govEstimate) : undefined,
      winning_competitor: winningCompetitor || undefined,
      winning_competitor_price: winningCompetitorPrice ? parseFloat(winningCompetitorPrice) : undefined,
      loss_reasons: lossReasons,
      strengths,
      weaknesses,
      lessons_learned: lessonsLearned,
      pricing_notes: pricingNotes,
      sub_performance_notes: subPerformanceNotes,
      what_to_repeat: whatToRepeat,
      what_to_change: whatToChange,
      evaluator_feedback: evaluatorFeedback,
      service_categories: serviceCategories,
      region: taskOrder.location_state || '',
      contract_value_range: getValueRange(parseFloat(ourProposedPrice || '0')),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      await saveDebrief(debrief)

      // Update task order status to match outcome
      const statusMap: Record<string, string> = {
        awarded: 'awarded',
        not_awarded: 'not_awarded',
        no_bid: 'not_awarded',
        withdrawn: 'not_awarded',
      }
      await supabase.from('task_orders').update({ status: statusMap[outcome] }).eq('id', id)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save debrief:', err)
    } finally {
      setSaving(false)
    }
  }

  function getValueRange(value: number): string {
    if (value <= 0) return 'Unknown'
    if (value < 100000) return 'Under $100K'
    if (value < 500000) return '$100K - $500K'
    if (value < 1000000) return '$500K - $1M'
    if (value < 5000000) return '$1M - $5M'
    return 'Over $5M'
  }

  function toggleItem(arr: string[], setArr: (v: string[]) => void, item: string) {
    setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item])
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Task order not found</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to={`/task-orders/${id}`} className="text-blue-600 hover:text-blue-800">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debrief: {taskOrder.title}</h1>
          <p className="text-sm text-gray-500">Record outcome, lessons learned, and competitive intelligence</p>
        </div>
      </div>

      {/* Outcome Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Bid Outcome</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'awarded', label: 'Awarded', icon: CheckCircle, color: 'green' },
            { value: 'not_awarded', label: 'Not Awarded', icon: XCircle, color: 'red' },
            { value: 'no_bid', label: 'No Bid', icon: MinusCircle, color: 'gray' },
            { value: 'withdrawn', label: 'Withdrawn', icon: AlertTriangle, color: 'amber' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setOutcome(opt.value as DebriefType['outcome'])}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                outcome === opt.value
                  ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <opt.icon size={24} className={`mx-auto mb-2 ${outcome === opt.value ? `text-${opt.color}-500` : 'text-gray-400'}`} />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Pricing Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Award / Decision Date</label>
            <input type="date" value={awardDate} onChange={e => setAwardDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Our Proposed Price ($)</label>
            <input type="number" value={ourProposedPrice} onChange={e => setOurProposedPrice(e.target.value)}
              placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {outcome === 'awarded' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Final Award Price ($)</label>
              <input type="number" value={finalAwardPrice} onChange={e => setFinalAwardPrice(e.target.value)}
                placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Government Estimate ($)</label>
            <input type="number" value={govEstimate} onChange={e => setGovEstimate(e.target.value)}
              placeholder="If known" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {outcome === 'not_awarded' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Winning Competitor</label>
                <input type="text" value={winningCompetitor} onChange={e => setWinningCompetitor(e.target.value)}
                  placeholder="Company name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Competitor&apos;s Winning Price ($)</label>
                <input type="number" value={winningCompetitorPrice} onChange={e => setWinningCompetitorPrice(e.target.value)}
                  placeholder="If known" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </>
          )}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Notes</label>
          <textarea value={pricingNotes} onChange={e => setPricingNotes(e.target.value)} rows={3}
            placeholder="Any observations about pricing strategy, markup decisions, cost drivers..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Loss Reasons (if not awarded) */}
      {outcome === 'not_awarded' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Reasons for Loss</h2>
          <p className="text-xs text-gray-500 mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {LOSS_REASON_OPTIONS.map(reason => (
              <button key={reason} onClick={() => toggleItem(lossReasons, setLossReasons, reason)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  lossReasons.includes(reason)
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}>
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Strengths Identified</h2>
        <p className="text-xs text-gray-500 mb-3">What worked well in this bid?</p>
        <div className="flex flex-wrap gap-2">
          {STRENGTH_OPTIONS.map(s => (
            <button key={s} onClick={() => toggleItem(strengths, setStrengths, s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                strengths.includes(s)
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Weaknesses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Weaknesses / Areas for Improvement</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {weaknesses.map(w => (
            <span key={w} className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
              {w}
              <button onClick={() => setWeaknesses(weaknesses.filter(x => x !== w))} className="hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={customWeakness} onChange={e => setCustomWeakness(e.target.value)}
            placeholder="Add a weakness..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            onKeyDown={e => { if (e.key === 'Enter' && customWeakness.trim()) { setWeaknesses([...weaknesses, customWeakness.trim()]); setCustomWeakness('') } }} />
          <button onClick={() => { if (customWeakness.trim()) { setWeaknesses([...weaknesses, customWeakness.trim()]); setCustomWeakness('') } }}
            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Lessons Learned & Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Lessons Learned & Notes</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lessons Learned</label>
          <textarea value={lessonsLearned} onChange={e => setLessonsLearned(e.target.value)} rows={3}
            placeholder="Key takeaways from this bid..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subcontractor Performance Notes</label>
          <textarea value={subPerformanceNotes} onChange={e => setSubPerformanceNotes(e.target.value)} rows={3}
            placeholder="How did subcontractors perform during the bid process? Responsiveness, pricing quality..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">What to Repeat</label>
            <textarea value={whatToRepeat} onChange={e => setWhatToRepeat(e.target.value)} rows={3}
              placeholder="Things that went well and should be repeated..."
              className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm bg-green-50/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-700 mb-1">What to Change</label>
            <textarea value={whatToChange} onChange={e => setWhatToChange(e.target.value)} rows={3}
              placeholder="Things that should be done differently next time..."
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-red-50/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evaluator Feedback (if available)</label>
          <textarea value={evaluatorFeedback} onChange={e => setEvaluatorFeedback(e.target.value)} rows={3}
            placeholder="Any feedback received from the contracting officer or evaluation team..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium">
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Debrief'}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <CheckCircle size={16} /> Debrief saved — intelligence updated
          </span>
        )}
      </div>
    </div>
  )
}
