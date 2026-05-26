import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import type { Contract } from '../lib/types'
import { FileStack, Plus, Search, Calendar, DollarSign, Building2, ChevronRight } from 'lucide-react'

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

interface ContractWithCount extends Contract {
  projectCount: number
}

export default function Contracts() {
  const { currentOrg } = useOrg()
  const [contracts, setContracts] = useState<ContractWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    if (currentOrg?.id) fetchContracts()
  }, [currentOrg?.id])

  async function fetchContracts() {
    setLoading(true)
    const { data: contractData } = await supabase
      .from('contracts')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('created_at', { ascending: false })

    if (!contractData || contractData.length === 0) {
      setContracts([])
      setLoading(false)
      return
    }

    const { data: projects } = await supabase
      .from('task_orders')
      .select('id, contract_id')
      .eq('org_id', currentOrg!.id)
      .not('contract_id', 'is', null)

    const countMap = new Map<string, number>()
    for (const p of (projects || [])) {
      if (p.contract_id) {
        countMap.set(p.contract_id, (countMap.get(p.contract_id) || 0) + 1)
      }
    }

    setContracts(contractData.map(c => ({
      ...c,
      projectCount: countMap.get(c.id) || 0,
    })))
    setLoading(false)
  }

  const filtered = contracts.filter(c => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.title.toLowerCase().includes(q) &&
          !c.contract_number?.toLowerCase().includes(q) &&
          !c.agency?.toLowerCase().includes(q)) return false
    }
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    return true
  })

  const active = contracts.filter(c => c.status === 'active').length
  const totalProjects = contracts.reduce((acc, c) => acc + c.projectCount, 0)

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileStack className="text-indigo-600" size={24} /> Contracts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage parent contracts and their associated task orders / projects</p>
        </div>
        <Link
          to="/contracts/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Contract
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{contracts.length}</div>
          <div className="text-xs text-gray-500">Total Contracts</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{active}</div>
          <div className="text-xs text-green-600">Active</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{totalProjects}</div>
          <div className="text-xs text-blue-600">Linked Projects</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search contracts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Contract List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileStack className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500 mb-2">No contracts found.</p>
          <p className="text-sm text-gray-400 mb-4">Create a parent contract to group related task orders and projects together.</p>
          <Link to="/contracts/new" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Create Contract
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(contract => (
            <Link
              key={contract.id}
              to={`/contracts/${contract.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{contract.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[contract.status] || 'bg-gray-100 text-gray-600'}`}>
                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                      {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                    {contract.contract_number && (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{contract.contract_number}</span>
                    )}
                    {contract.agency && (
                      <span className="flex items-center gap-1"><Building2 size={12} /> {contract.agency}</span>
                    )}
                    {contract.period_of_performance_end && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> Ends {new Date(contract.period_of_performance_end).toLocaleDateString()}
                      </span>
                    )}
                    {contract.ceiling_value && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} /> Ceiling: ${Number(contract.ceiling_value).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {contract.projectCount} task order{contract.projectCount !== 1 ? 's' : ''} / project{contract.projectCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400 mt-2" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
