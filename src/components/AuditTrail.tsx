import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, ChevronDown, ChevronUp, User } from 'lucide-react'
import { getStageColor, getWorkflowStage } from '../lib/projectTypes'

interface AuditEntry {
  id: string
  task_order_id: string
  from_stage: string | null
  to_stage: string
  changed_by: string
  changed_by_name: string | null
  note: string | null
  created_at: string
}

interface AuditTrailProps {
  taskOrderId: string
  projectTypeId: string | null | undefined
}

export default function AuditTrail({ taskOrderId, projectTypeId }: AuditTrailProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    loadAuditTrail()
  }, [taskOrderId])

  async function loadAuditTrail() {
    const { data, error } = await supabase
      .from('workflow_history')
      .select('*')
      .eq('task_order_id', taskOrderId)
      .order('created_at', { ascending: false })

    if (error) {
      // Table may not exist yet
      setSupported(false)
      return
    }

    setEntries(data || [])
  }

  if (!supported || entries.length === 0) return null

  const displayed = expanded ? entries : entries.slice(0, 3)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Clock size={16} />
          Activity Log ({entries.length})
        </h3>
        {entries.length > 3 && (
          expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      <div className="mt-3 space-y-3">
        {displayed.map(entry => {
          const fromStage = entry.from_stage ? getWorkflowStage(projectTypeId, entry.from_stage) : null
          const toStage = getWorkflowStage(projectTypeId, entry.to_stage)
          const toColors = getStageColor(toStage.color)

          return (
            <div key={entry.id} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5">
                <User size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-medium text-gray-700">{entry.changed_by_name || 'System'}</span>
                  {fromStage ? (
                    <>
                      <span className="text-gray-400">moved to</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${toColors.bg} ${toColors.text} font-medium`}>
                        {toStage.label}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-400">created project at</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${toColors.bg} ${toColors.text} font-medium`}>
                        {toStage.label}
                      </span>
                    </>
                  )}
                </div>
                {entry.note && (
                  <p className="text-gray-500 mt-0.5 italic">"{entry.note}"</p>
                )}
                <p className="text-gray-400 mt-0.5">
                  {new Date(entry.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {!expanded && entries.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Show {entries.length - 3} more...
        </button>
      )}
    </div>
  )
}
