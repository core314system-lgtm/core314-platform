import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Shield, Plus, Trash2, GripVertical, Save, RotateCcw,
  ChevronDown, ChevronUp, X, Check, Loader2, Edit2,
} from 'lucide-react'

interface GateTemplate {
  gate_number: number
  gate_name: string
  checklist: string[]
}

interface OrgGateConfig {
  id?: string
  org_id: string
  template_name: string
  gates: GateTemplate[]
  is_default: boolean
  created_at?: string
  updated_at?: string
}

const SHIPLEY_DEFAULT: GateTemplate[] = [
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

export default function GateTemplates() {
  const { currentOrg } = useOrg()
  const [config, setConfig] = useState<OrgGateConfig | null>(null)
  const [gates, setGates] = useState<GateTemplate[]>(SHIPLEY_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedGate, setExpandedGate] = useState<number | null>(null)
  const [newItemInputs, setNewItemInputs] = useState<Record<number, string>>({})
  const [editingGateName, setEditingGateName] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (currentOrg?.id) fetchConfig()
  }, [currentOrg?.id])

  async function fetchConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('gate_templates')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .eq('is_default', true)
      .single()

    if (data) {
      setConfig(data as OrgGateConfig)
      setGates((data as OrgGateConfig).gates)
    } else {
      setConfig(null)
      setGates(SHIPLEY_DEFAULT)
    }
    setLoading(false)
    setHasChanges(false)
  }

  async function handleSave() {
    if (!currentOrg?.id) return
    setSaving(true)
    setSaved(false)

    const numberedGates = gates.map((g, i) => ({ ...g, gate_number: i }))

    if (config?.id) {
      await supabase
        .from('gate_templates')
        .update({
          gates: numberedGates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id)
    } else {
      const { data } = await supabase
        .from('gate_templates')
        .insert({
          org_id: currentOrg.id,
          template_name: 'Default',
          gates: numberedGates,
          is_default: true,
        })
        .select()
        .single()
      if (data) setConfig(data as OrgGateConfig)
    }

    setSaving(false)
    setSaved(true)
    setHasChanges(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleResetToShipley() {
    if (!confirm('Reset to Shipley defaults? This will replace your current gate configuration.')) return
    setGates(SHIPLEY_DEFAULT)
    setHasChanges(true)
  }

  function addGate() {
    const newGateNum = gates.length
    setGates([...gates, {
      gate_number: newGateNum,
      gate_name: `Gate ${newGateNum}: New Gate`,
      checklist: ['New checklist item'],
    }])
    setExpandedGate(newGateNum)
    setHasChanges(true)
  }

  function removeGate(index: number) {
    if (!confirm(`Remove "${gates[index].gate_name}"? This cannot be undone.`)) return
    setGates(gates.filter((_, i) => i !== index))
    if (expandedGate === index) setExpandedGate(null)
    setHasChanges(true)
  }

  function updateGateName(index: number, name: string) {
    const updated = [...gates]
    updated[index] = { ...updated[index], gate_name: name }
    setGates(updated)
    setHasChanges(true)
  }

  function addChecklistItem(gateIndex: number) {
    const text = newItemInputs[gateIndex]?.trim()
    if (!text) return
    const updated = [...gates]
    updated[gateIndex] = {
      ...updated[gateIndex],
      checklist: [...updated[gateIndex].checklist, text],
    }
    setGates(updated)
    setNewItemInputs({ ...newItemInputs, [gateIndex]: '' })
    setHasChanges(true)
  }

  function removeChecklistItem(gateIndex: number, itemIndex: number) {
    const updated = [...gates]
    updated[gateIndex] = {
      ...updated[gateIndex],
      checklist: updated[gateIndex].checklist.filter((_, i) => i !== itemIndex),
    }
    setGates(updated)
    setHasChanges(true)
  }

  function moveGate(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= gates.length) return
    const updated = [...gates]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setGates(updated)
    if (expandedGate === index) setExpandedGate(newIndex)
    setHasChanges(true)
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto text-center py-20 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-blue-600" size={28} />
            Gate Review Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define your organization's default gate review structure. New projects will use this template.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToShipley}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            <RotateCcw size={14} /> Reset to Shipley
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Template'}
          </button>
        </div>
      </div>

      {config && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <Check size={14} /> Custom template active — {gates.length} gate{gates.length !== 1 ? 's' : ''} defined
        </div>
      )}
      {!config && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Shield size={14} /> Using Shipley defaults — customize below and save to create your org template
        </div>
      )}

      <div className="space-y-3">
        {gates.map((gate, gateIndex) => (
          <div key={gateIndex} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 p-4">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveGate(gateIndex, 'up')}
                  disabled={gateIndex === 0}
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronUp size={12} className="text-gray-400" />
                </button>
                <button
                  onClick={() => moveGate(gateIndex, 'down')}
                  disabled={gateIndex === gates.length - 1}
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronDown size={12} className="text-gray-400" />
                </button>
              </div>
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingGateName === gateIndex ? (
                  <input
                    type="text"
                    value={gate.gate_name}
                    onChange={e => updateGateName(gateIndex, e.target.value)}
                    onBlur={() => setEditingGateName(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingGateName(null)}
                    autoFocus
                    className="w-full px-2 py-1 border rounded text-sm font-semibold focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingGateName(gateIndex)}
                    className="text-left w-full group"
                  >
                    <span className="font-semibold text-gray-900 group-hover:text-blue-600">{gate.gate_name}</span>
                    <Edit2 size={12} className="inline ml-2 text-gray-300 group-hover:text-blue-400" />
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{gate.checklist.length} checklist item{gate.checklist.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setExpandedGate(expandedGate === gateIndex ? null : gateIndex)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                {expandedGate === gateIndex ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={() => removeGate(gateIndex)}
                disabled={gates.length <= 1}
                className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-30"
              >
                <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>

            {expandedGate === gateIndex && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Checklist Items</h4>
                <div className="space-y-1.5 mb-3">
                  {gate.checklist.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <span className="text-xs text-gray-400 w-5">{itemIndex + 1}.</span>
                      <span className="text-sm text-gray-700 flex-1">{item}</span>
                      <button
                        onClick={() => removeChecklistItem(gateIndex, itemIndex)}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <X size={12} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInputs[gateIndex] || ''}
                    onChange={e => setNewItemInputs({ ...newItemInputs, [gateIndex]: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChecklistItem(gateIndex))}
                    placeholder="Add a checklist item..."
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                  <button
                    onClick={() => addChecklistItem(gateIndex)}
                    disabled={!newItemInputs[gateIndex]?.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addGate}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
      >
        <Plus size={16} /> Add Gate
      </button>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>Note:</strong> Changes to this template only affect <em>new</em> projects. Existing projects keep their current gate configuration. To customize gates for a specific project, use the "Customize Gates" option on that project's Capture Gate Reviews page.
      </div>
    </div>
  )
}
