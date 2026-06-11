import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import {
  Bot, Shield, Radar, UserPlus, TrendingUp, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronUp, Bell, Zap, Eye
} from 'lucide-react'
import type { AgentType, AutonomyLevel, AgentSetting, AgentAction } from '../lib/agentTypes'
import { AGENT_META, AUTONOMY_LEVELS } from '../lib/agentTypes'

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  compliance_watchdog: Shield,
  opportunity_hunter: Radar,
  sub_recruitment: UserPlus,
  quote_analysis: TrendingUp,
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending_approval: { label: 'Pending Approval', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
  executed: { label: 'Executed', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50' },
  expired: { label: 'Expired', icon: Clock, color: 'text-gray-500 bg-gray-50' },
}

export default function AgentHub() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const [settings, setSettings] = useState<AgentSetting[]>([])
  const [actions, setActions] = useState<AgentAction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null)
  const [tab, setTab] = useState<'overview' | 'queue' | 'history'>('overview')
  const [supported, setSupported] = useState(true)

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return
    try {
      const [settingsRes, actionsRes] = await Promise.all([
        supabase.from('agent_settings').select('*').eq('org_id', currentOrg.id),
        supabase.from('agent_actions').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(50),
      ])
      if (settingsRes.error && settingsRes.error.message?.includes('does not exist')) {
        setSupported(false)
        setLoading(false)
        return
      }
      setSettings((settingsRes.data || []) as AgentSetting[])
      setActions((actionsRes.data || []) as AgentAction[])
    } catch {
      setSupported(false)
    }
    setLoading(false)
  }, [currentOrg?.id])

  useEffect(() => { loadData() }, [loadData])

  async function toggleAgent(agentType: AgentType, enabled: boolean) {
    if (!currentOrg?.id) return
    const existing = settings.find(s => s.agent_type === agentType && !s.project_id)
    if (existing) {
      await supabase.from('agent_settings').update({ enabled }).eq('id', existing.id)
      setSettings(prev => prev.map(s => s.id === existing.id ? { ...s, enabled } : s))
    } else {
      const { data } = await supabase.from('agent_settings').insert({
        org_id: currentOrg.id,
        project_id: null,
        agent_type: agentType,
        autonomy_level: AGENT_META[agentType].defaultLevel,
        enabled,
        primary_contact_id: user?.id || null,
        config: {},
      }).select().single()
      if (data) setSettings(prev => [...prev, data as AgentSetting])
    }
  }

  async function setAutonomyLevel(agentType: AgentType, level: AutonomyLevel) {
    if (!currentOrg?.id) return
    const existing = settings.find(s => s.agent_type === agentType && !s.project_id)
    if (existing) {
      await supabase.from('agent_settings').update({ autonomy_level: level }).eq('id', existing.id)
      setSettings(prev => prev.map(s => s.id === existing.id ? { ...s, autonomy_level: level } : s))
    }
  }

  async function handleAction(actionId: string, decision: 'approved' | 'rejected') {
    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      status: decision,
      resolved_by: user?.id,
    }
    if (decision === 'approved') update.approved_at = now
    await supabase.from('agent_actions').update(update).eq('id', actionId)
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: decision, resolved_by: user?.id || null } : a))
  }

  function getAgentSetting(agentType: AgentType): AgentSetting | undefined {
    return settings.find(s => s.agent_type === agentType && !s.project_id)
  }

  const pendingActions = actions.filter(a => a.status === 'pending_approval')
  const recentActions = actions.filter(a => a.status !== 'pending_approval')

  if (loading) return <div className="text-center py-12 text-gray-500">Loading Agent Hub...</div>

  if (!supported) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Bot className="w-16 h-16 text-purple-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Agent Hub</h1>
        <p className="text-gray-500 mb-4">Run the database migration to enable AI agents.</p>
        <p className="text-sm text-gray-400">The agent_settings and agent_actions tables need to be created first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Hub</h1>
            <p className="text-sm text-gray-500">Configure and monitor your AI agents</p>
          </div>
        </div>
        {pendingActions.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">{pendingActions.length} pending approval{pendingActions.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['overview', 'queue', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'overview' && 'Agents'}
            {t === 'queue' && `Action Queue (${pendingActions.length})`}
            {t === 'history' && 'History'}
          </button>
        ))}
      </div>

      {/* Overview Tab — Agent Cards */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(AGENT_META) as AgentType[]).map(agentType => {
            const meta = AGENT_META[agentType]
            const Icon = AGENT_ICONS[agentType]
            const setting = getAgentSetting(agentType)
            const isEnabled = setting?.enabled ?? false
            const level = setting?.autonomy_level ?? meta.defaultLevel
            const levelMeta = AUTONOMY_LEVELS[level]
            const agentActions = actions.filter(a => a.agent_type === agentType)
            const pendingCount = agentActions.filter(a => a.status === 'pending_approval').length
            const isExpanded = expandedAgent === agentType

            return (
              <div key={agentType} className={`bg-white rounded-xl border ${isEnabled ? 'border-purple-200 shadow-sm' : 'border-gray-200'} overflow-hidden`}>
                {/* Agent Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-purple-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-5 h-5 ${isEnabled ? 'text-purple-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{meta.label}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          meta.riskTier === 'low' ? 'bg-green-100 text-green-700' :
                          meta.riskTier === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {meta.riskTier} risk
                        </span>
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleAgent(agentType, !isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{meta.description}</p>

                  {/* Status Row */}
                  {isEnabled && (
                    <div className="flex items-center gap-3 mt-3">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-${levelMeta.color}-50 text-${levelMeta.color}-700 text-xs font-medium`}>
                        {level === 'advisor' && <Eye size={12} />}
                        {level === 'supervised' && <Bell size={12} />}
                        {level === 'autonomous' && <Zap size={12} />}
                        {levelMeta.label}
                      </div>
                      {pendingCount > 0 && (
                        <span className="text-xs text-amber-600 font-medium">{pendingCount} pending</span>
                      )}
                      <button
                        onClick={() => setExpandedAgent(isExpanded ? null : agentType)}
                        className="ml-auto text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Settings */}
                {isExpanded && isEnabled && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Autonomy Level</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(AUTONOMY_LEVELS) as AutonomyLevel[]).map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => setAutonomyLevel(agentType, lvl)}
                            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                              level === lvl
                                ? 'border-purple-300 bg-purple-50 text-purple-700 font-medium'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {AUTONOMY_LEVELS[lvl].label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{AUTONOMY_LEVELS[level].description}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Action Queue Tab */}
      {tab === 'queue' && (
        <div className="space-y-3">
          {pendingActions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="font-medium text-gray-700">All clear</h3>
              <p className="text-sm text-gray-500">No pending agent actions to review.</p>
            </div>
          ) : (
            pendingActions.map(action => {
              const meta = AGENT_META[action.agent_type]
              const Icon = AGENT_ICONS[action.agent_type]
              return (
                <div key={action.id} className="bg-white rounded-xl border border-amber-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mt-0.5">
                        <Icon className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{action.title}</h4>
                        <p className="text-sm text-gray-500 mt-0.5">{action.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{meta.label}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-400">{new Date(action.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(action.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(action.id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {recentActions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-700">No history yet</h3>
              <p className="text-sm text-gray-500">Agent actions will appear here once they start running.</p>
            </div>
          ) : (
            recentActions.map(action => {
              const Icon = AGENT_ICONS[action.agent_type]
              const statusCfg = STATUS_CONFIG[action.status] || STATUS_CONFIG.expired
              const StatusIcon = statusCfg.icon
              return (
                <div key={action.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{action.title}</p>
                    <p className="text-xs text-gray-400">{new Date(action.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusCfg.color}`}>
                    <StatusIcon size={12} />
                    {statusCfg.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
