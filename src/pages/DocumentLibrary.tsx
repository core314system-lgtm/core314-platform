import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { DocumentCategory } from '../lib/types'
import {
  Search, FileText, Download, Eye, Filter, ChevronDown, ChevronUp,
  X, Clock, ExternalLink, Archive, CheckSquare, Square
} from 'lucide-react'

interface DocRow {
  id: string
  task_order_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  category: DocumentCategory
  version: number
  uploaded_by: string
  uploaded_at: string
  project_title?: string
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  sow: { label: 'Statement of Work', color: 'bg-blue-100 text-blue-700' },
  pricing_sheet: { label: 'Pricing Sheet', color: 'bg-green-100 text-green-700' },
  exhibit: { label: 'Exhibit / Attachment', color: 'bg-purple-100 text-purple-700' },
  amendment: { label: 'Amendment', color: 'bg-amber-100 text-amber-700' },
  qa_response: { label: 'Q&A Response', color: 'bg-cyan-100 text-cyan-700' },
  wage_determination: { label: 'Wage Determination', color: 'bg-orange-100 text-orange-700' },
  site_info: { label: 'Site Information', color: 'bg-teal-100 text-teal-700' },
  subcontractor_quote: { label: 'Subcontractor Quote', color: 'bg-indigo-100 text-indigo-700' },
  internal_notes: { label: 'Internal Notes', color: 'bg-gray-100 text-gray-700' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-600' },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function DocumentLibrary() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewType, setPreviewType] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('procuvex_recent_docs') || '[]')
    } catch { return [] }
  })

  useEffect(() => {
    async function load() {
      const [docRes, projRes] = await Promise.all([
        supabase.from('documents').select('*').order('uploaded_at', { ascending: false }),
        supabase.from('task_orders').select('id, title').order('title'),
      ])

      const projMap = new Map((projRes.data || []).map(p => [p.id, p.title]))
      const enriched: DocRow[] = (docRes.data || []).map(d => ({
        ...d,
        project_title: projMap.get(d.task_order_id) || 'Unknown Project',
      }))

      setDocs(enriched)
      setProjects(projRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = docs

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.file_name.toLowerCase().includes(q) ||
        (d.project_title || '').toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== 'all') {
      result = result.filter(d => d.category === categoryFilter)
    }

    if (projectFilter !== 'all') {
      result = result.filter(d => d.task_order_id === projectFilter)
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') cmp = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
      else if (sortBy === 'name') cmp = a.file_name.localeCompare(b.file_name)
      else if (sortBy === 'size') cmp = a.file_size - b.file_size
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [docs, search, categoryFilter, projectFilter, sortBy, sortDir])

  const stats = useMemo(() => {
    const totalSize = docs.reduce((s, d) => s + d.file_size, 0)
    const categories = new Set(docs.map(d => d.category)).size
    return { total: docs.length, totalSize, categories, projects: projects.length }
  }, [docs, projects])

  const trackRecentView = useCallback((docId: string) => {
    setRecentlyViewed(prev => {
      const updated = [docId, ...prev.filter(id => id !== docId)].slice(0, 10)
      localStorage.setItem('procuvex_recent_docs', JSON.stringify(updated))
      return updated
    })
  }, [])

  async function handleView(doc: DocRow) {
    try {
      const { data, error } = await supabase.storage
        .from('task-order-documents')
        .createSignedUrl(doc.file_path, 3600)
      if (error) throw error
      if (data?.signedUrl) {
        trackRecentView(doc.id)

        // Check if this is a previewable type
        const ext = doc.file_name.split('.').pop()?.toLowerCase() || ''
        const isPreviewable = ['pdf'].includes(ext) ||
          (doc.file_type || '').startsWith('image/') ||
          ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)

        if (isPreviewable) {
          setPreviewUrl(data.signedUrl)
          setPreviewName(doc.file_name)
          setPreviewType(doc.file_type || '')
        } else {
          window.open(data.signedUrl, '_blank')
        }
      }
    } catch (err) {
      alert('Failed to open document: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleDownloadSingle(doc: DocRow) {
    try {
      const { data, error } = await supabase.storage
        .from('task-order-documents')
        .createSignedUrl(doc.file_path, 3600)
      if (error) throw error
      if (data?.signedUrl) {
        trackRecentView(doc.id)
        const a = document.createElement('a')
        a.href = data.signedUrl
        a.download = doc.file_name
        a.target = '_blank'
        a.click()
      }
    } catch (err) {
      alert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleBulkDownload() {
    const toDownload = selected.size > 0
      ? filtered.filter(d => selected.has(d.id))
      : filtered

    if (toDownload.length === 0) return
    if (toDownload.length === 1) {
      handleDownloadSingle(toDownload[0])
      return
    }

    setDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const doc of toDownload) {
        try {
          const { data, error } = await supabase.storage
            .from('task-order-documents')
            .download(doc.file_path)
          if (error || !data) continue
          const folder = doc.project_title || 'Unknown'
          zip.file(`${folder}/${doc.file_name}`, data)
        } catch {
          // Skip files that fail to download
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `procuvex-documents-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to create ZIP: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDownloading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(d => d.id)))
    }
  }

  function toggleSort(col: 'date' | 'name' | 'size') {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir(col === 'date' ? 'desc' : 'asc')
    }
  }

  const recentDocs = useMemo(() => {
    return recentlyViewed
      .map(id => docs.find(d => d.id === id))
      .filter((d): d is DocRow => !!d)
      .slice(0, 5)
  }, [recentlyViewed, docs])

  if (loading) return <div className="text-center py-12 text-gray-500">Loading documents...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
          <p className="text-sm text-gray-500">
            {stats.total} documents across {stats.projects} projects · {formatFileSize(stats.totalSize)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-sm text-blue-600 font-medium">{selected.size} selected</span>
          )}
          <button
            onClick={handleBulkDownload}
            disabled={downloading || filtered.length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Archive size={16} />
            {downloading ? 'Creating ZIP...' : selected.size > 0 ? `Download ${selected.size} as ZIP` : 'Download All as ZIP'}
          </button>
        </div>
      </div>

      {/* Recently Viewed */}
      {recentDocs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={14} /> Recently Viewed
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleView(doc)}
                className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors min-w-0 shrink-0"
              >
                <FileText size={14} className="text-blue-500" />
                <span className="truncate max-w-[180px] text-gray-700">{doc.file_name}</span>
                <span className="text-xs text-gray-400 shrink-0">{doc.project_title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by file name or project name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || categoryFilter !== 'all' || projectFilter !== 'all'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={14} />
            Filters
            {(categoryFilter !== 'all' || projectFilter !== 'all') && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {(categoryFilter !== 'all' ? 1 : 0) + (projectFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Category:</label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_META).map(([val, meta]) => (
                  <option key={val} value={val}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Project:</label>
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            {(categoryFilter !== 'all' || projectFilter !== 'all') && (
              <button
                onClick={() => { setCategoryFilter('all'); setProjectFilter('all') }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No documents found</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || categoryFilter !== 'all' || projectFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Upload documents to a project to see them here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {selected.size === filtered.length && filtered.length > 0
                        ? <CheckSquare size={16} className="text-blue-600" />
                        : <Square size={16} />
                      }
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      Document
                      {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('size')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      Size
                      {sortBy === 'size' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      Uploaded
                      {sortBy === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(doc => {
                  const cat = CATEGORY_META[doc.category] || CATEGORY_META.other
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50 transition-colors ${selected.has(doc.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(doc.id)} className="text-gray-400 hover:text-gray-600">
                          {selected.has(doc.id)
                            ? <CheckSquare size={16} className="text-blue-600" />
                            : <Square size={16} />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleView(doc)}
                          className="flex items-center gap-2 text-sm text-gray-900 hover:text-blue-600 group text-left"
                        >
                          <FileText size={16} className="text-blue-500 group-hover:text-blue-600 shrink-0" />
                          <span className="font-medium truncate max-w-xs">{doc.file_name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/projects/${doc.task_order_id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px] block"
                        >
                          {doc.project_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatFileSize(doc.file_size)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.uploaded_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleView(doc)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDownloadSingle(doc)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <Link
                            to={`/projects/${doc.task_order_id}`}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Go to Project"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Preview Modal */}
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
