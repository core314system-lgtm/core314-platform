import { useState, useMemo } from 'react'
import { X, Eye, Edit3, Send, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useOrg } from '../contexts/OrgContext'
import { supabase } from '../lib/supabase'

const DEFAULT_RFQ_TEMPLATE = `Dear {contact_name},

You are invited to submit a quote for the following scope of work:

**Project:** {task_order_title}
**Scope:** {sow_name}
**Site:** {site_name}, {location_city}, {location_state}
**Category:** {service_category}
**Response Due:** {due_date}
**Solicitation #:** {solicitation_number}

Please use the secure portal link below to review the full requirements, download all documents, submit your quote, and ask any questions.

This link is unique to your organization. Please do not share it.

Regards,
{org_name}`

const MERGE_FIELDS = [
  { key: '{contact_name}', desc: 'Subcontractor contact name or company', example: 'John Smith' },
  { key: '{org_name}', desc: 'Your organization name', example: '' },
  { key: '{task_order_title}', desc: 'Project/task order title', example: '' },
  { key: '{sow_name}', desc: 'Scope of work name', example: '' },
  { key: '{service_category}', desc: 'Service category', example: '' },
  { key: '{site_name}', desc: 'Site name', example: '' },
  { key: '{location_city}', desc: 'City', example: '' },
  { key: '{location_state}', desc: 'State', example: '' },
  { key: '{due_date}', desc: 'Response due date', example: '' },
  { key: '{solicitation_number}', desc: 'Solicitation number', example: '' },
]

interface RfqComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: (template: string, subject: string, customMessage: string) => Promise<void>
  selectedCount: number
  project: { id: string; title: string; site_name?: string; location_city?: string; location_state?: string; due_date?: string; solicitation_number?: string } | null
  sowCategories: string[]
}

