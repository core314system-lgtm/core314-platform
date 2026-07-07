import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Weekly digest email — sends each org a summary of:
 * - Projects approaching deadlines in the next 14 days
 * - Capture gates awaiting decisions
 * - Unread notifications count
 * - New comments and activity
 * 
 * Runs weekly on Monday at 8am EST / 12pm UTC.
 */
export default async (_req: Request, _context: Context) => {
  const headers = { "Content-Type": "application/json" }

  try {
    const now = new Date()
    const twoWeeksOut = new Date(now.getTime() + 14 * 86400000)
    const nowStr = now.toISOString().split('T')[0]
    const twoWeeksStr = twoWeeksOut.toISOString().split('T')[0]

    // Get all orgs with active projects
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), { headers })
    }

    let sent = 0

    for (const org of orgs) {
      // Get upcoming deadlines
      const { data: upcomingProjects } = await supabase
        .from('task_orders')
        .select('id, title, due_date, status')
        .eq('org_id', org.id)
        .gte('due_date', nowStr)
        .lte('due_date', twoWeeksStr)
        .not('status', 'in', '("awarded","not_awarded","submitted")')
        .order('due_date')

      // Get gates awaiting decision
      const { data: pendingGates } = await supabase
        .from('capture_gates')
        .select('gate_name, status, task_order_id')
        .eq('org_id', org.id)
        .eq('status', 'in_progress')
        .limit(10)

      // Get unread notification count
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('read', false)

      // Skip orgs with nothing to report
      if ((!upcomingProjects || upcomingProjects.length === 0) &&
          (!pendingGates || pendingGates.length === 0) &&
          (!unreadCount || unreadCount === 0)) {
        continue
      }

      // Get org admin emails
      const { data: members } = await supabase
        .from('user_profiles')
        .select('email, first_name')
        .eq('org_id', org.id)
        .in('org_role', ['owner', 'admin'])

      if (!members || members.length === 0) continue

      // Build digest content
      const lines: string[] = []
      lines.push(`Weekly Digest for ${org.name}`)
      lines.push('')

      if (upcomingProjects && upcomingProjects.length > 0) {
        lines.push('UPCOMING DEADLINES')
        for (const p of upcomingProjects) {
          const daysLeft = Math.ceil((new Date(p.due_date).getTime() - now.getTime()) / 86400000)
          lines.push(`  - ${p.title}: due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${new Date(p.due_date).toLocaleDateString()})`)
        }
        lines.push('')
      }

      if (pendingGates && pendingGates.length > 0) {
        lines.push('CAPTURE GATES AWAITING DECISION')
        for (const g of pendingGates) {
          lines.push(`  - ${g.gate_name}`)
        }
        lines.push('')
      }

      if (unreadCount && unreadCount > 0) {
        lines.push(`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}.`)
        lines.push('')
      }

      lines.push('Log in at https://procuvex.com/dashboard to review.')

      // Send via SendGrid
      const sendgridKey = process.env.SENDGRID_API_KEY
      if (!sendgridKey) continue

      for (const member of members) {
        if (!member.email) continue

        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: member.email }] }],
            from: { email: 'team@procuvex.com', name: 'Procuvex' },
            subject: `[Procuvex] Weekly Digest — ${org.name}`,
            content: [{ type: 'text/plain', value: lines.join('\n') }],
            tracking_settings: { click_tracking: { enable: false } },
          }),
        })

        sent++
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Weekly digest error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

export const config = {
  schedule: "0 12 * * 1", // Monday at 12pm UTC (8am EST)
}
