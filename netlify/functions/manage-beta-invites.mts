import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { sanitizeEmail } from "./_shared/sanitize.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_BETA_SEATS = 30

function getSiteUrl(): string {
  return process.env.URL || process.env.DEPLOY_URL || "https://procuvex.com"
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 48; i++) {
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

async function getAcceptedCount(): Promise<number> {
  const { count } = await supabase
    .from("beta_invitations")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
  return count || 0
}

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

function getCompanyFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  const genericDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "protonmail.com", "mail.com"]
  if (genericDomains.includes(domain)) return ""
  const name = domain.split(".")[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function buildInviteEmailHtml(applyUrl: string, recipientEmail: string): string {
  const company = getCompanyFromEmail(recipientEmail)
  const greeting = company ? `I came across ${company} and wanted to reach out personally.` : "I wanted to reach out to you personally."
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Invitation — Limited to 30 Partners</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: bold; line-height: 1.3;">You're Invited to Shape the Future<br/>of Procurement Technology</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">${greeting} We're selecting 30 procurement professionals to join the Procuvex Founding Partner Program — and your team is on our short list.</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">Procuvex was built from real-world federal procurement and multi-site facility management operations. It's designed for teams managing complex solicitations, subcontractor coordination, and compliance-heavy bid processes. <a href="https://procuvex.com" style="color: #1e40af; text-decoration: underline;">Learn more at procuvex.com</a></p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 16px 0 0;">I'd love to hear your honest feedback on the platform — that's what this program is about.</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #0c4a6e; font-weight: 600;">As a Founding Partner, you receive:</p>
          <ul style="margin: 0; padding-left: 18px; color: #0369a1; font-size: 14px; line-height: 2;">
            <li>Complimentary full-platform access during the 30-day program</li>
            <li><strong>Founding Partner</strong> designation on your account — permanently</li>
            <li>Direct access to the development team for feedback</li>
            <li>Early influence on platform direction and features</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${applyUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; letter-spacing: 0.3px;">
            Learn More &amp; Apply
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #9ca3af;">Only 30 founding seats available &mdash; spots are not guaranteed</p>
        </div>
        <p style="font-size: 14px; color: #374151; margin: 16px 0 0;">— Chris Brown, Founder<br/><span style="font-size: 13px; color: #6b7280;">Core314 Technologies</span></p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin-top: 16px;">This invitation is personal and non-transferable. It expires in 30 days.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Procuvex &mdash; Built for government contractors, procurement teams, and subcontractor-driven operations.<br/>A product of Core314 Technologies LLC
        </p>
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          If you no longer wish to receive these emails, you can <a href="${getSiteUrl()}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=%%EMAIL%%" style="color: #9ca3af; text-decoration: underline;">unsubscribe here</a>.
        </p>
      </div>
    </div>
  `
}

function buildAcceptanceEmailHtml(signupUrl: string, seatsRemaining: number): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #065f46, #059669); color: white; padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Congratulations</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: bold; line-height: 1.3;">Welcome to the Procuvex<br/>Founding Partner Program</h1>
        <p style="margin: 14px 0 0; opacity: 0.85; font-size: 14px;">You're one of only ${MAX_BETA_SEATS - seatsRemaining + 1} professionals selected</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Congratulations &mdash; you've been accepted as a Founding Partner of Procuvex!</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">We reviewed your application and are thrilled to have you on board. Here's everything you need to get started:</p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #166534; font-weight: 600;">Your Next Steps:</p>
          <ol style="margin: 0; padding-left: 18px; color: #15803d; font-size: 14px; line-height: 2.2;">
            <li><strong>Create your account</strong> using the button below</li>
            <li><strong>Complete your profile</strong> setup</li>
            <li><strong>Create your first project</strong> and upload a document</li>
            <li><strong>Explore core features</strong> &mdash; compliance matrix, subcontractor search, Q&amp;A management</li>
            <li><strong>Complete weekly feedback forms</strong> (4 weeks) to earn your Founding Partner designation</li>
          </ol>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Important:</strong> Your 30-day program begins when you first log in. Complete all 4 weekly feedback forms to earn your permanent Founding Partner designation and priority access to new features.</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${signupUrl}" style="background: linear-gradient(135deg, #065f46, #059669); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; letter-spacing: 0.3px;">
            Create Your Account
          </a>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.7;">Questions? Use the <strong>Ask Procuvex Intelligence</strong> chatbot (bottom-right of every page) once you're logged in.</p>
        <p style="font-size: 14px; color: #374151; margin-top: 16px;">Welcome aboard,<br/><strong>Chris Brown, Founder</strong><br/><span style="font-size: 13px; color: #6b7280;">Core314 Technologies</span></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Procuvex &mdash; A product of Core314 Technologies LLC
        </p>
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          If you no longer wish to receive these emails, you can <a href="${getSiteUrl()}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=%%EMAIL%%" style="color: #9ca3af; text-decoration: underline;">unsubscribe here</a>.
        </p>
      </div>
    </div>
  `
}

function buildDeclineEmailHtml(): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Procuvex Founding Partner Program Update</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Thank you for your interest in the Procuvex Founding Partner Program.</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">Due to overwhelming interest, all seats in our current founding cohort have been filled. We received applications from procurement professionals across the country, and the response exceeded our expectations.</p>
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">We've added you to our <strong>priority access list</strong>. When Procuvex launches publicly, you'll be among the first to know &mdash; and we'll make sure you have early access to get started.</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #0c4a6e;">In the meantime, learn more about Procuvex at<br/><a href="https://procuvex.com" style="color: #1e40af; font-weight: 600;">procuvex.com</a></p>
        </div>
        <p style="font-size: 14px; color: #374151;">We genuinely appreciate your interest and look forward to working with you soon.</p>
        <p style="font-size: 14px; color: #374151; margin-top: 16px;">Warm regards,<br/><strong>Chris Brown, Founder</strong><br/><span style="font-size: 13px; color: #6b7280;">Core314 Technologies</span></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          If you no longer wish to receive these emails, you can <a href="${getSiteUrl()}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=%%EMAIL%%" style="color: #9ca3af; text-decoration: underline;">unsubscribe here</a>.
        </p>
      </div>
    </div>
  `
}

function buildFollowUpEmailHtml(subject: string, message: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">${subject}</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Procuvex Founding Partner Program</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <div style="color: #374151; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">${message}</div>
        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="https://procuvex.com/login" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Log In to Procuvex</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex &mdash; A product of Core314 Technologies LLC</p>
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          If you no longer wish to receive these emails, you can <a href="${getSiteUrl()}/.netlify/functions/manage-beta-invites?action=unsubscribe&email=%%EMAIL%%" style="color: #9ca3af; text-decoration: underline;">unsubscribe here</a>.
        </p>
      </div>
    </div>
  `
}

async function sendEmail(to: string, subject: string, html: string, emailType: string) {
  initSendGrid()
  const finalHtml = html.replace(/%%EMAIL%%/g, encodeURIComponent(to))
  await sgMail.default.send({
    to,
    from: { email: "team@procuvex.com", name: "Chris Brown — Procuvex" },
    replyTo: { email: "team@procuvex.com", name: "Chris Brown" },
    subject,
    html: finalHtml,
    customArgs: { email_type: emailType },
  })
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  // --- GET: List all invitations with tester activity (global admin only) ---
  if (req.method === "GET") {
    const url = new URL(req.url)

    // Public endpoint: get seats remaining (no auth required for landing page)
    if (url.searchParams.get("action") === "seats") {
      const accepted = await getAcceptedCount()
      return new Response(JSON.stringify({ total: MAX_BETA_SEATS, remaining: Math.max(0, MAX_BETA_SEATS - accepted) }), { headers })
    }

    // Public endpoint: unsubscribe from beta emails
    if (url.searchParams.get("action") === "unsubscribe") {
      const email = url.searchParams.get("email")
      if (email) {
        await supabase
          .from("beta_invitations")
          .update({ status: "unsubscribed" })
          .eq("email", email.toLowerCase())
          .in("status", ["pending", "sent", "applied", "declined"])

        return new Response(
          `<html><head><title>Unsubscribed</title></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 20px;background:#f9fafb;"><div style="max-width:400px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h2 style="color:#111827;margin:0 0 12px;">You've been unsubscribed</h2><p style="color:#6b7280;margin:0;">You won't receive any more emails about the Procuvex Founding Partner Program. If this was a mistake, contact us at <a href="mailto:team@procuvex.com" style="color:#2563eb;">team@procuvex.com</a>.</p></div></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      }
      return new Response(JSON.stringify({ error: "Missing email" }), { status: 400, headers })
    }

    const callerId = req.headers.get("x-user-id")
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }

    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const { data: invites, error } = await supabase
      .from("beta_invitations")
      .select("id, email, token, status, created_at, claimed_at, expires_at, created_by, notes, agreed_at, applicant_name")
      .order("created_at", { ascending: false })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    const acceptedEmails = (invites || []).filter(i => i.status === "accepted").map(i => i.email)
    let testerActivity: Record<string, { last_sign_in_at: string | null; created_at: string; project_count: number; beta_start_date: string | null; beta_program_status: string | null; feedback_count: number }> = {}

    if (acceptedEmails.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("email, last_sign_in_at, created_at, current_org_id, beta_start_date, beta_program_status")
        .in("email", acceptedEmails)

      if (profiles) {
        for (const p of profiles) {
          testerActivity[p.email] = {
            last_sign_in_at: p.last_sign_in_at,
            created_at: p.created_at,
            project_count: 0,
            beta_start_date: p.beta_start_date,
            beta_program_status: p.beta_program_status,
            feedback_count: 0,
          }

          if (p.current_org_id) {
            const { count } = await supabase
              .from("projects")
              .select("id", { count: "exact", head: true })
              .eq("org_id", p.current_org_id)
            if (count !== null) testerActivity[p.email].project_count = count
          }
        }

        // Get feedback counts
        const { data: userIds } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("email", acceptedEmails)

        if (userIds) {
          for (const u of userIds) {
            const { count } = await supabase
              .from("beta_feedback")
              .select("id", { count: "exact", head: true })
              .eq("user_id", u.id)
            if (count !== null && testerActivity[u.email]) {
              testerActivity[u.email].feedback_count = count
            }
          }
        }
      }
    }

    const acceptedCount = await getAcceptedCount()

    return new Response(JSON.stringify({
      invites: invites || [],
      testerActivity,
      seats: { total: MAX_BETA_SEATS, accepted: acceptedCount, remaining: Math.max(0, MAX_BETA_SEATS - acceptedCount) }
    }), { headers })
  }

  // --- POST: Send invitations, follow-up, accept, decline ---
  if (req.method === "POST") {
    const body = await req.json()
    const callerId = body.caller_id

    // Accept application (admin only)
    if (body.action === "accept") {
      if (!callerId || !(await verifyGlobalAdmin(callerId))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
      }
      const { invite_id } = body
      const { data: invite } = await supabase.from("beta_invitations").select("*").eq("id", invite_id).single()
      if (!invite || invite.status !== "applied") {
        return new Response(JSON.stringify({ error: "Invitation not in 'applied' status" }), { status: 400, headers })
      }

      const acceptedCount = await getAcceptedCount()
      if (acceptedCount >= MAX_BETA_SEATS) {
        return new Response(JSON.stringify({ error: "All beta seats are filled" }), { status: 400, headers })
      }

      // Generate new signup token
      const newToken = generateToken()
      const { error: updateErr } = await supabase.from("beta_invitations").update({
        status: "accepted",
        token: newToken,
        claimed_at: new Date().toISOString(),
      }).eq("id", invite_id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers })
      }

      const siteUrl = process.env.URL || "https://procuvex.com"
      const signupUrl = `${siteUrl}/login?beta_invite=${newToken}`

      try {
        await sendEmail(
          invite.email,
          "Welcome to the Procuvex Founding Partner Program — You're In!",
          buildAcceptanceEmailHtml(signupUrl, acceptedCount),
          "beta_accepted"
        )
      } catch { /* email failure is non-blocking */ }

      return new Response(JSON.stringify({ success: true, token: newToken }), { headers })
    }

    // Decline application (admin only)
    if (body.action === "decline") {
      if (!callerId || !(await verifyGlobalAdmin(callerId))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
      }
      const { invite_id } = body
      const { data: invite } = await supabase.from("beta_invitations").select("*").eq("id", invite_id).single()
      if (!invite || invite.status !== "applied") {
        return new Response(JSON.stringify({ error: "Invitation not in 'applied' status" }), { status: 400, headers })
      }

      const { error: updateErr } = await supabase.from("beta_invitations").update({
        status: "declined",
      }).eq("id", invite_id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers })
      }

      try {
        await sendEmail(
          invite.email,
          "Procuvex Founding Partner Program Update",
          buildDeclineEmailHtml(),
          "beta_declined"
        )
      } catch { /* email failure is non-blocking */ }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Follow-up email (admin only)
    if (body.action === "follow_up") {
      if (!callerId || !(await verifyGlobalAdmin(callerId))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
      }
      const { email, subject, message } = body
      if (!email || !subject || !message) {
        return new Response(JSON.stringify({ error: "email, subject, and message required" }), { status: 400, headers })
      }
      try {
        await sendEmail(email, subject, buildFollowUpEmailHtml(subject, message), "beta_followup")
        return new Response(JSON.stringify({ success: true }), { headers })
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error"
        return new Response(JSON.stringify({ error: "Failed to send email: " + errMsg }), { status: 500, headers })
      }
    }

    // Send new invitations (admin only)
    if (!callerId || !(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const emails: string[] = body.emails
    if (!Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "emails array required" }), { status: 400, headers })
    }
    if (emails.length > 50) {
      return new Response(JSON.stringify({ error: "Maximum 50 invitations per batch" }), { status: 400, headers })
    }

    const siteUrl = process.env.URL || "https://procuvex.com"
    const results: Array<{ email: string; status: string; error?: string }> = []

    for (const rawEmail of emails) {
      const email = sanitizeEmail(rawEmail)
      if (!email) {
        results.push({ email: rawEmail, status: "failed", error: "Invalid email" })
        continue
      }

      const { data: existing } = await supabase
        .from("beta_invitations")
        .select("id, status")
        .eq("email", email)
        .in("status", ["pending", "applied", "accepted"])
        .maybeSingle()

      if (existing) {
        results.push({ email, status: "skipped", error: `Already ${existing.status}` })
        continue
      }

      await supabase.from("beta_invitations").delete().eq("email", email).in("status", ["revoked", "expired", "declined"])

      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { error: insertErr } = await supabase.from("beta_invitations").insert({
        email, token, status: "pending", created_by: callerId, expires_at: expiresAt.toISOString(),
      })

      if (insertErr) {
        results.push({ email, status: "failed", error: insertErr.message })
        continue
      }

      const applyUrl = `${siteUrl}/beta/apply/${token}`

      try {
        const company = getCompanyFromEmail(email)
        const subjectLine = company
          ? `${company} + Procuvex — Founding Partner Invitation`
          : "Invitation: Procuvex Founding Partner Program"
        await sendEmail(
          email,
          subjectLine,
          buildInviteEmailHtml(applyUrl, email),
          "beta_invite"
        )
        results.push({ email, status: "sent" })
      } catch (emailErr: unknown) {
        const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error"
        results.push({ email, status: "sent_no_email", error: "Invite created but email failed: " + errMsg })
      }
    }

    const sentCount = results.filter(r => r.status === "sent" || r.status === "sent_no_email").length
    return new Response(JSON.stringify({ results, sent: sentCount, total: emails.length }), { headers })
  }

  // --- PUT: Apply (public), validate, claim, or request_access ---
  if (req.method === "PUT") {
    const body = await req.json()
    const { token, action } = body

    // Request beta access (public — no token needed)
    if (action === "request_access") {
      const { email: reqEmail, name: reqName, company: reqCompany, reason: reqReason } = body

      if (!reqEmail || typeof reqEmail !== "string") {
        return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers })
      }
      if (!reqName || typeof reqName !== "string") {
        return new Response(JSON.stringify({ error: "Name is required" }), { status: 400, headers })
      }

      const cleanEmail = sanitizeEmail(reqEmail)

      // Check for existing invitation/request
      const { data: existing } = await supabase
        .from("beta_invitations")
        .select("id, status")
        .eq("email", cleanEmail)
        .maybeSingle()

      if (existing) {
        if (existing.status === "accepted") {
          return new Response(JSON.stringify({ error: "This email already has an active invitation. Check your email for the signup link." }), { status: 400, headers })
        }
        if (existing.status === "applied" || existing.status === "pending") {
          return new Response(JSON.stringify({ error: "A request for this email is already under review." }), { status: 400, headers })
        }
        // If previously declined/revoked/expired, allow re-request by deleting old record
        await supabase.from("beta_invitations").delete().eq("id", existing.id)
      }

      const requestToken = generateToken()
      const noteParts: string[] = []
      if (reqCompany) noteParts.push(`Company: ${reqCompany}`)
      if (reqReason) noteParts.push(`Reason: ${reqReason}`)

      const { error: insertErr } = await supabase.from("beta_invitations").insert({
        email: cleanEmail,
        token: requestToken,
        status: "applied",
        applicant_name: reqName.trim(),
        notes: noteParts.length > 0 ? noteParts.join("\n") : null,
        agreed_at: new Date().toISOString(),
      })

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers })
      }

      // Send notification email to admin
      try {
        initSendGrid()
        await sgMail.default.send({
          to: "admin@core314.com",
          from: { email: "admin@core314.com", name: "Procuvex" },
          subject: `Beta Access Request: ${reqName.trim()} (${cleanEmail})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px;">
              <h2 style="color: #1e3a5f;">New Beta Access Request</h2>
              <p><strong>Name:</strong> ${reqName.trim()}</p>
              <p><strong>Email:</strong> ${cleanEmail}</p>
              ${reqCompany ? `<p><strong>Company:</strong> ${reqCompany}</p>` : ""}
              ${reqReason ? `<p><strong>Why they want access:</strong> ${reqReason}</p>` : ""}
              <p style="margin-top: 20px;"><a href="https://procuvex.com/admin/invites" style="background: #1e40af; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Review in Admin Panel</a></p>
            </div>
          `,
        })
      } catch { /* email notification is best-effort */ }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers })
    }

    // Apply — tester agrees to terms and submits application
    if (action === "apply") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite) {
        return new Response(JSON.stringify({ error: "Invalid invitation" }), { status: 400, headers })
      }
      if (invite.status !== "pending") {
        return new Response(JSON.stringify({ error: "This invitation has already been used" }), { status: 400, headers })
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await supabase.from("beta_invitations").update({ status: "expired" }).eq("id", invite.id)
        return new Response(JSON.stringify({ error: "Invitation expired" }), { status: 400, headers })
      }

      const applicantName = body.applicant_name || null

      const { error: updateErr } = await supabase.from("beta_invitations").update({
        status: "applied",
        agreed_at: new Date().toISOString(),
        applicant_name: applicantName,
      }).eq("id", invite.id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Validate token (for signup page)
    if (action === "validate") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid invitation" }), { headers })
      }
      if (invite.status !== "accepted") {
        return new Response(JSON.stringify({ valid: false, error: invite.status === "applied" ? "Application under review" : "Invitation not yet approved" }), { headers })
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: "Invitation expired" }), { headers })
      }

      return new Response(JSON.stringify({ valid: true, email: invite.email }), { headers })
    }

    // Claim — mark as used during signup
    if (action === "claim") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite || invite.status !== "accepted") {
        return new Response(JSON.stringify({ error: "Invalid or not yet approved invitation" }), { status: 400, headers })
      }

      // Don't update status — keep as "accepted" since that means they're in the program
      // The claimed_at is already set when admin accepted them

      return new Response(JSON.stringify({ success: true, email: invite.email }), { headers })
    }

    // Get info for apply page (public — just need token validity + email + seats)
    if (action === "info") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid invitation" }), { headers })
      }

      if (invite.status === "applied") {
        return new Response(JSON.stringify({ valid: false, error: "already_applied" }), { headers })
      }
      if (invite.status !== "pending") {
        return new Response(JSON.stringify({ valid: false, error: `Invitation status: ${invite.status}` }), { headers })
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await supabase.from("beta_invitations").update({ status: "expired" }).eq("id", invite.id)
        return new Response(JSON.stringify({ valid: false, error: "Invitation expired" }), { headers })
      }

      const acceptedCount = await getAcceptedCount()

      return new Response(JSON.stringify({
        valid: true,
        email: invite.email,
        seats: { total: MAX_BETA_SEATS, remaining: Math.max(0, MAX_BETA_SEATS - acceptedCount) }
      }), { headers })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers })
  }

  // --- PATCH: Resend, update notes (admin only) ---
  if (req.method === "PATCH") {
    const body = await req.json()
    const callerId = body.caller_id
    if (!callerId || !(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    if (body.action === "update_notes") {
      const { invite_id, notes } = body
      if (!invite_id) return new Response(JSON.stringify({ error: "invite_id required" }), { status: 400, headers })
      const { error } = await supabase.from("beta_invitations").update({ notes: notes || null }).eq("id", invite_id)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      return new Response(JSON.stringify({ success: true }), { headers })
    }

    if (body.action === "resend") {
      const { invite_id } = body
      if (!invite_id) return new Response(JSON.stringify({ error: "invite_id required" }), { status: 400, headers })

      const { data: invite } = await supabase.from("beta_invitations").select("*").eq("id", invite_id).single()
      if (!invite) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers })
      if (invite.status === "accepted") {
        return new Response(JSON.stringify({ error: "Cannot resend — already accepted" }), { status: 400, headers })
      }

      const newToken = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      await supabase.from("beta_invitations").update({
        token: newToken, status: "pending", expires_at: expiresAt.toISOString(), claimed_at: null, agreed_at: null,
      }).eq("id", invite_id)

      const siteUrl = process.env.URL || "https://procuvex.com"
      const applyUrl = `${siteUrl}/beta/apply/${newToken}`

      try {
        const company = getCompanyFromEmail(invite.email)
        const subjectLine = company
          ? `${company} + Procuvex — Founding Partner Invitation`
          : "Invitation: Procuvex Founding Partner Program"
        await sendEmail(invite.email, subjectLine, buildInviteEmailHtml(applyUrl, invite.email), "beta_invite")
        return new Response(JSON.stringify({ success: true, token: newToken }), { headers })
      } catch (emailErr: unknown) {
        const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error"
        return new Response(JSON.stringify({ success: true, token: newToken, warning: "Token reset but email failed: " + errMsg }), { headers })
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers })
  }

  // --- DELETE: Revoke or permanently delete (admin only) ---
  if (req.method === "DELETE") {
    const callerId = req.headers.get("x-user-id")
    if (!callerId || !(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const url = new URL(req.url)
    const inviteId = url.searchParams.get("id")
    const action = url.searchParams.get("action") || "revoke"

    if (!inviteId) return new Response(JSON.stringify({ error: "Invite id required" }), { status: 400, headers })

    if (inviteId === "bulk") {
      const ids = url.searchParams.get("ids")?.split(",") || []
      if (ids.length === 0) return new Response(JSON.stringify({ error: "ids required" }), { status: 400, headers })

      if (action === "delete") {
        await supabase.from("beta_invitations").delete().in("id", ids)
      } else {
        await supabase.from("beta_invitations").update({ status: "revoked" }).in("id", ids).in("status", ["pending", "applied"])
      }
      return new Response(JSON.stringify({ success: true, count: ids.length }), { headers })
    }

    if (action === "delete") {
      await supabase.from("beta_invitations").delete().eq("id", inviteId)
      return new Response(JSON.stringify({ success: true }), { headers })
    }

    await supabase.from("beta_invitations").update({ status: "revoked" }).eq("id", inviteId).in("status", ["pending", "applied"])
    return new Response(JSON.stringify({ success: true }), { headers })
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
}
