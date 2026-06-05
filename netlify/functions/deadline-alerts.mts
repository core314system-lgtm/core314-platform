import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Scheduled function: checks all projects for upcoming deadlines (7, 3, 1 day out)
 * and creates in-app notifications. Can be triggered by Netlify scheduled function
 * or called manually via POST.
 * 
 * Set up as a Netlify Scheduled Function running daily.
 */
export default async (req: Request, _context: Context) => {
  const headers = { "Content-Type": "application/json" }

  try {
    const now = new Date()
    const alerts = [
      { days: 7, urgency: 'upcoming' },
      { days: 3, urgency: 'soon' },
      { days: 1, urgency: 'urgent' },
    ]

    let totalCreated = 0

    for (const alert of alerts) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + alert.days)
      const dateStr = targetDate.toISOString().split('T')[0]

      // Find projects with due dates matching this threshold
      const { data: projects } = await supabase
        .from('task_orders')
        .select('id, title, due_date, org_id, status')
        .eq('due_date', dateStr)
        .not('status', 'in', '("awarded","not_awarded","submitted")')

      if (!projects || projects.length === 0) continue

      for (const project of projects) {
        if (!project.org_id) continue

        // Check if we already sent this alert (prevent duplicates)
        const alertKey = `deadline_${project.id}_${alert.days}d`
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('org_id', project.org_id)
          .eq('type', 'deadline_approaching')
          .like('message', `%${alertKey}%`)
          .limit(1)

        if (existing && existing.length > 0) continue

        const urgencyLabel = alert.days === 1 ? 'TOMORROW' : `in ${alert.days} days`
        const urgencyColor = alert.days === 1 ? 'urgent' : alert.days === 3 ? 'warning' : 'info'

        await supabase.from('notifications').insert({
          org_id: project.org_id,
          type: 'deadline_approaching',
          title: `${project.title} due ${urgencyLabel}`,
          message: `Project "${project.title}" is due on ${new Date(project.due_date).toLocaleDateString()}. [${alertKey}]`,
          link: `/projects/${project.id}`,
          read: false,
          metadata: { urgency: urgencyColor, days_until: alert.days, project_id: project.id },
        })

        totalCreated++
      }
    }

    return new Response(
      JSON.stringify({ success: true, notifications_created: totalCreated }),
      { headers }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Deadline alerts error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

// Netlify Scheduled Function config (runs daily at 8am EST / 12pm UTC)
export const config = {
  schedule: "0 12 * * *",
}
