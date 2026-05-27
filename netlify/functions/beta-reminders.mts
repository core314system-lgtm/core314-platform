import type { Config } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

function buildWeeklyReminderHtml(weekNumber: number): string {
  const siteUrl = process.env.URL || "https://procuvex.com"
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Week ${weekNumber} Feedback Ready</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Procuvex Founding Partner Program</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 15px; color: #111827; margin-top: 0;">Your Week ${weekNumber} feedback form is now available!</p>
        <p style="font-size: 14px; color: #374151; line-height: 1.7;">Your input directly shapes what we build next. Complete all 4 weekly feedback forms to earn your exclusive <strong>25% lifetime discount</strong> on any Procuvex plan.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${siteUrl}/feedback" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Complete Week ${weekNumber} Feedback</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

function buildCouponExpiringHtml(couponCode: string, daysLeft: number): string {
  const siteUrl = process.env.URL || "https://procuvex.com"
  const urgencyColor = daysLeft <= 1 ? "#dc2626" : "#d97706"
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${urgencyColor}; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">${daysLeft <= 1 ? "Last Chance" : "Reminder"} — Your 25% Discount ${daysLeft <= 1 ? "Expires Today" : `Expires in ${daysLeft} Days`}</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 15px; color: #111827; margin-top: 0;">Don't miss out on your exclusive Founding Partner discount!</p>
        <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #166534;">Your code:</p>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #065f46; font-family: monospace; letter-spacing: 2px;">${couponCode}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${siteUrl}/billing" style="background: ${urgencyColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Claim My Discount Now</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

export default async (req: Request) => {
  initSendGrid()
  const results: string[] = []

  // 1. Weekly feedback reminders for active beta testers
  const { data: activeTesters } = await supabase
    .from("user_profiles")
    .select("id, email, beta_start_date")
    .eq("beta_program_status", "active")
    .not("beta_start_date", "is", null)

  if (activeTesters) {
    for (const tester of activeTesters) {
      const daysSinceStart = Math.floor(
        (Date.now() - new Date(tester.beta_start_date!).getTime()) / 86400000
      )
      const currentWeek = Math.min(4, Math.ceil(daysSinceStart / 7))
      if (currentWeek < 1) continue

      // Check if form-due day (days 7, 14, 21, 28) or 48-hour follow-up (days 9, 16, 23, 30)
      const isFormDay = [7, 14, 21, 28].includes(daysSinceStart)
      const isFollowUp = [9, 16, 23, 30].includes(daysSinceStart)

      if (isFormDay || isFollowUp) {
        // Check if they already submitted this week's feedback
        const { data: existing } = await supabase
          .from("beta_feedback")
          .select("id")
          .eq("user_id", tester.id)
          .eq("week_number", currentWeek)
          .maybeSingle()

        if (!existing) {
          try {
            await sgMail.default.send({
              to: tester.email,
              from: { email: "noreply@core314.com", name: "Procuvex" },
              subject: isFollowUp
                ? `Reminder: Week ${currentWeek} Feedback Still Pending — Procuvex Founding Partner Program`
                : `Procuvex Founding Partner Program — Week ${currentWeek} Feedback Ready`,
              html: buildWeeklyReminderHtml(currentWeek),
              customArgs: { email_type: "beta_feedback_reminder" },
            })
            results.push(`Sent week ${currentWeek} ${isFollowUp ? "follow-up" : "reminder"} to ${tester.email}`)
          } catch {
            results.push(`Failed to send reminder to ${tester.email}`)
          }
        }
      }
    }
  }

  // 2. Coupon expiration reminders (day 3 and day 5)
  const { data: completedTesters } = await supabase
    .from("user_profiles")
    .select("id, email, beta_coupon_code, beta_coupon_expires_at")
    .eq("beta_program_status", "completed")
    .not("beta_coupon_expires_at", "is", null)
    .not("beta_coupon_code", "is", null)

  if (completedTesters) {
    for (const tester of completedTesters) {
      const expiresAt = new Date(tester.beta_coupon_expires_at!)
      const msRemaining = expiresAt.getTime() - Date.now()
      const daysRemaining = Math.ceil(msRemaining / 86400000)

      // Send reminder at 2 days left and on final day
      if (daysRemaining === 2 || daysRemaining <= 1) {
        try {
          await sgMail.default.send({
            to: tester.email,
            from: { email: "noreply@core314.com", name: "Procuvex" },
            subject: daysRemaining <= 1
              ? "Last Chance — Your 25% Lifetime Discount Expires Today!"
              : "Your 25% Lifetime Discount Expires in 2 Days",
            html: buildCouponExpiringHtml(tester.beta_coupon_code!, daysRemaining),
            customArgs: { email_type: "beta_coupon_reminder" },
          })
          results.push(`Sent coupon ${daysRemaining <= 1 ? "final" : "3-day"} reminder to ${tester.email}`)
        } catch {
          results.push(`Failed to send coupon reminder to ${tester.email}`)
        }
      }

      // Expire coupon if past due
      if (msRemaining < 0) {
        await supabase.from("user_profiles").update({
          beta_program_status: "expired",
        }).eq("id", tester.id)
        results.push(`Expired coupon for ${tester.email}`)
      }
    }
  }

  // 3. Set beta_start_date on first login for accepted testers who haven't logged in yet
  const { data: acceptedInvites } = await supabase
    .from("beta_invitations")
    .select("email")
    .eq("status", "accepted")

  if (acceptedInvites) {
    for (const inv of acceptedInvites) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, beta_start_date, last_sign_in_at")
        .eq("email", inv.email)
        .is("beta_start_date", null)
        .not("last_sign_in_at", "is", null)
        .maybeSingle()

      if (profile) {
        await supabase.from("user_profiles").update({
          beta_start_date: profile.last_sign_in_at || new Date().toISOString(),
          beta_program_status: "active",
        }).eq("id", profile.id)
        results.push(`Set beta_start_date for ${inv.email}`)
      }
    }
  }

  return new Response(JSON.stringify({ processed: results.length, details: results }), {
    headers: { "Content-Type": "application/json" },
  })
}

export const config: Config = {
  schedule: "0 13 * * *", // Daily at 9am ET / 1pm UTC
}
