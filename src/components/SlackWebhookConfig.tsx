import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Save, ExternalLink, Check, X } from 'lucide-react'

interface Props {
  orgId: string
  isAdmin: boolean
}

export default function SlackWebhookConfig({ orgId, isAdmin }: Props) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!orgId) return
    loadConfig()
  }, [orgId])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('organization_settings')
      .select('slack_webhook_url')
      .eq('org_id', orgId)
      .single()

    if (data?.slack_webhook_url) {
      setWebhookUrl(data.slack_webhook_url)
      setSavedUrl(data.slack_webhook_url)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('organization_settings')
      .upsert({
        org_id: orgId,
        slack_webhook_url: webhookUrl.trim() || null,
      }, { onConflict: 'org_id' })

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' })
    } else {
      setSavedUrl(webhookUrl.trim())
      setMessage({ type: 'success', text: 'Slack webhook saved successfully.' })
      setTimeout(() => setMessage(null), 3000)
    }
    setSaving(false)
  }

  async function handleTest() {
    if (!webhookUrl.trim()) return
    setMessage(null)

    try {
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *Procuvex* — Slack integration is working! You will receive notifications for gate decisions, document uploads, deadline alerts, and team activity.',
            },
          }],
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Test message sent! Check your Slack channel.' })
      } else {
        setMessage({ type: 'error', text: 'Webhook test failed. Check the URL and try again.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach webhook URL. Verify it is correct.' })
    }
  }

  if (!isAdmin) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={20} className="text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Slack Integration</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Receive notifications in your Slack workspace when capture gates are updated, documents are uploaded,
        deadlines approach, or team members are assigned tasks.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Incoming Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Create an incoming webhook in your Slack workspace settings.{' '}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-0.5"
              >
                Learn how <ExternalLink size={10} />
              </a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || webhookUrl === savedUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            {webhookUrl.trim() && (
              <button
                onClick={handleTest}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Send Test Message
              </button>
            )}
            {savedUrl && (
              <button
                onClick={() => { setWebhookUrl(''); handleSave() }}
                className="text-sm text-red-500 hover:text-red-600 ml-auto"
              >
                Remove
              </button>
            )}
          </div>

          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {message.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
