import { useState } from 'react'
import { ChevronRight, Lock, Check } from 'lucide-react'
import { getWorkflowStages, getStageColor } from '../lib/projectTypes'
import type { WorkflowStage } from '../lib/projectTypes'

interface WorkflowBarProps {
  projectTypeId: string | null | undefined
  currentStageId: string
  onStageChange: (newStageId: string, note?: string) => Promise<void>
  canManage: boolean
}

export default function WorkflowBar({ projectTypeId, currentStageId, onStageChange, canManage }: WorkflowBarProps) {
  const stages = getWorkflowStages(projectTypeId)
  const currentIndex = stages.findIndex(s => s.id === currentStageId)
  const [changing, setChanging] = useState(false)
  const [showConfirm, setShowConfirm] = useState<WorkflowStage | null>(null)
  const [stageNote, setStageNote] = useState('')

  async function handleStageClick(stage: WorkflowStage, _index: number) {
    if (!canManage || changing) return
    if (stage.id === currentStageId) return
    // Allow moving to any stage (forward or backward)
    setShowConfirm(stage)
    setStageNote('')
  }

  async function confirmStageChange() {
    if (!showConfirm) return
    setChanging(true)
    await onStageChange(showConfirm.id, stageNote || undefined)
    setChanging(false)
    setShowConfirm(null)
    setStageNote('')
  }

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
                disabled={changing}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
