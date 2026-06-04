import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function initSendGrid() {
  sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

function buildOutreachEmail(companyName: string, claimUrl: string, tradeCategories: string[]): string {
  const trades = tradeCategories.slice(0, 3).join(", ") || "Government Contracting"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Procuvex</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Government Subcontractor Network</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
        <h2 style="color: #111827; margin: 0 0 16px; font-size: 20px;">Your Company Has Been Added to Procuvex</h2>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          We identified <strong>${companyName}</strong> as a qualified subcontractor in <strong>${trades}</strong> 
          based on your SAM.gov registration.
        </p>
        <p style="color: #374151; line-height: 1.6; font-size: 15px;">
          Your company profile has been created in the Procuvex network, where prime contractors 
          actively search for subcontractors for government contract opportunities.
        </p>
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #0c4a6e; margin: 0; font-size: 14px; font-weight: 600;">Why claim your profile?</p>
          <ul style="color: #0c4a6e; margin: 8px 0 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
            <li>Get matched with prime contractors looking for your trades</li>
            <li>Receive RFQ invitations directly from primes</li>
            <li>Showcase your certifications, insurance, and capabilities</li>
            <li>Increase visibility in subcontractor searches</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${claimUrl}" style="background: linear-gradient(135deg, #1e3a5f, #1e40af); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            Claim Your Profile
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center;">
          Claiming is free and takes less than 2 minutes. Your profile is already pre-populated 
          with your SAM.gov registration data.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Procuvex &mdash; A product of Core314 Technologies LLC<br/>
          You received this because your company is registered on SAM.gov.<br/>
          <a href="https://procuvex.com" style="color: #6b7280;">Visit Procuvex</a>
        </p>
      </div>
    </div>
  `
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const callerId = req.headers.get("x-user-id")
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  if (!(await verifyGlobalAdmin(callerId))) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers })
  }

  const body = await req.json()
  const { action } = body

  // --- ACTION: send-outreach ---
  // Send claim emails to unclaimed subs with email addresses
  if (action === "send-outreach") {
    initSendGrid()
    const { state, trade, limit: batchLimit } = body
    const maxBatch = Math.min(batchLimit || 50, 200) // cap at 200 per batch

    // Find unclaimed subs with email that haven't been contacted recently
    let query = supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, slug, trade_categories")
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(maxBatch)

    // Optional filters
    if (state) query = query.eq("state", state)
    if (trade) query = query.contains("trade_categories", [trade])

    // Exclude recently contacted (within 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)

    const { data: targets, error } = await query

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No eligible recipients found" }), { headers })
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const sub of targets) {
      try {
        // Generate claim token
        const token = generateToken()
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

        // Save token to DB
        await supabase
          .from("master_subcontractors")
          .update({
            claim_token: token,
            claim_token_expires_at: expiresAt.toISOString(),
            outreach_sent_at: new Date().toISOString(),
            outreach_email_count: (sub as any).outreach_email_count ? (sub as any).outreach_email_count + 1 : 1,
            last_outreach_email_at: new Date().toISOString(),
          })
          .eq("id", sub.id)

        // Send email
        const claimUrl = `https://procuvex.com/claim/${token}`
        const html = buildOutreachEmail(sub.company_name, claimUrl, sub.trade_categories || [])

        await sgMail.default.send({
          to: sub.contact_email!,
          from: { email: "team@procuvex.com", name: "Procuvex" },
          subject: `${sub.company_name} — Your Procuvex Profile Is Ready`,
          html,
          customArgs: { email_type: "sub_outreach" },
        })

        // Log the contact
        await supabase.from("master_sub_contact_log").insert({
          master_sub_id: sub.id,
          contact_type: "outreach_email",
          contact_method: "email",
          subject: "Profile claim invitation",
          notes: `Sent to ${sub.contact_email}`,
          sent_by: callerId,
        })

        sent++
      } catch (err: any) {
        failed++
        errors.push(`${sub.company_name}: ${err.message || "Unknown error"}`)
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: targets.length, errors: errors.slice(0, 5) }), { headers })
  }

  // --- ACTION: generate-tokens ---
  // Generate claim tokens without sending emails (for manual/future use)
  if (action === "generate-tokens") {
    const { ids } = body // array of sub IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "ids array required" }), { status: 400, headers })
    }

    let generated = 0
    for (const id of ids.slice(0, 500)) {
      const token = generateToken()
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const { error } = await supabase
        .from("master_subcontractors")
        .update({ claim_token: token, claim_token_expires_at: expiresAt.toISOString() })
        .eq("id", id)
        .is("claim_token", null) // only generate if not already set
      if (!error) generated++
    }

    return new Response(JSON.stringify({ generated, total: ids.length }), { headers })
  }

  // --- ACTION: preview ---
  // Preview outreach targets without sending
  if (action === "preview") {
    const { state, trade, limit: previewLimit } = body
    const maxPreview = Math.min(previewLimit || 50, 200)

    let query = supabase
      .from("master_subcontractors")
      .select("id, company_name, contact_email, state, trade_categories, outreach_sent_at", { count: "exact" })
      .is("claimed_at", null)
      .not("contact_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(maxPreview)

    if (state) query = query.eq("state", state)
    if (trade) query = query.contains("trade_categories", [trade])

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)

    const { data, count, error } = await query
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ targets: data, total: count }), { headers })
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers })
}
