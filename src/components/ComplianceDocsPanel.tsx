import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, Trash2, CheckCircle, XCircle, Clock, Calendar, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface RequiredDoc {
  id: string
  task_order_id: string
  sow_item_id: string | null
  doc_type: string
  doc_label: string
  is_required: boolean
}

interface UploadedDoc {
  id: string
  subcontractor_id: string
  task_order_id: string
  sow_item_id: string | null
  doc_type: string
  doc_name: string
  file_path: string
  file_name: string
  file_size: number | null
  expiration_date: string | null
  status: string
  reviewer_notes: string | null
  uploaded_at: string
  reviewed_at: string | null
}

interface Sub {
  id: string
  subcontractor_id: string
  sow_item_id: string
  subcontractors: { id: string; company_name: string; contact_email: string } | null
  sow_items: { id: string; sow_name: string } | null
}

const DOC_TYPES = [
  { value: 'coi', label: 'Certificate of Insurance (COI)' },
  { value: 'insurance_gl', label: 'General Liability Insurance' },
  { value: 'insurance_wc', label: "Workers' Compensation Insurance" },
  { value: 'insurance_auto', label: 'Auto Insurance' },
  { value: 'insurance_umbrella', label: 'Umbrella/Excess Insurance' },
  { value: 'license', label: 'Business/Trade License' },
  { value: 'trade_cert', label: 'Trade-Specific Certification' },
  { value: 'w9', label: 'W-9 Form' },
  { value: 'bonding', label: 'Bonding Certificate' },
  { value: 'safety', label: 'Safety Certification (OSHA, etc.)' },
  { value: 'quality', label: 'Quality Certification (ISO, etc.)' },
  { value: 'sam_registration', label: 'SAM.gov Registration' },
  { value: 'sba_cert', label: 'SBA Certification (8(a), HUBZone, etc.)' },
  { value: 'other', label: 'Other Document' },
]

function getDocTypeLabel(value: string) {
  return DOC_TYPES.find(d => d.value === value)?.label || value
}

