import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit, rateLimitResponse } from "./_shared/rate-limiter.ts"
import { sanitizeEmail, isValidUUID } from "./_shared/sanitize.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    const { email, org_id, role, invited_by_name, org_name } = body

    if (!email || !org_id || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers })
    }

    if (!isValidUUID(org_id)) {
      return new Response(JSON.stringify({ error: "Invalid organization ID" }), { status: 400, headers })
    }

    const cleanEmail = sanitizeEmail(email)
    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), { status: 400, headers })
    }

    // Rate limit invitations
    const rl = await checkRateLimit(org_id, "email")
    if (!rl.allowed) return rateLimitResponse(rl, "invitations")

    // Check if already a member
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", cleanEmail)
      .single()

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("org_id", org_id)
        .eq("user_id", existingProfile.id)
        .single()

      if (existingMember) {
        return new Response(JSON.stringify({ error: "This user is already a member of your organization." }), { status: 400, headers })
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from("org_invitations")
      .select("id")
      .eq("org_id", org_id)
      .eq("email", cleanEmail)
      .eq("status", "pending")
      .single()

    if (existingInvite) {
      return new Response(JSON.stringify({ error: "An invitation is already pending for this email." }), { status: 400, headers })
    }

    // Generate token and create invitation
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error: insertErr } = await supabase.from("org_invitations").insert({
      org_id,
      email: cleanEmail,
      role,
      token,
      invited_by: body.invited_by_id,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Failed to create invitation: " + insertErr.message }), { status: 500, headers })
    }

    // Send email via SendGrid
    const siteUrl = process.env.URL || "https://procuvex.com"
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)

    const signupUrl = `${siteUrl}/login?invite=${token}`
    const roleLabel = role === "admin" ? "Admin" : role === "viewer" ? "Viewer" : "Member"

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">You're Invited to Procuvex</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">AI-Powered Procurement Intelligence</p>
        </div>
        
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #111827;">Hi there,</p>
          
          <p style="color: #374151;">${invited_by_name || "A team member"} has invited you to join <strong>${org_name || "their organization"}</strong> on Procuvex as a <strong>${roleLabel}</strong>.</p>
          
          <p style="color: #374151;">Procuvex is an AI-powered procurement intelligence platform that helps teams analyze documents, generate compliance matrices, manage subcontractors, and streamline bid processes.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${signupUrl}" style="background: #1e40af; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 13px; color: #6b7280;">This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Delivered on behalf of ${org_name || "your organization"} &mdash; Powered by Procuvex
          </p>
        </div>
      </div>
    `

    try {
      await sgMail.default.send({
        to: email.trim(),
        from: {
          email: "noreply@core314.com",
          name: "Procuvex",
        },
        subject: `You're invited to join ${org_name || "Procuvex"}`,
        html: emailHtml,
      })
    } catch (emailErr: unknown) {
      // Email failed but invitation was created — still return success
      const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error"
      return new Response(JSON.stringify({
        success: true,
        warning: "Invitation created but email delivery failed: " + errMsg,
        signup_url: signupUrl,
      }), { headers })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Invitation sent to ${email}`,
    }), { headers })

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers })
  }
}
