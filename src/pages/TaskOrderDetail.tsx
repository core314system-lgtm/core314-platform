import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TaskOrder, Document as Doc, DocumentCategory, AnalysisResult } from '../lib/types'
import { parseFile } from '../lib/documentParser'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { analyzeDocuments, generateComplianceMatrix, generateRfqPackages, generateClarificationQuestions, generatePricingRisks, generateExecutiveSummary, matchSubcontractors } from '../lib/api'
import { Upload, FileText, Trash2, Brain, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Users, MapPin, BookOpen } from 'lucide-react'
import CitationBadge from '../components/CitationBadge'
import TaskOrderChat from '../components/TaskOrderChat'
import WorkflowBar from '../components/WorkflowBar'
import AuditTrail from '../components/AuditTrail'
import ProjectTeam from '../components/ProjectTeam'
import { getProjectType, getWorkflowStage, getStageColor } from '../lib/projectTypes'

const DEFAULT_CATEGORIES: { value: DocumentCategory | string; label: string }[] = [
  { value: 'sow', label: 'Statement of Work' },
  { value: 'pricing_sheet', label: 'Pricing Sheet' },
  { value: 'exhibit', label: 'Exhibit / Attachment' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'qa_response', label: 'Q&A Response' },
  { value: 'wage_determination', label: 'Wage Determination' },
  { value: 'site_info', label: 'Site Information' },
  { value: 'subcontractor_quote', label: 'Subcontractor Quote' },
  { value: 'internal_notes', label: 'Internal Notes' },
  { value: 'other', label: 'Other' },
]



