import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AlertTriangle, Upload, FileText, Send, Clock, ChevronDown, ChevronUp, CheckCircle, Loader2, X, Bell, RefreshCw } from 'lucide-react'

interface Modification {
  id: string
  task_order_id: string
  modification_number: string
  title: string
  description: string | null
  document_ids: string[]
  affected_sow_ids: string[]
  affected_subcontractor_ids: string[]
  notification_status: 'pending' | 'partial' | 'sent' | 'acknowledged'
  created_by: string
  created_at: string
  effective_date: string | null
}

interface SowItem {
  id: string
  sow_name: string
  service_category: string
}

interface SubNotification {
  subcontractor_id: string
  company_name: string
  contact_email: string | null
  sow_names: string[]
  notification_sent: boolean
  acknowledged: boolean
  quote_revision_requested: boolean
}

interface Props {
  taskOrderId: string
  taskOrderTitle: string
}

export default function ModificationTracker({ taskOrderId }: Props) {
  const { user } = useAuth()
  const [modifications, setModifications] = useState<Modification[]>([])
  const [sowItems, setSowItems] = useState<SowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showNotifyModal, setShowNotifyModal] = useState<string | null>(null)
  const [subNotifications, setSubNotifications] = useState<SubNotification[]>([])
  const [creating, setCreating] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [error, setError] = useState('')

  const [newMod, setNewMod] = useState({
    modification_number: '',
    title: '',
    description: '',
    affected_sow_ids: [] as string[],
    effective_date: '',
    require_quote_revision: true,
  })

  useEffect(() => {
    async function load() {
      const { data: mods } = await supabase
        .from('project_modifications')
        .select('*')
        .eq('task_order_id', taskOrderId)
        .order('created_at', { ascending: false })
      if (mods) setModifications(mods)

      const { data: sows } = await supabase
        .from('sow_items')
        .select('id, sow_name, service_category')
        .eq('task_order_id', taskOrderId)
        .order('sow_name')
      if (sows) setSowItems(sows)

      setLoading(false)
    }
    load()
  }, [taskOrderId])

  async function refreshModifications() {
    const { data } = await supabase
      .from('project_modifications')
      .select('*')
      .eq('task_order_id', taskOrderId)
      .order('created_at', { ascending: false })
    if (data) setModifications(data)
  }

  async function handleCreateModification() {
    if (!user || !newMod.modification_number.trim() || !newMod.title.trim()) {
      setError('Modification number and title are required.')
      return
    }

    setCreating(true)
    setError('')

    try {
      const { data, error: insertErr } = await supabase
        .from('project_modifications')
        .insert({
          task_order_id: taskOrderId,
          modification_number: newMod.modification_number.trim(),
          title: newMod.title.trim(),
          description: newMod.description.trim() || null,
          affected_sow_ids: newMod.affected_sow_ids,
          affected_subcontractor_ids: [],
          document_ids: [],
          notification_status: 'pending',
          created_by: user.id,
          effective_date: newMod.effective_date || null,
        })
        .select()
        .single()

      if (insertErr) throw new Error(insertErr.message)

      setModifications(prev => [data, ...prev])
      setShowCreateModal(false)
      setNewMod({ modification_number: '', title: '', description: '', affected_sow_ids: [], effective_date: '', require_quote_revision: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create modification')
    } finally {
      setCreating(false)
    }
  }

  async function loadSubNotifications(modId: string) {
    const mod = modifications.find(m => m.id === modId)
    if (!mod) return

    const affectedSowIds = mod.affected_sow_ids.length > 0 ? mod.affected_sow_ids : sowItems.map(s => s.id)

    if (affectedSowIds.length === 0) {
      setSubNotifications([])
      return
    }

    const { data: sowSubs } = await supabase
      .from('sow_subcontractors')
      .select('id, subcontractor_id, sow_item_id, outreach_status, subcontractors(company_name, contact_email)')
      .in('sow_item_id', affectedSowIds)
      .in('outreach_status', ['invited', 'reviewing', 'questions_pending', 'quote_submitted'])

    if (!sowSubs) {
      setSubNotifications([])
      return
    }

    const subMap = new Map<string, SubNotification>()
    for (const ss of sowSubs) {
      const sub = (ss as unknown as Record<string, Record<string, string>>).subcontractors
      if (!sub) continue
      const existing = subMap.get(ss.subcontractor_id)
      const sowItem = sowItems.find(s => s.id === ss.sow_item_id)
      if (existing) {
        if (sowItem) existing.sow_names.push(sowItem.sow_name)
      } else {
        subMap.set(ss.subcontractor_id, {
          subcontractor_id: ss.subcontractor_id,
          company_name: sub.company_name,
          contact_email: sub.contact_email,
          sow_names: sowItem ? [sowItem.sow_name] : [],
          notification_sent: false,
          acknowledged: false,
          quote_revision_requested: false,
        })
      }
    }

    setSubNotifications(Array.from(subMap.values()))
  }

  async function handleNotifySubcontractors(modId: string) {
    setNotifying(true)
    try {
      const resp = await fetch('/api/notify-modification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modification_id: modId,
          task_order_id: taskOrderId,
        }),
      })

      const result = await resp.json()
      if (result.success) {
        alert(`Amendment notices sent to ${result.sent} subcontractor(s).`)
        await supabase
          .from('project_modifications')
          .update({ notification_status: 'sent' })
          .eq('id', modId)
        refreshModifications()
      } else {
        alert('Failed to send notifications: ' + (result.error || 'Unknown error'))
      }
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setNotifying(false)
      setShowNotifyModal(null)
    }
  }

  function toggleSowSelection(sowId: string) {
    setNewMod(prev => ({
      ...prev,
      affected_sow_ids: prev.affected_sow_ids.includes(sowId)
        ? prev.affected_sow_ids.filter(id => id !== sowId)
        : [...prev.affected_sow_ids, sowId],
    }))
  }

  const modCount = modifications.length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="text-amber-600" />
          <div>
            <h2 className="font-semibold text-gray-900">Modifications & Amendments</h2>
            <p className="text-sm text-gray-500">
              {modCount === 0 ? 'No modifications recorded' : `${modCount} modification${modCount !== 1 ? 's' : ''} tracked`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {modifications.some(m => m.notification_status === 'pending') && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {modifications.filter(m => m.notification_status === 'pending').length} pending notification
            </span>
          )}
          {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Track SOW modifications, addendums, and change orders. Affected subcontractors are automatically identified and can be notified to update their quotes.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              <Upload size={14} /> Record Modification
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading modifications...</div>
          ) : modifications.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No modifications have been recorded for this project.</p>
              <p className="text-xs text-gray-400 mt-1">When the government issues an amendment or modification, record it here to track and notify affected subcontractors.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modifications.map(mod => (
                <div key={mod.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{mod.modification_number}</span>
                        <h3 className="font-semibold text-gray-900">{mod.title}</h3>
                      </div>
                      {mod.description && <p className="text-sm text-gray-600 mt-1">{mod.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(mod.created_at).toLocaleDateString()}</span>
                        {mod.effective_date && <span>Effective: {new Date(mod.effective_date).toLocaleDateString()}</span>}
                        {mod.affected_sow_ids.length > 0 && (
                          <span>{mod.affected_sow_ids.length} SOW{mod.affected_sow_ids.length !== 1 ? 's' : ''} affected</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mod.notification_status === 'sent' ? 'bg-green-100 text-green-700' :
                        mod.notification_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        mod.notification_status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {mod.notification_status === 'sent' ? 'Notified' :
                         mod.notification_status === 'acknowledged' ? 'Acknowledged' :
                         mod.notification_status === 'partial' ? 'Partially Sent' :
                         'Pending'}
                      </span>
                      {mod.notification_status === 'pending' && (
                        <button
                          onClick={() => { setShowNotifyModal(mod.id); loadSubNotifications(mod.id) }}
                          className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                        >
                          <Bell size={14} /> Notify Subs
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modification Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Record Modification / Amendment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modification Number *</label>
                <input
                  type="text"
                  value={newMod.modification_number}
                  onChange={e => setNewMod(p => ({ ...p, modification_number: e.target.value }))}
                  placeholder="e.g., Mod 001, Addendum #3, Amendment A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newMod.title}
                  onChange={e => setNewMod(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Updated HVAC requirements, Revised pricing schedule"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newMod.description}
                  onChange={e => setNewMod(p => ({ ...p, description: e.target.value }))}
                  placeholder="Summarize what changed..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={newMod.effective_date}
                  onChange={e => setNewMod(p => ({ ...p, effective_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {sowItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Affected SOWs (leave empty for all)</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {sowItems.map(sow => (
                      <label key={sow.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newMod.affected_sow_ids.includes(sow.id)}
                          onChange={() => toggleSowSelection(sow.id)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700">{sow.sow_name}</span>
                        <span className="text-xs text-gray-400">({sow.service_category})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMod.require_quote_revision}
                  onChange={e => setNewMod(p => ({ ...p, require_quote_revision: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-700">Request subcontractors to revise their quotes</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleCreateModification}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Record Modification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Subcontractors Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Notify Affected Subcontractors</h3>
              <button onClick={() => setShowNotifyModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {subNotifications.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No subcontractors have been sent RFQs for the affected SOWs yet.</p>
                <p className="text-xs text-gray-400 mt-1">Send RFQs first, then you can notify subcontractors about amendments.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  The following subcontractors have active RFQs and will be notified about this modification. Each will receive an email with:
                </p>
                <ul className="text-xs text-gray-500 mb-4 space-y-1">
                  <li>• Summary of what changed</li>
                  <li>• Link to their existing portal (to view updated documents)</li>
                  <li>• Request to review and revise their quote if needed</li>
                </ul>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {subNotifications.map(sub => (
                    <div key={sub.subcontractor_id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sub.company_name}</div>
                        <div className="text-xs text-gray-500">{sub.contact_email || 'No email'}</div>
                        <div className="text-xs text-gray-400">{sub.sow_names.join(', ')}</div>
                      </div>
                      {sub.contact_email ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-500" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button onClick={() => setShowNotifyModal(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                  <button
                    onClick={() => handleNotifySubcontractors(showNotifyModal)}
                    disabled={notifying || subNotifications.filter(s => s.contact_email).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {notifying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to {subNotifications.filter(s => s.contact_email).length} Subcontractor{subNotifications.filter(s => s.contact_email).length !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
