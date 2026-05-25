import type { Context } from "@netlify/functions"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
if (sendgridKey) sgMail.default.setApiKey(sendgridKey)
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@procuvex.com'

async function updateOrgSubscription(orgId: string, status: string, planId: string, stripeSubId: string, trialEnd: number | null, currentPeriodEnd: number | null) {
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: status,
      subscription_plan: planId,
      stripe_subscription_id: stripeSubId,
      trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      subscription_ends_at: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    console.error('Failed to update org subscription:', error)
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('No signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      let orgId = session.metadata?.org_id
      const planId = session.metadata?.plan_id || 'growth_monthly'
      const customerEmail = session.customer_details?.email || session.customer_email

      // Auto-confirm the user in Supabase if they haven't confirmed yet
      if (customerEmail) {
        const { data: users } = await supabase.auth.admin.listUsers()
        const user = users?.users?.find(u => u.email === customerEmail)
        if (user && !user.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
          console.log(`Auto-confirmed email for user ${user.id}`)
        }

        // If no org_id was passed (new signup), look up the user's org
        if (!orgId && user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('current_org_id')
            .eq('id', user.id)
            .single()
          orgId = profile?.current_org_id || ''
        }

        // Update stripe_customer_id on the org
        if (orgId && session.customer) {
          await supabase
            .from('organizations')
            .update({ stripe_customer_id: session.customer as string })
            .eq('id', orgId)
        }
      }

      if (orgId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await updateOrgSubscription(
          orgId,
          sub.status === 'trialing' ? 'trialing' : 'active',
          planId,
          sub.id,
          sub.trial_end,
          sub.current_period_end
        )
      }

      // Send welcome/subscription confirmation email
      if (customerEmail && sendgridKey) {
        const planLabel = planId.includes('enterprise') ? 'Enterprise' : 'Growth'
        try {
          await sgMail.default.send({
            to: customerEmail,
            from: { email: fromEmail, name: 'Procuvex' },
            subject: 'Welcome to Procuvex — Your 7-Day Free Trial Has Started',
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to Procuvex</h1>
                </div>
                <div style="padding: 32px;">
                  <p style="font-size: 16px; color: #1e293b;">Your <strong>${planLabel} Plan</strong> free trial is now active.</p>
                  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #0369a1;"><strong>What happens next:</strong></p>
                    <ul style="margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 14px;">
                      <li>Your 7-day free trial starts today</li>
                      <li>Full access to all ${planLabel} features</li>
                      <li>Cancel anytime before the trial ends — no charge</li>
                      <li>After 7 days, your subscription begins automatically</li>
                    </ul>
                  </div>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://procuvex.com/login" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Your Dashboard</a>
                  </div>
                  <p style="font-size: 13px; color: #64748b;">If you have any questions, our AI assistant is available in-app, or reach us at support@procuvex.com.</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
                </div>
              </div>
            `,
          })
          console.log(`Welcome email sent to ${customerEmail}`)
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id

      if (orgId) {
        await updateOrgSubscription(
          orgId,
          sub.status === 'trialing' ? 'trialing' : sub.status,
          sub.metadata?.plan_id || 'growth_monthly',
          sub.id,
          sub.trial_end,
          sub.current_period_end
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id

      if (orgId) {
        await updateOrgSubscription(orgId, 'cancelled', '', sub.id, null, null)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = invoice.subscription as string | null

      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.org_id
        if (orgId) {
          await updateOrgSubscription(orgId, 'past_due', sub.metadata?.plan_id || '', sub.id, sub.trial_end, sub.current_period_end)
        }

        // Send payment failure notification email
        const failedEmail = invoice.customer_email
        if (failedEmail && sendgridKey) {
          try {
            await sgMail.default.send({
              to: failedEmail,
              from: { email: fromEmail, name: 'Procuvex' },
              subject: 'Procuvex — Payment Failed — Action Required',
              html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                  <div style="background: #dc2626; padding: 32px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payment Failed</h1>
                  </div>
                  <div style="padding: 32px;">
                    <p style="font-size: 16px; color: #1e293b;">We were unable to process your payment for your Procuvex subscription.</p>
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Please update your payment method</strong> to avoid service interruption. We'll retry the charge automatically, but updating your payment details ensures uninterrupted access.</p>
                    </div>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="https://procuvex.com/billing" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Update Payment Method</a>
                    </div>
                    <p style="font-size: 13px; color: #64748b;">If you believe this is an error, please contact us at support@procuvex.com.</p>
                  </div>
                  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
                  </div>
                </div>
              `,
            })
            console.log(`Payment failure email sent to ${failedEmail}`)
          } catch (emailErr) {
            console.error('Failed to send payment failure email:', emailErr)
          }
        }
      }
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
