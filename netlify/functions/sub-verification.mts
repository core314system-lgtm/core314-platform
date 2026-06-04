import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

async function verifyGlobalAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_global_admin")
    .eq("id", userId)
    .single()
  return data?.is_global_admin === true
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  const callerId = req.headers.get("x-user-id")
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  // --- GET: List pending verifications (admin only) ---
  if (req.method === "GET") {
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get("status") || "pending_verification"

    const { data, error } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, slug, state, city, contact_email, verification_status, trade_categories, small_business_types, claimed_at, profile_completeness")
      .eq("verification_status", status)
      .order("claimed_at", { ascending: true })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    // Also get their uploaded docs
    const subIds = (data || []).map(d => d.id)
    const { data: certs } = await supabase
      .from("master_sub_certifications")
      .select("*")
      .in("master_sub_id", subIds)

    return new Response(JSON.stringify({ subs: data, certifications: certs || [] }), { headers })
  }

  // --- POST: Upload document metadata (sub owner) ---
  if (req.method === "POST") {
    const body = await req.json()
    const { action } = body

    // Sub uploads a document reference
    if (action === "upload-doc") {
      const { sub_id, doc_type, doc_name, file_url, expiration_date } = body

      // Verify ownership
      const { data: sub } = await supabase
        .from("master_subcontractors")
        .select("id, claimed_by_user_id")
        .eq("id", sub_id)
        .single()

      if (!sub || sub.claimed_by_user_id !== callerId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers })
      }

      const { data: cert, error } = await supabase
        .from("master_sub_certifications")
        .insert({
          master_sub_id: sub_id,
          cert_type: doc_type,
          cert_name: doc_name,
          file_url,
          expiration_date: expiration_date || null,
          status: "pending_review",
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }

      return new Response(JSON.stringify({ certification: cert }), { headers })
    }

    // Sub requests verification (after uploading docs)
    if (action === "request-verification") {
      const { sub_id } = body

      const { data: sub } = await supabase
        .from("master_subcontractors")
        .select("id, claimed_by_user_id, verification_status")
        .eq("id", sub_id)
        .single()

      if (!sub || sub.claimed_by_user_id !== callerId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers })
      }

      // Check they have at least one document
      const { count } = await supabase
        .from("master_sub_certifications")
        .select("id", { count: "exact", head: true })
        .eq("master_sub_id", sub_id)

      if (!count || count === 0) {
        return new Response(JSON.stringify({ error: "Upload at least one document before requesting verification" }), { status: 400, headers })
      }

      await supabase
        .from("master_subcontractors")
        .update({ verification_status: "pending_verification" })
        .eq("id", sub_id)

      return new Response(JSON.stringify({ status: "pending_verification" }), { headers })
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers })
  }

  // --- PATCH: Admin approve/reject verification ---
  if (req.method === "PATCH") {
    if (!(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }

    const body = await req.json()
    const { sub_id, decision, notes } = body // decision: "approve" or "reject"

    if (!sub_id || !decision) {
      return new Response(JSON.stringify({ error: "sub_id and decision required" }), { status: 400, headers })
    }

    const { data: sub } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, verification_status")
      .eq("id", sub_id)
      .single()

    if (!sub) {
      return new Response(JSON.stringify({ error: "Sub not found" }), { status: 404, headers })
    }

    if (decision === "approve") {
      await supabase
        .from("master_subcontractors")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: callerId,
        })
        .eq("id", sub_id)

      // Update all their certs to approved
      await supabase
        .from("master_sub_certifications")
        .update({ status: "verified" })
        .eq("master_sub_id", sub_id)
        .eq("status", "pending_review")

      // Send congratulations email
      if (sub.contact_email) {
        initSendGrid()
        await sgMail.default.send({
          to: sub.contact_email,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          subject: `Congratulations! ${sub.company_name} is now Procuvex Verified`,
          html: buildVerifiedEmail(sub.company_name),
          customArgs: { email_type: "verification_approved" },
        })
      }
    } else if (decision === "reject") {
      await supabase
        .from("master_subcontractors")
        .update({ verification_status: "claimed" }) // revert to claimed
        .eq("id", sub_id)

      // Send rejection email with reason
      if (sub.contact_email) {
        initSendGrid()
        await sgMail.default.send({
          to: sub.contact_email,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          subject: `Verification Update for ${sub.company_name}`,
          html: buildRejectionEmail(sub.company_name, notes || "Additional documentation needed"),
          customArgs: { email_type: "verification_rejected" },
        })
      }
    }

    // Log the decision
    await supabase.from("master_sub_contact_log").insert({
      master_sub_id: sub_id,
      contact_type: `verification_${decision}`,
      contact_method: "system",
      subject: `Verification ${decision}`,
      notes: notes || `${decision} by admin`,
      sent_by: callerId,
    })

    return new Response(JSON.stringify({ status: decision === "approve" ? "verified" : "claimed" }), { headers })
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
}

function buildVerifiedEmail(companyName: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✓ Verified</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Procuvex Subcontractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
        <h2 style="color: #111827; margin: 0 0 16px;">Congratulations, ${companyName}!</h2>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Your company is now <strong>Procuvex Verified</strong>. Here's what this means:
        </p>
        <ul style="color: #374151; line-height: 2; font-size: 14px; padding-left: 20px;">
          <li><strong>Verified Badge</strong> — displayed on your profile and in all search results</li>
          <li><strong>Priority Placement</strong> — you appear first when primes search for your trades</li>
          <li><strong>Auto-Matching</strong> — automatically matched to relevant RFQs from prime contractors</li>
          <li><strong>Expiration Alerts</strong> — we'll notify you before certifications or insurance expires</li>
        </ul>
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://procuvex.com/my-sub-profile" style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            View Your Profile
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex — A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}

function buildRejectionEmail(companyName: string, reason: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e3a5f; border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Procuvex</h1>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
        <h2 style="color: #111827; margin: 0 0 16px;">Verification Update for ${companyName}</h2>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          We reviewed your verification submission and need a few more items before we can approve:
        </p>
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Please update your documents and resubmit. If you have questions, reply to this email.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="https://procuvex.com/my-sub-profile" style="background: #1e3a5f; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Update Your Profile
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Procuvex — A product of Core314 Technologies LLC</p>
      </div>
    </div>
  `
}
