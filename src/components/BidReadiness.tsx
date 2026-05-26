import { useState, useEffect } from 'react'
import { ClipboardCheck, FileText, Brain, Users, Shield, Clock, CheckCircle, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'

interface BidReadinessProps {
  taskOrderId: string
  projectStatus: string
  documentCount: number
  analysisComplete: boolean
  dueDate: string | null
}

interface ChecklistItem {
  id: string
  label: string
  description: string
  complete: boolean
  icon: React.ReactNode
  category: 'preparation' | 'analysis' | 'team' | 'review'
}

export default function BidReadiness({ taskOrderId, projectStatus, documentCount, analysisComplete, dueDate }: BidReadinessProps) {
  const [expanded, setExpanded] = useState(false)
  const [complianceReady, setComplianceReady] = useState(false)
  const [rfqReady, setRfqReady] = useState(false)
  const [execSummaryReady, setExecSummaryReady] = useState(false)
  const [teamAssigned, setTeamAssigned] = useState(false)
  const [subAssignments, setSubAssignments] = useState(0)

  useEffect(() => {
    checkOutputs()
  }, [taskOrderId, analysisComplete])

  async function checkOutputs() {
    const [compliance, rfq, execSummary] = await Promise.all([
      loadAiOutput(taskOrderId, 'compliance_matrix'),
      loadAiOutput(taskOrderId, 'rfq_packages'),
      loadAiOutput(taskOrderId, 'executive_summary'),
    ])
    setComplianceReady(!!compliance)
    setRfqReady(!!rfq)
    setExecSummaryReady(!!execSummary)

    // Check team assignments
    try {
      const { count } = await supabase
        .from('project_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('task_order_id', taskOrderId)
      setTeamAssigned((count || 0) > 0)
    } catch {
      // table may not exist
    }

    // Check sub assignments
    try {
      const { count } = await supabase
        .from('sow_subcontractors')
        .select('id', { count: 'exact', head: true })
        .eq('task_order_id', taskOrderId)
      setSubAssignments(count || 0)
    } catch {
      // table may not exist
    }
  }

  // Don't show for completed projects
  if (['awarded', 'not_awarded'].includes(projectStatus)) return null

  const items: ChecklistItem[] = [
    {
      id: 'documents',
      label: 'Documents uploaded',
      description: documentCount > 0 ? `${documentCount} document${documentCount !== 1 ? 's' : ''} uploaded` : 'Upload SOW, pricing sheets, and exhibits',
      complete: documentCount > 0,
      icon: <FileText size={14} />,
      category: 'preparation',
    },
    {
      id: 'analysis',
      label: 'AI analysis completed',
      description: analysisComplete ? 'Requirements and service categories extracted' : 'Run AI analysis to extract requirements',
      complete: analysisComplete,
      icon: <Brain size={14} />,
      category: 'analysis',
    },
    {
      id: 'compliance',
      label: 'Compliance matrix generated',
      description: complianceReady ? 'Compliance matrix ready for review' : 'Generate compliance matrix from analysis',
      complete: complianceReady,
      icon: <Shield size={14} />,
      category: 'analysis',
    },
    {
      id: 'rfq',
      label: 'RFQ packages created',
      description: rfqReady ? 'RFQ packages ready to send' : 'Generate RFQ packages for subcontractor outreach',
      complete: rfqReady,
      icon: <FileText size={14} />,
      category: 'analysis',
    },
    {
      id: 'exec_summary',
      label: 'Executive summary prepared',
      description: execSummaryReady ? 'Executive summary ready for review' : 'Generate executive summary for internal review',
      complete: execSummaryReady,
      icon: <ClipboardCheck size={14} />,
      category: 'review',
    },
    {
      id: 'team',
      label: 'Team members assigned',
      description: teamAssigned ? 'Project team is assigned' : 'Assign team members to this project',
      complete: teamAssigned,
      icon: <Users size={14} />,
      category: 'team',
    },
    {
      id: 'subs',
      label: 'Subcontractors aligned',
      description: subAssignments > 0 ? `${subAssignments} subcontractor${subAssignments !== 1 ? 's' : ''} assigned to SOWs` : 'Match subcontractors to service categories',
      complete: subAssignments > 0,
      icon: <Users size={14} />,
      category: 'team',
    },
  ]

  const completedCount = items.filter(i => i.complete).length
  const totalCount = items.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)

  // Deadline info
  let deadlineInfo: { text: string; urgent: boolean } | null = null
  if (dueDate) {
    const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft > 0) {
      deadlineInfo = {
        text: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until deadline`,
        urgent: daysLeft <= 7,
      }
    } else if (daysLeft === 0) {
      deadlineInfo = { text: 'Deadline is today', urgent: true }
    } else {
      deadlineInfo = { text: `Deadline was ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`, urgent: true }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">Bid Readiness</span>
          <span className="text-xs text-gray-400">{completedCount}/{totalCount} steps</span>
        </div>
        <div className="flex items-center gap-3">
          {deadlineInfo && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              deadlineInfo.urgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Clock size={10} className="inline mr-1" />
              {deadlineInfo.text}
            </span>
          )}
          <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progressPercent === 100 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500">{progressPercent}%</span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg ${
                item.complete ? 'bg-green-50/50' : 'bg-gray-50'
              }`}
            >
              {item.complete ? (
                <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`text-xs font-medium ${item.complete ? 'text-green-700' : 'text-gray-700'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
