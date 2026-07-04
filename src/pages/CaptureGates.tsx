import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Shield, CheckCircle, XCircle, Clock, AlertTriangle,
  Save, ArrowLeft,
} from 'lucide-react'

interface GateChecklist {
  item: string
  checked: boolean
  notes: string
}

interface CaptureGate {
  id: string
  task_order_id: string
  gate_number: number
  gate_name: string
  status: string
  scheduled_date: string | null
  completed_date: string | null
  decision: string | null
  decision_rationale: string | null
  checklist: GateChecklist[]
  reviewers: string[]
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_GATES = [
  {
    gate_number: 0,
    gate_name: 'Gate 0: Opportunity Qualification',
    checklist: [
      { item: 'Opportunity aligns with strategic plan', checked: false, notes: '' },
      { item: 'NAICS code and set-aside match our capabilities', checked: false, notes: '' },
      { item: 'Contract value within our bonding/financial capacity', checked: false, notes: '' },
      { item: 'Geographic coverage is feasible', checked: false, notes: '' },
      { item: 'Past performance exists for this type of work', checked: false, notes: '' },
      { item: 'Incumbent identified and assessed', checked: false, notes: '' },
      { item: 'Customer relationship exists or can be established', checked: false, notes: '' },
    ],
  },
  {
    gate_number: 1,
    gate_name: 'Gate 1: Capture Strategy',
    checklist: [
      { item: 'Win themes developed and validated', checked: false, notes: '' },
      { item: 'Competitive assessment completed', checked: false, notes: '' },
      { item: 'Teaming strategy defined', checked: false, notes: '' },
      { item: 'Key personnel identified', checked: false, notes: '' },
      { item: 'Customer engagement plan established', checked: false, notes: '' },
      { item: 'Price-to-win range estimated', checked: false, notes: '' },
      { item: 'Capture budget approved', checked: false, notes: '' },
      { item: 'Risk assessment completed', checked: false, notes: '' },
    ],
  },
  {
    gate_number: 2,
    gate_name: 'Gate 2: Win Strategy',
    checklist: [
      { item: 'Solution architecture validated', checked: false, notes: '' },
      { item: 'Teaming agreements executed', checked: false, notes: '' },
      { item: 'Past performance citations selected', checked: false, notes: '' },
      { item: 'Cost/price model developed', checked: false, notes: '' },
      { item: 'Win themes refined based on customer feedback', checked: false, notes: '' },
      { item: 'Key personnel committed', checked: false, notes: '' },
      { item: 'Draft outline reviewed', checked: false, notes: '' },
      { item: 'Compliance matrix started', checked: false, notes: '' },
    ],
  },
  {
    gate_number: 3,
    gate_name: 'Gate 3: Proposal Ready',
    checklist: [
      { item: 'RFP/RFQ received and analyzed', checked: false, notes: '' },
      { item: 'Compliance matrix complete', checked: false, notes: '' },
      { item: 'Proposal outline approved', checked: false, notes: '' },
      { item: 'Writing assignments distributed', checked: false, notes: '' },
      { item: 'Past performance volumes drafted', checked: false, notes: '' },
      { item: 'Pricing volume in progress', checked: false, notes: '' },
      { item: 'Subcontractor quotes requested/received', checked: false, notes: '' },
      { item: 'Quality review schedule established', checked: false, notes: '' },
      { item: 'Small business subcontracting plan drafted', checked: false, notes: '' },
    ],
  },
  {
    gate_number: 4,
    gate_name: 'Gate 4: Submit / No-Submit Decision',
    checklist: [
      { item: 'All proposal volumes complete', checked: false, notes: '' },
      { item: 'Red Team review completed and findings addressed', checked: false, notes: '' },
      { item: 'Price is competitive (within PTW range)', checked: false, notes: '' },
      { item: 'Compliance matrix shows 100% responsiveness', checked: false, notes: '' },
      { item: 'All required certifications/representations complete', checked: false, notes: '' },
      { item: 'Executive review and sign-off obtained', checked: false, notes: '' },
      { item: 'Submission logistics confirmed (portal access, page limits, format)', checked: false, notes: '' },
    ],
  },
]

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  not_started: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Not Started' },
  in_progress: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'In Progress' },
  passed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Passed' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
  skipped: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Skipped' },
}

const DECISION_OPTIONS = [
  { value: 'go', label: 'GO', color: 'bg-green-600' },
  { value: 'no_go', label: 'NO-GO', color: 'bg-red-600' },
  { value: 'conditional_go', label: 'CONDITIONAL GO', color: 'bg-yellow-500' },
]

