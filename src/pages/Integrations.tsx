import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import {
  Search, ExternalLink, Upload, FileSpreadsheet,
  Building2, Globe, Key, Copy, CheckCircle, AlertCircle,
  MapPin, Clock, Filter, ChevronDown, ChevronUp, Plus,
  Paperclip, Link2
} from 'lucide-react'

// ========== SAM.gov Types ==========
interface SamOpportunity {
  noticeId: string
  title: string
  solicitationNumber: string
  agency: string
  postedDate: string
  responseDeadline: string
  type: string
  setAside: string | null
  naicsCode: string
  active: boolean
  description: string
  uiLink: string
  placeOfPerformance: { city: string | null; state: string | null } | null
  pointOfContact: Array<{ name: string; email: string; phone: string }>
  attachmentCounts?: { files: number; links: number }
}

// ========== Opportunity Types ==========
const OPP_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'o', label: 'Solicitation' },
  { value: 'p', label: 'Presolicitation' },
  { value: 'k', label: 'Combined Synopsis/Solicitation' },
  { value: 'r', label: 'Sources Sought' },
  { value: 'g', label: 'Sale of Surplus Property' },
  { value: 's', label: 'Special Notice' },
  { value: 'i', label: 'Intent to Bundle' },
]

const SET_ASIDES = [
  { value: '', label: 'All Set-Asides' },
  { value: 'SBA', label: 'Total Small Business' },
  { value: 'SBP', label: 'Partial Small Business' },
  { value: '8A', label: '8(a)' },
  { value: 'HZC', label: 'HUBZone' },
  { value: 'SDVOSBC', label: 'SDVOSB' },
  { value: 'WOSB', label: 'WOSB' },
  { value: 'EDWOSB', label: 'EDWOSB' },
]

