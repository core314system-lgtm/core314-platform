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

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  // --- GET: List all invitations (global admin only) ---
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
      .select("id, email, token, status, created_at, claimed_at, expires_at, created_by")
      .order("created_at", { ascending: false })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ invites: invites || [] }), { headers })
  }

  // --- POST: Send new invitation(s) (global admin only) ---
  if (req.method === "POST") {
    const body = await req.json()
    const callerId = body.caller_id
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
    }
    if (!(await verifyGlobalAdmin(callerId))) {
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
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)

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

      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30-day expiration

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

      // Send invitation email
      const signupUrl = `${siteUrl}/login?beta_invite=${token}`

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af, #4338ca); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">You're Invited to Beta Test Procuvex</h1>
            <p style="margin: 12px 0 0; opacity: 0.9; font-size: 15px;">AI-Powered Procurement Intelligence Platform</p>
          </div>
          
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background: #ffffff;">
            <p style="font-size: 16px; color: #111827; margin-top: 0;">Hi there,</p>
            
            <p style="color: #374151; line-height: 1.6;">You've been selected to join the <strong>Procuvex Beta Program</strong>. As a beta tester, you'll get early access to our AI-powered procurement intelligence platform that helps teams analyze documents, generate compliance matrices, manage subcontractors, and streamline bid processes.</p>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; font-size: 14px; color: #0c4a6e;"><strong>What you get as a beta tester:</strong></p>
              <ul style="margin: 8px 0 0; padding-left: 20px; color: #0369a1; font-size: 14px; line-height: 1.8;">
                <li>7-day free trial with full platform access</li>
                <li>Exclusive beta tester discount on subscription plans</li>
                <li>Direct line to our development team for feedback</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signupUrl}" style="background: linear-gradient(135deg, #1e40af, #4338ca); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Create Your Beta Account
              </a>
            </div>
            
            <p style="font-size: 13px; color: #6b7280;">This invitation is personal and expires in 30 days. If you didn't expect this email, you can safely ignore it.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Procuvex &mdash; A product of Core314 Technologies LLC
            </p>
          </div>
        </div>
      `

      try {
        await sgMail.default.send({
          to: email,
          from: { email: "noreply@core314.com", name: "Procuvex" },
          subject: "You're Invited to Beta Test Procuvex",
          html: emailHtml,
          customArgs: { email_type: "beta_invite" },
        })
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
      // Check if token is valid and pending
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
      // Mark invitation as accepted
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

  // --- DELETE: Revoke an invitation (global admin only) ---
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
    if (!inviteId) {
      return new Response(JSON.stringify({ error: "Invite id required" }), { status: 400, headers })
    }

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
