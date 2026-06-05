import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NotificationPayload {
  org_id: string
  type: 'quote_received' | 'question_asked' | 'profile_claimed' | 'compliance_gap' | 'deadline_approaching' | 'system' | 'outreach'
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body: NotificationPayload = await req.json()

    if (!body.org_id || !body.type || !body.title) {
      return new Response(JSON.stringify({ error: 'Missing required fields: org_id, type, title' }), { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        org_id: body.org_id,
        type: body.type,
        title: body.title,
        message: body.message || '',
        link: body.link || null,
        read: false,
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, notification: data }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
