import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { sanitizeEmail, sanitizeText } from "./_shared/sanitize.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

function generateReferralCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${slug}-${suffix}`
}

function generateMagicToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function verifyGlobalAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_global_admin")
    .eq("id", userId)
    .single()
  return !!data?.is_global_admin
}

function getSiteUrl(): string {
  return process.env.URL || "https://procuvex.com"
}

function buildWelcomeEmailHtml(partnerName: string, referralCode: string, dashboardUrl: string): string {
  const siteUrl = getSiteUrl()
  const referralLink = `${siteUrl}/r/${referralCode}`
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Welcome</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: bold; line-height: 1.3;">You're a Procuvex Partner!</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Hi ${partnerName},</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">Welcome to the Procuvex Partner Program! You've been approved to earn <strong>20% recurring commission</strong> for 12 months on every customer you refer.</p>

        <div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #5b21b6; font-weight: 600;">Your Referral Link</p>
          <p style="margin: 0; font-size: 16px; font-family: monospace; color: #4c1d95; background: white; padding: 10px 14px; border-radius: 6px; border: 1px solid #ddd6fe; word-break: break-all;">${referralLink}</p>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #166534; font-weight: 600;">How It Works</p>
          <ol style="margin: 0; padding-left: 18px; color: #15803d; font-size: 14px; line-height: 2.2;">
            <li>Share your unique referral link with your audience</li>
            <li>When someone signs up through your link, they're tracked to you</li>
            <li>After their trial converts to a paid subscription, you earn 20%</li>
            <li>Commissions are paid monthly, net 30, for up to 12 months per subscriber</li>
          </ol>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Go to Your Dashboard</a>
        </div>

        <p style="font-size: 14px; color: #374151; margin: 16px 0 0;">— Chris Brown, Founder<br/><span style="font-size: 13px; color: #6b7280;">Core314 Technologies</span></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

function buildReferralNotificationHtml(partnerName: string, companyName: string, planName: string): string {
  const dashboardUrl = `${getSiteUrl()}/partners/dashboard`
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">New Referral Sign-Up!</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Hi ${partnerName},</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">Great news! Someone just signed up through your referral link.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #166534;"><strong>Company:</strong> ${companyName}</p>
          <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Plan:</strong> ${planName}</p>
        </div>
        <p style="color: #374151; font-size: 14px;">Once their trial converts to a paid subscription, you'll start earning 20% monthly commission for 12 months.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">View Your Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

function buildCancellationNotificationHtml(partnerName: string, companyName: string, monthsActive: number, totalEarned: string): string {
  const dashboardUrl = `${getSiteUrl()}/partners/dashboard`
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #6b7280; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Referred Subscriber Cancelled</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Hi ${partnerName},</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">A customer you referred has cancelled their subscription.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #374151;"><strong>Company:</strong> ${companyName}</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #374151;"><strong>Months active:</strong> ${monthsActive}</p>
          <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Total commission earned:</strong> ${totalEarned}</p>
        </div>
        <p style="color: #374151; font-size: 14px;">No further commissions will be paid for this subscriber. Your other active referrals are unaffected.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">View Your Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

export default async (req: Request, _context: Context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  const url = new URL(req.url)

  // GET — public or authenticated reads
  if (req.method === 'GET') {
    const action = url.searchParams.get('action')

    // Public: Track referral click — /partners/api?action=track&code=xxx
    if (action === 'track') {
      const code = url.searchParams.get('code')
      if (!code) return new Response(JSON.stringify({ error: 'Missing referral code' }), { status: 400, headers })

      const { data: partner } = await supabase
        .from('referral_partners')
        .select('id, status')
        .eq('referral_code', code)
        .single()

      if (!partner || partner.status !== 'active') {
        return new Response(JSON.stringify({ valid: false }), { headers })
      }

      return new Response(JSON.stringify({ valid: true, code }), { headers })
    }

    // Partner dashboard data — requires magic token
    if (action === 'dashboard') {
      const token = url.searchParams.get('token')
      if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })

      const { data: partner } = await supabase
        .from('referral_partners')
        .select('*')
        .eq('magic_token', token)
        .eq('status', 'active')
        .single()

      if (!partner) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401, headers })
      }

      // Check token expiry if set
      if (partner.token_expires_at && new Date(partner.token_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Session expired. Please request a new login link.' }), { status: 401, headers })
      }

      // Get all signups for this partner
      const { data: signups } = await supabase
        .from('referral_signups')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })

      // Calculate commissions from Stripe
      const commissionData = await calculateCommissions(partner, signups || [])

      return new Response(JSON.stringify({
        partner: {
          name: partner.name,
          email: partner.email,
          referral_code: partner.referral_code,
          referral_link: `${getSiteUrl()}/r/${partner.referral_code}`,
          commission_rate: partner.commission_rate,
          commission_months: partner.commission_months,
          created_at: partner.created_at,
        },
        signups: (signups || []).map(s => ({
          id: s.id,
          company_name: s.company_name || 'Unknown',
          plan_name: s.plan_name || 'Unknown',
          status: s.subscription_status,
          created_at: s.created_at,
          subscription_started_at: s.subscription_started_at,
          subscription_cancelled_at: s.subscription_cancelled_at,
          monthly_amount: s.monthly_amount,
        })),
        commissions: commissionData,
      }), { headers })
    }

    // Admin: list all partners
    if (action === 'list') {
      const userId = req.headers.get('x-user-id')
      if (!userId || !(await verifyGlobalAdmin(userId))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
      }

      const { data: partners } = await supabase
        .from('referral_partners')
        .select('*')
        .order('created_at', { ascending: false })

      // Get signup counts per partner
      const partnerData = []
      for (const p of partners || []) {
        const { count } = await supabase
          .from('referral_signups')
          .select('id', { count: 'exact', head: true })
          .eq('partner_id', p.id)

        const { count: activeCount } = await supabase
          .from('referral_signups')
          .select('id', { count: 'exact', head: true })
          .eq('partner_id', p.id)
          .eq('subscription_status', 'active')

        partnerData.push({
          ...p,
          signup_count: count || 0,
          active_subscriber_count: activeCount || 0,
        })
      }

      return new Response(JSON.stringify({ partners: partnerData }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers })
  }

  // POST/PUT — mutations
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.json()
    const action = body.action

    // Public: Apply to become a partner
    if (action === 'apply') {
      const name = sanitizeText(body.name)
      const email = sanitizeEmail(body.email)
      const company = sanitizeText(body.company || '')
      const audience_size = sanitizeText(body.audience_size || '')
      const promotion_method = sanitizeText(body.promotion_method || '')

      if (!name || !email) {
        return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400, headers })
      }

      // Check for existing application
      const { data: existing } = await supabase
        .from('referral_partners')
        .select('id, status')
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        return new Response(JSON.stringify({
          error: 'already_applied',
          status: existing.status,
        }), { status: 409, headers })
      }

      const referralCode = generateReferralCode(name)
      const magicToken = generateMagicToken()
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: partner, error } = await supabase
        .from('referral_partners')
        .insert({
          name,
          email,
          company,
          audience_size,
          promotion_method,
          referral_code: referralCode,
          magic_token: magicToken,
          token_expires_at: tokenExpiresAt,
          commission_rate: 0.20,
          commission_months: 12,
          status: 'pending',
        })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to submit application' }), { status: 500, headers })
      }

      // Notify admin
      initSendGrid()
      try {
        await sgMail.default.send({
          to: 'admin@core314.com',
          from: { email: 'team@procuvex.com', name: 'Procuvex' },
          subject: `New Partner Application: ${name} (${email})`,
          html: `<p>New partner program application received.</p>
                 <p><strong>Name:</strong> ${name}<br/>
                 <strong>Email:</strong> ${email}<br/>
                 <strong>Company/Channel:</strong> ${company}<br/>
                 <strong>Audience:</strong> ${audience_size}<br/>
                 <strong>How they'll promote:</strong> ${promotion_method}</p>
                 <p>Review at <a href="${getSiteUrl()}/admin/partners">Admin Panel</a></p>`,
        })
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({ success: true, id: partner.id }), { headers })
    }

    // Partner: Request magic link login
    if (action === 'login') {
      const email = sanitizeEmail(body.email)
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers })
      }

      const { data: partner } = await supabase
        .from('referral_partners')
        .select('id, name, magic_token, status')
        .eq('email', email)
        .single()

      if (!partner || partner.status !== 'active') {
        // Don't reveal whether the email exists
        return new Response(JSON.stringify({ success: true, message: 'If an active partner account exists, a login link has been sent.' }), { headers })
      }

      // Rotate magic token for security, set 7-day expiry
      const newToken = generateMagicToken()
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('referral_partners')
        .update({ magic_token: newToken, token_expires_at: tokenExpiresAt })
        .eq('id', partner.id)

      const dashboardUrl = `${getSiteUrl()}/partners/dashboard?token=${newToken}`

      initSendGrid()
      try {
        await sgMail.default.send({
          to: email,
          from: { email: 'team@procuvex.com', name: 'Procuvex Partner Program' },
          replyTo: { email: 'team@procuvex.com', name: 'Chris Brown' },
          subject: 'Your Procuvex Partner Dashboard Login',
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Partner Dashboard Login</h1>
              </div>
              <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
                <p style="font-size: 16px; color: #111827; margin-top: 0;">Hi ${partner.name},</p>
                <p style="color: #374151; line-height: 1.7; font-size: 15px;">Click the button below to access your partner dashboard. This link is valid for one login session.</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Open Dashboard</a>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">If you didn't request this, you can ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
              </div>
            </div>
          `,
        })
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to send login email' }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true, message: 'If an active partner account exists, a login link has been sent.' }), { headers })
    }

    // Admin: Approve a partner
    if (action === 'approve') {
      const userId = req.headers.get('x-user-id')
      if (!userId || !(await verifyGlobalAdmin(userId))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
      }

      const partnerId = body.partner_id
      if (!partnerId) return new Response(JSON.stringify({ error: 'partner_id required' }), { status: 400, headers })

      // Refresh token and expiry on approval so the welcome email link is valid
      const freshToken = generateMagicToken()
      const freshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: partner, error } = await supabase
        .from('referral_partners')
        .update({ status: 'active', approved_at: new Date().toISOString(), magic_token: freshToken, token_expires_at: freshExpiry })
        .eq('id', partnerId)
        .select()
        .single()

      if (error || !partner) {
        return new Response(JSON.stringify({ error: 'Failed to approve partner' }), { status: 500, headers })
      }

      // Send welcome email
      initSendGrid()
      const dashboardUrl = `${getSiteUrl()}/partners/dashboard?token=${partner.magic_token}`
      try {
        await sgMail.default.send({
          to: partner.email,
          from: { email: 'team@procuvex.com', name: 'Chris Brown — Procuvex' },
          replyTo: { email: 'team@procuvex.com', name: 'Chris Brown' },
          subject: "You're Approved — Welcome to the Procuvex Partner Program!",
          html: buildWelcomeEmailHtml(partner.name, partner.referral_code, dashboardUrl),
        })
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({ success: true, partner }), { headers })
    }

    // Admin: Reject a partner
    if (action === 'reject') {
      const userId = req.headers.get('x-user-id')
      if (!userId || !(await verifyGlobalAdmin(userId))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
      }

      const partnerId = body.partner_id
      const { error } = await supabase
        .from('referral_partners')
        .update({ status: 'rejected' })
        .eq('id', partnerId)

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to reject partner' }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Admin: Mark payout as paid
    if (action === 'mark_paid') {
      const userId = req.headers.get('x-user-id')
      if (!userId || !(await verifyGlobalAdmin(userId))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
      }

      const partnerId = body.partner_id
      const month = body.month // YYYY-MM format
      const amount = body.amount

      const { error } = await supabase
        .from('partner_payouts')
        .upsert({
          partner_id: partnerId,
          month,
          amount,
          status: 'paid',
          paid_at: new Date().toISOString(),
        }, { onConflict: 'partner_id,month' })

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to record payout' }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Track a referral signup (called during user registration or checkout)
    if (action === 'track_signup') {
      const referralCode = body.referral_code
      const userEmail = sanitizeEmail(body.user_email)
      const companyName = sanitizeText(body.company_name || '')
      const planName = sanitizeText(body.plan_name || '')
      const stripeSubscriptionId = body.stripe_subscription_id || null

      if (!referralCode || !userEmail) {
        return new Response(JSON.stringify({ error: 'referral_code and user_email required' }), { status: 400, headers })
      }

      const { data: partner } = await supabase
        .from('referral_partners')
        .select('id, name, email, status')
        .eq('referral_code', referralCode)
        .single()

      if (!partner || partner.status !== 'active') {
        return new Response(JSON.stringify({ error: 'Invalid referral code' }), { status: 400, headers })
      }

      // Prevent self-referral
      if (partner.email === userEmail) {
        return new Response(JSON.stringify({ error: 'Self-referral not allowed' }), { status: 400, headers })
      }

      // Check if already tracked
      const { data: existing } = await supabase
        .from('referral_signups')
        .select('id')
        .eq('partner_id', partner.id)
        .eq('user_email', userEmail)
        .maybeSingle()

      if (existing) {
        return new Response(JSON.stringify({ already_tracked: true }), { headers })
      }

      const { error } = await supabase
        .from('referral_signups')
        .insert({
          partner_id: partner.id,
          user_email: userEmail,
          company_name: companyName,
          plan_name: planName,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: 'trial',
          monthly_amount: 0,
        })

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to track signup' }), { status: 500, headers })
      }

      // Notify partner of new signup
      initSendGrid()
      try {
        await sgMail.default.send({
          to: partner.email,
          from: { email: 'team@procuvex.com', name: 'Procuvex Partner Program' },
          replyTo: { email: 'team@procuvex.com', name: 'Chris Brown' },
          subject: `New Referral: ${companyName || userEmail} signed up through your link!`,
          html: buildReferralNotificationHtml(partner.name, companyName || userEmail, planName || 'Enterprise'),
        })
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
}

async function calculateCommissions(partner: Record<string, unknown>, signups: Record<string, unknown>[]): Promise<Record<string, unknown>> {
  const commissionRate = (partner.commission_rate as number) || 0.20
  const commissionMonths = (partner.commission_months as number) || 12
  const activeSignups = signups.filter(s => s.subscription_status === 'active')
  const totalSignups = signups.length
  const trialSignups = signups.filter(s => s.subscription_status === 'trial').length

  let currentMonthlyCommission = 0
  const subscriberDetails: Record<string, unknown>[] = []

  for (const signup of activeSignups) {
    const monthlyAmount = (signup.monthly_amount as number) || 0
    const startDate = signup.subscription_started_at ? new Date(signup.subscription_started_at as string) : null

    if (!startDate) continue

    const monthsActive = Math.floor((Date.now() - startDate.getTime()) / (30 * 86400000)) + 1
    const monthsRemaining = Math.max(0, commissionMonths - monthsActive)
    const commission = monthlyAmount * commissionRate

    if (monthsRemaining > 0) {
      currentMonthlyCommission += commission
      subscriberDetails.push({
        company: signup.company_name,
        plan: signup.plan_name,
        monthly_amount: monthlyAmount,
        commission: commission,
        started: signup.subscription_started_at,
        months_active: monthsActive,
        months_remaining: monthsRemaining,
      })
    }
  }

  // Calculate historical payouts
  const { data: payouts } = await supabase
    .from('partner_payouts')
    .select('*')
    .eq('partner_id', partner.id)
    .order('month', { ascending: true })

  const totalPaid = (payouts || []).reduce((sum, p) => sum + ((p.amount as number) || 0), 0)

  // Build monthly history
  const monthlyHistory: Record<string, unknown>[] = []
  const allMonths = new Set<string>()

  for (const signup of signups) {
    if (signup.subscription_started_at) {
      const startDate = new Date(signup.subscription_started_at as string)
      const endDate = signup.subscription_cancelled_at
        ? new Date(signup.subscription_cancelled_at as string)
        : new Date()
      const maxEnd = new Date(startDate.getTime() + commissionMonths * 30 * 86400000)
      const actualEnd = endDate < maxEnd ? endDate : maxEnd

      let cursor = new Date(startDate)
      while (cursor <= actualEnd) {
        allMonths.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }
  }

  const sortedMonths = [...allMonths].sort()
  for (const month of sortedMonths) {
    const [year, mo] = month.split('-').map(Number)
    const monthStart = new Date(year, mo - 1, 1)
    const monthEnd = new Date(year, mo, 0)

    let monthRevenue = 0
    let monthSubscribers = 0

    for (const signup of signups) {
      if (!signup.subscription_started_at) continue
      const subStart = new Date(signup.subscription_started_at as string)
      const subEnd = signup.subscription_cancelled_at
        ? new Date(signup.subscription_cancelled_at as string)
        : new Date(9999, 0)
      const commissionEnd = new Date(subStart.getTime() + commissionMonths * 30 * 86400000)

      if (subStart <= monthEnd && subEnd >= monthStart && commissionEnd >= monthStart) {
        monthRevenue += (signup.monthly_amount as number) || 0
        monthSubscribers++
      }
    }

    const monthCommission = monthRevenue * commissionRate
    const payout = (payouts || []).find(p => p.month === month)

    monthlyHistory.push({
      month,
      subscribers: monthSubscribers,
      revenue: monthRevenue,
      commission: monthCommission,
      status: payout ? 'paid' : (monthEnd < new Date() ? 'pending' : 'projected'),
      paid_at: payout?.paid_at || null,
    })
  }

  const projectedTotal = subscriberDetails.reduce((sum, s) => {
    return sum + ((s.commission as number) * (s.months_remaining as number))
  }, 0) + totalPaid

  return {
    total_signups: totalSignups,
    trial_signups: trialSignups,
    active_subscribers: activeSignups.length,
    cancelled: signups.filter(s => s.subscription_status === 'cancelled').length,
    current_monthly_commission: currentMonthlyCommission,
    total_paid: totalPaid,
    projected_total: projectedTotal,
    subscribers: subscriberDetails,
    monthly_history: monthlyHistory,
  }
}
