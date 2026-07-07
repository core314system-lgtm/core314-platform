import { createClient } from '@supabase/supabase-js'

interface NotificationPayload {
  org_id: string
  event_type: 'gate_decision' | 'document_upload' | 'deadline_alert' | 'task_assigned' | 'comment_added'
  project_title: string
  message: string
  actor_name?: string
  project_id?: string
}

const EVENT_EMOJI: Record<string, string> = {
  gate_decision: ':checkered_flag:',
  document_upload: ':page_facing_up:',
  deadline_alert: ':alarm_clock:',
  task_assigned: ':dart:',
  comment_added: ':speech_balloon:',
}

export const handler = async (event: any) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const payload: NotificationPayload = JSON.parse(event.body)

    if (!payload.org_id || !payload.event_type || !payload.message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up Slack webhook URL for this org from org settings
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('slack_webhook_url')
      .eq('org_id', payload.org_id)
      .single()

    if (!orgSettings?.slack_webhook_url) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true, reason: 'No Slack webhook configured' }) }
    }

    const emoji = EVENT_EMOJI[payload.event_type] || ':bell:'
    const actor = payload.actor_name ? ` by *${payload.actor_name}*` : ''
    const projectLink = payload.project_id
      ? ` | <https://procuvex.com/projects/${payload.project_id}|View Project>`
      : ''

    const slackMessage = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${payload.project_title}*\n${payload.message}${actor}${projectLink}`,
          },
        },
      ],
    }

    const res = await fetch(orgSettings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    })

    if (!res.ok) {
      console.error('[slack-notify] Webhook failed:', res.status, await res.text())
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'Webhook delivery failed' }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  } catch (error: any) {
    console.error('[slack-notify] Error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}
