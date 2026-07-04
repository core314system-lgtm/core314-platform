import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Shield, CheckCircle, XCircle, Clock, AlertTriangle,
  Save, ArrowLeft, Plus, Trash2, X, Settings, Edit2,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

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

interface GateTemplate {
  gate_number: number
  gate_name: string
  checklist: string[]
}

const HARDCODED_DEFAULTS: GateTemplate[] = [
  {
    gate_number: 0,
    gate_name: 'Gate 0: Opportunity Qualification',
    checklist: [
      'Opportunity aligns with strategic plan',
      'NAICS code and set-aside match our capabilities',
      'Contract value within our bonding/financial capacity',
      'Geographic coverage is feasible',
      'Past performance exists for this type of work',
      'Incumbent identified and assessed',
      'Customer relationship exists or can be established',
    ],
  },
  {
    gate_number: 1,
    gate_name: 'Gate 1: Capture Strategy',
    checklist: [
      'Win themes developed and validated',
      'Competitive assessment completed',
      'Teaming strategy defined',
      'Key personnel identified',
      'Customer engagement plan established',
      'Price-to-win range estimated',
      'Capture budget approved',
      'Risk assessment completed',
    ],
  },
  {
    gate_number: 2,
    gate_name: 'Gate 2: Win Strategy',
    checklist: [
      'Solution architecture validated',
      'Teaming agreements executed',
      'Past performance citations selected',
      'Cost/price model developed',
      'Win themes refined based on customer feedback',
      'Key personnel committed',
      'Draft outline reviewed',
      'Compliance matrix started',
    ],
  },
  {
    gate_number: 3,
    gate_name: 'Gate 3: Proposal Ready',
    checklist: [
      'RFP/RFQ received and analyzed',
      'Compliance matrix complete',
      'Proposal outline approved',
      'Writing assignments distributed',
      'Past performance volumes drafted',
      'Pricing volume in progress',
      'Subcontractor quotes requested/received',
      'Quality review schedule established',
      'Small business subcontracting plan drafted',
    ],
  },
  {
    gate_number: 4,
    gate_name: 'Gate 4: Submit / No-Submit Decision',
    checklist: [
      'All proposal volumes complete',
      'Red Team review completed and findings addressed',
      'Price is competitive (within PTW range)',
      'Compliance matrix shows 100% responsiveness',
      'All required certifications/representations complete',
      'Executive review and sign-off obtained',
      'Submission logistics confirmed (portal access, page limits, format)',
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
  const { currentOrg } = useOrg()
  const [gates, setGates] = useState<CaptureGate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGate, setExpandedGate] = useState<number | null>(null)
  const [autoExpanded, setAutoExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [editingGateName, setEditingGateName] = useState<number | null>(null)

  useEffect(() => {
    if (projectId) fetchGates()
  }, [projectId])

  async function getOrgTemplate(): Promise<GateTemplate[]> {
    if (!currentOrg?.id) return HARDCODED_DEFAULTS
    const { data } = await supabase
      .from('gate_templates')
      .select('gates')
      .eq('org_id', currentOrg.id)
      .eq('is_default', true)
      .single()

    if (data && Array.isArray(data.gates) && data.gates.length > 0) {
      return data.gates as GateTemplate[]
    }
    return HARDCODED_DEFAULTS
  }

  async function fetchGates() {
    setLoading(true)
    const { data } = await supabase
      .from('capture_gates')
      .select('*')
      .eq('task_order_id', projectId)
      .order('gate_number', { ascending: true })

    if (data && data.length > 0) {
      const loaded = data as CaptureGate[]
      setGates(loaded)
      if (!autoExpanded) {
        const firstIncomplete = loaded.findIndex(g => g.status === 'not_started' || g.status === 'in_progress')
        if (firstIncomplete >= 0) setExpandedGate(firstIncomplete)
        setAutoExpanded(true)
      }
    } else {
      await initializeGates()
    }
    setLoading(false)
  }

  async function initializeGates() {
    const template = await getOrgTemplate()
    const inserts = template.map(g => ({
      task_order_id: projectId,
      gate_number: g.gate_number,
      gate_name: g.gate_name,
      status: 'not_started',
      checklist: g.checklist.map(item => ({ item, checked: false, notes: '' })),
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
        gate_name: gate.gate_name,
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

  function addChecklistItemToGate(gateIndex: number) {
    if (!newChecklistItem.trim()) return
    const gate = gates[gateIndex]
    const newChecklist = [...gate.checklist, { item: newChecklistItem.trim(), checked: false, notes: '' }]
    updateLocalGate(gateIndex, { checklist: newChecklist })
    setNewChecklistItem('')
  }

  function removeChecklistItemFromGate(gateIndex: number, itemIndex: number) {
    const gate = gates[gateIndex]
    const newChecklist = gate.checklist.filter((_, i) => i !== itemIndex)
    updateLocalGate(gateIndex, { checklist: newChecklist })
  }

  async function addNewGate() {
    if (!projectId) return
    const newGateNumber = gates.length
    const { data } = await supabase
      .from('capture_gates')
      .insert({
        task_order_id: projectId,
        gate_number: newGateNumber,
        gate_name: `Gate ${newGateNumber}: New Gate`,
        status: 'not_started',
        checklist: [{ item: 'New checklist item', checked: false, notes: '' }],
        reviewers: [],
      })
      .select()
      .single()

    if (data) {
      setGates([...gates, data as CaptureGate])
      setExpandedGate(newGateNumber)
    }
  }

  async function removeGate(index: number) {
    if (!confirm(`Remove "${gates[index].gate_name}"? This will delete all checklist data for this gate.`)) return
    const gate = gates[index]
    await supabase.from('capture_gates').delete().eq('id', gate.id)
    const remaining = gates.filter((_, i) => i !== index)
    // Re-number remaining gates
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].gate_number !== i) {
        await supabase.from('capture_gates').update({ gate_number: i }).eq('id', remaining[i].id)
        remaining[i] = { ...remaining[i], gate_number: i }
      }
    }
    setGates(remaining)
    if (expandedGate === index) setExpandedGate(null)
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={28} />
            Capture Gate Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track decisions from qualification through submission</p>
        </div>
        <button
          onClick={() => setCustomizing(!customizing)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
            customizing ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Settings size={14} /> {customizing ? 'Done Customizing' : 'Customize Gates'}
        </button>
      </div>

      <FeatureGuidance
        title="How Capture Gate Reviews Work"
        description="Shipley-aligned gate reviews help your team make disciplined GO/NO-GO decisions at each stage of the capture lifecycle."
        storageKey="capture_gates"
        accentColor="blue"
        steps={[
          { title: 'Start with Gate 0', description: 'Click on Gate 0 below to evaluate whether this opportunity is worth pursuing. Review each checklist item and check off what applies.' },
          { title: 'Complete the checklist', description: 'Each gate has specific criteria. Check items as you verify them — the progress bar updates automatically.' },
          { title: 'Make your decision', description: 'Choose GO (proceed), NO-GO (stop), or CONDITIONAL GO (proceed with caveats). Add your rationale for the record.' },
          { title: 'Customize if needed', description: 'Click "Customize Gates" to add/remove gates or checklist items for this project. Set org-wide defaults in Settings → Gate Templates.' },
        ]}
      />

      {customizing && (
        <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center justify-between">
          <span>Customization mode — add, remove, or rename gates and checklist items for this project. Remember to save each gate after changes.</span>
          <Link to="/settings/gate-templates" className="text-blue-600 hover:underline flex-shrink-0 ml-3">
            Edit org-wide template →
          </Link>
        </div>
      )}

      {/* Progress Overview */}
      <div className={`grid gap-3 mb-8`} style={{ gridTemplateColumns: `repeat(${Math.min(gates.length, 7)}, 1fr)` }}>
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
              <div className="text-xs font-semibold text-gray-700 truncate">Gate {gate.gate_number}</div>
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
            {editingGateName === expandedGate ? (
              <input
                type="text"
                value={gates[expandedGate].gate_name}
                onChange={e => updateLocalGate(expandedGate, { gate_name: e.target.value })}
                onBlur={() => setEditingGateName(null)}
                onKeyDown={e => e.key === 'Enter' && setEditingGateName(null)}
                autoFocus
                className="text-lg font-bold px-2 py-1 border rounded focus:ring-2 focus:ring-blue-200 outline-none flex-1 mr-3"
              />
            ) : (
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {gates[expandedGate].gate_name}
                {customizing && (
                  <button onClick={() => setEditingGateName(expandedGate)} className="p-1 hover:bg-gray-100 rounded">
                    <Edit2 size={14} className="text-gray-400" />
                  </button>
                )}
              </h2>
            )}
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
              {customizing && (
                <button
                  onClick={() => removeGate(expandedGate)}
                  disabled={gates.length <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 text-sm disabled:opacity-30"
                >
                  <Trash2 size={14} /> Remove Gate
                </button>
              )}
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
                  {customizing && (
                    <button
                      onClick={() => removeChecklistItemFromGate(expandedGate, i)}
                      className="p-1 hover:bg-red-50 rounded"
                    >
                      <X size={12} className="text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {customizing && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={e => setNewChecklistItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItemToGate(expandedGate))}
                  placeholder="Add a checklist item..."
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                />
                <button
                  onClick={() => addChecklistItemToGate(expandedGate)}
                  disabled={!newChecklistItem.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
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

      {customizing && (
        <button
          onClick={addNewGate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
        >
          <Plus size={16} /> Add Gate
        </button>
      )}
    </div>
  )
}
