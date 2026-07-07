import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Weekly executive digest email — sends each Enterprise org a summary of:
 * - Projects approaching deadlines in the next 14 days
 * - Capture gates awaiting decisions
 * - Open tasks and assignments
 * - Recent team activity (comments)
 * - Unread notifications count
 * 
 * Enterprise-only feature. Runs weekly on Monday at 8am EST / 12pm UTC.
 */

const ENTERPRISE_PLANS = ['enterprise_monthly', 'enterprise_annual', 'agentic']

function urgencyColor(daysLeft: number): string {
  if (daysLeft <= 3) return '#dc2626'
  if (daysLeft <= 7) return '#d97706'
  return '#059669'
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'Today'
  if (daysLeft === 1) return 'Tomorrow'
  return `${daysLeft} days`
}

interface DigestData {
  orgName: string
  firstName: string
  upcomingProjects: { title: string; due_date: string; daysLeft: number; id: string }[]
  pendingGates: { gate_name: string; task_order_id: string }[]
  openTasks: { title: string; priority: string; assigned_to: string; project_id: string }[]
  recentComments: { user_name: string; content: string; project_id: string; created_at: string }[]
  unreadCount: number
}

function buildDigestHtml(data: DigestData): string {
  const sections: string[] = []

  // Upcoming deadlines
  if (data.upcomingProjects.length > 0) {
    const rows = data.upcomingProjects.map(p => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
          <a href="https://procuvex.com/projects/${p.id}" style="color:#1e40af;text-decoration:none;font-weight:500;">${p.title}</a>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">
          <span style="color:${urgencyColor(p.daysLeft)};font-weight:600;">${urgencyLabel(p.daysLeft)}</span>
          <span style="color:#9ca3af;font-size:12px;margin-left:4px;">(${new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
        </td>
      </tr>
    `).join('')

    sections.push(`
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px;color:#111827;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          Upcoming Deadlines
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows}
        </table>
      </div>
    `)
  }

  // Capture gates awaiting decision
  if (data.pendingGates.length > 0) {
    const items = data.pendingGates.map(g => `
      <li style="margin-bottom:6px;">
        <a href="https://procuvex.com/projects/${g.task_order_id}/capture-gates" style="color:#1e40af;text-decoration:none;">${g.gate_name}</a>
      </li>
    `).join('')

    sections.push(`
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px;color:#111827;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          Capture Gates Awaiting Decision
        </h2>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
          ${items}
        </ul>
      </div>
    `)
  }

  // Open tasks
  if (data.openTasks.length > 0) {
    const priorityBadge = (p: string) => {
      const colors: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#6b7280' }
      return `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:white;background:${colors[p] || '#6b7280'};">${p}</span>`
    }

    const rows = data.openTasks.slice(0, 10).map(t => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;">${t.title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${priorityBadge(t.priority)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${t.assigned_to || 'Unassigned'}</td>
      </tr>
    `).join('')

    sections.push(`
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px;color:#111827;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          Open Tasks (${data.openTasks.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Task</th>
              <th style="padding:6px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:500;">Priority</th>
              <th style="padding:6px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Assigned</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        ${data.openTasks.length > 10 ? `<p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">+ ${data.openTasks.length - 10} more tasks</p>` : ''}
      </div>
    `)
  }

  // Recent activity
  if (data.recentComments.length > 0) {
    const items = data.recentComments.slice(0, 5).map(c => {
      const timeAgo = formatTimeAgo(new Date(c.created_at))
      const preview = c.content.length > 120 ? c.content.slice(0, 120) + '...' : c.content
      return `
        <div style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
          <div style="font-size:13px;">
            <strong style="color:#111827;">${c.user_name || 'Team member'}</strong>
            <span style="color:#9ca3af;margin-left:8px;">${timeAgo}</span>
          </div>
          <p style="margin:4px 0 0;font-size:14px;color:#374151;line-height:1.5;">${preview}</p>
        </div>
      `
    }).join('')

    sections.push(`
      <div style="margin-bottom:24px;">
        <h2 style="font-size:16px;color:#111827;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          Recent Team Activity
        </h2>
        ${items}
      </div>
    `)
  }

  // Unread notifications
  if (data.unreadCount > 0) {
    sections.push(`
      <div style="margin-bottom:24px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
        <p style="margin:0;font-size:14px;color:#1e40af;">
          You have <strong>${data.unreadCount}</strong> unread notification${data.unreadCount !== 1 ? 's' : ''}.
          <a href="https://procuvex.com/dashboard" style="color:#1e40af;font-weight:600;margin-left:8px;">View in dashboard &rarr;</a>
        </p>
      </div>
    `)
  }

  // No data fallback
  if (sections.length === 0) return ''

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;padding:0;">
      <div style="background:linear-gradient(135deg,#1e3a5f,#1e40af);color:white;padding:32px;border-radius:12px 12px 0 0;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.7;">Weekly Executive Digest</p>
        <h1 style="margin:0;font-size:22px;font-weight:bold;">${data.orgName}</h1>
        <p style="margin:8px 0 0;font-size:13px;opacity:0.8;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 12px 12px;background:#ffffff;">
        <p style="margin:0 0 24px;font-size:15px;color:#374151;">
          Hi ${data.firstName || 'there'}, here's your weekly overview of what needs attention.
        </p>
        ${sections.join('')}
        <div style="text-align:center;margin:32px 0 16px;">
          <a href="https://procuvex.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#1e40af);color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
            Open Dashboard
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;margin:0;">
          Procuvex &mdash; AI-Powered Capture Management for Government Contractors<br/>
          A product of Core314 Technologies LLC
        </p>
      </div>
    </div>
  `
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  const days = Math.floor(seconds / 86400)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

export default async (_req: Request, _context: Context) => {
  const headers = { "Content-Type": "application/json" }

  try {
    const now = new Date()
    const twoWeeksOut = new Date(now.getTime() + 14 * 86400000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000)
    const nowStr = now.toISOString().split('T')[0]
    const twoWeeksStr = twoWeeksOut.toISOString().split('T')[0]

    // Only send to Enterprise-tier orgs (this is an Enterprise-only feature)
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, subscription_plan')
      .in('subscription_plan', ENTERPRISE_PLANS)

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_enterprise_orgs' }), { headers })
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

      // Get open tasks (todo or in_progress)
      const { data: openTasks } = await supabase
        .from('project_tasks')
        .select('title, priority, assigned_to, project_id')
        .eq('org_id', org.id)
        .in('status', ['todo', 'in_progress'])
        .order('priority')
        .limit(15)

      // Get recent comments (last 7 days)
      const { data: recentComments } = await supabase
        .from('project_comments')
        .select('user_name, content, project_id, created_at')
        .eq('org_id', org.id)
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5)

      // Get unread notification count
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('read', false)

      // Skip orgs with nothing to report
      if ((!upcomingProjects || upcomingProjects.length === 0) &&
          (!pendingGates || pendingGates.length === 0) &&
          (!openTasks || openTasks.length === 0) &&
          (!recentComments || recentComments.length === 0) &&
          (!unreadCount || unreadCount === 0)) {
        continue
      }

      // Get org admin/owner emails
      const { data: members } = await supabase
        .from('user_profiles')
        .select('email, first_name')
        .eq('org_id', org.id)
        .in('org_role', ['owner', 'admin'])

      if (!members || members.length === 0) continue

      // Build enriched project data with daysLeft
      const enrichedProjects = (upcomingProjects || []).map(p => ({
        ...p,
        daysLeft: Math.ceil((new Date(p.due_date).getTime() - now.getTime()) / 86400000),
      }))

      // Send via SendGrid
      const sendgridKey = process.env.SENDGRID_API_KEY
      if (!sendgridKey) continue

      for (const member of members) {
        if (!member.email) continue

        const digestData: DigestData = {
          orgName: org.name,
          firstName: member.first_name || '',
          upcomingProjects: enrichedProjects,
          pendingGates: pendingGates || [],
          openTasks: openTasks || [],
          recentComments: recentComments || [],
          unreadCount: unreadCount || 0,
        }

        const emailHtml = buildDigestHtml(digestData)
        if (!emailHtml) continue

        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: member.email }] }],
            from: { email: 'team@procuvex.com', name: 'Procuvex' },
            subject: `[Procuvex] Weekly Digest \u2014 ${org.name}`,
            content: [
              { type: 'text/plain', value: htmlToPlainText(emailHtml) },
              { type: 'text/html', value: emailHtml },
            ],
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
