import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
if (sendgridKey) sgMail.default.setApiKey(sendgridKey)
const fromEmail = 'noreply@procuvex.com'

export default async (_req: Request, _context: Context) => {
  if (!sendgridKey) {
    return new Response(JSON.stringify({ error: 'SendGrid not configured' }), { status: 500 })
  }

  // Find orgs whose trial ends in ~2 days (between 36 and 60 hours from now)
  const now = new Date()
  const from = new Date(now.getTime() + 36 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 60 * 60 * 60 * 1000)

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, trial_ends_at, subscription_plan')
    .eq('subscription_status', 'trialing')
    .gte('trial_ends_at', from.toISOString())
    .lte('trial_ends_at', to.toISOString())

  if (!orgs || orgs.length === 0) {
    return new Response(JSON.stringify({ message: 'No trials expiring soon', checked: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0

  for (const org of orgs) {
    // Get org members to email
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)
      .eq('role', 'owner')

    if (!members || members.length === 0) continue

    for (const member of members) {
      const { data: user } = await supabase.auth.admin.getUserById(member.user_id)
      if (!user?.user?.email) continue

      const trialEnd = new Date(org.trial_ends_at)
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const rawPlan = org.subscription_plan || ''
      const planLabel = rawPlan.includes('agentic') ? 'Agentic'
        : rawPlan.includes('enterprise') ? 'Enterprise'
        : rawPlan.includes('growth') ? 'Growth'
        : 'Growth'

      try {
        await sgMail.default.send({
          to: user.user.email,
          from: { email: fromEmail, name: 'Procuvex' },
          subject: `Your Procuvex trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Trial Is Ending Soon</h1>
              </div>
              <div style="padding: 32px;">
                <p style="font-size: 16px; color: #1e293b;">Your <strong>${planLabel} Plan</strong> free trial for <strong>${org.name || 'your organization'}</strong> ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 24px 0;">
                  <p style="margin: 0 0 8px; font-size: 14px; color: #92400e;"><strong>What you need to know:</strong></p>
                  <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px;">
                    <li>Your subscription will begin automatically after the trial</li>
                    <li>Your payment method on file will be charged</li>
                    <li>To cancel, go to Billing in your dashboard before the trial ends</li>
                    <li>All your data and settings will be preserved</li>
                  </ul>
                </div>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="https://procuvex.com/billing" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Manage Your Subscription</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">Questions? Our AI assistant is available in-app, or email support@procuvex.com.</p>
              </div>
              <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
              </div>
            </div>
          `,
          text: htmlToPlainText(`Your ${planLabel} Plan free trial for ${org.name || 'your organization'} ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Your subscription will begin automatically after the trial. Your payment method on file will be charged. To cancel, go to Billing in your dashboard before the trial ends. All your data and settings will be preserved. Manage Your Subscription: https://procuvex.com/billing`),
          headers: {
            "List-Unsubscribe": "<mailto:team@procuvex.com?subject=Unsubscribe%20Trial%20Reminders>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })
        sent++
        console.log(`Trial reminder sent to ${user.user.email} for org ${org.id}`)
      } catch (emailErr) {
        console.error(`Failed to send trial reminder to ${user.user.email}:`, emailErr)
      }
    }
  }

  return new Response(JSON.stringify({ message: `Sent ${sent} trial reminders`, checked: orgs.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
