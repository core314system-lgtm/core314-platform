import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Document as Doc, TaskOrder } from '../lib/types'
import { ArrowLeft, Upload, FileText, Trash2, BarChart2 } from 'lucide-react'

export default function QuoteManagement() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [quotes, setQuotes] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [serviceCategory, setServiceCategory] = useState('')

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      fetchQuotes()
    }
  }, [id])

  async function fetchQuotes() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('task_order_id', id)
      .eq('category', 'subcontractor_quote')
      .order('uploaded_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !id || !user) return
    setUploading(true)

    for (const file of files) {
      const path = `${id}/quotes/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('task-order-documents').upload(path, file)
      if (error) { console.error(error); continue }

      await supabase.from('documents').insert({
        task_order_id: id,
        file_name: serviceCategory ? `[${serviceCategory}] ${file.name}` : file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        category: 'subcontractor_quote',
        version: 1,
        uploaded_by: user.id,
      })
    }

    setUploading(false)
    fetchQuotes()
    e.target.value = ''
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return
    await supabase.storage.from('task-order-documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    fetchQuotes()
  }

  // Group quotes by service category (extracted from filename prefix)
  const grouped: Record<string, Doc[]> = {}
  for (const q of quotes) {
    const match = q.file_name.match(/^\[(.+?)\]/)
    const cat = match ? match[1] : 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(q)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="text-teal-600" size={24} /> Subcontractor Quote Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">{quotes.length} quote{quotes.length !== 1 ? 's' : ''} uploaded</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Upload Subcontractor Quotes</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Category (optional)</label>
            <input
              type="text"
              value={serviceCategory}
              onChange={e => setServiceCategory(e.target.value)}
              placeholder="e.g., HVAC, Janitorial, Grounds"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="pt-6">
            <label className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-teal-700 flex items-center gap-2">
              <Upload size={16} /> Upload Quotes
              <input type="file" multiple onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>
        {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
      </div>

      {/* Quotes by Category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BarChart2 className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No subcontractor quotes uploaded yet.</p>
          <p className="text-sm text-gray-400 mt-1">Upload quotes and tag them with service categories for side-by-side comparison.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, docs]) => (
          <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{category}</h3>
              <p className="text-xs text-gray-500">{docs.length} quote{docs.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {docs.map(doc => (
                <div key={doc.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-800">{doc.file_name.replace(/^\[.+?\]\s*/, '')}</p>
                      <p className="text-xs text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB | Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(doc)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {docs.length >= 2 && (
              <div className="px-6 py-3 bg-teal-50 border-t border-teal-200">
                <p className="text-xs text-teal-700 font-medium">
                  {docs.length} quotes available for comparison. AI comparison will flag missing scope, exceptions, and pricing gaps.
                </p>
              </div>
            )}
          </div>
        ))
      )}

      {/* Comparison Tips */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Quote Comparison Tips</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Tag each quote with the service category for organized comparison</li>
          <li>• The system will flag missing scope, exceptions, exclusions, and assumptions</li>
          <li>• Watch for sales tax omissions and pricing gaps between vendors</li>
          <li>• Track vendor responsiveness and competitiveness over time</li>
        </ul>
      </div>
    </div>
  )
}
