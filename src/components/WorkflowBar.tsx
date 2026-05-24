import { useState } from 'react'
import { ChevronRight, Lock, Check, AlertTriangle } from 'lucide-react'
import { getWorkflowStages, getStageColor } from '../lib/projectTypes'
import type { WorkflowStage } from '../lib/projectTypes'

export interface SowCoverageItem {
  name: string
  hasQuotes: boolean
  quoteCount: number
}

interface WorkflowBarProps {
  projectTypeId: string | null | undefined
  currentStageId: string
  onStageChange: (newStageId: string, note?: string) => Promise<void>
  canManage: boolean
  sowCoverage?: SowCoverageItem[]
}

// Stages that require full SOW quote coverage before advancing
const GATED_STAGES = ['submitted', 'awarded']

export default function WorkflowBar({ projectTypeId, currentStageId, onStageChange, canManage, sowCoverage }: WorkflowBarProps) {
  const stages = getWorkflowStages(projectTypeId)
  const currentIndex = stages.findIndex(s => s.id === currentStageId)
  const [changing, setChanging] = useState(false)
  const [showConfirm, setShowConfirm] = useState<WorkflowStage | null>(null)
  const [stageNote, setStageNote] = useState('')
  const [overrideGate, setOverrideGate] = useState(false)

  // Calculate coverage gaps
  const uncoveredSows = sowCoverage?.filter(s => !s.hasQuotes) || []
  const hasGaps = uncoveredSows.length > 0
  const totalSows = sowCoverage?.length || 0

  function isGatedStage(stageId: string): boolean {
    return GATED_STAGES.includes(stageId)
  }

  async function handleStageClick(stage: WorkflowStage, _index: number) {
    if (!canManage || changing) return
    if (stage.id === currentStageId) return
    setShowConfirm(stage)
    setStageNote('')
    setOverrideGate(false)
  }

  async function confirmStageChange() {
    if (!showConfirm) return
    setChanging(true)
    await onStageChange(showConfirm.id, stageNote || undefined)
    setChanging(false)
    setShowConfirm(null)
    setStageNote('')
    setOverrideGate(false)
  }

  const showGateWarning = showConfirm && isGatedStage(showConfirm.id) && hasGaps && sowCoverage && sowCoverage.length > 0

  return (
    <div className="space-y-3">
      {/* Stage progress bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, i) => {
          const isPast = i < currentIndex
          const isCurrent = i === currentIndex
          const isFuture = i > currentIndex
          const colors = getStageColor(stage.color)

          return (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => handleStageClick(stage, i)}
                disabled={!canManage || changing || stage.id === currentStageId}
                className={`
                  relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                  transition-all whitespace-nowrap
                  ${isCurrent ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-${stage.color}-400` : ''}
                  ${isPast ? 'bg-gray-50 text-gray-500' : ''}
                  ${isFuture ? 'bg-gray-50 text-gray-400' : ''}
                  ${canManage && stage.id !== currentStageId ? 'hover:bg-gray-100 cursor-pointer' : ''}
                  ${!canManage || stage.id === currentStageId ? 'cursor-default' : ''}
                `}
                title={stage.description}
              >
                {isPast && <Check size={12} className="text-green-500" />}
                {isCurrent && <span className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                {stage.requiresApproval && isFuture && <Lock size={10} className="text-gray-400" />}
                {stage.label}
              </button>
              {i < stages.length - 1 && (
                <ChevronRight size={14} className={`mx-0.5 flex-shrink-0 ${i < currentIndex ? 'text-green-400' : 'text-gray-300'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Stage description */}
      {stages[currentIndex] && (
        <p className="text-xs text-gray-500 italic">
          {stages[currentIndex].description}
        </p>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900">Change Stage</h3>
            <p className="text-sm text-gray-600">
              Move this project from <strong>{stages[currentIndex]?.label}</strong> to <strong>{showConfirm.label}</strong>?
            </p>

            {/* SOW Coverage Gate Warning */}
            {showGateWarning && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                  <AlertTriangle size={16} />
                  SOW Coverage Incomplete — {uncoveredSows.length} of {totalSows} items missing quotes
                </div>
                <ul className="text-xs text-red-700 space-y-1 ml-6 list-disc">
                  {uncoveredSows.map(s => (
                    <li key={s.name}>{s.name} — No quotes received</li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 mt-2">
                  All SOW items should have at least one subcontractor quote before submitting a bid.
                  Go to SOW Tracker to send RFQs for uncovered items.
                </p>
                <label className="flex items-center gap-2 text-xs text-red-700 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideGate}
                    onChange={e => setOverrideGate(e.target.checked)}
                    className="rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  I acknowledge the gaps and want to proceed anyway
                </label>
              </div>
            )}

            {showConfirm.requiresApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 flex items-center gap-2">
                <Lock size={14} />
                This stage requires approval. The change will be recorded in the audit trail.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea
                value={stageNote}
                onChange={e => setStageNote(e.target.value)}
                placeholder="Why is this stage changing? (recorded in audit trail)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmStageChange}
                disabled={changing || (showGateWarning && !overrideGate)}
                className={`px-4 py-2 text-sm rounded-lg disabled:opacity-50 ${
                  showGateWarning && !overrideGate
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {changing ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