export default function RfqComposeModal({ open, onClose, onSend, selectedCount, project, sowCategories }: RfqComposeModalProps) {
  const { currentOrg } = useOrg()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [template, setTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showMergeFields, setShowMergeFields] = useState(false)

  // Load org's saved template on open
  if (open && !loaded) {
    setLoaded(true)
    // Load saved template from org settings
    if (currentOrg?.id) {
      supabase
        .from('organizations')
        .select('settings')
        .eq('id', currentOrg.id)
        .single()
        .then(({ data }) => {
          const saved = (data?.settings as Record<string, unknown>)?.rfq_template as string | undefined
          setTemplate(saved || DEFAULT_RFQ_TEMPLATE)
        })
    } else {
      setTemplate(DEFAULT_RFQ_TEMPLATE)
    }
    setSubject(project ? `RFQ: ${sowCategories[0] || 'Quote Request'} — ${project.title}` : 'Request for Quote')
  }

  // Reset on close
  const handleClose = () => {
    setLoaded(false)
    setTab('edit')
    setCustomMessage('')
    setSending(false)
    onClose()
  }

  // Merge field values from project data
  const mergeValues: Record<string, string> = useMemo(() => ({
    '{contact_name}': 'Subcontractor Name',
    '{org_name}': currentOrg?.name || 'Your Company',
    '{task_order_title}': project?.title || '',
    '{sow_name}': sowCategories.join(', ') || '',
    '{service_category}': sowCategories.join(', ') || '',
    '{site_name}': project?.site_name || '',
    '{location_city}': project?.location_city || '',
    '{location_state}': project?.location_state || '',
    '{due_date}': project?.due_date ? new Date(project.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD',
    '{solicitation_number}': project?.solicitation_number || 'N/A',
  }), [currentOrg, project, sowCategories])

  // Render template with merge field values
  const renderedPreview = useMemo(() => {
    let rendered = template
    for (const [key, val] of Object.entries(mergeValues)) {
      rendered = rendered.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val)
    }
    return rendered
  }, [template, mergeValues])

  // Insert merge field at cursor
  const insertField = (field: string) => {
    const textarea = document.getElementById('rfq-template-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = template.substring(0, start) + field + template.substring(end)
    setTemplate(newText)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + field.length, start + field.length)
    }, 0)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(template, subject, customMessage)
      handleClose()
    } catch {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-white">Compose RFQ</h2>
            <p className="text-sm text-indigo-100">Sending to {selectedCount} subcontractor{selectedCount !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Subject line */}
        <div className="px-6 pt-4">
          <label className="text-xs font-medium text-gray-600 block mb-1">Email Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="RFQ: Scope — Project Name"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          <button
            onClick={() => setTab('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'edit' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Edit3 size={14} /> Edit Template
          </button>
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'preview' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Eye size={14} /> Preview Email
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {tab === 'edit' ? (
            <div className="space-y-3">
              {/* Merge fields reference */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg">
                <button
                  onClick={() => setShowMergeFields(!showMergeFields)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-blue-700"
                >
                  <span className="flex items-center gap-1"><Info size={12} /> Available Merge Fields — click to insert</span>
                  {showMergeFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showMergeFields && (
                  <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                    {MERGE_FIELDS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => insertField(f.key)}
                        className="text-left text-xs bg-white border border-blue-200 rounded px-2 py-1.5 hover:bg-blue-100 transition-colors"
                      >
                        <span className="font-mono text-blue-700">{f.key}</span>
                        <span className="text-gray-500 ml-1">— {f.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Template editor */}
              <textarea
                id="rfq-template-editor"
                value={template}
                onChange={e => setTemplate(e.target.value)}
                className="w-full h-64 text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Write your RFQ template here. Use {field_name} for merge fields..."
              />

              {/* Custom message */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Additional Note (optional)</label>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="w-full h-16 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Add a note that appears highlighted in the email (e.g., 'Urgent timeline — please respond within 48 hours')"
                />
              </div>

              {/* Auto-populated values preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Auto-populated values for this project:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(mergeValues).map(([key, val]) => (
                    <div key={key} className="flex items-baseline gap-1 text-xs">
                      <span className="font-mono text-indigo-600">{key}</span>
                      <span className="text-gray-400">=</span>
                      <span className="text-gray-700 truncate">{val || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 italic mb-2">
                Preview shows how the email will appear. Each subcontractor's name will be personalized.
              </div>
              {/* Email preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-6 py-5 text-center">
                  <h3 className="text-white text-lg font-bold m-0">Request for Quote</h3>
                  <p className="text-blue-200 text-sm mt-1">On behalf of {currentOrg?.name || 'Your Company'}</p>
                </div>
                <div className="p-6 bg-white">
                  <div className="prose prose-sm max-w-none">
                    {renderedPreview.split('\n').map((line, i) => {
                      if (line.startsWith('**') && line.includes(':**')) {
                        const parts = line.match(/\*\*(.+?)\*\*\s*(.*)/)
                        if (parts) {
                          return <p key={i} className="my-1 text-sm"><strong>{parts[1]}</strong> {parts[2]}</p>
                        }
                      }
                      return <p key={i} className="my-1 text-sm text-gray-700">{line || '\u00A0'}</p>
                    })}
                  </div>
                  {customMessage && (
                    <div className="bg-blue-50 border-l-4 border-blue-600 p-3 my-4 text-sm">
                      <strong>Note from the team:</strong><br />{customMessage}
                    </div>
                  )}
                  <div className="text-center my-6">
                    <span className="inline-block bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-sm">
                      View RFQ & Submit Quote
                    </span>
                  </div>
                  <hr className="my-4 border-gray-200" />
                  <p className="text-xs text-gray-400 text-center">
                    Delivered on behalf of {currentOrg?.name || 'Your Company'}<br />Powered by Procuvex
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <div className="text-xs text-gray-500">
            Template changes apply to this send only. To save as default, go to Org Settings &gt; RFQ Template.
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-300 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !template.trim()}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send RFQ{selectedCount > 1 ? 's' : ''} ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
