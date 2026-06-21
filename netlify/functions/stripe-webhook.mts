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
      const checkoutType = session.metadata?.type
      const customerEmail = session.customer_details?.email || session.customer_email

      // --- Sub Verification Checkout ---
      if (checkoutType === 'sub_verification') {
        const subId = session.metadata?.sub_id
        const userId = session.metadata?.user_id

        if (subId) {
          // Mark subcontractor as verified
          const { data: subData } = await supabase
            .from('master_subcontractors')
            .update({
              verification_status: 'verified',
              verified_at: new Date().toISOString(),
              stripe_subscription_id: session.subscription as string,
            })
            .eq('id', subId)
            .select('company_name, contact_email, trade_categories')
            .single()

          const companyName = subData?.company_name || 'Your company'
          const trades = subData?.trade_categories?.slice(0, 3).join(', ') || 'your trades'
          const subEmail = customerEmail || subData?.contact_email

          // Send verification confirmation email
          if (subEmail && sendgridKey) {
            try {
              await sgMail.default.send({
                to: subEmail,
                from: { email: 'team@procuvex.com', name: 'Procuvex' },
                subject: `${companyName} is Now Procuvex Verified!`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
                      <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 32px;">&#10003;</span>
                      </div>
                      <h1 style="color: white; margin: 0; font-size: 24px;">You're Procuvex Verified!</h1>
                    </div>
                    <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
                      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                        Congratulations! <strong>${companyName}</strong> now has the Procuvex Verified badge.
                        Here's what that means for your business:
                      </p>

                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <div style="margin-bottom: 10px;">
                          <strong style="color: #166534;">&#9989; Priority Search Placement</strong>
                          <p style="color: #15803d; margin: 4px 0 0; font-size: 13px;">Your profile now appears first when prime contractors search for ${trades}.</p>
                        </div>
                        <div style="margin-bottom: 10px;">
                          <strong style="color: #166534;">&#9989; Auto-Matching Active</strong>
                          <p style="color: #15803d; margin: 4px 0 0; font-size: 13px;">You'll be automatically matched to RFQ opportunities in your trade areas.</p>
                        </div>
                        <div style="margin-bottom: 10px;">
                          <strong style="color: #166534;">&#9989; Verified Badge</strong>
                          <p style="color: #15803d; margin: 4px 0 0; font-size: 13px;">A green verified badge appears on your public profile, building trust with primes.</p>
                        </div>
                        <div>
                          <strong style="color: #166534;">&#9989; Certification Alerts</strong>
                          <p style="color: #15803d; margin: 4px 0 0; font-size: 13px;">We'll remind you before your certifications expire so you never miss a renewal.</p>
                        </div>
                      </div>

                      <h3 style="color: #111827; font-size: 16px; margin: 24px 0 12px;">What to do next:</h3>
                      <ol style="color: #374151; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                        <li><strong>Complete your profile</strong> — add a company description, capability narrative, and geographic coverage to maximize visibility.</li>
                        <li><strong>Upload documents</strong> — COI, business licenses, and certifications increase your match score.</li>
                        <li><strong>Share your profile</strong> — send your public Procuvex profile link to prime contractors you work with.</li>
                      </ol>

                      <div style="text-align: center; margin: 28px 0;">
                        <a href="https://procuvex.com/my-sub-profile" style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                          Go to Your Profile
                        </a>
                      </div>

                      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                      <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                        Procuvex &mdash; A product of Core314 Technologies LLC<br/>
                        Your $99/year verification subscription is active. Manage billing at <a href="https://procuvex.com/my-sub-profile" style="color: #6b7280;">your profile</a>.
                      </p>
                    </div>
                  </div>
                `,
              })
              console.log(`Verification confirmation email sent to ${subEmail}`)
            } catch (emailErr) {
              console.error('Failed to send verification email:', emailErr)
            }
          }

          // TODO: Schedule 24-hour and 7-day follow-up emails
          // Requires scheduled_emails table — will be added in future migration
        }
        break
      }

      // --- Org/Platform Subscription Checkout ---
      let orgId = session.metadata?.org_id
      const planId = session.metadata?.plan_id || 'growth_monthly'

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

        // Track referral if referral_code is present
        const referralCode = session.metadata?.referral_code || sub.metadata?.referral_code
        if (referralCode && customerEmail) {
          const planLabel = planId.includes('enterprise') ? 'Enterprise' : 'Growth'
          const isAnnual = planId.includes('annual')
          const monthlyAmount = planId === 'enterprise_monthly' ? 5000
            : planId === 'enterprise_annual' ? 4000
            : planId === 'growth_annual' ? 2000
            : 2500

          try {
            await fetch(`${process.env.URL || 'https://procuvex.com'}/.netlify/functions/partner-program`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'track_signup',
                referral_code: referralCode,
                user_email: customerEmail,
                company_name: session.customer_details?.name || '',
                plan_name: `${planLabel}${isAnnual ? ' (Annual)' : ''}`,
                stripe_subscription_id: sub.id,
              }),
            })
          } catch (refErr) {
            console.error('Failed to track referral:', refErr)
          }
        }
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

      // Update referral signup when subscription becomes active (trial → paid)
      const updatedReferralCode = sub.metadata?.referral_code
      if (updatedReferralCode && sub.status === 'active') {
        const updatedPlanId = sub.metadata?.plan_id || 'growth_monthly'
        const monthlyAmount = updatedPlanId === 'enterprise_monthly' ? 5000
          : updatedPlanId === 'enterprise_annual' ? 4000
          : updatedPlanId === 'growth_annual' ? 2000
          : 2500

        await supabase
          .from('referral_signups')
          .update({
            subscription_status: 'active',
            subscription_started_at: new Date().toISOString(),
            monthly_amount: monthlyAmount,
            stripe_subscription_id: sub.id,
          })
          .eq('stripe_subscription_id', sub.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id

      if (orgId) {
        await updateOrgSubscription(orgId, 'cancelled', '', sub.id, null, null)
      }

      // Update referral signup status if this was a referred subscription
      const cancelledReferralCode = sub.metadata?.referral_code
      if (cancelledReferralCode) {
        await supabase
          .from('referral_signups')
          .update({
            subscription_status: 'cancelled',
            subscription_cancelled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
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
