import type { Config } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.ts"

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
        <p style="font-size: 14px; color: #374151; line-height: 1.7;">Your input directly shapes what we build next. Complete all 4 weekly feedback forms to earn your <strong>Founding Partner</strong> designation, priority access to new features, and a one-time 50%-off-first-month Enterprise discount.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${siteUrl}/feedback" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Complete Week ${weekNumber} Feedback</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

export default async (_req: Request) => {
  initSendGrid()
  const results: string[] = []
  const siteUrl = process.env.URL || "https://procuvex.com"

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
              from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
              replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
              subject: isFollowUp
                ? `Reminder: Week ${currentWeek} Feedback Still Pending — Procuvex Founding Partner Program`
                : `Procuvex Founding Partner Program — Week ${currentWeek} Feedback Ready`,
              html: buildWeeklyReminderHtml(currentWeek),
              text: htmlToPlainText(buildWeeklyReminderHtml(currentWeek)),
              customArgs: { email_type: "beta_feedback_reminder" },
              headers: {
                "List-Unsubscribe": `<${siteUrl}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=${encodeURIComponent(tester.email)}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            })
            results.push(`Sent week ${currentWeek} ${isFollowUp ? "follow-up" : "reminder"} to ${tester.email}`)
          } catch {
            results.push(`Failed to send reminder to ${tester.email}`)
          }
        }
      }
    }
  }

  // 2. Coupon expiration reminders — DISABLED (25% discount removed from program)

  // 3. Follow-up drip for pending beta invitations (Day 3 and Day 7)
  const { data: pendingInvites } = await supabase
    .from("beta_invitations")
    .select("id, email, created_at, status")
    .eq("status", "pending")

  if (pendingInvites) {

    for (const inv of pendingInvites) {
      const daysSinceSent = Math.floor(
        (Date.now() - new Date(inv.created_at).getTime()) / 86400000
      )

      if (daysSinceSent === 3 || daysSinceSent === 7) {
        const domain = inv.email.split("@")[1]?.toLowerCase() || ""
        const genericDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "protonmail.com", "mail.com"]
        const company = genericDomains.includes(domain) ? "" : (domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1))

        const isDay3 = daysSinceSent === 3
        const subject = isDay3
          ? "Quick follow-up — your Procuvex invite is waiting"
          : `Last chance${company ? ` for ${company}` : ""} — Procuvex Founding Partner spot`

        const body = isDay3
          ? `<p style="font-size: 15px; color: #111827;">Hi — just wanted to make sure you saw my previous email.</p>
             <p style="font-size: 15px; color: #374151; line-height: 1.7;">We're selecting 30 procurement professionals for our Founding Partner Program — complimentary Enterprise access for 30 days, direct input on the product roadmap, and a Founding Partner designation.</p>
             <p style="font-size: 15px; color: #374151;">Your spot is reserved for the next few days. Takes 2 minutes to apply:</p>`
          : `<p style="font-size: 15px; color: #111827;">This is my last note about this — I don't want to be a bother.</p>
             <p style="font-size: 15px; color: #374151; line-height: 1.7;">Your invitation to the Procuvex Founding Partner Program expires soon. If procurement tech isn't on your radar right now, no worries at all. But if you've been meaning to look into it, now's the time:</p>`

        const html = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
              ${body}
              <div style="text-align: center; margin: 24px 0;">
                <a href="${siteUrl}/beta/apply/${inv.id}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">View My Invitation</a>
              </div>
              <p style="font-size: 14px; color: #374151; margin: 16px 0 0;">— Chris Brown, Founder<br/><span style="font-size: 13px; color: #6b7280;">Core314 Technologies</span></p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center;">
                <a href="${siteUrl}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=${encodeURIComponent(inv.email)}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>
            </div>
          </div>
        `

        try {
          await sgMail.default.send({
            to: inv.email,
            from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
            replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
            subject,
            html,
            text: htmlToPlainText(html),
            customArgs: { email_type: "beta_invite_followup" },
            headers: {
              "List-Unsubscribe": `<${siteUrl}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=${encodeURIComponent(inv.email)}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          })
          results.push(`Sent day ${daysSinceSent} follow-up to ${inv.email}`)
        } catch {
          results.push(`Failed to send follow-up to ${inv.email}`)
        }
      }
    }
  }

  // 4. Set beta_start_date on first login for accepted testers who haven't logged in yet
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
