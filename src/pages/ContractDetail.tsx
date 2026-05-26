import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import type { Contract, TaskOrder } from '../lib/types'
import {
  ArrowLeft, FileStack, Calendar, Building2, User, Mail, Phone,
  Plus, ChevronRight, ClipboardList, Edit2, Check, X, Trash2, AlertTriangle,
} from 'lucide-react'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  idiq: 'IDIQ',
  bpa: 'BPA',
  gwac: 'GWAC',
  gsa_schedule: 'GSA Schedule',
  prime: 'Prime Contract',
  subcontract: 'Subcontract',
  msa: 'Master Services Agreement',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  closed: 'bg-gray-100 text-gray-600',
}

const PROJECT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  not_awarded: 'bg-red-100 text-red-700',
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [contract, setContract] = useState<Contract | null>(null)
  const [projects, setProjects] = useState<TaskOrder[]>([])
  const [unlinkedProjects, setUnlinkedProjects] = useState<TaskOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusValue, setStatusValue] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (id && currentOrg?.id) fetchData()
  }, [id, currentOrg?.id])

  async function fetchData() {
    setLoading(true)

    const [contractRes, projectsRes, allProjectsRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('id', id!).single(),
      supabase.from('task_orders').select('*').eq('contract_id', id!).order('created_at', { ascending: false }),
      supabase.from('task_orders').select('*').eq('org_id', currentOrg!.id).is('contract_id', null).order('title'),
    ])

    setContract(contractRes.data)
    setProjects(projectsRes.data || [])
    setUnlinkedProjects(allProjectsRes.data || [])
    setStatusValue(contractRes.data?.status || 'active')
    setLoading(false)
  }

  async function linkProject(projectId: string) {
    await supabase.from('task_orders').update({ contract_id: id }).eq('id', projectId)
    setShowLinkModal(false)
    fetchData()
  }

  async function unlinkProject(projectId: string) {
    if (!confirm('Remove this project from the contract? The project itself will not be deleted.')) return
    await supabase.from('task_orders').update({ contract_id: null }).eq('id', projectId)
    fetchData()
  }

  async function saveStatus() {
    await supabase.from('contracts').update({ status: statusValue }).eq('id', id!)
    setEditingStatus(false)
    fetchData()
  }

  async function deleteContract() {
    if (!confirm('Delete this contract? All linked projects will be unlinked (not deleted). This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('task_orders').update({ contract_id: null }).eq('contract_id', id!)
    await supabase.from('contracts').delete().eq('id', id!)
    navigate('/contracts')
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!contract) return <div className="text-center py-12 text-red-500">Contract not found</div>

  const totalEstimatedValue = projects.reduce((acc, p) => acc + (Number(p.estimated_value) || 0), 0)
  const awarded = projects.filter(p => p.status === 'awarded').length
  const active = projects.filter(p => ['draft', 'in_progress', 'under_review', 'submitted'].includes(p.status)).length

  const popStart = contract.period_of_performance_start ? new Date(contract.period_of_performance_start) : null
  const popEnd = contract.period_of_performance_end ? new Date(contract.period_of_performance_end) : null
  const now = new Date()
  const popProgress = popStart && popEnd
    ? Math.min(100, Math.max(0, ((now.getTime() - popStart.getTime()) / (popEnd.getTime() - popStart.getTime())) * 100))
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/contracts" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileStack className="text-indigo-600" size={22} />
              <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
              {editingStatus ? (
                <div className="flex items-center gap-1 ml-2">
                  <select
                    value={statusValue}
                    onChange={e => setStatusValue(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button onClick={saveStatus} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                  <button onClick={() => setEditingStatus(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="flex items-center gap-1"
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[contract.status]}`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                  <Edit2 size={12} className="text-gray-400" />
                </button>
              )}
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
              </span>
            </div>
            {contract.contract_number && (
              <span className="text-sm font-mono text-gray-500 mt-1 inline-block">{contract.contract_number}</span>
            )}
          </div>
        </div>
        <button
          onClick={deleteContract}
          disabled={deleting}
          className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Task Orders / Projects</div>
          <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
          <div className="text-xs text-gray-400 mt-1">{active} active, {awarded} awarded</div>
        </div>
        {contract.ceiling_value && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">Contract Ceiling</div>
            <div className="text-2xl font-bold text-gray-900">${Number(contract.ceiling_value).toLocaleString()}</div>
            {contract.funded_value && (
              <div className="text-xs text-gray-400 mt-1">${Number(contract.funded_value).toLocaleString()} funded</div>
            )}
          </div>
        )}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Project Value</div>
          <div className="text-2xl font-bold text-blue-700">${totalEstimatedValue.toLocaleString()}</div>
          {contract.ceiling_value && Number(contract.ceiling_value) > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              {((totalEstimatedValue / Number(contract.ceiling_value)) * 100).toFixed(1)}% of ceiling
            </div>
          )}
        </div>
        {popEnd && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">Period of Performance</div>
            <div className="text-sm font-medium text-gray-900">
              {popEnd.toLocaleDateString()}
            </div>
            {popProgress !== null && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${popProgress > 90 ? 'bg-red-500' : popProgress > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${popProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{popProgress.toFixed(0)}% elapsed</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contract Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Contract Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {contract.vehicle && (
            <div><span className="text-gray-500">Vehicle:</span> <span className="text-gray-900 ml-1">{contract.vehicle}</span></div>
          )}
          {contract.agency && (
            <div className="flex items-center gap-1"><Building2 size={14} className="text-gray-400" /> <span className="text-gray-900">{contract.agency}</span></div>
          )}
          {contract.naics_code && (
            <div><span className="text-gray-500">NAICS:</span> <span className="font-mono text-gray-900 ml-1">{contract.naics_code}</span></div>
          )}
          {contract.set_aside && (
            <div><span className="text-gray-500">Set-Aside:</span> <span className="text-gray-900 ml-1">{contract.set_aside}</span></div>
          )}
          {contract.contracting_officer && (
            <div className="flex items-center gap-1"><User size={14} className="text-gray-400" /> <span className="text-gray-900">{contract.contracting_officer}</span></div>
          )}
          {contract.co_email && (
            <div className="flex items-center gap-1"><Mail size={14} className="text-gray-400" /> <a href={`mailto:${contract.co_email}`} className="text-blue-600 hover:underline">{contract.co_email}</a></div>
          )}
          {contract.co_phone && (
            <div className="flex items-center gap-1"><Phone size={14} className="text-gray-400" /> <span className="text-gray-900">{contract.co_phone}</span></div>
          )}
          {contract.period_of_performance_start && (
            <div className="flex items-center gap-1"><Calendar size={14} className="text-gray-400" /> <span className="text-gray-900">{new Date(contract.period_of_performance_start).toLocaleDateString()} — {popEnd?.toLocaleDateString() || 'TBD'}</span></div>
          )}
        </div>
        {contract.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-700">{contract.description}</p>
          </div>
        )}
      </div>

      {/* Child Projects */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            Task Orders / Projects ({projects.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus size={14} /> Link Existing Project
            </button>
            <Link
              to={`/projects/new?contract_id=${id}`}
              className="flex items-center gap-1 text-sm text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> New Task Order
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto text-gray-400 mb-3" size={36} />
            <p className="text-gray-500 mb-1">No task orders or projects linked yet.</p>
            <p className="text-sm text-gray-400">Link existing projects or create new ones under this contract.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map(project => (
              <div key={project.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/projects/${project.id}`} className="font-medium text-blue-600 hover:underline text-sm">
                      {project.title}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATUS_STYLES[project.status] || 'bg-gray-100 text-gray-600'}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                    {project.project_type && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{project.project_type.replace('_', ' ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {project.solicitation_number && <span className="font-mono">{project.solicitation_number}</span>}
                    {project.location_city && project.location_state && (
                      <span>{project.location_city}, {project.location_state}</span>
                    )}
                    {project.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> Due {new Date(project.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {project.estimated_value && (
                      <span>${Number(project.estimated_value).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => unlinkProject(project.id)}
                    className="text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                    title="Unlink from contract"
                  >
                    <X size={14} />
                  </button>
                  <Link to={`/projects/${project.id}`}>
                    <ChevronRight size={16} className="text-gray-400" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Link Existing Project</h3>
              <p className="text-sm text-gray-500 mt-1">Select an unlinked project to add to this contract.</p>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {unlinkedProjects.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <AlertTriangle className="mx-auto mb-2 text-gray-400" size={24} />
                  All projects are already linked to a contract.
                </div>
              ) : (
                unlinkedProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => linkProject(p.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{p.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.solicitation_number || p.task_order_number || 'No number'} · {p.status.replace('_', ' ')}
                      </p>
                    </div>
                    <Plus size={16} className="text-blue-600" />
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button onClick={() => setShowLinkModal(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
