import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { htmlToPlainText } from "./_shared/html-to-text.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || process.env.PROCUVEX_STRIPE_SECRET_KEY!,
  { apiVersion: "2024-12-18.acacia" }
)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

function buildCompletionEmailHtml(couponCode: string, claimUrl: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #065f46, #059669); color: white; padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Congratulations</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: bold; line-height: 1.3;">You've Completed the<br/>Founding Partner Program!</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Thank you for your dedication as a Founding Partner. Your feedback has been invaluable in shaping Procuvex.</p>
        <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #166534; font-weight: 600;">Your Exclusive 50% Off First Month Code:</p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #065f46; letter-spacing: 2px; font-family: monospace;">${couponCode}</p>
          <p style="margin: 12px 0 0; font-size: 13px; color: #16a34a;">Valid for the Enterprise plan &mdash; 50% off your first month.</p>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Important:</strong> You have 5 days to claim this discount and activate your subscription. After that, the code expires.</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #065f46, #059669); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Claim My Discount</a>
        </div>
        <p style="font-size: 14px; color: #374151;">Welcome aboard as a valued member of the Procuvex community.</p>
        <p style="font-size: 14px; color: #374151; margin-top: 16px;">With gratitude,<br/><strong>The Procuvex Team</strong></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

function buildReminderEmailHtml(weekNumber: number, feedbackUrl: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Week ${weekNumber} Feedback Ready</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Procuvex Founding Partner Program</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 15px; color: #111827; margin-top: 0;">Your Week ${weekNumber} feedback form is ready. Your input directly shapes what we build next.</p>
        <p style="font-size: 14px; color: #374151;">Complete all 4 weekly feedback forms to earn your exclusive <strong>50% off your first month</strong> on the Enterprise plan.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${feedbackUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Complete Week ${weekNumber} Feedback</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") return new Response(null, { headers })

  // --- GET: Fetch feedback for a user or all (admin) ---
  if (req.method === "GET") {
    const userId = req.headers.get("x-user-id")
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })

    const url = new URL(req.url)

    // Admin: get all feedback
    if (url.searchParams.get("all") === "true") {
      const { data: profile } = await supabase.from("user_profiles").select("is_global_admin").eq("id", userId).single()
      if (!profile?.is_global_admin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
      }

      const { data: feedback } = await supabase
        .from("beta_feedback")
        .select("user_id, week_number, responses, submitted_at, user_profiles!inner(email, full_name)")
        .order("submitted_at", { ascending: false })

      const mapped = (feedback || []).map((f: Record<string, unknown>) => ({
        user_id: f.user_id,
        week_number: f.week_number,
        responses: f.responses,
        submitted_at: f.submitted_at,
        user_email: (f.user_profiles as Record<string, unknown>)?.email,
        user_name: (f.user_profiles as Record<string, unknown>)?.full_name,
      }))

      return new Response(JSON.stringify({ feedback: mapped }), { headers })
    }

    // User: get own feedback + beta status
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("beta_start_date, beta_program_status, beta_coupon_code, beta_coupon_expires_at")
      .eq("id", userId)
      .single()

    const { data: feedback } = await supabase
      .from("beta_feedback")
      .select("week_number, responses, submitted_at")
      .eq("user_id", userId)
      .order("week_number")

    // Calculate current week
    let currentWeek = 0
    let daysRemaining = 30
    if (profile?.beta_start_date) {
      const daysSinceStart = Math.floor((Date.now() - new Date(profile.beta_start_date).getTime()) / 86400000)
      currentWeek = Math.min(4, Math.ceil(daysSinceStart / 7))
      if (currentWeek < 1) currentWeek = 1
      daysRemaining = Math.max(0, 30 - daysSinceStart)
    }

    return new Response(JSON.stringify({
      feedback: feedback || [],
      beta_start_date: profile?.beta_start_date,
      beta_program_status: profile?.beta_program_status,
      beta_coupon_code: profile?.beta_coupon_code,
      beta_coupon_expires_at: profile?.beta_coupon_expires_at,
      current_week: currentWeek,
      days_remaining: daysRemaining,
    }), { headers })
  }

  // --- POST: Submit feedback ---
  if (req.method === "POST") {
    const body = await req.json()
    const userId = body.user_id
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })

    const { week_number, responses } = body
    if (!week_number || week_number < 1 || week_number > 4) {
      return new Response(JSON.stringify({ error: "week_number must be 1-4" }), { status: 400, headers })
    }
    if (!responses || typeof responses !== "object") {
      return new Response(JSON.stringify({ error: "responses required" }), { status: 400, headers })
    }

    // Set beta_start_date on first login/feedback if not set
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("beta_start_date, beta_program_status, email")
      .eq("id", userId)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers })
    }

    if (!profile.beta_start_date) {
      await supabase.from("user_profiles").update({
        beta_start_date: new Date().toISOString(),
        beta_program_status: "active",
      }).eq("id", userId)
    }

    // Upsert feedback
    const { error: upsertErr } = await supabase
      .from("beta_feedback")
      .upsert({
        user_id: userId,
        week_number,
        responses,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "user_id,week_number" })

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500, headers })
    }

    // Check if all 4 weeks are now complete
    if (week_number === 4) {
      const { count } = await supabase
        .from("beta_feedback")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)

      if (count === 4) {
        // Program complete — generate Stripe coupon
        try {
          const coupon = await stripe.coupons.create({
            percent_off: 50,
            duration: "once",
            max_redemptions: 1,
            metadata: { user_id: userId, program: "founding_partner", plan: "enterprise" },
          })

          const promoCode = await stripe.promotionCodes.create({
            coupon: coupon.id,
            code: `FP-${Date.now().toString(36).toUpperCase()}`,
            max_redemptions: 1,
          })

          const couponExpiresAt = new Date()
          couponExpiresAt.setDate(couponExpiresAt.getDate() + 5)

          await supabase.from("user_profiles").update({
            beta_program_status: "completed",
            beta_coupon_code: promoCode.code,
            beta_coupon_expires_at: couponExpiresAt.toISOString(),
          }).eq("id", userId)

          // Send completion email
          const siteUrl = process.env.URL || "https://procuvex.com"
          const claimUrl = `${siteUrl}/billing`

          try {
            initSendGrid()
            await sgMail.default.send({
              to: profile.email,
              from: { email: "noreply@procuvex.com", name: "Procuvex" },
              subject: "You Did It — 50% Off Your First Month on Enterprise!",
              html: buildCompletionEmailHtml(promoCode.code, claimUrl),
              text: htmlToPlainText(buildCompletionEmailHtml(promoCode.code, claimUrl)),
              customArgs: { email_type: "beta_completed" },
            })
          } catch { /* non-blocking */ }

          return new Response(JSON.stringify({
            success: true,
            program_completed: true,
            coupon_code: promoCode.code,
            coupon_expires_at: couponExpiresAt.toISOString(),
          }), { headers })

        } catch (stripeErr: unknown) {
          const errMsg = stripeErr instanceof Error ? stripeErr.message : "Unknown error"
          // Mark complete even if Stripe fails
          await supabase.from("user_profiles").update({
            beta_program_status: "completed",
          }).eq("id", userId)

          return new Response(JSON.stringify({
            success: true,
            program_completed: true,
            warning: "Feedback saved but coupon generation failed: " + errMsg,
          }), { headers })
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers })
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
}