export default function TaskOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [documents, setDocuments] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('sow')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [aiStatus, setAiStatus] = useState<Record<string, boolean>>({})
  const [expandedSection, setExpandedSection] = useState<string | null>('documents')
  const [subMatches, setSubMatches] = useState<Array<{ subcontractor_id: string; company_name: string; matched_categories: string[]; location_match: boolean; incumbent_status: string; preferred: boolean; match_score: number }>>([])
  const [auditKey, setAuditKey] = useState(0)

  async function handleStageChange(newStageId: string, note?: string) {
    if (!taskOrder || !id) return

    // Update the status in the database
    const { error } = await supabase
      .from('task_orders')
      .update({ status: newStageId, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return

    // Record in workflow_history (may fail silently if table doesn't exist yet)
    try {
      await supabase.from('workflow_history').insert({
        task_order_id: id,
        from_stage: taskOrder.status,
        to_stage: newStageId,
        changed_by: user?.id || '',
        changed_by_name: profile?.full_name || profile?.email || null,
        note: note || null,
      })
    } catch {
      // workflow_history table may not exist yet — stage change still works
    }

    setTaskOrder({ ...taskOrder, status: newStageId as TaskOrder['status'] })
    setAuditKey(k => k + 1) // refresh audit trail
  }

  useEffect(() => {
    if (id) {
      fetchTaskOrder()
      fetchDocuments()
      loadExistingAnalysis()
    }
  }, [id])

  async function fetchTaskOrder() {
    const { data } = await supabase.from('task_orders').select('*').eq('id', id).single()
    setTaskOrder(data)
    setLoading(false)
  }

  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').eq('task_order_id', id).order('uploaded_at', { ascending: false })
    setDocuments(data || [])
  }

  async function loadExistingAnalysis() {
    if (!id) return
    const analysis = await loadAiOutput<AnalysisResult>(id, 'analysis')
    if (analysis) setAnalysisResult(analysis)

    const types = ['analysis', 'compliance_matrix', 'rfq_packages', 'clarification_questions', 'pricing_risks', 'executive_summary']
    const status: Record<string, boolean> = {}
    for (const t of types) {
      const data = await loadAiOutput(id, t)
      status[t] = !!data
    }
    setAiStatus(status)
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    await uploadFiles(files)
  }, [id, user, selectedCategory])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await uploadFiles(files)
    e.target.value = ''
  }

  async function uploadFiles(files: File[]) {
    if (!id || !user) return
    setUploading(true)

    for (const file of files) {
      const path = `${id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('task-order-documents')
        .upload(path, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      await supabase.from('documents').insert({
        task_order_id: id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        category: selectedCategory,
        version: 1,
        uploaded_by: user.id,
      })
    }

    setUploading(false)
    fetchDocuments()
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return
    await supabase.storage.from('task-order-documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    fetchDocuments()
  }

  async function handleDeleteTaskOrder() {
    if (!id || !taskOrder) return
    const msg = `DELETE ENTIRE TASK ORDER: "${taskOrder.title}"?\n\nThis will permanently remove:\n- The task order record\n- All uploaded documents\n- All AI analysis outputs\n- All SOW items, subcontractor assignments, quotes, and communications\n\nThis action cannot be undone.`
    if (!confirm(msg)) return
    if (!confirm('Are you absolutely sure? Type OK to confirm.')) return
    setDeleting(true)
    try {
      // Delete SOW-related data first (cascade should handle most, but be explicit)
      await supabase.from('sow_items').delete().eq('task_order_id', id)
      // Delete documents from storage
      const { data: docs } = await supabase.from('documents').select('file_path').eq('task_order_id', id)
      if (docs && docs.length > 0) {
        const paths = docs.map(d => d.file_path)
        await supabase.storage.from('task-order-documents').remove(paths)
      }
      // Delete AI outputs from storage
      const { data: aiFiles } = await supabase.storage.from('task-order-documents').list(`${id}/ai_outputs`)
      if (aiFiles && aiFiles.length > 0) {
        await supabase.storage.from('task-order-documents').remove(aiFiles.map(f => `${id}/ai_outputs/${f.name}`))
      }
      // Delete quote files from storage
      const { data: quoteFolders } = await supabase.storage.from('task-order-documents').list(`${id}/quotes`)
      if (quoteFolders) {
        for (const folder of quoteFolders) {
          const { data: quoteFiles } = await supabase.storage.from('task-order-documents').list(`${id}/quotes/${folder.name}`)
          if (quoteFiles && quoteFiles.length > 0) {
            await supabase.storage.from('task-order-documents').remove(quoteFiles.map(f => `${id}/quotes/${folder.name}/${f.name}`))
          }
        }
      }
      // Delete document records
      await supabase.from('documents').delete().eq('task_order_id', id)
      // Delete task order (cascades should handle remaining FKs)
      await supabase.from('task_orders').delete().eq('id', id)
      navigate('/task-orders')
    } catch (err) {
      console.error('Delete task order error:', err)
      alert('Failed to delete task order. Check console for details.')
      setDeleting(false)
    }
  }

  async function handleAnalyze() {
    if (!id || !taskOrder || documents.length === 0) return
    setAnalyzing(true)

    try {
      const texts: string[] = []
      const names: string[] = []

      for (const doc of documents) {
        const { data } = await supabase.storage.from('task-order-documents').download(doc.file_path)
        if (data) {
          const file = new File([data], doc.file_name, { type: doc.file_type })
          const text = await parseFile(file)
          texts.push(text)
          names.push(doc.file_name)
        }
      }

      const result = await analyzeDocuments(texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined) as unknown as AnalysisResult
      await saveAiOutput(id, 'analysis', result)
      setAnalysisResult(result)
      setAiStatus(prev => ({ ...prev, analysis: true }))

      // Auto-populate task order metadata from AI extraction
      const meta = result.task_order_metadata
      if (meta) {
        const updates: Record<string, string | null> = {}
        if (meta.title && !taskOrder.title) updates.title = meta.title
        if (meta.solicitation_number && !taskOrder.solicitation_number) updates.solicitation_number = meta.solicitation_number
        if (meta.task_order_number && !taskOrder.task_order_number) updates.task_order_number = meta.task_order_number
        if (meta.site_name && !taskOrder.site_name) updates.site_name = meta.site_name
        if (meta.location_city && !taskOrder.location_city) updates.location_city = meta.location_city
        if (meta.location_state && !taskOrder.location_state) updates.location_state = meta.location_state
        if (meta.contracting_officer) updates.contracting_officer = meta.contracting_officer
        if (meta.co_email) updates.co_email = meta.co_email
        if (meta.co_phone) updates.co_phone = meta.co_phone
        if (meta.response_due_date && !taskOrder.due_date) updates.due_date = meta.response_due_date
        if (Object.keys(updates).length > 0) {
          await supabase.from('task_orders').update(updates).eq('id', id)
          fetchTaskOrder()
        }
      }

      // Run resource matching
      const { data: subs } = await supabase.from('subcontractors').select('id, company_name, service_categories, geographic_coverage, incumbent_status, preferred')
      if (subs && subs.length > 0) {
        const location = `${taskOrder.location_city || ''}, ${taskOrder.location_state || ''}`
        const matches = await matchSubcontractors(result as unknown as Record<string, unknown>, subs, location)
        setSubMatches(matches)
      }
    } catch (err) {
      alert('Analysis failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerateAll() {
    if (!id || !taskOrder || documents.length === 0) return
    setGeneratingAll(true)

    try {
      const texts: string[] = []
      const names: string[] = []

      for (const doc of documents) {
        const { data } = await supabase.storage.from('task-order-documents').download(doc.file_path)
        if (data) {
          const file = new File([data], doc.file_name, { type: doc.file_type })
          const text = await parseFile(file)
          texts.push(text)
          names.push(doc.file_name)
        }
      }

      const args = [texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined] as const
      const pause = () => new Promise(r => setTimeout(r, 3000))

      // Always regenerate all outputs (overwrites existing)
      const analysis = await analyzeDocuments(...args)
      await saveAiOutput(id, 'analysis', analysis)
      setAnalysisResult(analysis as unknown as AnalysisResult)
      setAiStatus(prev => ({ ...prev, analysis: true }))
      await pause()

      const matrix = await generateComplianceMatrix(...args)
      await saveAiOutput(id, 'compliance_matrix', matrix)
      setAiStatus(prev => ({ ...prev, compliance_matrix: true }))
      await pause()

      const packages = await generateRfqPackages(...args)
      await saveAiOutput(id, 'rfq_packages', packages)
      setAiStatus(prev => ({ ...prev, rfq_packages: true }))
      await pause()

      const questions = await generateClarificationQuestions(...args)
      await saveAiOutput(id, 'clarification_questions', questions)
      setAiStatus(prev => ({ ...prev, clarification_questions: true }))
      await pause()

      const risks = await generatePricingRisks(...args)
      await saveAiOutput(id, 'pricing_risks', risks)
      setAiStatus(prev => ({ ...prev, pricing_risks: true }))
      await pause()

      const summary = await generateExecutiveSummary(...args)
      await saveAiOutput(id, 'executive_summary', summary)
      setAiStatus(prev => ({ ...prev, executive_summary: true }))

      // Update task order status
      await supabase.from('task_orders').update({ status: 'in_progress' }).eq('id', id)
      fetchTaskOrder()
    } catch (err) {
      alert('Generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setGeneratingAll(false)
    }
  }

  function toggleSection(section: string) {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Project not found</div>

  const projectType = getProjectType(taskOrder.project_type)
  const CATEGORIES = projectType.documentCategories.length > 0 ? projectType.documentCategories : DEFAULT_CATEGORIES

  const groupedDocs = CATEGORIES.map(cat => ({
    ...cat,
    docs: documents.filter(d => d.category === cat.value),
  })).filter(g => g.docs.length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline mb-1 inline-block">&larr; Back to Projects</Link>
          <h1 className="text-2xl font-bold text-gray-900">{taskOrder.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
            {taskOrder.solicitation_number && <span>Solicitation: {taskOrder.solicitation_number}</span>}
            {taskOrder.task_order_number && <span>TO#: {taskOrder.task_order_number}</span>}
            {taskOrder.site_name && <span>Site: {taskOrder.site_name}</span>}
            {taskOrder.location_city && <span>{taskOrder.location_city}, {taskOrder.location_state}</span>}
          </div>
          {/* AI-Extracted Metadata */}
          {analysisResult?.task_order_metadata && (
            <div className="mt-3 bg-purple-50 rounded-lg px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-purple-700 mb-2">AI-Extracted Details:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-gray-700">
                {analysisResult.task_order_metadata.contract_number && <span><strong>Contract:</strong> {analysisResult.task_order_metadata.contract_number}</span>}
                {analysisResult.task_order_metadata.contract_vehicle && <span><strong>Vehicle:</strong> {analysisResult.task_order_metadata.contract_vehicle}</span>}
                {analysisResult.task_order_metadata.contracting_officer && <span><strong>CO:</strong> {analysisResult.task_order_metadata.contracting_officer}</span>}
                {analysisResult.task_order_metadata.co_email && <span><strong>CO Email:</strong> {analysisResult.task_order_metadata.co_email}</span>}
                {analysisResult.task_order_metadata.co_phone && <span><strong>CO Phone:</strong> {analysisResult.task_order_metadata.co_phone}</span>}
                {analysisResult.task_order_metadata.estimated_value && <span><strong>Est. Value:</strong> {analysisResult.task_order_metadata.estimated_value}</span>}
                {analysisResult.task_order_metadata.naics_code && <span><strong>NAICS:</strong> {analysisResult.task_order_metadata.naics_code}</span>}
                {analysisResult.task_order_metadata.set_aside && <span><strong>Set-Aside:</strong> {analysisResult.task_order_metadata.set_aside}</span>}
                {analysisResult.task_order_metadata.period_of_performance_start && <span><strong>PoP Start:</strong> {analysisResult.task_order_metadata.period_of_performance_start}</span>}
                {analysisResult.task_order_metadata.period_of_performance_end && <span><strong>PoP End:</strong> {analysisResult.task_order_metadata.period_of_performance_end}</span>}
                {analysisResult.task_order_metadata.pop_total_duration && <span><strong>Total PoP:</strong> {analysisResult.task_order_metadata.pop_total_duration}</span>}
                {analysisResult.task_order_metadata.pop_structure_summary && <span className="col-span-2 md:col-span-3"><strong>PoP Structure:</strong> {analysisResult.task_order_metadata.pop_structure_summary}</span>}
              </div>
              {analysisResult.task_order_metadata.pop_base_period && (
                <div className="mt-2 text-gray-700 space-y-1">
                  <div><strong>Base Period:</strong> {analysisResult.task_order_metadata.pop_base_period}</div>
                  {analysisResult.task_order_metadata.pop_option_periods && analysisResult.task_order_metadata.pop_option_periods.length > 0 && (
                    <div>
                      <strong>Option Periods:</strong>
                      <ul className="ml-4 list-disc">
                        {analysisResult.task_order_metadata.pop_option_periods.map((op: string, i: number) => (
                          <li key={i}>{op}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${id}/debrief`}
            className="text-sm bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100 border border-purple-200 flex items-center gap-1.5"
          >
            <BookOpen size={14} /> Add Debrief
          </Link>
          <button
            onClick={handleDeleteTaskOrder}
            disabled={deleting}
            className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 border border-red-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Task Order'}
          </button>
          {(() => {
            const stage = getWorkflowStage(taskOrder.project_type, taskOrder.status)
            const colors = getStageColor(stage.color)
            return (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
                {stage.label}
              </span>
            )
          })()}
          {taskOrder.due_date && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock size={14} /> Due: {new Date(taskOrder.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Workflow Stage Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <WorkflowBar
          projectTypeId={taskOrder.project_type}
          currentStageId={taskOrder.status}
          onStageChange={handleStageChange}
          canManage={true}
        />
      </div>

      {/* Project Team + Audit Trail side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProjectTeam taskOrderId={id!} />
        <AuditTrail key={auditKey} taskOrderId={id!} projectTypeId={taskOrder.project_type} />
      </div>

      {/* Step 1: Document Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('documents')}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Upload size={20} className="text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Step 1: Upload Task Order Documents</h2>
              <p className="text-sm text-gray-500">{documents.length} document{documents.length !== 1 ? 's' : ''} uploaded</p>
            </div>
          </div>
          {expandedSection === 'documents' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'documents' && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value as DocumentCategory)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Drag and drop files here, or click to select'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, text files supported</p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700">
                Select Files
              </label>
            </div>

            {groupedDocs.length > 0 && (
              <div className="space-y-4">
                {groupedDocs.map(group => (
                  <div key={group.value}>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{group.label} ({group.docs.length})</h4>
                    <div className="space-y-1.5">
                      {group.docs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-700">{doc.file_name}</span>
                            <span className="text-xs text-gray-400">({(doc.file_size / 1024).toFixed(0)} KB)</span>
                          </div>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: AI Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('analysis')}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Brain size={20} className="text-purple-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Step 2: AI Document Analysis</h2>
              <p className="text-sm text-gray-500">
                {aiStatus.analysis ? 'Analysis complete' : documents.length > 0 ? 'Ready to analyze' : 'Upload documents first'}
              </p>
            </div>
          </div>
          {expandedSection === 'analysis' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'analysis' && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            {documents.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle size={20} className="text-yellow-500" />
                <p className="text-sm text-yellow-700">Upload task order documents before running AI analysis.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || documents.length === 0}
                    className="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Brain size={18} />
                    {analyzing ? 'Analyzing...' : 'Run Document Analysis'}
                  </button>
                  <button
                    onClick={handleGenerateAll}
                    disabled={generatingAll || documents.length === 0}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Brain size={18} />
                    {generatingAll ? 'Generating all outputs...' : 'Generate All AI Outputs'}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'analysis', label: 'Document Analysis', link: '' },
                    { key: 'compliance_matrix', label: 'Compliance Matrix', link: `/projects/${id}/compliance` },
                    { key: 'rfq_packages', label: 'Subcontractor RFQs', link: `/projects/${id}/rfq-packages` },
                    { key: 'clarification_questions', label: 'Clarification Questions', link: `/projects/${id}/clarifications` },
                    { key: 'pricing_risks', label: 'Pricing Risks', link: `/projects/${id}/pricing-risks` },
                    { key: 'executive_summary', label: 'Executive Summary', link: `/projects/${id}/executive-summary` },
                  ].map(item => (
                    <div key={item.key} className={`rounded-lg border p-3 ${aiStatus[item.key] ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        {aiStatus[item.key] ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <Clock size={16} className="text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      {aiStatus[item.key] && item.link && (
                        <Link to={item.link} className="text-xs text-blue-600 hover:underline mt-1 block">View &rarr;</Link>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Analysis Summary */}
            {analysisResult && (
              <div className="space-y-4 mt-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Analysis Summary</h4>
                  <p className="text-sm text-purple-800">{analysisResult.summary}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700">{analysisResult.requirements?.length || 0}</div>
                    <div className="text-xs text-blue-600">Requirements Found</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-700">{analysisResult.unclear_items?.length || 0}</div>
                    <div className="text-xs text-amber-600">Unclear Items</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{analysisResult.pricing_alignment_issues?.length || 0}</div>
                    <div className="text-xs text-red-600">Pricing Issues</div>
                  </div>
                </div>

                {analysisResult.service_categories?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Service Categories Identified</h4>
                    <div className="space-y-2">
                      {analysisResult.service_categories.map((cat, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{cat.category}</span>
                            {cat.subcontractor_heavy && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">Subcontractor-Heavy</span>}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.requirements?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Extracted Requirements ({analysisResult.requirements.length})</h4>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">#</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Requirement</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Source</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Category</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Frequency</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {analysisResult.requirements.map((req, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                                <td className="px-3 py-2 text-gray-800 max-w-sm">{req.requirement}</td>
                                <td className="px-3 py-2">
                                  <CitationBadge sourceDocument={req.source_document} pageSection={req.page_section} />
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-xs">{req.service_category}</td>
                                <td className="px-3 py-2 text-gray-600 text-xs">{req.frequency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Quick Links to Generated Outputs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('outputs')}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-green-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Step 3: Review Generated Outputs</h2>
              <p className="text-sm text-gray-500">{Object.values(aiStatus).filter(Boolean).length} of 6 outputs generated</p>
            </div>
          </div>
          {expandedSection === 'outputs' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'outputs' && (
          <div className="px-6 pb-6 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'SOW Bid Management', link: `/projects/${id}/sow-tracker`, key: '', desc: 'Match subs to SOWs, track RFQs, quotes & communications', highlight: true },
                { label: 'Bid Summary Dashboard', link: `/projects/${id}/bid-summary`, key: '', desc: 'Aggregated pricing, quote coverage, and recommendations', highlight: true },
                { label: 'Pricing Decision Matrix', link: `/projects/${id}/pricing-matrix`, key: '', desc: 'Select subs, set markup, calculate supplier totals & option year pricing', highlight: true },
                { label: 'Compliance Matrix', link: `/projects/${id}/compliance`, key: 'compliance_matrix', desc: 'Requirements mapped to source documents with risk levels' },
                { label: 'Subcontractor RFQ Packages', link: `/projects/${id}/rfq-packages`, key: 'rfq_packages', desc: 'Scope packages ready to send to subcontractors' },
                { label: 'Clarification Questions', link: `/projects/${id}/clarifications`, key: 'clarification_questions', desc: 'Questions for the contracting officer' },
                { label: 'Pricing Risk Review', link: `/projects/${id}/pricing-risks`, key: 'pricing_risks', desc: 'Pricing gaps, risks, and action items' },
                { label: 'Executive Bid Summary', link: `/projects/${id}/executive-summary`, key: 'executive_summary', desc: 'Management-ready bid overview' },
                { label: 'Export Center', link: `/projects/${id}/exports`, key: '', desc: 'Download reports in Word, PDF, Excel' },
              ].map(item => (
                <Link
                  key={item.label}
                  to={item.link}
                  className={`block rounded-lg border p-4 hover:shadow-md transition-shadow ${
                    'highlight' in item && item.highlight ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200' :
                    item.key && aiStatus[item.key] ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{item.label}</span>
                    {'highlight' in item && item.highlight && <Users size={16} className="text-blue-500" />}
                    {item.key && aiStatus[item.key] && <CheckCircle size={16} className="text-green-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resource Matching */}
      {subMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('matching')}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Users size={20} className="text-indigo-600" />
              <div>
                <h2 className="font-semibold text-gray-900">Matched Subcontractors</h2>
                <p className="text-sm text-gray-500">{subMatches.length} subcontractors matched to this task order</p>
              </div>
            </div>
            {expandedSection === 'matching' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>

          {expandedSection === 'matching' && (
            <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-3">
              {subMatches.map(m => (
                <div key={m.subcontractor_id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{m.company_name}</span>
                      {m.preferred && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Preferred</span>}
                      {m.incumbent_status === 'known' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Incumbent</span>}
                      {m.location_match && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin size={10} />Local</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.matched_categories.map(cat => (
                        <span key={cat} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{cat}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      m.match_score >= 70 ? 'text-green-600' : m.match_score >= 40 ? 'text-amber-600' : 'text-gray-500'
                    }`}>{m.match_score}%</div>
                    <div className="text-xs text-gray-500">Match Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {taskOrder.notes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{taskOrder.notes}</p>
        </div>
      )}

      {/* AI Chat Assistant */}
      <TaskOrderChat
        taskOrderId={id!}
        taskOrderTitle={taskOrder.title}
        analysisResult={analysisResult as Record<string, unknown> | null}
      />
    </div>
  )
}
