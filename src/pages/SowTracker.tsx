import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import { alignSubcontractorsToTaskOrder } from '../lib/subcontractorAlignment'
import type { TaskOrder, SowItem, SowSubcontractor, SowQuote, SowCommunication, Subcontractor, AnalysisResult, SowStatus, OutreachStatus, CommType, QuoteStatus } from '../lib/types'
import {
  ArrowLeft, Plus, Send, MessageSquare, DollarSign, ChevronDown, ChevronUp,
  CheckCircle, Clock, AlertTriangle, XCircle, RefreshCw, Search, Filter, X,
  Package, Mail, Phone, Building, Upload, FileText, Paperclip, Eye, Radar, Settings, Loader2
} from 'lucide-react'
import QuestionQueue from '../components/QuestionQueue'
import FollowUpManager from '../components/FollowUpManager'

const SOW_STATUS_CONFIG: Record<SowStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bg: 'bg-gray-100' },
  subs_identified: { label: 'Subs Identified', color: 'text-blue-700', bg: 'bg-blue-100' },
  rfqs_sent: { label: 'RFQs Sent', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  quotes_received: { label: 'Quotes Received', color: 'text-amber-700', bg: 'bg-amber-100' },
  evaluating: { label: 'Evaluating', color: 'text-purple-700', bg: 'bg-purple-100' },
  awarded: { label: 'Awarded', color: 'text-green-700', bg: 'bg-green-100' },
}

