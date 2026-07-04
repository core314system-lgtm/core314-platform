import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  FileText, ArrowLeft, Save, RefreshCw, Users,
  CheckCircle, AlertTriangle, DollarSign,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface SBPlan {
  id: string
  task_order_id: string
  total_subcontracting_dollars: number | null
  sb_goal_percent: number
  sb_goal_dollars: number | null
  sdb_goal_percent: number
  sdb_goal_dollars: number | null
  wosb_goal_percent: number
  wosb_goal_dollars: number | null
  hubzone_goal_percent: number
  hubzone_goal_dollars: number | null
  sdvosb_goal_percent: number
  sdvosb_goal_dollars: number | null
  planned_subcontractors: PlannedSub[]
  plan_narrative: string | null
  good_faith_efforts: string | null
  administrator_name: string | null
  administrator_title: string | null
  administrator_email: string | null
  status: string
  generated_at: string | null
  created_at: string
  updated_at: string
}

interface PlannedSub {
  sub_id: string
  company_name: string
  sb_type: string
  planned_dollars: number
  trade: string
}

interface OrgSub {
  id: string
  company_name: string
  small_business: boolean
  is_8a: boolean
  is_hubzone: boolean
  is_sdvosb: boolean
  is_wosb: boolean
  is_edwosb: boolean
  primary_trade: string | null
}

const SB_CATEGORIES = [
  { key: 'sb', label: 'Small Business (SB)', goalKey: 'sb_goal_percent', dollarsKey: 'sb_goal_dollars', defaultPercent: 23 },
  { key: 'sdb', label: 'Small Disadvantaged Business (SDB/8(a))', goalKey: 'sdb_goal_percent', dollarsKey: 'sdb_goal_dollars', defaultPercent: 5 },
  { key: 'wosb', label: 'Women-Owned Small Business (WOSB)', goalKey: 'wosb_goal_percent', dollarsKey: 'wosb_goal_dollars', defaultPercent: 5 },
  { key: 'hubzone', label: 'HUBZone Small Business', goalKey: 'hubzone_goal_percent', dollarsKey: 'hubzone_goal_dollars', defaultPercent: 3 },
  { key: 'sdvosb', label: 'Service-Disabled Veteran-Owned (SDVOSB)', goalKey: 'sdvosb_goal_percent', dollarsKey: 'sdvosb_goal_dollars', defaultPercent: 3 },
] as const

const DEFAULT_NARRATIVE = `This subcontracting plan is submitted in accordance with FAR 52.219-9 and demonstrates our commitment to providing maximum practicable opportunities to small business concerns. Our approach leverages an existing network of qualified small business subcontractors with proven past performance in relevant work areas. We have established mentor-protege relationships and actively seek small business participation across all applicable trade categories.`

const DEFAULT_GOOD_FAITH = `1. Outreach to small business sources through SAM.gov, SBA SUBNet, and industry events
2. Internal review of all subcontracting opportunities for small business applicability
3. Ensure timely payment to small business subcontractors (Net-30 or better)
4. Designate a Small Business Liaison Officer (SBLO)
5. Submit timely and accurate ISR/SSR reports via eSRS
6. Participate in small business matchmaking events and procurement conferences
7. Maintain records of outreach efforts and responses`

