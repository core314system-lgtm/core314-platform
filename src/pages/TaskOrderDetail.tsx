import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TaskOrder, Document as Doc, DocumentCategory, AnalysisResult, ProjectSubcontractor, ProjectSubStatus, Subcontractor } from '../lib/types'
import { parseFile } from '../lib/documentParser'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { analyzeDocuments, generateComplianceMatrix, generateRfqPackages, generateClarificationQuestions, generatePricingRisks, generateExecutiveSummary, matchSubcontractors, matchSubcontractorsPerRequirement, discoverSubsForRequirements } from '../lib/api'
import type { SubMatch, RequirementMatch, RequirementDiscovery, DiscoveredBusiness } from '../lib/api'
import { Upload, FileText, Trash2, Brain, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Users, MapPin, BookOpen, FileStack, Search, Globe, Database, Plus, Star, ExternalLink, X, Shield } from 'lucide-react'
import CitationBadge from '../components/CitationBadge'
import TaskOrderChat from '../components/TaskOrderChat'
import WorkflowBar from '../components/WorkflowBar'
import type { SowCoverageItem } from '../components/WorkflowBar'
import AuditTrail from '../components/AuditTrail'
import ProjectTeam from '../components/ProjectTeam'
import ProjectContacts from '../components/ProjectContacts'
import ProjectActivityFeed from '../components/ProjectActivityFeed'
import ProjectTasks from '../components/ProjectTasks'
import TierGate from '../components/TierGate'
import BidReadiness from '../components/BidReadiness'
import SmartRecommendations from '../components/SmartRecommendations'
import QAManagement from '../components/QAManagement'
import ModificationTracker from '../components/ModificationTracker'
import PiiWarningModal from '../components/PiiWarningModal'
import { scanForPii, type PiiMatch } from '../lib/piiDetector'
import GovtQAProcessor from '../components/GovtQAProcessor'
import { getProjectType, getWorkflowStage, getStageColor } from '../lib/projectTypes'

function isValidExtractedDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const year = d.getFullYear()
  const now = new Date()
  const currentYear = now.getFullYear()
  return year >= currentYear - 2 && year <= currentYear + 10
}

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
  const [analysisProgress, setAnalysisProgress] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [aiStatus, setAiStatus] = useState<Record<string, boolean>>({})
  const [expandedSection, setExpandedSection] = useState<string | null>('documents')
  const [subMatches, setSubMatches] = useState<SubMatch[]>([])
  const [requirementMatches, setRequirementMatches] = useState<RequirementMatch[]>([])
  const [discoveredSubs, setDiscoveredSubs] = useState<RequirementDiscovery[]>([])
  const [matchingMode, setMatchingMode] = useState<'database' | 'discover' | 'both'>('database')
  const [matchingInProgress, setMatchingInProgress] = useState(false)
  const [addingToDb, setAddingToDb] = useState<string | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [auditKey, setAuditKey] = useState(0)
  const [contractName, setContractName] = useState<string | null>(null)
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewType, setPreviewType] = useState('')
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [projectSubs, setProjectSubs] = useState<ProjectSubcontractor[]>([])
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [projectSubsTableExists, setProjectSubsTableExists] = useState(true)
  const [gateStatuses, setGateStatuses] = useState<{ gate_number: number; gate_name: string; status: string; decision: string | null; checklist: { checked: boolean }[] }[]>([])
  const [selfPerformReqs, setSelfPerformReqs] = useState<string[]>([])
  const [searchingGap, setSearchingGap] = useState<string | null>(null)
  const [sowCoverage, setSowCoverage] = useState<SowCoverageItem[]>([])
  const [sowItems, setSowItems] = useState<{ id: string; name: string }[]>([])
  const [selectedSowItemId, setSelectedSowItemId] = useState<string>('')
  const [piiWarning, setPiiWarning] = useState<{ matches: PiiMatch[]; texts: string[]; names: string[] } | null>(null)


  async function handleViewDocument(doc: Doc) {
    try {
      // Track in recently viewed
      try {
        const recent: string[] = JSON.parse(localStorage.getItem('procuvex_recent_docs') || '[]')
        const updated = [doc.id, ...recent.filter(id => id !== doc.id)].slice(0, 10)
        localStorage.setItem('procuvex_recent_docs', JSON.stringify(updated))
      } catch { /* ignore */ }

      const ext = doc.file_name.split('.').pop()?.toLowerCase() || ''
      const isPreviewable = ['pdf'].includes(ext) ||
        (doc.file_type || '').startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)

      if (isPreviewable) {
        const { data, error } = await supabase.storage
          .from('task-order-documents')
          .createSignedUrl(doc.file_path, 3600)
        if (error) throw error
        if (data?.signedUrl) {
          setPreviewUrl(data.signedUrl)
          setPreviewName(doc.file_name)
          setPreviewType(doc.file_type || '')
        }
      } else {
        const { data, error } = await supabase.storage
          .from('task-order-documents')
          .download(doc.file_path)
        if (error) throw error
        if (data) {
          const url = URL.createObjectURL(data)
          const a = document.createElement('a')
          a.href = url
          a.download = doc.file_name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      }
    } catch (err) {
      alert('Failed to open document: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleBulkDownload() {
    if (documents.length === 0) return
    setBulkDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const doc of documents) {
        try {
          const { data, error } = await supabase.storage.from('task-order-documents').download(doc.file_path)
          if (error || !data) continue
          zip.file(doc.file_name, data)
        } catch { /* skip */ }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${taskOrder?.title || 'project'}-documents.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to create ZIP: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setBulkDownloading(false)
    }
  }

  async function handleGenerateSingle(outputType: string) {
    if (!id || !taskOrder || documents.length === 0) return
    setGeneratingSingle(outputType)

    try {
      const texts: string[] = []
      const names: string[] = []

      for (const doc of documents) {
        try {
          const { data, error } = await supabase.storage.from('task-order-documents').download(doc.file_path)
          if (error) { console.error(`Failed to download ${doc.file_name}:`, error); continue }
          if (data) {
            const file = new File([data], doc.file_name, { type: doc.file_type })
            const text = await parseFile(file)
            texts.push(text)
            names.push(doc.file_name)
          }
        } catch { continue }
      }

      if (texts.length === 0) {
        throw new Error('Could not read any documents.')
      }

      const args = [texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined] as const

      let result: unknown
      switch (outputType) {
        case 'analysis':
          result = await analyzeDocuments(...args)
          setAnalysisResult(result as unknown as AnalysisResult)
          break
        case 'compliance_matrix':
          result = await generateComplianceMatrix(...args)
          break
        case 'rfq_packages':
          result = await generateRfqPackages(...args)
          break
        case 'clarification_questions':
          result = await generateClarificationQuestions(...args)
          break
        case 'pricing_risks':
          result = await generatePricingRisks(...args)
          break
        case 'executive_summary':
          result = await generateExecutiveSummary(...args)
          break
      }

      if (result) {
        await saveAiOutput(id, outputType, result)
        setAiStatus(prev => ({ ...prev, [outputType]: true }))
      }
    } catch (err) {
      alert(`Failed to generate ${outputType}: ` + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setGeneratingSingle(null)
    }
  }

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
      loadProjectSubcontractors()
      loadSelfPerformReqs()
      loadSowCoverage()
      fetchGateStatuses()
    }
  }, [id])

  async function fetchGateStatuses() {
    const { data } = await supabase
      .from('capture_gates')
      .select('gate_number, gate_name, status, decision, checklist')
      .eq('task_order_id', id)
      .order('gate_number')
    if (data && data.length > 0) {
      setGateStatuses(data as { gate_number: number; gate_name: string; status: string; decision: string | null; checklist: { checked: boolean }[] }[])
    }
  }

  async function fetchTaskOrder() {
    const { data } = await supabase.from('task_orders').select('*').eq('id', id).single()
    setTaskOrder(data)
    if (data?.contract_id) {
      supabase.from('contracts').select('title').eq('id', data.contract_id).single()
        .then(({ data: c }) => { if (c) setContractName(c.title) })
    }
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

  async function loadProjectSubcontractors() {
    if (!id) return
    try {
      const { data, error } = await supabase
        .from('project_subcontractors')
        .select('*, subcontractor:subcontractors(*)')
        .eq('task_order_id', id)
        .neq('status', 'removed')
        .order('match_score', { ascending: false })
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('project_subcontractors')) {
          setProjectSubsTableExists(false)
        }
        return
      }
      setProjectSubs(data || [])
    } catch {
      // Table may not exist yet
    }
  }

  async function loadSelfPerformReqs() {
    if (!id) return
    const data = await loadAiOutput<string[]>(id, 'self_perform_requirements')
    if (data) setSelfPerformReqs(data)
  }

  async function loadSowCoverage() {
    if (!id) return
    try {
      // Get all SOW items for this project
      const { data: sowItems } = await supabase
        .from('sow_items')
        .select('id, sow_name, service_category')
        .eq('task_order_id', id)
      if (!sowItems?.length) {
        setSowCoverage([])
        return
      }
      // Get quote counts for each SOW item
      const { data: quotes } = await supabase
        .from('sow_quotes')
        .select('sow_item_id')
        .in('sow_item_id', sowItems.map(s => s.id))
        .eq('status', 'received')
      const quoteCounts: Record<string, number> = {}
      for (const q of quotes || []) {
        quoteCounts[q.sow_item_id] = (quoteCounts[q.sow_item_id] || 0) + 1
      }
      const coverage: SowCoverageItem[] = sowItems.map(s => ({
        name: s.sow_name || s.service_category || 'Unknown',
        hasQuotes: (quoteCounts[s.id] || 0) > 0,
        quoteCount: quoteCounts[s.id] || 0,
      }))
      setSowCoverage(coverage)
      setSowItems(sowItems.map(s => ({ id: s.id, name: s.sow_name || s.service_category || 'Unknown' })))
    } catch {
      // SOW items may not exist for this project
    }
  }

  async function toggleSelfPerform(category: string) {
    if (!id) return
    const updated = selfPerformReqs.includes(category)
      ? selfPerformReqs.filter(r => r !== category)
      : [...selfPerformReqs, category]
    setSelfPerformReqs(updated)
    await saveAiOutput(id, 'self_perform_requirements', updated)
  }

  async function searchForGap(category: string) {
    if (!taskOrder || !analysisResult) return
    setSearchingGap(category)
    const location = `${taskOrder.location_city || ''}, ${taskOrder.location_state || ''}`
    try {
      const discoveries = await discoverSubsForRequirements(
        { service_categories: [{ category, description: '' }] } as unknown as Record<string, unknown>,
        location,
        {}
      )
      setDiscoveredSubs(prev => {
        const filtered = prev.filter(d => d.requirement_category !== category)
        return [...filtered, ...discoveries]
      })
    } catch (err) {
      console.error('Gap search error:', err)
    } finally {
      setSearchingGap(null)
    }
  }

  function computeCoverage() {
    if (!analysisResult) return { total: 0, covered: 0, gaps: [] as { name: string; description: string }[], coverageMap: {} as Record<string, 'sub' | 'self'> }

    // Use service_categories for coverage tracking since that's what subcontractor matching uses
    const svcCategories = (analysisResult.service_categories || []).map(c => c.category)

    // Fall back to unique requirement service_category values if no service_categories
    const reqCategories = [...new Set(
      (analysisResult.requirements || [])
        .map(r => r.service_category)
        .filter(Boolean)
    )]

    const categories = svcCategories.length > 0 ? svcCategories : reqCategories
    const total = categories.length
    const coverageMap: Record<string, 'sub' | 'self'> = {}

    for (const cat of categories) {
      // Check if a projectSub explicitly covers this category (matched_requirements contains it)
      const hasDbSub = projectSubs.some(ps =>
        ps.status !== 'rejected' &&
        (ps.matched_requirements || []).some(r => r.toLowerCase() === cat.toLowerCase())
      )
      // Also check in-memory subMatches from current session matching
      const hasMemSub = subMatches.some(sm =>
        (sm.matched_categories || []).some(c => c.toLowerCase() === cat.toLowerCase())
      )
      if (hasDbSub || hasMemSub) {
        coverageMap[cat] = 'sub'
      } else if (selfPerformReqs.includes(cat)) {
        coverageMap[cat] = 'self'
      }
    }

    const covered = Object.keys(coverageMap).length
    const gaps = categories
      .filter(c => !coverageMap[c])
      .map(c => {
        const svcInfo = analysisResult?.service_categories?.find(s => s.category === c)
        return { name: c, description: svcInfo?.description || '' }
      })
    return { total, covered, gaps, coverageMap }
  }

  async function persistMatchesToProject(matches: SubMatch[]) {
    if (!id || !user || !projectSubsTableExists) return
    for (const match of matches) {
      if (match.match_score < 20) continue
      const { error } = await supabase
        .from('project_subcontractors')
        .upsert({
          task_order_id: id,
          subcontractor_id: match.subcontractor_id,
          match_score: match.match_score,
          relevance_reason: match.relevance_reason,
          matched_requirements: match.matched_categories,
          source: 'ai_match',
          added_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'task_order_id,subcontractor_id' })
      if (error) {
        console.error('Failed to persist match:', error)
      }
    }
    await loadProjectSubcontractors()
  }

  async function updateProjectSubStatus(projectSubId: string, newStatus: ProjectSubStatus) {
    setUpdatingStatus(projectSubId)
    try {
      const { error } = await supabase
        .from('project_subcontractors')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectSubId)
      if (error) throw error
      setProjectSubs(prev => prev.map(ps =>
        ps.id === projectSubId ? { ...ps, status: newStatus } : ps
      ))
    } catch (err) {
      alert('Failed to update status: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(null)
    }
  }

  async function removeProjectSub(projectSubId: string) {
    if (!confirm('Remove this subcontractor from the project?')) return
    try {
      const { error } = await supabase
        .from('project_subcontractors')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', projectSubId)
      if (error) throw error
      setProjectSubs(prev => prev.filter(ps => ps.id !== projectSubId))
    } catch (err) {
      alert('Failed to remove: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
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

      // Auto-match document to SOW item by filename if user didn't manually select one
      let assignedSowId = selectedSowItemId
      if (!assignedSowId && selectedCategory === 'sow' && sowItems.length > 0) {
        const nameLower = file.name.toLowerCase().replace(/[_\-.]/g, ' ')
        let bestMatch = ''
        let bestId = ''
        for (const sow of sowItems) {
          const sowLower = sow.name.toLowerCase()
          // Check if SOW name words appear in the filename
          const sowWords = sowLower.split(/\s+/).filter(w => w.length > 2)
          const matchCount = sowWords.filter(w => nameLower.includes(w)).length
          if (matchCount > 0 && matchCount >= sowWords.length * 0.5 && sowLower.length > bestMatch.length) {
            bestMatch = sowLower
            bestId = sow.id
          }
        }
        if (bestId) assignedSowId = bestId
      }

      const docRecord: Record<string, any> = {
        task_order_id: id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        category: selectedCategory,
        version: 1,
        uploaded_by: user.id,
      }
      if (assignedSowId) docRecord.sow_item_id = assignedSowId
      await supabase.from('documents').insert(docRecord)
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
      // Delete project subcontractors
      await supabase.from('project_subcontractors').delete().eq('task_order_id', id).then(() => {})
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

  async function autoSyncSowItems(analysis: AnalysisResult) {
    if (!id || !analysis?.service_categories?.length) return
    try {
      const { data: existingSows } = await supabase.from('sow_items').select('service_category').eq('task_order_id', id)
      const existing = new Set((existingSows || []).map((s: { service_category: string }) => s.service_category.toLowerCase()))
      for (const cat of analysis.service_categories) {
        if (!existing.has(cat.category.toLowerCase())) {
          await supabase.from('sow_items').insert({
            task_order_id: id,
            sow_name: cat.category,
            service_category: cat.category,
            description: cat.description,
            source_document: null,
            status: 'not_started',
          })
        }
      }
    } catch (err) {
      console.error('Auto-sync SOW items failed:', err)
    }
  }

  async function handleAnalyze() {
    if (!id || !taskOrder || documents.length === 0) return
    setAnalyzing(true)
    setAnalysisProgress('Downloading documents...')

    try {
      const texts: string[] = []
      const names: string[] = []

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        setAnalysisProgress(`Downloading document ${i + 1} of ${documents.length}...`)
        try {
          const { data, error } = await supabase.storage.from('task-order-documents').download(doc.file_path)
          if (error) {
            console.error(`Failed to download ${doc.file_name}:`, error)
            continue
          }
          if (data) {
            const file = new File([data], doc.file_name, { type: doc.file_type })
            const text = await parseFile(file)
            texts.push(text)
            names.push(doc.file_name)
          }
        } catch (dlErr) {
          console.error(`Error downloading ${doc.file_name}:`, dlErr)
          continue
        }
      }

      if (texts.length === 0) {
        throw new Error('Could not read any documents. Please check that documents are uploaded correctly.')
      }

      // PII detection — scan extracted text before sending to AI
      const allText = texts.join('\n')
      const piiMatches = scanForPii(allText)
      if (piiMatches.length > 0) {
        setPiiWarning({ matches: piiMatches, texts, names })
        setAnalyzing(false)
        setAnalysisProgress('')
        return
      }

      setAnalysisProgress(`Analyzing ${texts.length} documents with AI (this may take 15-30 seconds)...`)
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
        if (meta.response_due_date && !taskOrder.due_date && isValidExtractedDate(meta.response_due_date)) updates.due_date = meta.response_due_date
        if (Object.keys(updates).length > 0) {
          await supabase.from('task_orders').update(updates).eq('id', id)
          fetchTaskOrder()
        }
      }

      // Auto-sync SOW items from analysis
      await autoSyncSowItems(result)

      setAnalysisProgress('Matching subcontractors...')
      // Auto-run database matching after analysis
      await runSubcontractorMatch('database', result as unknown as Record<string, unknown>)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert('Analysis failed: ' + msg)
    } finally {
      setAnalyzing(false)
      setAnalysisProgress('')
    }
  }

  async function proceedWithAnalysis(texts: string[], names: string[]) {
    if (!id || !taskOrder) return
    setAnalyzing(true)
    setPiiWarning(null)
    try {
      setAnalysisProgress(`Analyzing ${texts.length} documents with AI (this may take 15-30 seconds)...`)
      const result = await analyzeDocuments(texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined) as unknown as AnalysisResult
      await saveAiOutput(id, 'analysis', result)
      setAnalysisResult(result)
      setAiStatus(prev => ({ ...prev, analysis: true }))
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
        if (meta.response_due_date && !taskOrder.due_date && isValidExtractedDate(meta.response_due_date)) updates.due_date = meta.response_due_date
        if (Object.keys(updates).length > 0) {
          await supabase.from('task_orders').update(updates).eq('id', id)
          fetchTaskOrder()
        }
      }

      // Auto-sync SOW items from analysis
      await autoSyncSowItems(result)

      setAnalysisProgress('Matching subcontractors...')
      await runSubcontractorMatch('database', result as unknown as Record<string, unknown>)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert('Analysis failed: ' + msg)
    } finally {
      setAnalyzing(false)
      setAnalysisProgress('')
    }
  }

  async function handleGenerateAll() {
    if (!id || !taskOrder || documents.length === 0) return
    setGeneratingAll(true)
    setAnalysisProgress('Downloading documents...')

    try {
      const texts: string[] = []
      const names: string[] = []

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        setAnalysisProgress(`Downloading document ${i + 1} of ${documents.length}...`)
        try {
          const { data, error } = await supabase.storage.from('task-order-documents').download(doc.file_path)
          if (error) { console.error(`Failed to download ${doc.file_name}:`, error); continue }
          if (data) {
            const file = new File([data], doc.file_name, { type: doc.file_type })
            const text = await parseFile(file)
            texts.push(text)
            names.push(doc.file_name)
          }
        } catch { continue }
      }

      if (texts.length === 0) {
        throw new Error('Could not read any documents.')
      }

      const args = [texts, names, taskOrder.title, taskOrder.site_name, taskOrder.project_type ?? undefined] as const
      const pause = () => new Promise(r => setTimeout(r, 3000))

      // Always regenerate all outputs (overwrites existing)
      setAnalysisProgress('Generating Document Analysis (1/6)...')
      const analysis = await analyzeDocuments(...args)
      await saveAiOutput(id, 'analysis', analysis)
      setAnalysisResult(analysis as unknown as AnalysisResult)
      setAiStatus(prev => ({ ...prev, analysis: true }))
      await pause()

      setAnalysisProgress('Generating Compliance Matrix (2/6)...')
      const matrix = await generateComplianceMatrix(...args)
      await saveAiOutput(id, 'compliance_matrix', matrix)
      setAiStatus(prev => ({ ...prev, compliance_matrix: true }))
      await pause()

      setAnalysisProgress('Generating Subcontractor RFQs (3/6)...')
      const packages = await generateRfqPackages(...args)
      await saveAiOutput(id, 'rfq_packages', packages)
      setAiStatus(prev => ({ ...prev, rfq_packages: true }))
      await pause()

      setAnalysisProgress('Generating Clarification Questions (4/6)...')
      const questions = await generateClarificationQuestions(...args)
      await saveAiOutput(id, 'clarification_questions', questions)
      setAiStatus(prev => ({ ...prev, clarification_questions: true }))
      await pause()

      setAnalysisProgress('Generating Pricing & Risk Analysis (5/6)...')
      const risks = await generatePricingRisks(...args)
      await saveAiOutput(id, 'pricing_risks', risks)
      setAiStatus(prev => ({ ...prev, pricing_risks: true }))
      await pause()

      setAnalysisProgress('Generating Executive Summary (6/6)...')
      const summary = await generateExecutiveSummary(...args)
      await saveAiOutput(id, 'executive_summary', summary)
      setAiStatus(prev => ({ ...prev, executive_summary: true }))

      // Auto-sync SOW items from analysis
      await autoSyncSowItems(analysis as unknown as AnalysisResult)

      // Update task order status
      await supabase.from('task_orders').update({ status: 'in_progress' }).eq('id', id)
      fetchTaskOrder()
    } catch (err) {
      alert('Generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setGeneratingAll(false)
      setAnalysisProgress('')
    }
  }

  async function runSubcontractorMatch(mode: 'database' | 'discover' | 'both', analysisOverride?: Record<string, unknown>) {
    if (!taskOrder) {
      setMatchError('No task order loaded')
      return
    }

    setMatchingInProgress(true)
    setMatchingMode(mode)
    setMatchError(null)

    const analysis = analysisOverride || analysisResult as unknown as Record<string, unknown>
    if (!analysis) {
      setMatchError('No analysis results available. Run AI analysis first.')
      setMatchingInProgress(false)
      return
    }

    const location = `${taskOrder.location_city || ''}, ${taskOrder.location_state || ''}`

    try {
      if (mode === 'database' || mode === 'both') {
        const { data: subs, error: subsError } = await supabase.from('subcontractors').select('id, company_name, service_categories, geographic_coverage, incumbent_status, preferred')
        if (subsError) {
          setMatchError('Failed to load subcontractors: ' + subsError.message)
          setMatchingInProgress(false)
          return
        }
        if (!subs || subs.length === 0) {
          setMatchError('No subcontractors in your database. Add subcontractors first via the Subcontractors page.')
          setSubMatches([])
          setRequirementMatches([])
          setMatchingInProgress(false)
          return
        }

        const [matches, reqMatches] = await Promise.all([
          matchSubcontractors(analysis, subs, location),
          matchSubcontractorsPerRequirement(analysis, subs, location),
        ])
        setSubMatches(matches)
        setRequirementMatches(reqMatches)

        // Persist matched subcontractors to the project matrix
        if (matches.length > 0) {
          await persistMatchesToProject(matches)
        }

        if (matches.length === 0 && reqMatches.length === 0) {
          setMatchError(`Evaluated ${subs.length} subcontractors — none were relevant to this project's requirements. Try "Auto-Discover New" to find new vendors.`)
        }
      }

      if (mode === 'discover' || mode === 'both') {
        const dbMatchCounts: Record<string, number> = {}
        for (const rm of requirementMatches) {
          dbMatchCounts[rm.requirement_category] = rm.matched_subs.length
        }
        const discoveries = await discoverSubsForRequirements(analysis, location, dbMatchCounts)
        setDiscoveredSubs(discoveries)

        if (discoveries.every(d => d.discovered_businesses.length === 0)) {
          setMatchError(prev => (prev ? prev + ' ' : '') + 'No businesses found nearby for any requirement category.')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Matching error:', err)
      setMatchError('Matching failed: ' + msg)
    } finally {
      setMatchingInProgress(false)
    }
  }

  async function addDiscoveredToDb(business: DiscoveredBusiness, serviceCategory: string) {
    if (!profile?.current_org_id) return
    setAddingToDb(business.company_name)

    try {
      const { data: inserted, error } = await supabase.from('subcontractors').insert({
        company_name: business.company_name,
        contact_email: null,
        contact_phone: business.phone,
        service_categories: [serviceCategory, ...business.categories].filter(Boolean),
        geographic_coverage: business.state ? [business.state] : [],
        address: business.address,
        website: business.website,
        preferred: false,
        incumbent_status: 'unknown',
        org_id: profile.current_org_id,
      }).select('id').single()

      if (error) throw error

      // Also link to this project
      if (inserted && id && projectSubsTableExists) {
        await supabase.from('project_subcontractors').upsert({
          task_order_id: id,
          subcontractor_id: inserted.id,
          match_score: business.rating ? Math.min(Math.round(business.rating * 20), 100) : 50,
          relevance_reason: `Discovered via Google Places for ${serviceCategory}`,
          matched_requirements: [serviceCategory],
          source: 'auto_discover',
          added_by: user?.id || null,
        }, { onConflict: 'task_order_id,subcontractor_id' })
        await loadProjectSubcontractors()
      }

      alert(`✓ ${business.company_name} added to database.\n\nAdd their email by editing their profile in the Master Subcontractor Database so RFQs can be sent.`)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
      alert('Failed to add: ' + msg)
    } finally {
      setAddingToDb(null)
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
      {/* PII Warning Modal */}
      {piiWarning && (
        <PiiWarningModal
          matches={piiWarning.matches}
          onProceed={() => proceedWithAnalysis(piiWarning.texts, piiWarning.names)}
          onCancel={() => setPiiWarning(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline mb-1 inline-block">&larr; Back to Projects</Link>
          <h1 className="text-2xl font-bold text-gray-900">{taskOrder.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
            {contractName && (taskOrder as TaskOrder & { contract_id?: string }).contract_id && (
              <Link to={`/contracts/${(taskOrder as TaskOrder & { contract_id?: string }).contract_id}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                <FileStack size={14} /> {contractName}
              </Link>
            )}
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
          sowCoverage={sowCoverage}
        />
      </div>

      {/* Capture Gate Status Summary */}
      {gateStatuses.length > 0 && (
        <Link to={`/projects/${id}/capture-gates`} className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Capture Gate Progress</h3>
            </div>
            <span className="text-xs text-blue-600 font-medium">View Details &rarr;</span>
          </div>
          <div className="flex gap-2">
            {gateStatuses.map(g => {
              const progress = g.checklist.length > 0 ? Math.round((g.checklist.filter(c => c.checked).length / g.checklist.length) * 100) : 0
              const isGo = g.decision === 'go'
              const isNoGo = g.decision === 'no_go'
              const isConditional = g.decision === 'conditional_go'
              return (
                <div key={g.gate_number} className="flex-1 text-center">
                  <div className={`text-[10px] font-bold mb-1 ${
                    isGo ? 'text-green-700' : isNoGo ? 'text-red-700' : isConditional ? 'text-yellow-700' : 'text-gray-500'
                  }`}>
                    G{g.gate_number}
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isGo ? 'bg-green-500' : isNoGo ? 'bg-red-500' : isConditional ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className={`text-[9px] mt-0.5 ${
                    isGo ? 'text-green-600 font-semibold' : isNoGo ? 'text-red-600 font-semibold' : isConditional ? 'text-yellow-600 font-semibold' : 'text-gray-400'
                  }`}>
                    {isGo ? 'GO' : isNoGo ? 'NO-GO' : isConditional ? 'COND' : `${progress}%`}
                  </div>
                </div>
              )
            })}
          </div>
        </Link>
      )}

      {/* Bid Readiness + Smart Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BidReadiness
          taskOrderId={id!}
          projectStatus={taskOrder.status}
          documentCount={documents.length}
          analysisComplete={!!analysisResult}
          dueDate={taskOrder.due_date}
        />
        <SmartRecommendations
          project={taskOrder as unknown as Record<string, unknown>}
          documentCount={documents.length}
          analysisComplete={!!analysisResult}
          subAssignments={0}
        />
      </div>

      {/* Project Team + Audit Trail side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProjectTeam taskOrderId={id!} />
        <TierGate feature="project_contacts" fallback={null}>
          <ProjectContacts projectId={id!} />
        </TierGate>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TierGate feature="task_assignments" fallback={null}>
          <ProjectTasks projectId={id!} />
        </TierGate>
        <TierGate feature="activity_feed" fallback={null}>
          <ProjectActivityFeed projectId={id!} />
        </TierGate>
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
            <div className="flex items-center gap-3 mb-3 flex-wrap">
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
              {sowItems.length > 0 && (
                <>
                  <label className="text-sm font-medium text-gray-700 ml-2">SOW Assignment:</label>
                  <select
                    value={selectedSowItemId}
                    onChange={e => setSelectedSowItemId(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All SOWs (shared)</option>
                    {sowItems.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </>
              )}
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
                <div className="flex items-center justify-between">
                  <Link to="/documents" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    View all in Document Library →
                  </Link>
                  <button
                    onClick={handleBulkDownload}
                    disabled={bulkDownloading || documents.length === 0}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium disabled:opacity-50"
                  >
                    <FileStack size={14} />
                    {bulkDownloading ? 'Creating ZIP...' : `Download All (${documents.length})`}
                  </button>
                </div>
                {groupedDocs.map(group => (
                  <div key={group.value}>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{group.label} ({group.docs.length})</h4>
                    <div className="space-y-1.5">
                      {group.docs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <button
                            onClick={() => handleViewDocument(doc)}
                            className="flex items-center gap-2 hover:text-blue-600 text-left group"
                            title="Click to view/download document"
                          >
                            <FileText size={16} className="text-blue-500 group-hover:text-blue-700" />
                            <span className="text-sm text-blue-600 hover:underline">{doc.file_name}</span>
                            <span className="text-xs text-gray-400">({(doc.file_size / 1024).toFixed(0)} KB)</span>
                            <ExternalLink size={12} className="text-gray-400 group-hover:text-blue-500" />
                          </button>
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
                    {analyzing ? (analysisProgress || 'Analyzing...') : 'Run Document Analysis'}
                  </button>
                  <button
                    onClick={handleGenerateAll}
                    disabled={generatingAll || documents.length === 0}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Brain size={18} />
                    {generatingAll ? (analysisProgress || 'Generating all outputs...') : 'Generate All AI Outputs'}
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
                        ) : generatingSingle === item.key ? (
                          <Brain size={16} className="text-purple-500 animate-pulse" />
                        ) : (
                          <Clock size={16} className="text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {aiStatus[item.key] && item.link && (
                          <Link to={item.link} className="text-xs text-blue-600 hover:underline">View &rarr;</Link>
                        )}
                        {!generatingAll && (
                          <button
                            onClick={() => handleGenerateSingle(item.key)}
                            disabled={!!generatingSingle || generatingAll || documents.length === 0}
                            className="text-xs text-purple-600 hover:underline disabled:opacity-50 disabled:no-underline"
                          >
                            {generatingSingle === item.key ? 'Generating...' : aiStatus[item.key] ? 'Regenerate' : 'Generate'}
                          </button>
                        )}
                      </div>
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

      {/* Subcontractor Matching — right after analysis */}
      {analysisResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('matching')}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Users size={20} className="text-indigo-600" />
              <div>
                <h2 className="font-semibold text-gray-900">Subcontractor Matching</h2>
                <p className="text-sm text-gray-500">
                  {(() => {
                    const { total, covered, gaps } = computeCoverage()
                    if (total > 0 && gaps.length === 0) return `Full Coverage — all ${total} requirements covered`
                    if (total > 0 && covered > 0) return `${covered}/${total} requirements covered · ${gaps.length} gap${gaps.length > 1 ? 's' : ''} remaining`
                    if (projectSubs.length > 0) return `${projectSubs.length} subcontractors in project matrix`
                    if (subMatches.length > 0) return `${subMatches.length} matched from database`
                    return 'Find subcontractors for each requirement'
                  })()}
                  {discoveredSubs.length > 0 && ` · ${discoveredSubs.reduce((sum, d) => sum + d.discovered_businesses.length, 0)} discovered nearby`}
                </p>
              </div>
            </div>
            {expandedSection === 'matching' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>

          {expandedSection === 'matching' && (
            <div className="px-6 pb-6 border-t border-gray-100 pt-4">
              {/* Search mode buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => runSubcontractorMatch('database')}
                  disabled={matchingInProgress}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    matchingMode === 'database' && subMatches.length > 0
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <Database size={16} />
                  {matchingInProgress && matchingMode === 'database' ? 'Matching...' : 'Match from Database'}
                </button>
                <button
                  onClick={() => runSubcontractorMatch('discover')}
                  disabled={matchingInProgress}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    matchingMode === 'discover' && discoveredSubs.length > 0
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <Globe size={16} />
                  {matchingInProgress && matchingMode === 'discover' ? 'Discovering...' : 'Auto-Discover New'}
                </button>
                <button
                  onClick={() => runSubcontractorMatch('both')}
                  disabled={matchingInProgress}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    matchingMode === 'both' && (subMatches.length > 0 || discoveredSubs.length > 0)
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <Search size={16} />
                  {matchingInProgress && matchingMode === 'both' ? 'Searching...' : 'Full Search (Both)'}
                </button>
              </div>

              {matchingInProgress && (
                <div className="flex items-center gap-2 text-sm text-indigo-600 mb-4">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  {matchingMode === 'database' && 'AI is evaluating your subcontractor database for relevance...'}
                  {matchingMode === 'discover' && 'Searching Google Places for new subcontractors near the project...'}
                  {matchingMode === 'both' && 'Running database match + discovering new subcontractors...'}
                </div>
              )}

              {matchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                  {matchError}
                </div>
              )}

              {/* Coverage Bar & Gap Analysis */}
              {(() => {
                const { total, covered, gaps, coverageMap } = computeCoverage()
                if (total === 0) return null
                const pct = Math.round((covered / total) * 100)
                const isFull = gaps.length === 0

                return (
                  <div className="mb-6">
                    {/* Coverage Progress Bar */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <CheckCircle size={14} className={isFull ? 'text-green-600' : 'text-amber-500'} />
                          Requirement Coverage
                        </h3>
                        <span className={`text-sm font-bold ${isFull ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {covered} of {total} requirements covered ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isFull ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {isFull && (
                        <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
                          <CheckCircle size={12} /> Full Coverage — all requirements have an assigned subcontractor or are self-performed
                        </p>
                      )}
                      {!isFull && (total > 0) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(() => {
                            const reqCats = [...new Set((analysisResult?.requirements || []).map(r => r.service_category).filter(Boolean))]
                            const allCats = reqCats.length > (analysisResult?.service_categories || []).length ? reqCats : (analysisResult?.service_categories || []).map(c => c.category)
                            return allCats.map(cat => (
                              <span key={cat} className={`text-xs px-2 py-0.5 rounded-full ${
                                coverageMap[cat] === 'sub' ? 'bg-green-100 text-green-700' :
                                coverageMap[cat] === 'self' ? 'bg-blue-100 text-blue-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {cat}
                                {coverageMap[cat] === 'sub' && ' \u2713 Sub'}
                                {coverageMap[cat] === 'self' && ' \u2713 Self'}
                                {!coverageMap[cat] && ' \u2014 Gap'}
                              </span>
                            ))
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Coverage Gaps */}
                    {gaps.length > 0 && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-amber-600" />
                          <h3 className="text-sm font-semibold text-amber-800">
                            Coverage Gaps ({gaps.length} requirement{gaps.length > 1 ? 's' : ''} uncovered)
                          </h3>
                        </div>
                        <div className="divide-y divide-amber-100">
                          {gaps.map(gap => (
                              <div key={gap.name} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm font-medium text-gray-900">{gap.name}</span>
                                  {gap.description && <p className="text-xs text-gray-500 mt-0.5">{gap.description}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => searchForGap(gap.name)}
                                    disabled={searchingGap === gap.name}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                                  >
                                    <Search size={12} />
                                    {searchingGap === gap.name ? 'Searching...' : 'Find Sub'}
                                  </button>
                                  <button
                                    onClick={() => toggleSelfPerform(gap.name)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                                  >
                                    <Users size={12} />
                                    Self-Perform
                                  </button>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Project Subcontractor Matrix — persisted per-project list */}
              {projectSubs.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Users size={14} />
                      Project Subcontractor Matrix ({projectSubs.length})
                    </h3>
                    <span className="text-xs text-gray-400">Status changes are saved automatically</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <div className="col-span-3">Company</div>
                      <div className="col-span-4">Covers Requirements</div>
                      <div className="col-span-3">Status</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {projectSubs.map(ps => {
                        const sub = ps.subcontractor as Subcontractor | undefined
                        return (
                          <div key={ps.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                            <div className="col-span-3">
                              <span className="text-sm font-medium text-gray-900">{sub?.company_name || 'Unknown'}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                {sub?.contact_phone && <span className="text-xs text-gray-400">{sub.contact_phone}</span>}
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${ps.match_score >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{ps.match_score}%</span>
                              </div>
                              {ps.source === 'auto_discover' && <span className="text-xs bg-green-50 text-green-600 px-1 py-0.5 rounded">Discovered</span>}
                            </div>
                            <div className="col-span-4">
                              <div className="flex flex-wrap gap-1">
                                {(ps.matched_requirements || []).map(req => (
                                  <span key={req} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <CheckCircle size={10} />{req}
                                  </span>
                                ))}
                              </div>
                              {ps.relevance_reason && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ps.relevance_reason}</p>}
                            </div>
                            <div className="col-span-3">
                              <select
                                value={ps.status}
                                onChange={e => updateProjectSubStatus(ps.id, e.target.value as ProjectSubStatus)}
                                disabled={updatingStatus === ps.id}
                                className={`text-xs rounded-lg border px-2 py-1 ${
                                  ps.status === 'awarded' ? 'bg-green-50 border-green-300 text-green-700' :
                                  ps.status === 'shortlisted' ? 'bg-blue-50 border-blue-300 text-blue-700' :
                                  ps.status === 'invited' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' :
                                  ps.status === 'quoted' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                                  ps.status === 'rejected' ? 'bg-red-50 border-red-300 text-red-700' :
                                  'bg-gray-50 border-gray-300 text-gray-700'
                                }`}
                              >
                                <option value="matched">Matched</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="invited">Invited</option>
                                <option value="quoted">Quoted</option>
                                <option value="awarded">Awarded</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex justify-end gap-1">
                              {sub && (
                                <Link to={`/subcontractors`} className="text-xs text-indigo-600 hover:underline">View</Link>
                              )}
                              <button
                                onClick={() => removeProjectSub(ps.id)}
                                className="text-xs text-red-500 hover:text-red-700 ml-2"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Per-Requirement View */}
              {requirementMatches.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Database size={14} />
                    Database Matches by Requirement
                  </h3>
                  {requirementMatches.map(rm => (
                    <div key={rm.requirement_category} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900 text-sm">{rm.requirement_category}</span>
                          {rm.requirement_description && <span className="text-xs text-gray-500 ml-2">— {rm.requirement_description}</span>}
                        </div>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{rm.matched_subs.length} matches</span>
                      </div>
                      {rm.matched_subs.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {rm.matched_subs.map(ms => (
                            <div key={ms.subcontractor_id} className="px-4 py-2 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-900">{ms.company_name}</span>
                                <p className="text-xs text-gray-500 mt-0.5">{ms.relevance_reason}</p>
                              </div>
                              <div className={`text-sm font-bold ${
                                ms.relevance_score >= 70 ? 'text-green-600' : ms.relevance_score >= 40 ? 'text-amber-600' : 'text-gray-500'
                              }`}>{ms.relevance_score}%</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">No matches in your database — try &quot;Auto-Discover New&quot;</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Database Matches */}
              {subMatches.length > 0 && requirementMatches.length === 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700">Database Matches (Overall)</h3>
                  {subMatches.map(m => (
                    <div key={m.subcontractor_id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{m.company_name}</span>
                          {m.preferred && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Preferred</span>}
                          {m.incumbent_status === 'known' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Incumbent</span>}
                          {m.location_match && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin size={10} />Local</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{m.relevance_reason}</p>
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
                        <div className="text-xs text-gray-500">Relevance</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Discovered Subcontractors */}
              {discoveredSubs.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe size={14} />
                    Discovered Nearby Subcontractors
                  </h3>
                  {discoveredSubs.map(rd => (
                    <div key={rd.requirement_category} className="border border-green-200 rounded-lg overflow-hidden">
                      <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900 text-sm">{rd.requirement_category}</span>
                          {rd.requirement_description && <span className="text-xs text-gray-500 ml-2">— {rd.requirement_description}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {rd.db_matches_count > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{rd.db_matches_count} in DB</span>}
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{rd.discovered_businesses.length} discovered</span>
                        </div>
                      </div>
                      {rd.discovered_businesses.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {rd.discovered_businesses.map((biz, idx) => (
                            <div key={`${biz.company_name}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{biz.company_name}</span>
                                  {biz.rating && (
                                    <span className="flex items-center gap-0.5 text-xs text-amber-600">
                                      <Star size={10} className="fill-amber-400" />{biz.rating}
                                      {biz.review_count && <span className="text-gray-400">({biz.review_count})</span>}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{biz.address}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  {biz.phone && <span className="text-xs text-gray-500">{biz.phone}</span>}
                                  {biz.website && (
                                    <a href={`https://${biz.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                                      <ExternalLink size={10} />{biz.website.length > 30 ? biz.website.slice(0, 30) + '...' : biz.website}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => addDiscoveredToDb(biz, rd.requirement_category)}
                                disabled={addingToDb === biz.company_name}
                                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                              >
                                <Plus size={12} />
                                {addingToDb === biz.company_name ? 'Adding...' : 'Add to DB'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">No businesses found nearby for this category</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!matchingInProgress && subMatches.length === 0 && requirementMatches.length === 0 && discoveredSubs.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Click a search button above to find subcontractors for this project&apos;s requirements</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                { label: 'Past Performance', link: `/projects/${id}/past-performance`, key: '', desc: 'AI-matched past performance citations from your library for this project' },
                { label: 'Capture Gate Reviews', link: `/projects/${id}/capture-gates`, key: '', desc: 'Shipley-aligned gate review process — qualification through submission' },
                { label: 'Color Team Reviews', link: `/projects/${id}/color-team`, key: '', desc: 'Pink, Red, Gold team proposal quality reviews' },
                { label: 'SB Subcontracting Plan', link: `/projects/${id}/sb-plan`, key: '', desc: 'FAR 52.219-9 compliant small business subcontracting plan' },
                { label: 'Section L/M Analysis', link: `/projects/${id}/section-lm`, key: '', desc: 'AI extraction of evaluation criteria from RFP Section L & M' },
                { label: 'Price-to-Win', link: `/projects/${id}/price-to-win`, key: '', desc: 'AI-assisted competitive pricing analysis and strategy' },
                { label: 'Proposal Outline', link: `/projects/${id}/proposal-outline`, key: '', desc: 'AI-generated proposal volume structure mapped to evaluation criteria' },
                { label: 'Win Themes', link: `/projects/${id}/win-themes`, key: '', desc: 'AI-generated discriminators and ghost themes for competitive advantage' },
                { label: 'OCI Screening', link: `/projects/${id}/oci-screening`, key: '', desc: 'FAR 9.5 organizational conflict of interest assessment' },
                { label: 'Proposal Schedule', link: `/projects/${id}/proposal-schedule`, key: '', desc: 'Shipley-aligned milestone tracker from RFP release to submission' },
                { label: 'Teaming Evaluator', link: `/projects/${id}/teaming-evaluator`, key: '', desc: 'AI-scored teaming partner recommendations for this project' },
                { label: 'Protest Risk', link: `/projects/${id}/protest-risk`, key: '', desc: 'AI analysis of protest likelihood and mitigation strategies' },
                { label: 'Oral Presentation Prep', link: `/projects/${id}/oral-prep`, key: '', desc: 'Team assignments, scenario questions, and dry-run checklist' },
                { label: 'Source Selection Model', link: `/projects/${id}/source-selection`, key: '', desc: 'Evaluation factor weighting and competitive scoring model' },
                { label: 'Bid/No-Bid Decision', link: `/projects/${id}/bid-decision`, key: '', desc: 'AI-powered opportunity scoring and recommendation', highlight: true },
                { label: 'Post-Award Transition', link: `/projects/${id}/post-award`, key: '', desc: 'Mobilization checklist, subcontract execution, NTP tracking' },
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

      {/* Q&A Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('questions')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Brain size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">AI Q&A Management</h2>
              <p className="text-sm text-gray-500">Track questions, AI-powered answers, and formal submissions</p>
            </div>
          </div>
          {expandedSection === 'questions' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'questions' && (
          <div className="px-6 pb-6 border-t border-gray-100 pt-4">
            <QAManagement taskOrderId={id!} />
          </div>
        )}
      </div>

      {/* Modification / Amendment Tracking */}
      <ModificationTracker taskOrderId={id!} taskOrderTitle={taskOrder.title} />

      {/* Government Q&A Response Processing */}
      <GovtQAProcessor taskOrderId={id!} taskOrderTitle={taskOrder.title} />

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

      {/* Inline Document Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900 truncate">{previewName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <ExternalLink size={14} /> Open in new tab
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              {previewType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(previewName.split('.').pop()?.toLowerCase() || '') ? (
                <div className="flex items-center justify-center p-8">
                  <img src={previewUrl} alt={previewName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[70vh]"
                  title={previewName}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
