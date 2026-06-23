import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput, saveAiOutput } from '../lib/aiStorage'
import { generatePostAwardChecklist } from '../lib/api'
import type { PostAwardChecklistItem } from '../lib/api'
import type { TaskOrder } from '../lib/types'
import { ArrowLeft, CheckCircle2, Circle, Clock, FileText, Users, Shield, DollarSign, Calendar, AlertTriangle, Loader2, Sparkles, RotateCw, Wrench, Zap, Building2, Truck, HardHat } from 'lucide-react'

type ChecklistItem = PostAwardChecklistItem

export default function PostAward() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [hasProjectData, setHasProjectData] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    const { data: to } = await supabase.from('task_orders').select('*').eq('id', id).single()
    setTaskOrder(to)

    // Check if project has AI analysis data
    const analysis = await loadAiOutput<Record<string, unknown>>(id, 'analysis')
    setHasProjectData(analysis !== null)

    // Load saved checklist from storage
    const saved = await loadAiOutput<{ checklist: ChecklistItem[]; ai_generated?: boolean }>(id, 'post_award_checklist')

    if (saved?.checklist && saved.checklist.length > 0) {
      setChecklist(saved.checklist)
      setIsAiGenerated(saved.ai_generated === true)
    } else {
      // No saved checklist — auto-generate if project data exists, otherwise use defaults
      if (analysis && to) {
        await generateChecklist(to, analysis)
      } else {
        initializeDefaultChecklist()
      }
    }

    setLoading(false)
  }

  function initializeDefaultChecklist() {
    const defaults: Omit<ChecklistItem, 'id' | 'status' | 'notes'>[] = [
      { category: 'Contract Execution', title: 'Receive Notice to Proceed (NTP)', description: 'Confirm NTP received from contracting officer with start date', due_offset_days: 0 },
      { category: 'Contract Execution', title: 'Execute Prime Contract', description: 'Sign and return contract documents to the government', due_offset_days: 5 },
      { category: 'Contract Execution', title: 'Set Up Contract File', description: 'Create organized contract file with all executed documents', due_offset_days: 7 },
      { category: 'Contract Execution', title: 'Establish Invoice Schedule', description: 'Confirm billing cycle, invoice format, and payment terms', due_offset_days: 10 },
      { category: 'Subcontract Management', title: 'Issue Subcontract Awards', description: 'Send award letters to selected subcontractors with SOW and pricing', due_offset_days: 5 },
      { category: 'Subcontract Management', title: 'Execute Subcontract Agreements', description: 'Obtain signed subcontracts from all awarded subs', due_offset_days: 14 },
      { category: 'Subcontract Management', title: 'Collect Insurance Certificates', description: 'Verify current COIs from all subcontractors meeting contract requirements', due_offset_days: 14 },
      { category: 'Subcontract Management', title: 'Verify Bonding (if required)', description: 'Confirm performance and payment bonds are in place', due_offset_days: 14 },
      { category: 'Compliance & Onboarding', title: 'Submit Small Business Subcontracting Plan', description: 'File ISR/SSR if contract exceeds $750K threshold', due_offset_days: 14 },
      { category: 'Compliance & Onboarding', title: 'Background Checks', description: 'Initiate background checks for all personnel requiring site access', due_offset_days: 10 },
      { category: 'Compliance & Onboarding', title: 'Safety Training & Certification', description: 'Complete site-specific safety orientation for all personnel', due_offset_days: 14 },
      { category: 'Compliance & Onboarding', title: 'Key Personnel Assignment', description: 'Assign and notify key personnel (PM, QC Manager, Safety Officer)', due_offset_days: 7 },
      { category: 'Mobilization', title: 'Site Visit / Walk-Through', description: 'Conduct initial site assessment with subcontractors', due_offset_days: 7 },
      { category: 'Mobilization', title: 'Equipment Procurement', description: 'Order/stage all required equipment and materials', due_offset_days: 14 },
      { category: 'Mobilization', title: 'Establish Communication Channels', description: 'Set up reporting cadence with CO, COR, and site POCs', due_offset_days: 5 },
      { category: 'Mobilization', title: 'Quality Control Plan Submission', description: 'Submit QC plan per contract requirements', due_offset_days: 14 },
      { category: 'Financial Setup', title: 'Set Up Cost Tracking', description: 'Create project cost accounts and budget baseline', due_offset_days: 7 },
      { category: 'Financial Setup', title: 'Confirm Funding', description: 'Verify funding is obligated and available for initial period', due_offset_days: 5 },
      { category: 'Financial Setup', title: 'Establish Sub Payment Schedule', description: 'Set up payment terms and schedule with each subcontractor', due_offset_days: 14 },
    ]
    setChecklist(defaults.map((item, i) => ({ ...item, id: `item-${i}`, status: 'pending', notes: '' })))
    setIsAiGenerated(false)
  }

  async function generateChecklist(to?: TaskOrder | null, preloadedAnalysis?: Record<string, unknown> | null) {
    const project = to || taskOrder
    if (!id || !project) return

    setGenerating(true)
    try {
      const analysis = preloadedAnalysis ?? await loadAiOutput<Record<string, unknown>>(id, 'analysis')
      const compliance = await loadAiOutput<Record<string, unknown>>(id, 'compliance_matrix')
      const execSummary = await loadAiOutput<Record<string, unknown>>(id, 'executive_summary')

      const result = await generatePostAwardChecklist(
        project.title,
        project.site_name || null,
        project.project_type || null,
        analysis,
        compliance,
        execSummary,
      )

      if (result.checklist && result.checklist.length > 0) {
        // Ensure all items have proper defaults
        const items: ChecklistItem[] = result.checklist.map((item, i) => ({
          id: item.id || `item-${i}`,
          category: item.category || 'General',
          title: item.title || 'Untitled',
          description: item.description || '',
          due_offset_days: item.due_offset_days ?? 0,
          status: 'pending' as const,
          notes: '',
        }))
        setChecklist(items)
        setIsAiGenerated(true)
        // Save immediately
        await saveAiOutput(id, 'post_award_checklist', { checklist: items, ai_generated: true })
      } else {
        initializeDefaultChecklist()
      }
    } catch (err) {
      console.error('Failed to generate checklist:', err)
      initializeDefaultChecklist()
    } finally {
      setGenerating(false)
    }
  }

  async function updateItem(itemId: string, updates: Partial<ChecklistItem>) {
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    )
    setChecklist(updated)

    setSaving(true)
    await saveAiOutput(id!, 'post_award_checklist', { checklist: updated, ai_generated: isAiGenerated })
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
        <p className="text-gray-500 text-sm">Loading post-award checklist...</p>
      </div>
    )
  }
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Project not found</div>

  if (generating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${id}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Post-Award Transition</h1>
            <p className="text-sm text-gray-500">{taskOrder.title}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Sparkles size={32} className="mx-auto text-blue-500 mb-3 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Tailored Checklist</h3>
          <p className="text-sm text-gray-500 mb-4">
            Analyzing project requirements, compliance items, and subcontractor needs to build a checklist specific to this contract...
          </p>
          <Loader2 size={20} className="animate-spin mx-auto text-blue-500" />
        </div>
      </div>
    )
  }

  const categories = [...new Set(checklist.map(i => i.category))]
  const totalItems = checklist.filter(i => i.status !== 'not_applicable').length
  const completedItems = checklist.filter(i => i.status === 'complete').length
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle2 size={18} className="text-green-500" />
      case 'in_progress': return <Clock size={18} className="text-blue-500" />
      case 'not_applicable': return <Circle size={18} className="text-gray-300" />
      default: return <Circle size={18} className="text-gray-400" />
    }
  }

  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase()
    if (lower.includes('contract') && lower.includes('execution')) return <FileText size={18} className="text-blue-600" />
    if (lower.includes('subcontract') || lower.includes('teaming')) return <Users size={18} className="text-purple-600" />
    if (lower.includes('compliance') || lower.includes('safety') || lower.includes('security')) return <Shield size={18} className="text-green-600" />
    if (lower.includes('mobilization') || lower.includes('site')) return <Calendar size={18} className="text-orange-600" />
    if (lower.includes('financial') || lower.includes('billing') || lower.includes('cost')) return <DollarSign size={18} className="text-emerald-600" />
    if (lower.includes('hvac') || lower.includes('mechanical')) return <Wrench size={18} className="text-red-600" />
    if (lower.includes('electric') || lower.includes('power')) return <Zap size={18} className="text-yellow-600" />
    if (lower.includes('building') || lower.includes('facility') || lower.includes('construction')) return <Building2 size={18} className="text-indigo-600" />
    if (lower.includes('logistics') || lower.includes('equipment') || lower.includes('transport')) return <Truck size={18} className="text-teal-600" />
    if (lower.includes('personnel') || lower.includes('staffing') || lower.includes('labor')) return <HardHat size={18} className="text-amber-600" />
    return <FileText size={18} className="text-gray-600" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Post-Award Transition</h1>
          <p className="text-sm text-gray-500">{taskOrder.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Saving...
            </span>
          )}
          {hasProjectData && (
            <button
              onClick={() => generateChecklist()}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
              title="Regenerate checklist from project analysis data"
            >
              <RotateCw size={13} />
              {isAiGenerated ? 'Regenerate' : 'Generate from Project Data'}
            </button>
          )}
        </div>
      </div>

      {/* AI Badge */}
      {isAiGenerated && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
          <Sparkles size={16} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            This checklist was generated by AI based on the project's requirements, compliance items, and subcontractor categories. Click <strong>Regenerate</strong> to refresh after updating project analysis.
          </p>
        </div>
      )}

      {/* Prompt to generate if not AI and has data */}
      {!isAiGenerated && hasProjectData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            This project has AI analysis data available. Click <strong>Generate from Project Data</strong> above to create a checklist tailored to this project's specific requirements and scope.
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-900">Overall Progress</span>
          <span className="text-sm font-bold text-gray-900">{completedItems}/{totalItems} complete ({progress}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 size={14} /> All transition items complete — project is fully mobilized
          </p>
        )}
      </div>

      {/* Checklist by Category */}
      {categories.map(category => {
        const items = checklist.filter(i => i.category === category)
        const catComplete = items.filter(i => i.status === 'complete').length
        const catTotal = items.filter(i => i.status !== 'not_applicable').length

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getCategoryIcon(category)}
                <h3 className="font-semibold text-gray-900">{category}</h3>
              </div>
              <span className="text-xs text-gray-500">{catComplete}/{catTotal} complete</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className={`p-4 ${item.status === 'not_applicable' ? 'opacity-40' : ''}`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => {
                        const nextStatus = item.status === 'pending' ? 'in_progress' :
                          item.status === 'in_progress' ? 'complete' : 'pending'
                        updateItem(item.id, { status: nextStatus })
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {getStatusIcon(item.status)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${item.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {item.title}
                        </span>
                        {item.due_offset_days !== undefined && (
                          <span className="text-xs text-gray-400">Day +{item.due_offset_days}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => updateItem(item.id, { status: e.target.value as ChecklistItem['status'] })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                      <option value="not_applicable">N/A</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Warning for non-awarded projects */}
      {taskOrder.status !== 'awarded' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Project not yet awarded</p>
            <p className="text-xs text-yellow-600 mt-1">
              This checklist is available for planning, but items should only be executed after official contract award.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
