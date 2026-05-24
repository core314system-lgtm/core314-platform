import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

/**
 * Netlify Function: Automated RFQ Follow-Up
 * 
 * Checks for subcontractors who haven't responded to RFQs and sends
 * follow-up reminders on a cadence (Day 3, Day 7, Day 10).
 * 
 * Can be called manually (POST /api/rfq-followup) or via scheduled trigger.
 * Body (optional): { task_order_id?: string, dry_run?: boolean }
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

interface FollowUpResult {
  sow_subcontractor_id: string
  subcontractor_name: string
  email: string
  days_since_rfq: number
  follow_up_number: number
  action: 'sent' | 'skipped' | 'error'
  reason?: string
}

const FOLLOW_UP_CADENCE = [3, 7, 10] // Days after initial RFQ
const MAX_FOLLOW_UPS = 3

function daysBetween(date1: string, date2: Date): number {
  const d1 = new Date(date1)
  return Math.floor((date2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

function getFollowUpSubject(followUpNumber: number, sowName: string): string {
  switch (followUpNumber) {
    case 1: return `Reminder: Quote Request — ${sowName}`
    case 2: return `Second Reminder: Quote Needed — ${sowName}`
    case 3: return `Final Notice: Quote Due Soon — ${sowName}`
    default: return `Follow-up: Quote Request — ${sowName}`
  }
}

function getFollowUpHtml(params: {
  subName: string
  sowName: string
  projectTitle: string
  followUpNumber: number
  portalLink: string
  daysSinceRfq: number
}): string {
  const urgency = params.followUpNumber === 3
    ? '<p style="color: #dc2626; font-weight: bold;">This is our final reminder. Please respond at your earliest convenience.</p>'
    : params.followUpNumber === 2
    ? '<p style="color: #d97706;">We haven\'t received your response yet. Please submit your quote soon.</p>'
    : '<p>We wanted to follow up on our recent quote request.</p>'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">Quote Request Follow-Up</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hello ${params.subName},</p>
        ${urgency}
        <p>We sent a quote request <strong>${params.daysSinceRfq} days ago</strong> for:</p>
        <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 12px 0;">
          <strong>${params.sowName}</strong><br/>
          <span style="color: #6b7280;">Project: ${params.projectTitle}</span>
        </div>
        <p>Please submit your quote through the portal below:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${params.portalLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Submit Your Quote →
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px;">If you've already submitted or decided not to bid, please disregard this message.</p>
      </div>
    </div>
  `
}

export default async function handler(req: Request, _context: Context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
  if (!sendgridKey) {
    return new Response(JSON.stringify({ error: 'SendGrid API key not configured' }), { status: 200, headers })
  }

  sgMail.default.setApiKey(sendgridKey)
  const now = new Date()
  const results: FollowUpResult[] = []

  let taskOrderFilter: string | undefined
  let dryRun = false

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      taskOrderFilter = body.task_order_id
      dryRun = body.dry_run || false
    } catch { /* empty body is OK */ }
  }

  try {
    // Find all sow_subcontractors that:
    // 1. Have an RFQ sent (rfq_sent_date is not null)
    // 2. Haven't submitted a quote (outreach_status != 'quote_submitted')
    // 3. Haven't exceeded max follow-ups
    let query = supabase
      .from('sow_subcontractors')
      .select('*, subcontractors(*), sow_items(*, task_orders(title))')
      .not('rfq_sent_date', 'is', null)
      .not('outreach_status', 'eq', 'quote_submitted')
      .lt('follow_up_count', MAX_FOLLOW_UPS)

    if (taskOrderFilter) {
      query = query.eq('sow_items.task_order_id', taskOrderFilter)
    }

    const { data: pendingSubs, error } = await query

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    for (const record of (pendingSubs || [])) {
      const sub = record.subcontractors
      const sow = record.sow_items
      const taskOrder = sow?.task_orders

      if (!sub?.contact_email || !sow || !record.rfq_sent_date) {
        results.push({
          sow_subcontractor_id: record.id,
          subcontractor_name: sub?.company_name || 'Unknown',
          email: sub?.contact_email || '',
          days_since_rfq: 0,
          follow_up_number: (record.follow_up_count || 0) + 1,
          action: 'skipped',
          reason: !sub?.contact_email ? 'No email address' : 'Missing data',
        })
        continue
      }

      const daysSince = daysBetween(record.rfq_sent_date, now)
      const currentFollowUps = record.follow_up_count || 0
      const nextFollowUpDay = FOLLOW_UP_CADENCE[currentFollowUps]

      // Check if it's time for the next follow-up
      if (!nextFollowUpDay || daysSince < nextFollowUpDay) {
        continue // Not time yet
      }

      const followUpNumber = currentFollowUps + 1

      // Get portal link
      let portalLink = ''
      const { data: tokenData } = await supabase
        .from('rfq_tokens')
        .select('token')
        .eq('sow_subcontractor_id', record.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (tokenData?.token) {
        const siteUrl = process.env.URL || 'https://procuvex.com'
        portalLink = `${siteUrl}/portal/${tokenData.token}`
      }

      if (dryRun) {
        results.push({
          sow_subcontractor_id: record.id,
          subcontractor_name: sub.company_name,
          email: sub.contact_email,
          days_since_rfq: daysSince,
          follow_up_number: followUpNumber,
          action: 'skipped',
          reason: 'Dry run — would send',
        })
        continue
      }

      // Send the follow-up email
      try {
        const sowName = sow.sow_name || sow.service_category || 'RFQ'
        const projectTitle = taskOrder?.title || 'Project'

        await sgMail.default.send({
          to: sub.contact_email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@core314.com',
            name: 'Core314 Task Order Intelligence',
          },
          subject: getFollowUpSubject(followUpNumber, sowName),
          html: getFollowUpHtml({
            subName: sub.company_name,
            sowName,
            projectTitle,
            followUpNumber,
            portalLink: portalLink || '#',
            daysSinceRfq: daysSince,
          }),
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true },
          },
          customArgs: {
            sow_subcontractor_id: record.id,
            follow_up_number: String(followUpNumber),
          },
        })

        // Update follow-up count and timestamp
        await supabase
          .from('sow_subcontractors')
          .update({
            follow_up_count: followUpNumber,
            last_follow_up_at: now.toISOString(),
          })
          .eq('id', record.id)

        results.push({
          sow_subcontractor_id: record.id,
          subcontractor_name: sub.company_name,
          email: sub.contact_email,
          days_since_rfq: daysSince,
          follow_up_number: followUpNumber,
          action: 'sent',
        })
      } catch (emailErr: any) {
        results.push({
          sow_subcontractor_id: record.id,
          subcontractor_name: sub.company_name,
          email: sub.contact_email,
          days_since_rfq: daysSince,
          follow_up_number: followUpNumber,
          action: 'error',
          reason: emailErr?.message || 'Email send failed',
        })
      }
    }

    const sent = results.filter(r => r.action === 'sent').length
    const skipped = results.filter(r => r.action === 'skipped').length
    const errors = results.filter(r => r.action === 'error').length

    return new Response(JSON.stringify({
      success: true,
      summary: { total: results.length, sent, skipped, errors },
      results,
      dry_run: dryRun,
    }), { status: 200, headers })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}