export default function SBSubcontractingPlan() {
  const { id: projectId } = useParams<{ id: string }>()
  const { currentOrg } = useOrg()
  const [plan, setPlan] = useState<SBPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [orgSubs, setOrgSubs] = useState<OrgSub[]>([])

  useEffect(() => {
    if (projectId && currentOrg?.id) {
      fetchPlan()
      fetchOrgSubs()
    }
  }, [projectId, currentOrg?.id])

  async function fetchPlan() {
    setLoading(true)
    const { data } = await supabase
      .from('sb_subcontracting_plans')
      .select('*')
      .eq('task_order_id', projectId)
      .maybeSingle()

    if (data) {
      setPlan(data as SBPlan)
    } else {
      setPlan({
        id: '',
        task_order_id: projectId!,
        total_subcontracting_dollars: null,
        sb_goal_percent: 23,
        sb_goal_dollars: null,
        sdb_goal_percent: 5,
        sdb_goal_dollars: null,
        wosb_goal_percent: 5,
        wosb_goal_dollars: null,
        hubzone_goal_percent: 3,
        hubzone_goal_dollars: null,
        sdvosb_goal_percent: 3,
        sdvosb_goal_dollars: null,
        planned_subcontractors: [],
        plan_narrative: DEFAULT_NARRATIVE,
        good_faith_efforts: DEFAULT_GOOD_FAITH,
        administrator_name: null,
        administrator_title: 'Small Business Liaison Officer',
        administrator_email: null,
        status: 'draft',
        generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    setLoading(false)
  }

  async function fetchOrgSubs() {
    const { data } = await supabase
      .from('subcontractors')
      .select('id, company_name, small_business, is_8a, is_hubzone, is_sdvosb, is_wosb, is_edwosb, primary_trade')
      .eq('org_id', currentOrg!.id)
      .eq('small_business', true)
      .order('company_name')
    setOrgSubs((data as OrgSub[]) || [])
  }

  function autoPopulateFromSubs() {
    if (!plan) return
    setGenerating(true)

    const planned: PlannedSub[] = orgSubs.map(sub => {
      let sbType = 'SB'
      if (sub.is_8a) sbType = 'SDB/8(a)'
      else if (sub.is_sdvosb) sbType = 'SDVOSB'
      else if (sub.is_wosb || sub.is_edwosb) sbType = 'WOSB'
      else if (sub.is_hubzone) sbType = 'HUBZone'

      return {
        sub_id: sub.id,
        company_name: sub.company_name,
        sb_type: sbType,
        planned_dollars: 0,
        trade: sub.primary_trade || 'General',
      }
    })

    setPlan({
      ...plan,
      planned_subcontractors: planned,
      generated_at: new Date().toISOString(),
    })

    setTimeout(() => setGenerating(false), 500)
  }

  function recalculateDollars() {
    if (!plan || !plan.total_subcontracting_dollars) return
    const total = plan.total_subcontracting_dollars
    setPlan({
      ...plan,
      sb_goal_dollars: Math.round(total * (plan.sb_goal_percent / 100)),
      sdb_goal_dollars: Math.round(total * (plan.sdb_goal_percent / 100)),
      wosb_goal_dollars: Math.round(total * (plan.wosb_goal_percent / 100)),
      hubzone_goal_dollars: Math.round(total * (plan.hubzone_goal_percent / 100)),
      sdvosb_goal_dollars: Math.round(total * (plan.sdvosb_goal_percent / 100)),
    })
  }

  async function handleSave() {
    if (!plan || !projectId) return
    setSaving(true)

    const payload = {
      task_order_id: projectId,
      total_subcontracting_dollars: plan.total_subcontracting_dollars,
      sb_goal_percent: plan.sb_goal_percent,
      sb_goal_dollars: plan.sb_goal_dollars,
      sdb_goal_percent: plan.sdb_goal_percent,
      sdb_goal_dollars: plan.sdb_goal_dollars,
      wosb_goal_percent: plan.wosb_goal_percent,
      wosb_goal_dollars: plan.wosb_goal_dollars,
      hubzone_goal_percent: plan.hubzone_goal_percent,
      hubzone_goal_dollars: plan.hubzone_goal_dollars,
      sdvosb_goal_percent: plan.sdvosb_goal_percent,
      sdvosb_goal_dollars: plan.sdvosb_goal_dollars,
      planned_subcontractors: plan.planned_subcontractors,
      plan_narrative: plan.plan_narrative,
      good_faith_efforts: plan.good_faith_efforts,
      administrator_name: plan.administrator_name,
      administrator_title: plan.administrator_title,
      administrator_email: plan.administrator_email,
      status: plan.status,
      generated_at: plan.generated_at,
      updated_at: new Date().toISOString(),
    }

    if (plan.id) {
      await supabase.from('sb_subcontracting_plans').update(payload).eq('id', plan.id)
    } else {
      const { data } = await supabase.from('sb_subcontracting_plans').insert(payload).select().single()
      if (data) setPlan(data as SBPlan)
    }

    setSaving(false)
  }

  function updatePlannedSub(index: number, updates: Partial<PlannedSub>) {
    if (!plan) return
    const newPlanned = [...plan.planned_subcontractors]
    newPlanned[index] = { ...newPlanned[index], ...updates }
    setPlan({ ...plan, planned_subcontractors: newPlanned })
  }

  function removePlannedSub(index: number) {
    if (!plan) return
    setPlan({ ...plan, planned_subcontractors: plan.planned_subcontractors.filter((_, i) => i !== index) })
  }

  if (loading || !plan) {
    return <div className="text-center py-20 text-gray-500">Loading subcontracting plan...</div>
  }

  const totalPlanned = plan.planned_subcontractors.reduce((sum, s) => sum + (s.planned_dollars || 0), 0)
  const sbGoalMet = plan.sb_goal_dollars ? totalPlanned >= plan.sb_goal_dollars : false

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={28} />
              Small Business Subcontracting Plan
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">FAR 52.219-9 compliant plan — auto-populated from your subcontractor network</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            plan.status === 'approved' ? 'bg-green-100 text-green-700' :
            plan.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
            plan.status === 'reviewed' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
          </span>
          <select
            value={plan.status}
            onChange={e => setPlan({ ...plan, status: e.target.value })}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </div>

      <FeatureGuidance
        title="Small Business Subcontracting Plan"
        description="Required by FAR 52.219-9 for contracts over $750K. This tool auto-populates your plan using your existing subcontractor network and federal SB goal percentages."
        storageKey="sb_plan"
        accentColor="amber"
        steps={[
          { title: 'Enter your total subcontracting dollars', description: 'This is the total dollar value you plan to subcontract. Enter it in the field below, then click "Recalculate Goals" to auto-compute each category.' },
          { title: 'Review the default goal percentages', description: 'Goals are pre-set to federal minimums: SB 23%, SDB/8(a) 5%, WOSB 5%, HUBZone 3%, SDVOSB 3%. Adjust these if the solicitation specifies different targets.' },
          { title: 'Auto-populate from your subcontractor network', description: 'Click "Auto-Populate from Network" to pull in your small business subcontractors automatically. Then assign planned dollar amounts to each sub.' },
          { title: 'Complete the narrative sections', description: 'The Plan Narrative and Good Faith Efforts sections are pre-filled with compliant language. Customize them for your specific opportunity and teaming arrangement.' },
        ]}
      />

      {/* Total Subcontracting Dollars */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Total Subcontracting Base</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Total Subcontracting Dollars</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={plan.total_subcontracting_dollars || ''}
                onChange={e => setPlan({ ...plan, total_subcontracting_dollars: e.target.value ? Number(e.target.value) : null })}
                placeholder="e.g. 5000000"
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>
          <button
            onClick={recalculateDollars}
            disabled={!plan.total_subcontracting_dollars}
            className="mt-5 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Recalculate Goals
          </button>
        </div>
      </div>

      {/* Goal Percentages & Dollars */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Subcontracting Goals (FAR 19.704)</h2>
        <div className="space-y-3">
          {SB_CATEGORIES.map(cat => (
            <div key={cat.key} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5">
                <span className="text-sm text-gray-700">{cat.label}</span>
              </div>
              <div className="col-span-3">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={plan[cat.goalKey as keyof SBPlan] as number || ''}
                    onChange={e => setPlan({ ...plan, [cat.goalKey]: e.target.value ? Number(e.target.value) : cat.defaultPercent })}
                    className="w-20 px-2 py-1.5 border rounded-lg text-sm text-right outline-none"
                    step="0.1"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
              <div className="col-span-4">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    value={plan[cat.dollarsKey as keyof SBPlan] as number || ''}
                    onChange={e => setPlan({ ...plan, [cat.dollarsKey]: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm text-right outline-none"
                    placeholder="Auto-calculated"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Planned Subcontractors */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Planned Small Business Subcontractors</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {orgSubs.length} small business subcontractor{orgSubs.length !== 1 ? 's' : ''} in your network &middot;
              Total planned: ${totalPlanned.toLocaleString()}
            </p>
          </div>
          <button
            onClick={autoPopulateFromSubs}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <Users size={14} /> {generating ? 'Populating...' : 'Auto-Populate from Network'}
          </button>
        </div>

        {plan.planned_subcontractors.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No subcontractors added. Click "Auto-Populate from Network" to pull from your subcontractor database.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
              <div className="col-span-4">Company</div>
              <div className="col-span-2">SB Type</div>
              <div className="col-span-2">Trade</div>
              <div className="col-span-3">Planned $</div>
              <div className="col-span-1"></div>
            </div>
            {plan.planned_subcontractors.map((sub, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-gray-50">
                <div className="col-span-4 text-sm text-gray-900 font-medium truncate">{sub.company_name}</div>
                <div className="col-span-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{sub.sb_type}</span>
                </div>
                <div className="col-span-2 text-xs text-gray-600 truncate">{sub.trade}</div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={sub.planned_dollars || ''}
                    onChange={e => updatePlannedSub(i, { planned_dollars: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-2 py-1 border rounded text-sm text-right outline-none"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={() => removePlannedSub(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {plan.sb_goal_dollars && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${sbGoalMet ? 'bg-green-50' : 'bg-yellow-50'}`}>
            {sbGoalMet ? (
              <><CheckCircle size={16} className="text-green-600" /> <span className="text-sm text-green-700">SB goal met: ${totalPlanned.toLocaleString()} of ${plan.sb_goal_dollars.toLocaleString()} target</span></>
            ) : (
              <><AlertTriangle size={16} className="text-yellow-600" /> <span className="text-sm text-yellow-700">SB goal shortfall: ${totalPlanned.toLocaleString()} of ${plan.sb_goal_dollars.toLocaleString()} target (${((totalPlanned / plan.sb_goal_dollars) * 100).toFixed(1)}%)</span></>
            )}
          </div>
        )}
      </div>

      {/* Plan Narrative */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Plan Narrative</h2>
        <textarea
          value={plan.plan_narrative || ''}
          onChange={e => setPlan({ ...plan, plan_narrative: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
          placeholder="Describe your approach to small business subcontracting..."
        />
      </div>

      {/* Good Faith Efforts */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Good Faith Efforts (FAR 19.705-7)</h2>
        <textarea
          value={plan.good_faith_efforts || ''}
          onChange={e => setPlan({ ...plan, good_faith_efforts: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
          placeholder="List your good faith efforts to maximize small business participation..."
        />
      </div>

      {/* Plan Administrator */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Plan Administrator</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={plan.administrator_name || ''}
              onChange={e => setPlan({ ...plan, administrator_name: e.target.value })}
              placeholder="Small Business Liaison Officer"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={plan.administrator_title || ''}
              onChange={e => setPlan({ ...plan, administrator_title: e.target.value })}
              placeholder="e.g. Director of Subcontracts"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={plan.administrator_email || ''}
              onChange={e => setPlan({ ...plan, administrator_email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
