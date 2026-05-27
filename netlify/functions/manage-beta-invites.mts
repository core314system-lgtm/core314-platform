import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { sanitizeEmail } from "./_shared/sanitize.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

function buildInviteEmailHtml(signupUrl: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Private Beta Invitation</p>
        <h1 style="margin: 0; font-size: 26px; font-weight: bold; line-height: 1.3;">You've Been Selected for<br/>the Procuvex Beta Program</h1>
        <p style="margin: 14px 0 0; opacity: 0.85; font-size: 14px;">AI-Powered Procurement Intelligence for Complex Bid &amp; Subcontractor Workflows</p>
      </div>
      
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">You've been hand-selected to join a limited group of procurement professionals testing Procuvex before public launch.</p>
        
        <p style="color: #374151; line-height: 1.7; font-size: 15px;">Procuvex was built from real-world federal procurement and multi-site facility management operations. It's designed for teams managing complex solicitations, subcontractor coordination, and compliance-heavy bid processes &mdash; the kind of work where manual spreadsheets and disconnected tools cost you time and wins. <a href="https://procuvex.com" style="color: #1e40af; text-decoration: underline;">Learn more at procuvex.com</a></p>

        <div style="background: #fefce8; border-left: 4px solid #ca8a04; border-radius: 4px; padding: 14px 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #854d0e; font-weight: 600;">What Procuvex helps you do:</p>
          <ul style="margin: 8px 0 0; padding-left: 18px; color: #713f12; font-size: 14px; line-height: 2;">
            <li>Cut proposal prep time with AI-powered document analysis</li>
            <li>Find and qualify subcontractors faster</li>
            <li>Identify compliance gaps automatically</li>
            <li>Centralize task order and bid management</li>
            <li>Eliminate manual spreadsheet workflows</li>
          </ul>
        </div>
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #0c4a6e; font-weight: 600;">As a founding beta tester, you receive:</p>
          <ul style="margin: 0; padding-left: 18px; color: #0369a1; font-size: 14px; line-height: 2;">
            <li>Complimentary full-platform access during the beta period</li>
            <li><strong>25% lifetime discount</strong> on your chosen plan upon completion of the beta program</li>
            <li>Direct access to the development team for feedback</li>
            <li>Early influence on platform direction and features</li>
          </ul>
        </div>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #374151; font-weight: 600;">What we ask from beta testers:</p>
          <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.7;">We're looking for procurement professionals willing to actively test workflows and provide feedback during the beta period. Upload at least one project, explore the core features, and share what works and what doesn't. Complete the beta program guidelines and your 25% lifetime discount is yours. Your input directly shapes what we build next.</p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${signupUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 16px 44px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; letter-spacing: 0.3px;">
            Activate Beta Access
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #9ca3af;">Limited beta cohort &mdash; spots are not guaranteed</p>
        </div>
        
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">This invitation is personal and non-transferable. It expires in 30 days. If you didn't expect this email, you can safely ignore it.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Procuvex &mdash; Built for government contractors, procurement teams, and subcontractor-driven operations.<br/>
          A product of Core314 Technologies LLC
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
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Procuvex Beta Program</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
        <div style="color: #374151; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">${message}</div>
        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="https://procuvex.com/login" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Log In to Procuvex
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Procuvex &mdash; A product of Core314 Technologies LLC
        </p>
      </div>
    </div>
  `
}

async function sendInviteEmail(email: string, signupUrl: string): Promise<void> {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
  await sgMail.default.send({
    to: email,
    from: { email: "noreply@core314.com", name: "Procuvex" },
    subject: "Private Beta Invitation — You've Been Selected for Procuvex",
    html: buildInviteEmailHtml(signupUrl),
    customArgs: { email_type: "beta_invite" },
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
    const callerId = req.headers.get("x-user-id")
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const { data: invites, error } = await supabase
      .from("beta_invitations")
      .select("id, email, token, status, created_at, claimed_at, expires_at, created_by, notes")
      .order("created_at", { ascending: false })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    // For accepted invitations, fetch tester activity data
    const acceptedEmails = (invites || []).filter(i => i.status === "accepted").map(i => i.email)
    let testerActivity: Record<string, { last_sign_in_at: string | null; created_at: string; project_count: number }> = {}

    if (acceptedEmails.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("email, last_sign_in_at, created_at")
        .in("email", acceptedEmails)

      if (profiles) {
        for (const p of profiles) {
          testerActivity[p.email] = {
            last_sign_in_at: p.last_sign_in_at,
            created_at: p.created_at,
            project_count: 0,
          }
        }
      }

      // Get project counts per user
      const { data: projectCounts } = await supabase
        .from("user_profiles")
        .select("email, current_org_id")
        .in("email", acceptedEmails)

      if (projectCounts) {
        for (const pc of projectCounts) {
          if (pc.current_org_id) {
            const { count } = await supabase
              .from("projects")
              .select("id", { count: "exact", head: true })
              .eq("org_id", pc.current_org_id)

            if (count !== null && testerActivity[pc.email]) {
              testerActivity[pc.email].project_count = count
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ invites: invites || [], testerActivity }), { headers })
  }

  // --- POST: Send new invitation(s) or follow-up email (global admin only) ---
  if (req.method === "POST") {
    const body = await req.json()
    const callerId = body.caller_id
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    // Follow-up email action
    if (body.action === "follow_up") {
      const { email, subject, message } = body
      if (!email || !subject || !message) {
        return new Response(JSON.stringify({ error: "email, subject, and message required" }), { status: 400, headers })
      }
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
      try {
        await sgMail.default.send({
          to: email,
          from: { email: "noreply@core314.com", name: "Procuvex" },
          subject,
          html: buildFollowUpEmailHtml(subject, message),
          customArgs: { email_type: "beta_followup" },
        })
        return new Response(JSON.stringify({ success: true }), { headers })
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error"
        return new Response(JSON.stringify({ error: "Failed to send email: " + errMsg }), { status: 500, headers })
      }
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

      // Check for existing pending/accepted invitation
      const { data: existing } = await supabase
        .from("beta_invitations")
        .select("id, status")
        .eq("email", email)
        .in("status", ["pending", "accepted"])
        .maybeSingle()

      if (existing) {
        results.push({ email, status: "skipped", error: `Already ${existing.status}` })
        continue
      }

      // Delete any old revoked/expired invitations for this email so the new one is clean
      await supabase
        .from("beta_invitations")
        .delete()
        .eq("email", email)
        .in("status", ["revoked", "expired"])

      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { error: insertErr } = await supabase.from("beta_invitations").insert({
        email,
        token,
        status: "pending",
        created_by: callerId,
        expires_at: expiresAt.toISOString(),
      })

      if (insertErr) {
        results.push({ email, status: "failed", error: insertErr.message })
        continue
      }

      const signupUrl = `${siteUrl}/login?beta_invite=${token}`

      try {
        await sendInviteEmail(email, signupUrl)
        results.push({ email, status: "sent" })
      } catch (emailErr: unknown) {
        const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error"
        results.push({ email, status: "sent_no_email", error: "Invite created but email failed: " + errMsg })
      }
    }

    const sentCount = results.filter(r => r.status === "sent" || r.status === "sent_no_email").length
    return new Response(JSON.stringify({ results, sent: sentCount, total: emails.length }), { headers })
  }

  // --- PUT: Validate/claim a beta invite token (used during signup) ---
  if (req.method === "PUT") {
    const { token, action } = await req.json()

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers })
    }

    if (action === "validate") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid invitation" }), { headers })
      }

      if (invite.status !== "pending") {
        return new Response(JSON.stringify({ valid: false, error: "Invitation already used" }), { headers })
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await supabase.from("beta_invitations").update({ status: "expired" }).eq("id", invite.id)
        return new Response(JSON.stringify({ valid: false, error: "Invitation expired" }), { headers })
      }

      return new Response(JSON.stringify({ valid: true, email: invite.email }), { headers })
    }

    if (action === "claim") {
      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status, expires_at")
        .eq("token", token)
        .single()

      if (!invite || invite.status !== "pending") {
        return new Response(JSON.stringify({ error: "Invalid or already used invitation" }), { status: 400, headers })
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await supabase.from("beta_invitations").update({ status: "expired" }).eq("id", invite.id)
        return new Response(JSON.stringify({ error: "Invitation expired" }), { status: 400, headers })
      }

      const { error: updateErr } = await supabase
        .from("beta_invitations")
        .update({ status: "accepted", claimed_at: new Date().toISOString() })
        .eq("id", invite.id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ success: true, email: invite.email }), { headers })
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'validate' or 'claim'" }), { status: 400, headers })
  }

  // --- PATCH: Resend invitation or update notes (global admin only) ---
  if (req.method === "PATCH") {
    const body = await req.json()
    const callerId = body.caller_id
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    // Update notes
    if (body.action === "update_notes") {
      const { invite_id, notes } = body
      if (!invite_id) {
        return new Response(JSON.stringify({ error: "invite_id required" }), { status: 400, headers })
      }
      const { error } = await supabase
        .from("beta_invitations")
        .update({ notes: notes || null })
        .eq("id", invite_id)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }
      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Resend invitation
    if (body.action === "resend") {
      const { invite_id } = body
      if (!invite_id) {
        return new Response(JSON.stringify({ error: "invite_id required" }), { status: 400, headers })
      }

      const { data: invite } = await supabase
        .from("beta_invitations")
        .select("id, email, status")
        .eq("id", invite_id)
        .single()

      if (!invite) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), { status: 404, headers })
      }

      if (invite.status === "accepted") {
        return new Response(JSON.stringify({ error: "Cannot resend — already accepted" }), { status: 400, headers })
      }

      // Generate new token and reset to pending with fresh expiration
      const newToken = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { error: updateErr } = await supabase
        .from("beta_invitations")
        .update({
          token: newToken,
          status: "pending",
          expires_at: expiresAt.toISOString(),
          claimed_at: null,
        })
        .eq("id", invite_id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers })
      }

      const siteUrl = process.env.URL || "https://procuvex.com"
      const signupUrl = `${siteUrl}/login?beta_invite=${newToken}`

      try {
        await sendInviteEmail(invite.email, signupUrl)
        return new Response(JSON.stringify({ success: true, token: newToken }), { headers })
      } catch (emailErr: unknown) {
        const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error"
        return new Response(JSON.stringify({ success: true, token: newToken, warning: "Token reset but email failed: " + errMsg }), { headers })
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers })
  }

  // --- DELETE: Revoke or permanently delete an invitation (global admin only) ---
  if (req.method === "DELETE") {
    const callerId = req.headers.get("x-user-id")
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const url = new URL(req.url)
    const inviteId = url.searchParams.get("id")
    const action = url.searchParams.get("action") || "revoke"

    if (!inviteId) {
      return new Response(JSON.stringify({ error: "Invite id required" }), { status: 400, headers })
    }

    // Bulk delete/revoke
    if (inviteId === "bulk") {
      const ids = url.searchParams.get("ids")?.split(",") || []
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "ids parameter required for bulk operations" }), { status: 400, headers })
      }

      if (action === "delete") {
        const { error } = await supabase
          .from("beta_invitations")
          .delete()
          .in("id", ids)
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
        }
      } else {
        const { error } = await supabase
          .from("beta_invitations")
          .update({ status: "revoked" })
          .in("id", ids)
          .in("status", ["pending"])
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
        }
      }
      return new Response(JSON.stringify({ success: true, count: ids.length }), { headers })
    }

    if (action === "delete") {
      // Permanent delete
      const { error } = await supabase
        .from("beta_invitations")
        .delete()
        .eq("id", inviteId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }
      return new Response(JSON.stringify({ success: true }), { headers })
    }

    // Default: revoke (only pending)
    const { error } = await supabase
      .from("beta_invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .eq("status", "pending")

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ success: true }), { headers })
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
}
