import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { Bell, Mail, Monitor, Save } from 'lucide-react'
import type { AgentType } from '../lib/agentTypes'
import { AGENT_META } from '../lib/agentTypes'

interface Pref {
  id?: string
  agent_type: AgentType | 'all'
  channel: 'email' | 'in_app' | 'both'
  enabled: boolean
}

const CHANNELS = [
  { value: 'in_app', label: 'In-App', icon: Monitor },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'both', label: 'Both', icon: Bell },
] as const

export default function NotificationPreferences() {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supported, setSupported] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPrefs()
  }, [user?.id, currentOrg?.id])

  async function loadPrefs() {
    if (!user?.id || !currentOrg?.id) return
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id)

    if (error) {
      setSupported(false)
      setLoading(false)
      return
    }

    // Initialize defaults if nothing exists
    if (!data || data.length === 0) {
      const defaults: Pref[] = [
        { agent_type: 'all', channel: 'in_app', enabled: true },
        ...Object.keys(AGENT_META).map(at => ({
          agent_type: at as AgentType,
          channel: 'both' as const,
          enabled: true,
        })),
      ]
      setPrefs(defaults)
    } else {
      setPrefs(data as Pref[])
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!user?.id || !currentOrg?.id) return
    setSaving(true)
    setMessage(null)

    // Delete existing and re-insert
    await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id)

    const rows = prefs.map(p => ({
      user_id: user.id,
      org_id: currentOrg.id,
      project_id: null,
      agent_type: p.agent_type,
      channel: p.channel,
      enabled: p.enabled,
    }))

    const { error } = await supabase.from('notification_preferences').insert(rows)
    if (error) {
      setMessage('Failed to save: ' + error.message)
    } else {
      setMessage('Preferences saved.')
    }
    setSaving(false)
  }

  function updatePref(agentType: string, field: 'channel' | 'enabled', value: string | boolean) {
    setPrefs(prev => prev.map(p =>
      p.agent_type === agentType ? { ...p, [field]: value } : p
    ))
  }

  if (!supported) return null
  if (loading) return <div className="text-sm text-gray-400">Loading preferences...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Bell size={16} /> Agent Notifications
      </h3>

      <div className="space-y-2">
        {prefs.map(p => {
          const meta = p.agent_type === 'all' ? { label: 'All Notifications' } : AGENT_META[p.agent_type as AgentType]
          return (
            <div key={p.agent_type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={e => updatePref(p.agent_type, 'enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-checked:bg-purple-600 rounded-full peer-focus:ring-2 peer-focus:ring-purple-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-sm font-medium text-gray-700">{meta?.label || p.agent_type}</span>
              </div>
              <select
                value={p.channel}
                onChange={e => updatePref(p.agent_type, 'channel', e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                disabled={!p.enabled}
              >
                {CHANNELS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {message && <span className="text-sm text-green-600">{message}</span>}
      </div>
    </div>
  )
}