export default function CaptureGates() {
  const { id: projectId } = useParams<{ id: string }>()
  const [gates, setGates] = useState<CaptureGate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGate, setExpandedGate] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (projectId) fetchGates()
  }, [projectId])

  async function fetchGates() {
    setLoading(true)
    const { data } = await supabase
      .from('capture_gates')
      .select('*')
      .eq('task_order_id', projectId)
      .order('gate_number', { ascending: true })

    if (data && data.length > 0) {
      setGates(data as CaptureGate[])
    } else {
      // Initialize default gates for this project
      await initializeGates()
    }
    setLoading(false)
  }

  async function initializeGates() {
    const inserts = DEFAULT_GATES.map(g => ({
      task_order_id: projectId,
      gate_number: g.gate_number,
      gate_name: g.gate_name,
      status: 'not_started',
      checklist: g.checklist,
      reviewers: [],
    }))

    const { data } = await supabase
      .from('capture_gates')
      .insert(inserts)
      .select()

    if (data) setGates(data as CaptureGate[])
  }

  async function updateGate(gate: CaptureGate) {
    setSaving(true)
    await supabase
      .from('capture_gates')
      .update({
        status: gate.status,
        scheduled_date: gate.scheduled_date,
        completed_date: gate.completed_date,
        decision: gate.decision,
        decision_rationale: gate.decision_rationale,
        checklist: gate.checklist,
        reviewers: gate.reviewers,
        approved_by: gate.approved_by,
        notes: gate.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gate.id)
    setSaving(false)
  }

  function updateLocalGate(index: number, updates: Partial<CaptureGate>) {
    const updated = [...gates]
    updated[index] = { ...updated[index], ...updates }
    setGates(updated)
  }

  function toggleChecklistItem(gateIndex: number, itemIndex: number) {
    const gate = gates[gateIndex]
    const newChecklist = [...gate.checklist]
    newChecklist[itemIndex] = { ...newChecklist[itemIndex], checked: !newChecklist[itemIndex].checked }
    updateLocalGate(gateIndex, { checklist: newChecklist })
  }

  function getProgress(gate: CaptureGate): number {
    if (!gate.checklist || gate.checklist.length === 0) return 0
    const checked = gate.checklist.filter(c => c.checked).length
    return Math.round((checked / gate.checklist.length) * 100)
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading capture gates...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={28} />
            Capture Gate Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Shipley-aligned gate review process — track decisions from qualification through submission</p>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {gates.map((gate, i) => {
          const config = STATUS_CONFIG[gate.status] || STATUS_CONFIG.not_started
          const Icon = config.icon
          const progress = getProgress(gate)
          return (
            <button
              key={gate.id}
              onClick={() => setExpandedGate(expandedGate === i ? null : i)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                expandedGate === i ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon size={20} className={`mx-auto mb-1 ${config.color}`} />
              <div className="text-xs font-semibold text-gray-700">Gate {gate.gate_number}</div>
              <div className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${config.bg} ${config.color}`}>
                {config.label}
              </div>
              <div className="mt-1.5">
                <div className="w-full h-1 bg-gray-200 rounded-full">
                  <div className="h-1 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{progress}%</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Expanded Gate Detail */}
      {expandedGate !== null && gates[expandedGate] && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{gates[expandedGate].gate_name}</h2>
            <div className="flex items-center gap-3">
              <select
                value={gates[expandedGate].status}
                onChange={e => updateLocalGate(expandedGate, { status: e.target.value })}
                className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button
                onClick={() => updateGate(gates[expandedGate])}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
              <input
                type="date"
                value={gates[expandedGate].scheduled_date || ''}
                onChange={e => updateLocalGate(expandedGate, { scheduled_date: e.target.value || null })}
                className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Completed Date</label>
              <input
                type="date"
                value={gates[expandedGate].completed_date || ''}
                onChange={e => updateLocalGate(expandedGate, { completed_date: e.target.value || null })}
                className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Review Checklist</h3>
            <div className="space-y-2">
              {gates[expandedGate].checklist.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecklistItem(expandedGate, i)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm flex-1 ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {item.item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Gate Decision</h3>
            <div className="flex gap-2 mb-3">
              {DECISION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateLocalGate(expandedGate, { decision: opt.value })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    gates[expandedGate].decision === opt.value
                      ? `${opt.color} text-white shadow-lg`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              value={gates[expandedGate].decision_rationale || ''}
              onChange={e => updateLocalGate(expandedGate, { decision_rationale: e.target.value })}
              placeholder="Decision rationale..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
            <textarea
              value={gates[expandedGate].notes || ''}
              onChange={e => updateLocalGate(expandedGate, { notes: e.target.value })}
              placeholder="Additional notes for this gate review..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