export default function ComplianceDocsPanel({ taskOrderId }: { taskOrderId: string }) {
  const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  // Add required doc form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDocType, setNewDocType] = useState('')
  const [newDocLabel, setNewDocLabel] = useState('')
  const [newDocRequired, setNewDocRequired] = useState(true)
  const [adding, setAdding] = useState(false)

  // Review state
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    fetchData()
  }, [taskOrderId])

  async function fetchData() {
    try {
      const resp = await fetch(`/api/compliance-docs-api?task_order_id=${taskOrderId}`)
      if (resp.ok) {
        const data = await resp.json()
        setRequiredDocs(data.required_docs || [])
        setUploadedDocs(data.uploaded_docs || [])
        setSubs(data.subcontractors || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  async function handleAddRequired() {
    if (!newDocType || !newDocLabel) return
    setAdding(true)
    try {
      const resp = await fetch('/api/compliance-docs-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_required_doc',
          task_order_id: taskOrderId,
          doc_type: newDocType,
          doc_label: newDocLabel,
          is_required: newDocRequired,
        }),
      })
      const data = await resp.json()
      if (data.success) {
        setRequiredDocs(prev => [...prev, data.required_doc])
        setNewDocType('')
        setNewDocLabel('')
        setShowAddForm(false)
      }
    } catch { /* silent */ }
    setAdding(false)
  }

  async function handleRemoveRequired(id: string) {
    if (!confirm('Remove this requirement?')) return
    await fetch('/api/compliance-docs-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_required_doc', id }),
    })
    setRequiredDocs(prev => prev.filter(d => d.id !== id))
  }

  async function handleReview(docId: string, status: 'approved' | 'rejected') {
    const resp = await fetch('/api/compliance-docs-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review_doc', doc_id: docId, status, reviewer_notes: reviewNotes }),
    })
    const data = await resp.json()
    if (data.success) {
      setUploadedDocs(prev => prev.map(d => d.id === docId ? data.document : d))
      setReviewingDoc(null)
      setReviewNotes('')
    }
  }

  function getSubName(subId: string) {
    const sub = subs.find(s => s.subcontractor_id === subId)
    return sub?.subcontractors?.company_name || 'Unknown Sub'
  }

  // Build per-sub compliance summary
  const uniqueSubs = [...new Set(subs.map(s => s.subcontractor_id))]
  const subSummaries = uniqueSubs.map(subId => {
    const subDocs = uploadedDocs.filter(d => d.subcontractor_id === subId)
    const requiredCount = requiredDocs.filter(r => r.is_required).length
    const uploadedCount = requiredDocs.filter(r => r.is_required && subDocs.some(d => d.doc_type === r.doc_type)).length
    const expiredCount = subDocs.filter(d => d.expiration_date && new Date(d.expiration_date) < new Date()).length
    const pendingCount = subDocs.filter(d => d.status === 'pending').length
    return {
      subId,
      name: getSubName(subId),
      total: subDocs.length,
      required: requiredCount,
      uploaded: uploadedCount,
      expired: expiredCount,
      pending: pendingCount,
      complete: requiredCount > 0 ? uploadedCount >= requiredCount : false,
    }
  })

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm text-gray-500">Loading compliance data...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Compliance Documents</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {uploadedDocs.length} uploaded · {requiredDocs.length} required
          </span>
          {uploadedDocs.some(d => d.status === 'pending') && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {uploadedDocs.filter(d => d.status === 'pending').length} pending review
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          {/* Required Documents Config */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Required Documents</h4>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Requirement
              </button>
            </div>

            {showAddForm && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={newDocType}
                    onChange={e => {
                      setNewDocType(e.target.value)
                      if (!newDocLabel) {
                        const label = DOC_TYPES.find(d => d.value === e.target.value)?.label
                        if (label) setNewDocLabel(label)
                      }
                    }}
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="">Select type...</option>
                    {DOC_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newDocLabel}
                    onChange={e => setNewDocLabel(e.target.value)}
                    placeholder="Document label"
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={newDocRequired} onChange={e => setNewDocRequired(e.target.checked)} />
                      Required
                    </label>
                    <button
                      onClick={handleAddRequired}
                      disabled={adding || !newDocType || !newDocLabel}
                      className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {requiredDocs.length > 0 ? (
              <div className="space-y-1">
                {requiredDocs.map(req => (
                  <div key={req.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="flex-1 text-gray-700">{req.doc_label}</span>
                    <span className={`px-1.5 py-0.5 rounded ${req.is_required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {req.is_required ? 'Required' : 'Optional'}
                    </span>
                    <button onClick={() => handleRemoveRequired(req.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No required documents defined. Click "Add Requirement" to set what docs subs must upload.</p>
            )}
          </div>

          {/* Per-Sub Compliance Status */}
          {subSummaries.length > 0 && requiredDocs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Subcontractor Compliance Status</h4>
              <div className="space-y-2">
                {subSummaries.map(s => (
                  <div key={s.subId} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    {s.complete ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : s.uploaded > 0 ? (
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium text-gray-700 flex-1">{s.name}</span>
                    <span className="text-xs text-gray-500">
                      {s.uploaded}/{s.required} docs
                    </span>
                    {s.expired > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        {s.expired} expired
                      </span>
                    )}
                    {s.pending > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {s.pending} pending
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded Documents List */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Uploaded Documents ({uploadedDocs.length})
            </h4>
            {uploadedDocs.length > 0 ? (
              <div className="space-y-2">
                {uploadedDocs.map(doc => {
                  const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date()
                  const isExpiringSoon = doc.expiration_date && !isExpired && new Date(doc.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  return (
                    <div key={doc.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          doc.status === 'approved' ? 'text-green-500' :
                          doc.status === 'rejected' ? 'text-red-500' :
                          'text-amber-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-900">{doc.doc_name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                              doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                            {isExpired && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Expired</span>}
                            {isExpiringSoon && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Expiring Soon</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{getSubName(doc.subcontractor_id)}</span>
                            <span>{getDocTypeLabel(doc.doc_type)}</span>
                            {doc.expiration_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(doc.expiration_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {doc.reviewer_notes && (
                            <p className="mt-1 text-xs text-gray-600 italic">Notes: {doc.reviewer_notes}</p>
                          )}
                        </div>

                        {/* Review buttons */}
                        {doc.status === 'pending' && reviewingDoc !== doc.id && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleReview(doc.id, 'approved')}
                              className="p-1 rounded text-green-600 hover:bg-green-50"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setReviewingDoc(doc.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50"
                              title="Reject with notes"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Rejection notes form */}
                      {reviewingDoc === doc.id && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                          <input
                            type="text"
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-2"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(doc.id, 'rejected')}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => { setReviewingDoc(null); setReviewNotes('') }}
                              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No compliance documents uploaded by subcontractors yet.</p>
                <p className="text-xs text-gray-400 mt-1">Subs can upload documents via their portal's Compliance tab.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