export default function Integrations() {
  const { user } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()

  // Tab state
  const [activeTab, setActiveTab] = useState<'sam' | 'import' | 'api'>('sam')

  // SAM.gov search state
  const [samKeyword, setSamKeyword] = useState('')
  const [samType, setSamType] = useState('')
  const [samNaics, setSamNaics] = useState('')
  const [samSetAside, setSamSetAside] = useState('')
  const [samResults, setSamResults] = useState<SamOpportunity[]>([])
  const [samTotal, setSamTotal] = useState(0)
  const [samSearching, setSamSearching] = useState(false)
  const [samError, setSamError] = useState('')
  const [samImporting, setSamImporting] = useState<string | null>(null)
  const [samImported, setSamImported] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)

  // API state
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  // Load existing API key from org settings
  useEffect(() => {
    if (currentOrg?.settings && typeof currentOrg.settings === 'object') {
      const settings = currentOrg.settings as Record<string, string>
      if (settings.api_key) setApiKey(settings.api_key)
    }
  }, [currentOrg])

  // ========== SAM.gov Search ==========
  async function handleSamSearch() {
    setSamSearching(true)
    setSamError('')
    setSamResults([])

    try {
      const res = await fetch('/api/sam-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: samKeyword,
          solicitationType: samType || undefined,
          naicsCode: samNaics || undefined,
          setAside: samSetAside || undefined,
          limit: 25,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Search failed' }))
        setSamError(err.error || 'Search failed')
        setSamSearching(false)
        return
      }

      const data = await res.json()
      setSamResults(data.opportunities || [])
      setSamTotal(data.totalRecords || 0)
    } catch (err) {
      setSamError('Network error — could not reach SAM.gov. The SAM.gov API may be temporarily unavailable.')
    }
    setSamSearching(false)
  }

  async function handleImportOpportunity(opp: SamOpportunity) {
    setSamImporting(opp.noticeId)

    const insertData: Record<string, unknown> = {
      title: opp.title,
      solicitation_number: opp.solicitationNumber || null,
      site_name: opp.placeOfPerformance?.city && opp.placeOfPerformance?.state
        ? `${opp.placeOfPerformance.city}, ${opp.placeOfPerformance.state}`
        : opp.agency || null,
      location_city: opp.placeOfPerformance?.city || null,
      location_state: opp.placeOfPerformance?.state || null,
      due_date: opp.responseDeadline ? new Date(opp.responseDeadline).toISOString().split('T')[0] : null,
      notes: `Imported from SAM.gov\nAgency: ${opp.agency}\nNotice ID: ${opp.noticeId}\nNAICS: ${opp.naicsCode}\nSet-Aside: ${opp.setAside || 'None'}\n${opp.pointOfContact.length > 0 ? `Contact: ${opp.pointOfContact[0].name} (${opp.pointOfContact[0].email})` : ''}\n\n${opp.description}`,
      status: 'draft',
      project_type: 'government_task_order',
      created_by: user?.id,
      naics_code: opp.naicsCode || null,
      set_aside: opp.setAside || null,
    }

    if (isMultiTenantEnabled && currentOrg) {
      insertData.org_id = currentOrg.id
    }

    let projectId: string | null = null

    const { data, error } = await supabase.from('task_orders').insert(insertData).select().single()

    if (error) {
      delete insertData.naics_code
      delete insertData.set_aside
      const { data: fallbackData, error: e2 } = await supabase.from('task_orders').insert(insertData).select().single()
      if (e2) {
        alert('Import failed: ' + e2.message)
        setSamImporting(null)
        return
      }
      projectId = fallbackData?.id || null
    } else {
      projectId = data?.id || null
    }

    // Record in workflow history
    if (projectId) {
      try {
        await supabase.from('workflow_history').insert({
          task_order_id: projectId,
          from_stage: null,
          to_stage: 'draft',
          changed_by: user?.id || '',
          changed_by_name: null,
          note: `Imported from SAM.gov (${opp.solicitationNumber})`,
        })
      } catch { /* workflow_history may not exist */ }
    }

    // Download SAM.gov solicitation documents and capture links
    if (projectId && user) {
      try {
        const attRes = await fetch(`/api/sam-documents?opportunityId=${opp.noticeId}`)
        if (attRes.ok) {
          const attData = await attRes.json()
          const attachments = (attData.attachments || []) as Array<{
            resourceId: string; name: string; mimeType: string; size: number;
            type: 'file' | 'link'; uri?: string; description?: string
          }>

          const fileAtts = attachments.filter(a => a.type === 'file')
          const linkAtts = attachments.filter(a => a.type === 'link')

          // Download file attachments via proxy and upload to Supabase
          let docCount = 0
          for (const att of fileAtts) {
            try {
              const dlRes = await fetch(`/api/sam-documents?resourceId=${att.resourceId}&download=1`)
              if (!dlRes.ok) {
                console.warn(`[SAM Import] Download failed for ${att.name}: HTTP ${dlRes.status}`)
                continue
              }

              const arrayBuffer = await dlRes.arrayBuffer()
              const ext = att.name.split('.').pop()?.toLowerCase() || ''
              const mimeMap: Record<string, string> = {
                pdf: 'application/pdf',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                doc: 'application/msword',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                xls: 'application/vnd.ms-excel',
                zip: 'application/zip',
              }
              const mimeType = mimeMap[ext] || 'application/octet-stream'

              const file = new File([arrayBuffer], att.name, { type: mimeType })
              const storagePath = `${projectId}/${Date.now()}_${att.name}`

              console.log(`[SAM Import] Uploading ${att.name} (${(arrayBuffer.byteLength / 1024).toFixed(0)}KB) to ${storagePath}`)

              const { error: uploadErr } = await supabase.storage
                .from('task-order-documents')
                .upload(storagePath, file, { contentType: mimeType, upsert: false })

              if (uploadErr) {
                console.error(`[SAM Import] Upload to storage failed for ${att.name}:`, uploadErr.message)
                continue
              }

              const { error: insertErr } = await supabase.from('documents').insert({
                task_order_id: projectId,
                file_name: att.name,
                file_path: storagePath,
                file_size: arrayBuffer.byteLength,
                file_type: mimeType,
                category: 'solicitation',
                version: 1,
                uploaded_by: user.id,
              })
              if (insertErr) {
                console.error(`[SAM Import] DB insert failed for ${att.name}:`, insertErr.message)
              } else {
                docCount++
                console.log(`[SAM Import] Successfully imported ${att.name}`)
              }
            } catch (err) {
              console.error(`[SAM Import] Error for ${att.name}:`, err)
            }
          }
          if (docCount > 0) {
            console.log(`[SAM Import] Successfully imported ${docCount} document(s)`)
          } else if (fileAtts.length > 0) {
            console.warn(`[SAM Import] Failed to import any of ${fileAtts.length} document(s) — check browser console for errors`)
          }

          // Append external document links to project notes
          if (linkAtts.length > 0) {
            const linkNotes = '\n\n--- SAM.gov Document Links ---\n' +
              linkAtts.map(l => `• ${l.description || l.name}: ${l.uri}`).join('\n')

            await supabase.from('task_orders')
              .update({ notes: (insertData.notes as string || '') + linkNotes })
              .eq('id', projectId)
          }
        }
      } catch { /* documents download is best-effort */ }
    }

    setSamImported(prev => new Set(prev).add(opp.noticeId))
    setSamImporting(null)
  }

  // ========== CSV/Excel Import ==========
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult(null)

    // Parse CSV preview
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      setImportPreview([])
      return
    }

    const headerLine = lines[0]
    const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const preview: Array<Record<string, string>> = []

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, j) => { row[h] = values[j] || '' })
      preview.push(row)
    }
    setImportPreview(preview)
  }

  async function handleBulkImport() {
    if (!importFile) return
    setImporting(true)

    const text = await importFile.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

    // Map common header names
    const headerMap: Record<string, string> = {
      'title': 'title', 'project': 'title', 'project name': 'title', 'name': 'title',
      'solicitation': 'solicitation_number', 'solicitation number': 'solicitation_number', 'sol #': 'solicitation_number',
      'task order': 'task_order_number', 'task order number': 'task_order_number', 'to #': 'task_order_number',
      'site': 'site_name', 'site name': 'site_name', 'location': 'site_name',
      'city': 'location_city',
      'state': 'location_state',
      'due date': 'due_date', 'deadline': 'due_date', 'response date': 'due_date',
      'notes': 'notes', 'description': 'notes',
      'type': 'project_type', 'project type': 'project_type',
      'contract': 'contract_title', 'contract name': 'contract_title', 'parent contract': 'contract_title',
    }

    const columnMap: Record<number, string> = {}
    headers.forEach((h, i) => {
      const mapped = headerMap[h]
      if (mapped) columnMap[i] = mapped
    })

    let success = 0
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      Object.entries(columnMap).forEach(([idx, field]) => {
        row[field] = values[Number(idx)] || ''
      })

      if (!row.title) {
        errors.push(`Row ${i + 1}: Missing title`)
        continue
      }

      const insertData: Record<string, unknown> = {
        title: row.title,
        solicitation_number: row.solicitation_number || null,
        task_order_number: row.task_order_number || null,
        site_name: row.site_name || null,
        location_city: row.location_city || null,
        location_state: row.location_state || null,
        due_date: row.due_date || null,
        notes: row.notes || null,
        status: 'draft',
        project_type: row.project_type || 'government_task_order',
        created_by: user?.id,
      }

      if (isMultiTenantEnabled && currentOrg) {
        insertData.org_id = currentOrg.id
      }

      // Try to match contract by title
      if (row.contract_title && currentOrg) {
        const { data: matchedContract } = await supabase.from('contracts')
          .select('id').eq('org_id', currentOrg.id)
          .ilike('title', row.contract_title.trim()).limit(1).single()
        if (matchedContract) insertData.contract_id = matchedContract.id
      }

      const { error } = await supabase.from('task_orders').insert(insertData)
      if (error) {
        errors.push(`Row ${i + 1}: ${error.message}`)
      } else {
        success++
      }
    }

    setImportResult({ success, errors })
    setImporting(false)
  }

  // ========== API Key Management ==========
  async function generateApiKey() {
    const key = 'pk_' + crypto.randomUUID().replace(/-/g, '')
    setApiKey(key)

    if (currentOrg) {
      const newSettings = { ...(currentOrg.settings || {}), api_key: key }
      await supabase.from('organizations').update({ settings: newSettings }).eq('id', currentOrg.id)
    }
  }

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  // ========== Render ==========
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500">Connect external data sources and import opportunities</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'sam' as const, label: 'SAM.gov Search', icon: Building2 },
          { id: 'import' as const, label: 'Bulk Import', icon: FileSpreadsheet },
          { id: 'api' as const, label: 'API Access', icon: Key },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* SAM.gov Search Tab */}
      {activeTab === 'sam' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe size={18} className="text-blue-600" />
              Search Federal Opportunities
            </h2>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={samKeyword}
                    onChange={e => setSamKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSamSearch()}
                    placeholder="Search keywords (e.g., facility maintenance, HVAC, janitorial)..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSamSearch}
                  disabled={samSearching || !samKeyword.trim()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {samSearching ? 'Searching...' : <><Search size={16} /> Search</>}
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Filter size={14} /> Advanced Filters
                {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showFilters && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Opportunity Type</label>
                    <select value={samType} onChange={e => setSamType(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                      {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NAICS Code</label>
                    <input type="text" value={samNaics} onChange={e => setSamNaics(e.target.value)}
                      placeholder="e.g., 561210"
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Set-Aside</label>
                    <select value={samSetAside} onChange={e => setSamSetAside(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                      {SET_ASIDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {samError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {samError}
            </div>
          )}

          {samResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{samTotal.toLocaleString()} opportunities found — showing {samResults.length}</p>

              {samResults.map(opp => (
                <div key={opp.noticeId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{opp.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="font-medium text-blue-600">{opp.solicitationNumber}</span>
                        <span>{opp.agency}</span>
                        {opp.naicsCode && <span>NAICS: {opp.naicsCode}</span>}
                        {opp.setAside && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{opp.setAside}</span>}
                        {opp.type && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{opp.type}</span>}
                      </div>
                      {opp.placeOfPerformance && (opp.placeOfPerformance.city || opp.placeOfPerformance.state) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <MapPin size={10} />
                          {[opp.placeOfPerformance.city, opp.placeOfPerformance.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {opp.responseDeadline && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock size={10} /> Response deadline: {new Date(opp.responseDeadline).toLocaleDateString()}
                        </div>
                      )}
                      {opp.attachmentCounts && (opp.attachmentCounts.files > 0 || opp.attachmentCounts.links > 0) && (
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          {opp.attachmentCounts.files > 0 && (
                            <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              <Paperclip size={10} /> {opp.attachmentCounts.files} document{opp.attachmentCounts.files !== 1 ? 's' : ''}
                            </span>
                          )}
                          {opp.attachmentCounts.links > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              <Link2 size={10} /> {opp.attachmentCounts.links} external link{opp.attachmentCounts.links !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {opp.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{opp.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {samImported.has(opp.noticeId) ? (
                        <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                          <CheckCircle size={14} /> Imported with docs
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportOpportunity(opp)}
                          disabled={samImporting === opp.noticeId}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {samImporting === opp.noticeId ? 'Importing & downloading docs...' : <><Plus size={12} /> Import</>}
                        </button>
                      )}
                      <a
                        href={opp.uiLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> View on SAM.gov
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk Import Tab */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-green-600" />
            Import Projects from CSV
          </h2>
          <p className="text-sm text-gray-500">
            Upload a CSV file with your projects. The system auto-detects columns by matching header names.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">Supported column headers:</p>
            <p>Title, Solicitation Number, Task Order Number, Site Name, City, State, Due Date, Notes, Project Type, Contract (parent contract name)</p>
            <p className="text-gray-400 mt-1">Minimum required: Title</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-green-100">
              <Upload size={16} />
              Choose CSV File
              <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            </label>
            {importFile && <span className="text-sm text-gray-600">{importFile.name}</span>}
          </div>

          {importPreview.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Preview (first {importPreview.length} rows):</p>
              <div className="overflow-x-auto">
                <table className="text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(importPreview[0]).map(h => (
                        <th key={h} className="px-3 py-1.5 text-left font-medium text-gray-500 border-b">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleBulkImport}
                disabled={importing}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import All Projects`}
              </button>
            </div>
          )}

          {importResult && (
            <div className={`rounded-lg p-4 ${importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-sm font-medium text-gray-800">
                {importResult.success} project{importResult.success !== 1 ? 's' : ''} imported successfully.
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  {importResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* API Access Tab */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Key size={18} className="text-purple-600" />
              API Access
            </h2>
            <p className="text-sm text-gray-500">
              Use the Procuvex API to create and manage projects programmatically from external systems (CRM, ERP, scripts).
            </p>

            {apiKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-sm font-mono text-gray-700">
                    {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => setShowKey(!showKey)} className="text-sm text-gray-500 hover:text-gray-700">
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={copyApiKey} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    {keyCopied ? <><CheckCircle size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
                <button onClick={generateApiKey} className="text-xs text-red-500 hover:text-red-700">
                  Regenerate Key (invalidates current key)
                </button>
              </div>
            ) : (
              <button
                onClick={generateApiKey}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
              >
                Generate API Key
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">API Documentation</h3>

            <div className="space-y-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-700">Create a Project</p>
                <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto whitespace-pre">
{`POST https://procuvex.com/api/projects
Headers:
  X-API-Key: your_api_key
  Content-Type: application/json

Body:
{
  "title": "HVAC Maintenance - Building A",
  "solicitation_number": "SOL-2026-001",
  "site_name": "Federal Building A",
  "location_city": "Atlanta",
  "location_state": "GA",
  "due_date": "2026-06-15",
  "project_type": "government_task_order",
  "notes": "Optional notes",
  "contract_id": "optional-parent-contract-uuid"
}`}
                </code>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-700">List Projects</p>
                <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto whitespace-pre">
{`GET https://procuvex.com/api/projects
Headers:
  X-API-Key: your_api_key`}
                </code>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-700">Authentication</p>
                <p className="text-gray-600">
                  Two options: <strong>API Key</strong> (X-API-Key header) for server-to-server integration,
                  or <strong>Bearer Token</strong> (Authorization: Bearer) using a Supabase access token for user-scoped access.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-700">Project Types</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><code>government_task_order</code> — Government Task Order / RFQ</p>
                  <p><code>government_rfp</code> — Government RFP / Proposal</p>
                  <p><code>construction</code> — Construction Bid</p>
                  <p><code>it_services</code> — IT Services / Technology</p>
                  <p><code>commercial</code> — Commercial Procurement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
