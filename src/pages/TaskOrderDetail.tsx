import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder, Document as DocType, DocumentCategory } from '../lib/types'
import { ArrowLeft, Upload, FileText, Trash2 } from 'lucide-react'

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  sow: 'Statement of Work',
  pricing_sheet: 'Pricing Sheet',
  exhibit: 'Exhibit',
  amendment: 'Amendment',
  qa_response: 'Q&A Response',
  wage_determination: 'Wage Determination',
  site_info: 'Site Information',
  subcontractor_quote: 'Subcontractor Quote',
  internal_notes: 'Internal Notes',
  other: 'Other',
}

export default function TaskOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [documents, setDocuments] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('sow')

  const fetchData = useCallback(async () => {
    if (!id) return

    const [toRes, docsRes] = await Promise.all([
      supabase.from('task_orders').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('task_order_id', id).order('uploaded_at', { ascending: false }),
    ])

    setTaskOrder(toRes.data)
    setDocuments(docsRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || !id) return

    setUploading(true)

    for (const file of files) {
      const filePath = `${id}/${Date.now()}_${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('task-order-documents')
        .upload(filePath, file)

      if (uploadError) {
        alert('Upload error: ' + uploadError.message)
        continue
      }

      await supabase.from('documents').insert({
        task_order_id: id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        category: selectedCategory,
        version: 1,
      })
    }

    setUploading(false)
    fetchData()
    e.target.value = ''
  }

  async function handleDeleteDocument(doc: DocType) {
    if (!confirm(`Delete ${doc.file_name}?`)) return

    await supabase.storage.from('task-order-documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    fetchData()
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading...</div>
  }

  if (!taskOrder) {
    return <div className="text-center text-gray-500 py-12">Task order not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/task-orders" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{taskOrder.title}</h1>
          <p className="text-gray-500">
            {taskOrder.site_name && `${taskOrder.site_name} • `}
            {taskOrder.location_city && `${taskOrder.location_city}, `}{taskOrder.location_state}
          </p>
        </div>
      </div>

      {/* Task Order Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Solicitation #</span>
            <p className="font-medium">{taskOrder.solicitation_number || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Task Order #</span>
            <p className="font-medium">{taskOrder.task_order_number || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Status</span>
            <p className="font-medium capitalize">{taskOrder.status.replace('_', ' ')}</p>
          </div>
          <div>
            <span className="text-gray-500">Due Date</span>
            <p className="font-medium">{taskOrder.due_date ? new Date(taskOrder.due_date).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        {taskOrder.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Notes</span>
            <p className="mt-1 text-gray-700">{taskOrder.notes}</p>
          </div>
        )}
      </div>

      {/* Document Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

        <div className="flex items-end gap-3 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <label className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={18} />
            {uploading ? 'Uploading...' : 'Upload Files'}
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileText className="text-gray-400" size={20} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {CATEGORY_LABELS[doc.category]} • {(doc.file_size / 1024).toFixed(0)} KB • {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDocument(doc)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