const OUTREACH_STATUS_CONFIG: Record<OutreachStatus, { label: string; color: string; bg: string }> = {
  identified: { label: 'Identified', color: 'text-gray-600', bg: 'bg-gray-100' },
  invited: { label: 'RFQ Sent', color: 'text-blue-700', bg: 'bg-blue-100' },
  reviewing: { label: 'Reviewing', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  questions_pending: { label: 'Questions Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  quote_submitted: { label: 'Quote Submitted', color: 'text-green-700', bg: 'bg-green-100' },
  declined: { label: 'Declined', color: 'text-red-700', bg: 'bg-red-100' },
  no_response: { label: 'No Response', color: 'text-gray-500', bg: 'bg-gray-50' },
  awarded: { label: 'Awarded', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  not_selected: { label: 'Not Selected', color: 'text-gray-500', bg: 'bg-gray-50' },
}

interface SowWithDetails extends SowItem {
  subcontractors: (SowSubcontractor & { subcontractor: Subcontractor; quotes: SowQuote[]; communications: SowCommunication[] })[]
  quoteCount: number
  lowestQuote: number | null
  highestQuote: number | null
}

export default function SowTracker() {
  const { id: taskOrderId } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [sowItems, setSowItems] = useState<SowWithDetails[]>([])
  const [allSubcontractors, setAllSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSow, setExpandedSow] = useState<string | null>(null)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [showAddSub, setShowAddSub] = useState<string | null>(null)
  const [showAddQuote, setShowAddQuote] = useState<string | null>(null)
  const [showAddComm, setShowAddComm] = useState<string | null>(null)
  const [subSearch, setSubSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const [uploadingQuote, setUploadingQuote] = useState(false)
  const [dragOverSub, setDragOverSub] = useState<string | null>(null)

  // Document management
  const [sowDocuments, setSowDocuments] = useState<Record<string, any[]>>({})
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [showDocUpload, setShowDocUpload] = useState<string | null>(null)

  // Quote form
  const [quoteForm, setQuoteForm] = useState({
    total_amount: '', monthly_amount: '', annual_amount: '',
    labor_cost: '', materials_cost: '', equipment_cost: '', overhead_markup: '',
    scope_inclusions: '', scope_exclusions: '', assumptions: '',
    timeline: '', payment_terms: '', validity_period: '',
  })

  // Communication form
  const [commForm, setCommForm] = useState({ comm_type: 'note' as CommType, direction: 'internal' as 'outbound' | 'inbound' | 'internal', subject: '', body: '' })

  const fetchData = useCallback(async () => {
    if (!taskOrderId) return

    const [toRes, sowRes, subsRes] = await Promise.all([
      supabase.from('task_orders').select('*').eq('id', taskOrderId).single(),
      supabase.from('sow_items').select('*').eq('task_order_id', taskOrderId).order('service_category'),
      supabase.from('subcontractors').select('*').order('company_name'),
    ])

    setTaskOrder(toRes.data)
    setAllSubcontractors(subsRes.data || [])

    const sows = sowRes.data || []
    const enriched: SowWithDetails[] = []

    for (const sow of sows) {
      const { data: sowSubs } = await supabase
        .from('sow_subcontractors')
        .select('*, subcontractors(*)')
        .eq('sow_item_id', sow.id)
        .order('match_score', { ascending: false })

      const subsWithDetails = []
      for (const ss of (sowSubs || [])) {
        const [quotesRes, commsRes] = await Promise.all([
          supabase.from('sow_quotes').select('*').eq('sow_subcontractor_id', ss.id).order('submitted_at', { ascending: false }),
          supabase.from('sow_communications').select('*').eq('sow_subcontractor_id', ss.id).order('created_at', { ascending: false }),
        ])
        subsWithDetails.push({
          ...ss,
          subcontractor: ss.subcontractors as Subcontractor,
          quotes: quotesRes.data || [],
          communications: commsRes.data || [],
        })
      }

      const allQuotes = subsWithDetails.flatMap(s => s.quotes).filter(q => q.total_amount != null)
      const amounts = allQuotes.map(q => q.total_amount as number)

      enriched.push({
        ...sow,
        subcontractors: subsWithDetails,
        quoteCount: allQuotes.length,
        lowestQuote: amounts.length > 0 ? Math.min(...amounts) : null,
        highestQuote: amounts.length > 0 ? Math.max(...amounts) : null,
      })
    }

    setSowItems(enriched)
    setLoading(false)
  }, [taskOrderId])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch documents for all SOWs in this task order
  const fetchDocuments = useCallback(async () => {
    if (!taskOrderId) return
    const { data } = await supabase.from('documents')
      .select('*')
      .eq('task_order_id', taskOrderId)
      .order('uploaded_at', { ascending: false })
    if (data) {
      const byPath: Record<string, any[]> = { _taskorder: [] }
      data.forEach((doc: any) => {
        const parts = doc.file_path?.split('/') || []
        // file_path format: {taskOrderId}/{sowItemId}/{filename} or {taskOrderId}/{filename}
        if (parts.length >= 3) {
          const sowId = parts[1]
          if (!byPath[sowId]) byPath[sowId] = []
          byPath[sowId].push(doc)
        } else {
          byPath._taskorder.push(doc)
        }
      })
      setSowDocuments(byPath)
    }
  }, [taskOrderId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  async function syncFromAiAnalysis() {
    if (!taskOrderId) return
    setSyncing(true)
    try {
      const analysis = await loadAiOutput<AnalysisResult>(taskOrderId, 'analysis')
      if (!analysis?.service_categories?.length) {
        alert('No AI analysis found. Run "Generate All AI Outputs" on the project first.')
        setSyncing(false)
        return
      }

      const { data: existingSows } = await supabase.from('sow_items').select('service_category').eq('task_order_id', taskOrderId)
      const existing = new Set((existingSows || []).map(s => s.service_category.toLowerCase()))

      let created = 0
      for (const cat of analysis.service_categories) {
        if (!existing.has(cat.category.toLowerCase())) {
          await supabase.from('sow_items').insert({
            task_order_id: taskOrderId,
            sow_name: cat.category,
            service_category: cat.category,
            description: cat.description,
            source_document: null,
            status: 'not_started',
          })
          created++
        }
      }

      // Auto-match subcontractors
      const { data: sows } = await supabase.from('sow_items').select('*').eq('task_order_id', taskOrderId)
      const { data: subs } = await supabase.from('subcontractors').select('*')
      const taskOrderState = taskOrder?.location_state?.toUpperCase() || ''

      for (const sow of (sows || [])) {
        const { data: existingAssigns } = await supabase.from('sow_subcontractors').select('subcontractor_id').eq('sow_item_id', sow.id)
        const assignedIds = new Set((existingAssigns || []).map(a => a.subcontractor_id))

        const sowCat = sow.service_category.toLowerCase().trim()

        for (const sub of (subs || [])) {
          if (assignedIds.has(sub.id)) continue
          // Strict matching: exact category name match only
          const catMatch = sub.service_categories?.some((sc: string) =>
            sc.toLowerCase().trim() === sowCat
          )
          if (!catMatch) continue

          const locMatch = sub.nationwide || sub.geographic_coverage?.some((g: string) =>
            g.toUpperCase() === taskOrderState || g.toUpperCase().includes(taskOrderState)
          )

          let score = 60
          if (locMatch) score += 15
          if (sub.preferred) score += 10
          if (sub.incumbent_status === 'known') score += 10
          if (sub.incumbent_status === 'suspected') score += 5

          await supabase.from('sow_subcontractors').insert({
            sow_item_id: sow.id,
            subcontractor_id: sub.id,
            match_score: Math.min(score, 100),
            outreach_status: 'identified',
          })
        }

        // Update SOW status if subs were matched
        const { count } = await supabase.from('sow_subcontractors').select('*', { count: 'exact', head: true }).eq('sow_item_id', sow.id)
        if ((count || 0) > 0 && sow.status === 'not_started') {
          await supabase.from('sow_items').update({ status: 'subs_identified' }).eq('id', sow.id)
        }
      }

      alert(`Synced! ${created} new SOW items created. Subcontractors auto-matched.`)
      fetchData()
    } catch (err) {
      alert('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSyncing(false)
    }
  }

  async function addSubToSow(sowId: string, subId: string) {
    await supabase.from('sow_subcontractors').insert({
      sow_item_id: sowId,
      subcontractor_id: subId,
      match_score: 0,
      outreach_status: 'identified',
    })

    // Also link to the project matrix
    if (taskOrderId) {
      const sow = sowItems.find(s => s.id === sowId)
      await supabase.from('project_subcontractors').upsert({
        task_order_id: taskOrderId,
        subcontractor_id: subId,
        match_score: 0,
        matched_requirements: sow ? [sow.service_category] : [],
        source: 'sow_tracker',
      }, { onConflict: 'task_order_id,subcontractor_id' }).then(() => {})
    }

    setShowAddSub(null)
    setSubSearch('')
    fetchData()
  }

  async function autoAlignSubcontractors() {
    if (!taskOrderId) return
    setSyncing(true)
    try {
      const alignment = await alignSubcontractorsToTaskOrder(taskOrderId)
      let addedCount = 0

      for (const sow of sowItems) {
        const matches = alignment[sow.id] || []
        const existingSubIds = new Set(sow.subcontractors.map(s => s.subcontractor_id))

        // Add top matches not already assigned (max 3 per SOW)
        const toAdd = matches
          .filter(m => !existingSubIds.has(m.subcontractor.id))
          .slice(0, 3)

        for (const match of toAdd) {
          await supabase.from('sow_subcontractors').insert({
            sow_item_id: sow.id,
            subcontractor_id: match.subcontractor.id,
            match_score: match.matchScore,
            outreach_status: 'identified',
          })
          addedCount++
        }
      }

      if (addedCount > 0) {
        alert(`Auto-aligned ${addedCount} subcontractor${addedCount !== 1 ? 's' : ''} across SOWs based on service category match.`)
      } else {
        alert('All matching subcontractors are already assigned to their respective SOWs.')
      }
      fetchData()
    } catch (err) {
      console.error('Alignment error:', err)
      alert('Failed to auto-align subcontractors.')
    } finally {
      setSyncing(false)
    }
  }

  async function updateOutreachStatus(sowSubId: string, status: OutreachStatus) {
    const updates: Record<string, unknown> = { outreach_status: status, updated_at: new Date().toISOString() }
    if (status === 'invited') updates.rfq_sent_date = new Date().toISOString()
    if (status === 'quote_submitted') updates.response_date = new Date().toISOString()
    await supabase.from('sow_subcontractors').update(updates).eq('id', sowSubId)
    fetchData()
  }

  async function updateSowStatus(sowId: string, status: SowStatus) {
    await supabase.from('sow_items').update({ status, updated_at: new Date().toISOString() }).eq('id', sowId)
    fetchData()
  }

  async function removeSub(sowSubId: string) {
    if (!confirm('Remove this subcontractor from this SOW?')) return
    await supabase.from('sow_subcontractors').delete().eq('id', sowSubId)
    fetchData()
  }

  async function uploadQuoteFile(file: File, taskOrderId: string, sowItemId: string, subId: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'pdf'
    const path = `${taskOrderId}/quotes/${sowItemId}/${subId}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('task-order-documents').upload(path, file, { upsert: true })
    if (error) { console.error('Quote upload error:', error); return null }
    return path
  }

  async function saveQuote(sowSubId: string, sowItemId: string, subId: string) {
    setUploadingQuote(true)
    try {
      const numOrNull = (v: string) => v ? parseFloat(v) : null
      let attachmentPath: string | null = null

      // Upload file if provided
      if (quoteFile && taskOrderId) {
        attachmentPath = await uploadQuoteFile(quoteFile, taskOrderId, sowItemId, subId)
      }

      await supabase.from('sow_quotes').insert({
        sow_subcontractor_id: sowSubId,
        sow_item_id: sowItemId,
        subcontractor_id: subId,
        total_amount: numOrNull(quoteForm.total_amount),
        monthly_amount: numOrNull(quoteForm.monthly_amount),
        annual_amount: numOrNull(quoteForm.annual_amount),
        labor_cost: numOrNull(quoteForm.labor_cost),
        materials_cost: numOrNull(quoteForm.materials_cost),
        equipment_cost: numOrNull(quoteForm.equipment_cost),
        overhead_markup: numOrNull(quoteForm.overhead_markup),
        scope_inclusions: quoteForm.scope_inclusions || null,
        scope_exclusions: quoteForm.scope_exclusions || null,
        assumptions: quoteForm.assumptions || null,
        timeline: quoteForm.timeline || null,
        payment_terms: quoteForm.payment_terms || null,
        validity_period: quoteForm.validity_period || null,
        attachment_path: attachmentPath,
        status: 'received',
      })

      // Auto-update outreach status
      await supabase.from('sow_subcontractors').update({
        outreach_status: 'quote_submitted',
        response_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sowSubId)

      // Auto-log communication
      const sub = allSubcontractors.find(s => s.id === subId)
      await supabase.from('sow_communications').insert({
        sow_subcontractor_id: sowSubId,
        comm_type: 'quote_received',
        direction: 'inbound',
        subject: `Quote received from ${sub?.company_name || 'subcontractor'}`,
        body: `Quote of ${quoteForm.total_amount ? '$' + parseFloat(quoteForm.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'} received.${attachmentPath ? ' Document attached.' : ''}${quoteForm.scope_exclusions ? ' Exclusions noted: ' + quoteForm.scope_exclusions : ''}`,
      })

      // Auto-update SOW status to quotes_received if this is the first quote
      const sow = sowItems.find(s => s.id === sowItemId)
      if (sow && (sow.status === 'not_started' || sow.status === 'subs_identified' || sow.status === 'rfqs_sent')) {
        await supabase.from('sow_items').update({
          status: 'quotes_received',
          updated_at: new Date().toISOString(),
        }).eq('id', sowItemId)
      }

      setShowAddQuote(null)
      setQuoteFile(null)
      setQuoteForm({ total_amount: '', monthly_amount: '', annual_amount: '', labor_cost: '', materials_cost: '', equipment_cost: '', overhead_markup: '', scope_inclusions: '', scope_exclusions: '', assumptions: '', timeline: '', payment_terms: '', validity_period: '' })
      fetchData()
    } finally {
      setUploadingQuote(false)
    }
  }

  async function handleQuoteDrop(e: React.DragEvent, sowSubId: string, _sowItemId: string, _subId: string) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverSub(null)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    const file = files[0]
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|xlsx?|docx?|csv)$/i)) {
      alert('Please upload a PDF, Excel, Word, or CSV file.')
      return
    }
    // Open the quote form with the file pre-attached
    setQuoteFile(file)
    setShowAddQuote(sowSubId)
    setQuoteForm({ total_amount: '', monthly_amount: '', annual_amount: '', labor_cost: '', materials_cost: '', equipment_cost: '', overhead_markup: '', scope_inclusions: '', scope_exclusions: '', assumptions: '', timeline: '', payment_terms: '', validity_period: '' })
  }

  async function viewQuoteFile(path: string) {
    const { data } = await supabase.storage.from('task-order-documents').createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function updateQuoteStatus(quoteId: string, status: QuoteStatus) {
    await supabase.from('sow_quotes').update({ status, reviewed_at: new Date().toISOString() }).eq('id', quoteId)
    fetchData()
  }

  async function saveComm(sowSubId: string) {
    await supabase.from('sow_communications').insert({
      sow_subcontractor_id: sowSubId,
      comm_type: commForm.comm_type,
      direction: commForm.direction,
      subject: commForm.subject || null,
      body: commForm.body || null,
    })
    setShowAddComm(null)
    setCommForm({ comm_type: 'note', direction: 'internal', subject: '', body: '' })
    fetchData()
  }

  const [sendingRfqs, setSendingRfqs] = useState<string | null>(null)
  const [rfqMessage, setRfqMessage] = useState('')
  const [showRfqModal, setShowRfqModal] = useState<string | null>(null)

  async function handleDocUpload(sowId: string, files: FileList | null) {
    if (!files || files.length === 0 || !taskOrderId) return
    setUploadingDoc(sowId)
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${taskOrderId}/${sowId}/${Date.now()}_${safeName}`
        const { error: uploadErr } = await supabase.storage
          .from('task-order-documents')
          .upload(filePath, file, { upsert: false })
        if (uploadErr) { alert('Upload error: ' + uploadErr.message); continue }
        supabase.storage
          .from('task-order-documents')
          .getPublicUrl(filePath)
        const category = file.name.toLowerCase().includes('flowdown') || file.name.toLowerCase().includes('far') || file.name.toLowerCase().includes('dfar')
          ? 'flowdown' : file.name.toLowerCase().includes('site') || file.name.toLowerCase().includes('map')
          ? 'site_info' : file.name.toLowerCase().includes('exhibit')
          ? 'exhibit' : file.name.toLowerCase().includes('amend')
          ? 'amendment' : 'sow'
        await supabase.from('documents').insert({
          task_order_id: taskOrderId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          category,
        })
      }
      fetchDocuments()
    } finally {
      setUploadingDoc(null)
      setShowDocUpload(null)
    }
  }

  async function deleteDocument(docId: string, filePath: string) {
    if (!confirm('Remove this document?')) return
    await supabase.storage.from('task-order-documents').remove([filePath])
    await supabase.from('documents').delete().eq('id', docId)
    fetchDocuments()
  }

  function getDocUrl(filePath: string) {
    const { data } = supabase.storage.from('task-order-documents').getPublicUrl(filePath)
    return data?.publicUrl || ''
  }

  async function bulkSendRfqs(sowId: string) {
    const sow = sowItems.find(s => s.id === sowId)
    if (!sow) return
    const identified = sow.subcontractors.filter(s => s.outreach_status === 'identified')
    if (identified.length === 0) { alert('No subcontractors in "Identified" status to send RFQs to.'); return }
    setShowRfqModal(sowId)
  }

  async function confirmSendRfqs() {
    if (!showRfqModal || !taskOrderId) return
    const sow = sowItems.find(s => s.id === showRfqModal)
    if (!sow) return
    const identified = sow.subcontractors.filter(s => s.outreach_status === 'identified')
    setSendingRfqs(showRfqModal)
    setShowRfqModal(null)

    try {
      const resp = await fetch('/api/send-rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sow_subcontractor_ids: identified.map(s => s.id),
          task_order_id: taskOrderId,
          custom_message: rfqMessage || undefined,
        }),
      })
      const result = await resp.json()
      if (result.success) {
        alert(`RFQ emails sent to ${result.sent} of ${result.total} subcontractors.`)
      } else {
        alert('Failed to send RFQs: ' + (result.error || 'Unknown error'))
      }
      setRfqMessage('')
      fetchData()
    } catch (err: any) {
      alert('Error sending RFQs: ' + err.message)
    } finally {
      setSendingRfqs(null)
    }
  }

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'

  const filtered = filterStatus ? sowItems.filter(s => s.status === filterStatus) : sowItems

  // Summary stats
  const totalSows = sowItems.length
  const totalQuotes = sowItems.reduce((acc, s) => acc + s.quoteCount, 0)
  const totalSubsEngaged = new Set(sowItems.flatMap(s => s.subcontractors.map(ss => ss.subcontractor_id))).size
  const sowsWithQuotes = sowItems.filter(s => s.quoteCount > 0).length
  const sowsWithNoQuotes = sowItems.filter(s => s.quoteCount === 0 && s.status !== 'not_started').length
  const totalEstCost = sowItems.reduce((acc, s) => acc + (s.lowestQuote || 0), 0)

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Task order not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={`/projects/${taskOrderId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder.title}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package size={24} className="text-blue-600" />
              SOW Bid Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">{taskOrder.title} — Track subcontractor bids for each SOW</p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/projects/${taskOrderId}/form-builder`}
              className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-100 flex items-center gap-2 text-sm border border-purple-200"
            >
              <Settings size={16} />
              Default Quote Form
            </Link>
            <button
              onClick={autoAlignSubcontractors}
              disabled={syncing || sowItems.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <Radar size={16} />
              Auto-Align Subcontractors
            </button>
            <button
              onClick={syncFromAiAnalysis}
              disabled={syncing}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync from AI Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{totalSows}</div>
          <div className="text-xs text-gray-500 mt-1">SOW Items</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-indigo-700">{totalSubsEngaged}</div>
          <div className="text-xs text-gray-500 mt-1">Subs Engaged</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{totalQuotes}</div>
          <div className="text-xs text-gray-500 mt-1">Quotes Received</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className={`text-2xl font-bold ${sowsWithQuotes >= totalSows * 0.5 ? 'text-green-600' : sowsWithQuotes > 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {sowsWithQuotes}/{totalSows}
          </div>
          <div className="text-xs text-gray-500 mt-1">SOWs with Quotes</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className={`text-2xl font-bold ${sowsWithNoQuotes === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {sowsWithNoQuotes}
          </div>
          <div className="text-xs text-gray-500 mt-1">Awaiting Quotes</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {totalEstCost > 0 ? `$${(totalEstCost / 1000).toFixed(0)}K` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Est. Low Total</div>
        </div>
      </div>

      {/* Coverage Bar */}
      {totalSows > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quote Coverage by SOW</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {sowItems.map(sow => {
              const qc = sow.quoteCount
              const color = qc >= 3 ? 'bg-green-500' : qc >= 1 ? 'bg-amber-500' : 'bg-red-400'
              const label = qc >= 3 ? 'Good' : qc >= 1 ? 'Low' : 'None'
              return (
                <div key={sow.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-gray-700 truncate flex-1">{sow.sow_name}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${qc >= 3 ? 'bg-green-100 text-green-700' : qc >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {qc} quote{qc !== 1 ? 's' : ''} — {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Follow-Up Manager */}
      {taskOrderId && totalSubsEngaged > 0 && (
        <FollowUpManager taskOrderId={taskOrderId} />
      )}

      {/* Filter */}
      {totalSows > 0 && (
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All SOWs ({totalSows})</option>
            {Object.entries(SOW_STATUS_CONFIG).map(([k, v]) => {
              const count = sowItems.filter(s => s.status === k).length
              return count > 0 ? <option key={k} value={k}>{v.label} ({count})</option> : null
            })}
          </select>
        </div>
      )}

      {/* SOW Items */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No SOW Items Yet</h3>
          <p className="text-sm text-gray-500 mt-1">Click "Sync from AI Analysis" to auto-create SOW items from your AI document analysis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(sow => (
            <div key={sow.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* SOW Header */}
              <button
                onClick={() => setExpandedSow(expandedSow === sow.id ? null : sow.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {sow.quoteCount >= 3 ? <CheckCircle size={20} className="text-green-500" /> :
                     sow.quoteCount >= 1 ? <Clock size={20} className="text-amber-500" /> :
                     <AlertTriangle size={20} className="text-red-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{sow.sow_name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOW_STATUS_CONFIG[sow.status].bg} ${SOW_STATUS_CONFIG[sow.status].color}`}>
                        {SOW_STATUS_CONFIG[sow.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{sow.description || sow.service_category}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm flex-shrink-0">
                    <div className="text-center">
                      <div className="font-bold text-gray-700">{sow.subcontractors.length}</div>
                      <div className="text-xs text-gray-400">Subs</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-700">{sow.quoteCount}</div>
                      <div className="text-xs text-gray-400">Quotes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{fmt(sow.lowestQuote)}</div>
                      <div className="text-xs text-gray-400">Low</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-red-600">{fmt(sow.highestQuote)}</div>
                      <div className="text-xs text-gray-400">High</div>
                    </div>
                  </div>
                </div>
                {expandedSow === sow.id ? <ChevronUp size={20} className="text-gray-400 ml-3" /> : <ChevronDown size={20} className="text-gray-400 ml-3" />}
              </button>

              {expandedSow === sow.id && (
                <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
                  {/* SOW Actions */}
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={sow.status}
                      onChange={e => updateSowStatus(sow.id, e.target.value as SowStatus)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                    >
                      {Object.entries(SOW_STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowAddSub(sow.id)}
                      className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Subcontractor
                    </button>
                    <button
                      onClick={() => bulkSendRfqs(sow.id)}
                      disabled={sendingRfqs === sow.id}
                      className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
                    >
                      {sendingRfqs === sow.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {sendingRfqs === sow.id ? 'Sending...' : 'Send RFQs to All Identified'}
                    </button>
                    <Link
                      to={`/projects/${taskOrderId}/form-builder/${sow.id}`}
                      className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 flex items-center gap-1"
                    >
                      <Settings size={14} /> Configure Quote Form
                    </Link>
                    <button
                      onClick={() => setShowDocUpload(showDocUpload === sow.id ? null : sow.id)}
                      className="text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 flex items-center gap-1"
                    >
                      <Paperclip size={14} /> SOW Documents & Flow-Downs
                      {(sowDocuments[sow.id]?.length || 0) > 0 && (
                        <span className="ml-1 bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">{sowDocuments[sow.id].length}</span>
                      )}
                    </button>
                  </div>

                  {/* Document Upload Section */}
                  {showDocUpload === sow.id && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-amber-900 flex items-center gap-2">
                          <FileText size={16} /> SOW Documents & Flow-Downs
                        </h4>
                        <button onClick={() => setShowDocUpload(null)} className="text-amber-400 hover:text-amber-600"><X size={16} /></button>
                      </div>
                      <p className="text-xs text-amber-700 mb-3">
                        Upload scope of work documents, flow-down clauses (FAR/DFAR), site maps, exhibits, and any other documents subcontractors need to review before quoting. These will be included in the RFQ email and available on the subcontractor portal.
                      </p>

                      {/* Existing documents */}
                      {(sowDocuments[sow.id]?.length || 0) > 0 && (
                        <div className="mb-3 space-y-1">
                          {sowDocuments[sow.id].map((doc: any) => (
                            <div key={doc.id} className="flex items-center gap-2 bg-white rounded px-3 py-2 text-sm border border-amber-100">
                              <FileText size={14} className="text-amber-600 flex-shrink-0" />
                              <a href={getDocUrl(doc.file_path)} target="_blank" rel="noreferrer" className="flex-1 text-blue-700 hover:underline truncate">{doc.file_name}</a>
                              <span className="text-xs text-amber-500 capitalize">{doc.category.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-gray-400">{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}</span>
                              <button onClick={() => deleteDocument(doc.id, doc.file_path)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload area */}
                      <label className="flex flex-col items-center gap-2 border-2 border-dashed border-amber-300 rounded-lg p-4 cursor-pointer hover:bg-amber-100/50 transition-colors">
                        <Upload size={20} className="text-amber-500" />
                        <span className="text-sm text-amber-700 font-medium">
                          {uploadingDoc === sow.id ? 'Uploading...' : 'Click to upload or drag files here'}
                        </span>
                        <span className="text-xs text-amber-500">PDF, Word, Excel, images — SOW packages, flow-downs, site maps, exhibits</span>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.tif,.tiff"
                          onChange={e => handleDocUpload(sow.id, e.target.files)}
                          disabled={uploadingDoc === sow.id}
                        />
                      </label>
                    </div>
                  )}

                  {/* Add Subcontractor Modal */}
                  {showAddSub === sow.id && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-blue-900">Add Subcontractor to {sow.sow_name}</h4>
                        <button onClick={() => { setShowAddSub(null); setSubSearch('') }} className="text-blue-400 hover:text-blue-600"><X size={16} /></button>
                      </div>
                      <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                          value={subSearch}
                          onChange={e => setSubSearch(e.target.value)}
                          placeholder="Search subcontractors..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-blue-200 rounded-lg"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {allSubcontractors
                          .filter(s => !sow.subcontractors.some(ss => ss.subcontractor_id === s.id))
                          .filter(s => !subSearch || s.company_name.toLowerCase().includes(subSearch.toLowerCase()) || s.service_categories.some(c => c.toLowerCase().includes(subSearch.toLowerCase())))
                          .slice(0, 10)
                          .map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => addSubToSow(sow.id, sub.id)}
                              className="w-full text-left px-3 py-2 text-sm bg-white rounded hover:bg-blue-100 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium">{sub.company_name}</span>
                                <span className="text-xs text-gray-400 ml-2">{sub.service_categories.join(', ')}</span>
                              </div>
                              <Plus size={14} className="text-blue-500" />
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Subcontractors List */}
                  {sow.subcontractors.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No subcontractors assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {sow.subcontractors.map(ss => (
                        <div key={ss.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          {/* Sub Header — drop zone for quote files */}
                          <div
                            onDragOver={e => { e.preventDefault(); setDragOverSub(ss.id) }}
                            onDragLeave={() => setDragOverSub(null)}
                            onDrop={e => handleQuoteDrop(e, ss.id, sow.id, ss.subcontractor_id)}
                            className={`transition-colors ${dragOverSub === ss.id ? 'ring-2 ring-green-400 bg-green-50' : ''}`}
                          >
                          <button
                            onClick={() => setExpandedSub(expandedSub === ss.id ? null : ss.id)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Building size={16} className="text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 text-sm">{ss.subcontractor?.company_name}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${OUTREACH_STATUS_CONFIG[ss.outreach_status].bg} ${OUTREACH_STATUS_CONFIG[ss.outreach_status].color}`}>
                                    {OUTREACH_STATUS_CONFIG[ss.outreach_status].label}
                                  </span>
                                  {ss.match_score > 0 && <span className="text-xs text-gray-400">{ss.match_score}% match</span>}
                                </div>
                                {ss.subcontractor?.contact_email && (
                                  <div className="text-xs text-gray-400 flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1"><Mail size={10} /> {ss.subcontractor.contact_email}</span>
                                    {ss.subcontractor.contact_phone && <span className="flex items-center gap-1"><Phone size={10} /> {ss.subcontractor.contact_phone}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {ss.quotes.length > 0 && (
                                <span className="text-sm font-bold text-green-600">{fmt(ss.quotes[0]?.total_amount)}</span>
                              )}
                              <span className="text-xs text-gray-400">{ss.communications.length} msgs</span>
                              {expandedSub === ss.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </div>
                          </button>
                          {dragOverSub === ss.id && (
                            <div className="px-4 py-2 bg-green-100 border-t border-green-300 text-center text-xs text-green-700 font-medium">
                              <Upload size={14} className="inline mr-1" /> Drop quote file here to attach and record
                            </div>
                          )}
                          </div>

                          {expandedSub === ss.id && (
                            <div className="px-4 pb-4 border-t border-gray-200 pt-3 space-y-3">
                              {/* Actions */}
                              <div className="flex flex-wrap gap-2">
                                <select
                                  value={ss.outreach_status}
                                  onChange={e => updateOutreachStatus(ss.id, e.target.value as OutreachStatus)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1"
                                >
                                  {Object.entries(OUTREACH_STATUS_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>
                                <button onClick={() => { setShowAddQuote(ss.id); setQuoteFile(null); setQuoteForm({ total_amount: '', monthly_amount: '', annual_amount: '', labor_cost: '', materials_cost: '', equipment_cost: '', overhead_markup: '', scope_inclusions: '', scope_exclusions: '', assumptions: '', timeline: '', payment_terms: '', validity_period: '' }) }} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 flex items-center gap-1"><DollarSign size={12} /> Add Quote</button>
                                <button onClick={() => { setShowAddComm(ss.id); setCommForm({ comm_type: 'note', direction: 'internal', subject: '', body: '' }) }} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded hover:bg-purple-100 flex items-center gap-1"><MessageSquare size={12} /> Add Note</button>
                                <button onClick={() => removeSub(ss.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 flex items-center gap-1"><XCircle size={12} /> Remove</button>
                              </div>

                              {/* Add Quote Form */}
                              {showAddQuote === ss.id && (
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-medium text-green-900 text-sm">Record Quote from {ss.subcontractor?.company_name}</h5>
                                    <button onClick={() => { setShowAddQuote(null); setQuoteFile(null) }} className="text-green-400 hover:text-green-600"><X size={14} /></button>
                                  </div>

                                  {/* Quote File Upload */}
                                  <div className="bg-white rounded-lg border border-dashed border-green-300 p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1">
                                        {quoteFile ? (
                                          <div className="flex items-center gap-2">
                                            <Paperclip size={14} className="text-green-600" />
                                            <span className="text-sm font-medium text-green-800">{quoteFile.name}</span>
                                            <span className="text-xs text-gray-400">({(quoteFile.size / 1024).toFixed(0)} KB)</span>
                                            <button onClick={() => setQuoteFile(null)} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                                          </div>
                                        ) : (
                                          <label className="flex items-center gap-2 cursor-pointer text-sm text-green-700 hover:text-green-900">
                                            <Upload size={14} />
                                            <span>Upload quote document (PDF, Excel, Word)</span>
                                            <input
                                              type="file"
                                              accept=".pdf,.xlsx,.xls,.doc,.docx,.csv"
                                              className="hidden"
                                              onChange={e => { if (e.target.files?.[0]) setQuoteFile(e.target.files[0]) }}
                                            />
                                          </label>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-400">or drag & drop onto subcontractor</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-600">Total Amount *</label>
                                      <input type="number" step="0.01" value={quoteForm.total_amount} onChange={e => setQuoteForm(p => ({ ...p, total_amount: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="$0.00" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Monthly</label>
                                      <input type="number" step="0.01" value={quoteForm.monthly_amount} onChange={e => setQuoteForm(p => ({ ...p, monthly_amount: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="$0.00" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Annual</label>
                                      <input type="number" step="0.01" value={quoteForm.annual_amount} onChange={e => setQuoteForm(p => ({ ...p, annual_amount: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="$0.00" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Overhead %</label>
                                      <input type="number" step="0.01" value={quoteForm.overhead_markup} onChange={e => setQuoteForm(p => ({ ...p, overhead_markup: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="10%" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-600">Labor Cost</label>
                                      <input type="number" step="0.01" value={quoteForm.labor_cost} onChange={e => setQuoteForm(p => ({ ...p, labor_cost: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Materials Cost</label>
                                      <input type="number" step="0.01" value={quoteForm.materials_cost} onChange={e => setQuoteForm(p => ({ ...p, materials_cost: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Equipment Cost</label>
                                      <input type="number" step="0.01" value={quoteForm.equipment_cost} onChange={e => setQuoteForm(p => ({ ...p, equipment_cost: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-600">Scope Inclusions</label>
                                      <textarea value={quoteForm.scope_inclusions} onChange={e => setQuoteForm(p => ({ ...p, scope_inclusions: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" rows={2} placeholder="What's included..." />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Scope Exclusions</label>
                                      <textarea value={quoteForm.scope_exclusions} onChange={e => setQuoteForm(p => ({ ...p, scope_exclusions: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" rows={2} placeholder="What's NOT included..." />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-600">Timeline</label>
                                      <input value={quoteForm.timeline} onChange={e => setQuoteForm(p => ({ ...p, timeline: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="e.g., 30 days" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Payment Terms</label>
                                      <input value={quoteForm.payment_terms} onChange={e => setQuoteForm(p => ({ ...p, payment_terms: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="e.g., Net 30" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600">Valid Until</label>
                                      <input value={quoteForm.validity_period} onChange={e => setQuoteForm(p => ({ ...p, validity_period: e.target.value }))} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="e.g., 60 days" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <textarea value={quoteForm.assumptions} onChange={e => setQuoteForm(p => ({ ...p, assumptions: e.target.value }))} className="flex-1 text-sm border border-green-200 rounded px-2 py-1" rows={1} placeholder="Assumptions or conditions..." />
                                  </div>
                                  <button
                                    onClick={() => saveQuote(ss.id, sow.id, ss.subcontractor_id)}
                                    disabled={!quoteForm.total_amount || uploadingQuote}
                                    className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {uploadingQuote ? (
                                      <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                                    ) : (
                                      <><CheckCircle size={14} /> Save Quote{quoteFile ? ' & Upload File' : ''}</>
                                    )}
                                  </button>
                                  <p className="text-xs text-green-600 italic">Saving will automatically update status to "Quote Submitted" and log the communication.</p>
                                </div>
                              )}

                              {/* Add Communication Form */}
                              {showAddComm === ss.id && (
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-medium text-purple-900 text-sm">Add Communication</h5>
                                    <button onClick={() => setShowAddComm(null)} className="text-purple-400 hover:text-purple-600"><X size={14} /></button>
                                  </div>
                                  <div className="flex gap-2">
                                    <select value={commForm.comm_type} onChange={e => setCommForm(p => ({ ...p, comm_type: e.target.value as CommType }))} className="text-xs border border-purple-200 rounded px-2 py-1">
                                      <option value="note">Internal Note</option>
                                      <option value="rfq_sent">RFQ Sent</option>
                                      <option value="question">Question</option>
                                      <option value="response">Response</option>
                                      <option value="follow_up">Follow Up</option>
                                      <option value="clarification">Clarification</option>
                                      <option value="quote_received">Quote Received</option>
                                    </select>
                                    <select value={commForm.direction} onChange={e => setCommForm(p => ({ ...p, direction: e.target.value as 'outbound' | 'inbound' | 'internal' }))} className="text-xs border border-purple-200 rounded px-2 py-1">
                                      <option value="internal">Internal</option>
                                      <option value="outbound">Outbound</option>
                                      <option value="inbound">Inbound</option>
                                    </select>
                                    <input value={commForm.subject} onChange={e => setCommForm(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" className="flex-1 text-xs border border-purple-200 rounded px-2 py-1" />
                                  </div>
                                  <textarea value={commForm.body} onChange={e => setCommForm(p => ({ ...p, body: e.target.value }))} placeholder="Details..." className="w-full text-xs border border-purple-200 rounded px-2 py-1" rows={2} />
                                  <button onClick={() => saveComm(ss.id)} disabled={!commForm.body} className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50">Save</button>
                                </div>
                              )}

                              {/* Existing Quotes */}
                              {ss.quotes.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><DollarSign size={12} /> Quotes ({ss.quotes.length})</h5>
                                  {ss.quotes.map(q => (
                                    <div key={q.id} className="bg-white rounded-lg p-3 border border-gray-200 mb-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <span className="text-lg font-bold text-gray-900">{fmt(q.total_amount)}</span>
                                          {q.monthly_amount && <span className="text-xs text-gray-400">{fmt(q.monthly_amount)}/mo</span>}
                                          {q.annual_amount && <span className="text-xs text-gray-400">{fmt(q.annual_amount)}/yr</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {q.attachment_path && (
                                            <button
                                              onClick={() => viewQuoteFile(q.attachment_path!)}
                                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 flex items-center gap-1"
                                            >
                                              <Eye size={10} /> View Document
                                            </button>
                                          )}
                                          <select
                                            value={q.status}
                                            onChange={e => updateQuoteStatus(q.id, e.target.value as QuoteStatus)}
                                            className="text-xs border border-gray-200 rounded px-2 py-0.5"
                                          >
                                            <option value="received">Received</option>
                                            <option value="under_review">Under Review</option>
                                            <option value="clarification_needed">Needs Clarification</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="rejected">Rejected</option>
                                          </select>
                                        </div>
                                      </div>
                                      {(q.labor_cost || q.materials_cost || q.equipment_cost) && (
                                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                          {q.labor_cost && <span>Labor: {fmt(q.labor_cost)}</span>}
                                          {q.materials_cost && <span>Materials: {fmt(q.materials_cost)}</span>}
                                          {q.equipment_cost && <span>Equipment: {fmt(q.equipment_cost)}</span>}
                                          {q.overhead_markup && <span>OH: {q.overhead_markup}%</span>}
                                        </div>
                                      )}
                                      {q.attachment_path && <div className="text-xs text-blue-600 mt-1 flex items-center gap-1"><FileText size={10} /> Quote document attached</div>}
                                      {q.scope_exclusions && <div className="text-xs text-red-600 mt-1">Exclusions: {q.scope_exclusions}</div>}
                                      {q.scope_inclusions && <div className="text-xs text-green-600 mt-1">Includes: {q.scope_inclusions}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Communication Log */}
                              {ss.communications.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><MessageSquare size={12} /> Communication Log</h5>
                                  <div className="space-y-1">
                                    {ss.communications.slice(0, 5).map(c => (
                                      <div key={c.id} className="flex items-start gap-2 text-xs">
                                        <span className={`px-1.5 py-0.5 rounded ${c.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : c.direction === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {c.direction === 'outbound' ? '→' : c.direction === 'inbound' ? '←' : '•'} {c.comm_type.replace('_', ' ')}
                                        </span>
                                        {c.subject && <span className="font-medium text-gray-700">{c.subject}</span>}
                                        <span className="text-gray-500 flex-1 truncate">{c.body}</span>
                                        <span className="text-gray-300 flex-shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Timeline */}
                              <div className="flex flex-wrap gap-3 text-xs text-gray-400 border-t border-gray-100 pt-2">
                                {ss.rfq_sent_date && <span>RFQ Sent: {new Date(ss.rfq_sent_date).toLocaleDateString()}</span>}
                                {ss.rfq_due_date && <span>Due: {new Date(ss.rfq_due_date).toLocaleDateString()}</span>}
                                {ss.response_date && <span>Responded: {new Date(ss.response_date).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Question Queue for this SOW */}
                  {taskOrderId && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <QuestionQueue taskOrderId={taskOrderId} sowItemId={sow.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* RFQ Send Confirmation Modal */}
      {showRfqModal && (() => {
        const sow = sowItems.find(s => s.id === showRfqModal)
        const identified = sow?.subcontractors.filter(s => s.outreach_status === 'identified') || []
        const withEmail = identified.filter(s => s.subcontractor?.contact_email)
        const withoutEmail = identified.filter(s => !s.subcontractor?.contact_email)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Send RFQ Emails</h3>
              <p className="text-sm text-gray-600 mb-4">
                Send RFQ emails to <strong>{withEmail.length}</strong> subcontractor{withEmail.length !== 1 ? 's' : ''} for <strong>{sow?.sow_name}</strong>.
              </p>
              {withoutEmail.length > 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  {withoutEmail.length} sub{withoutEmail.length !== 1 ? 's' : ''} will be skipped (no email on file): {withoutEmail.map(s => s.subcontractor?.company_name).join(', ')}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message (optional)</label>
                <textarea
                  value={rfqMessage}
                  onChange={e => setRfqMessage(e.target.value)}
                  placeholder="Add a personalized note to include in the RFQ email..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {(sowDocuments[showRfqModal]?.length || 0) > 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <strong>{sowDocuments[showRfqModal].length} document{sowDocuments[showRfqModal].length !== 1 ? 's' : ''}</strong> will be included: {sowDocuments[showRfqModal].map((d: any) => d.file_name).join(', ')}
                </div>
              )}
              {(sowDocuments[showRfqModal]?.length || 0) === 0 && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                  <Paperclip size={12} className="inline mr-1" /> No SOW documents attached. Consider uploading scope documents and flow-downs before sending.
                </div>
              )}
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                Each subcontractor will receive a unique portal link to view the SOW, download documents, submit their quote, and ask questions.
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowRfqModal(null); setRfqMessage('') }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  onClick={confirmSendRfqs}
                  disabled={withEmail.length === 0}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={14} /> Send {withEmail.length} RFQ Email{withEmail.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
