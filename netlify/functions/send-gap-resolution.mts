import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { quote_id, gaps, pricing_gaps, deadline, custom_message, sender_name } = body

    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id required" }), { status: 400, headers: corsHeaders })
    }

    // Fetch quote + sub + SOW + task order
    const { data: quote, error: quoteErr } = await supabase
      .from("sow_quotes")
      .select("*, sow_items(id, sow_name, task_order_id), subcontractors(id, company_name, contact_email, contact_name)")
      .eq("id", quote_id)
      .single()

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404, headers: corsHeaders })
    }

    const sow = quote.sow_items
    const sub = quote.subcontractors

    if (!sub?.contact_email) {
      return new Response(JSON.stringify({ error: "Subcontractor has no contact email" }), { status: 400, headers: corsHeaders })
    }

    const { data: taskOrder } = await supabase
      .from("task_orders")
      .select("title, site_name, solicitation_number")
      .eq("id", sow.task_order_id)
      .single()

    // Get portal URL
    const { data: tokenData } = await supabase
      .from("rfq_tokens")
      .select("token")
      .eq("subcontractor_id", sub.id || quote.subcontractor_id)
      .eq("sow_item_id", sow.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    const portalUrl = tokenData
      ? `https://procuvex.com/portal/${tokenData.token}?revise=true`
      : "https://procuvex.com"

    const allGaps = gaps || []
    const allPricingGaps = pricing_gaps || []
    const deadlineStr = deadline
      ? new Date(deadline).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "5 business days"

    const gapItems = allGaps
      .map((g: string) => `<li style="margin: 6px 0; color: #991b1b; font-size: 13px;">${g}</li>`)
      .join("")
    const pricingItems = allPricingGaps
      .map((g: string) => `<li style="margin: 6px 0; color: #92400e; font-size: 13px;">${g}</li>`)
      .join("")

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="color: white; font-size: 20px; margin: 0;">Clarification Request</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Quote Compliance Review — Action Required</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
            Dear <strong>${sub.contact_name || sub.company_name}</strong>,
          </p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
            Thank you for your quote submission for <strong>${sow.sow_name}</strong> at <strong>${taskOrder?.site_name || taskOrder?.title || "the project"}</strong>${taskOrder?.solicitation_number ? ` (Solicitation: ${taskOrder.solicitation_number})` : ""}.
          </p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
            During our evaluation, the following items were identified as requiring clarification or amendment in your quote. Per <strong>FAR 15.306</strong> evaluation procedures, we are providing you the opportunity to address these items.
          </p>

          ${allGaps.length > 0 ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <strong style="color: #991b1b; font-size: 14px;">SOW Requirements Requiring Clarification (${allGaps.length})</strong>
            </div>
            <ol style="margin: 0; padding-left: 20px;">${gapItems}</ol>
          </div>
          ` : ""}

          ${allPricingGaps.length > 0 ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <strong style="color: #92400e; font-size: 14px;">Pricing Items Requiring Detail (${allPricingGaps.length})</strong>
            </div>
            <ol style="margin: 0; padding-left: 20px;">${pricingItems}</ol>
          </div>
          ` : ""}

          ${custom_message ? `
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <strong style="color: #0c4a6e; font-size: 13px;">Additional Notes from the Evaluation Team:</strong>
            <p style="color: #0c4a6e; font-size: 13px; margin: 8px 0 0;">${custom_message}</p>
          </div>
          ` : ""}

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #334155; font-size: 14px; margin: 0;">
              <strong>Response Deadline:</strong> ${deadlineStr}
            </p>
            <p style="color: #64748b; font-size: 12px; margin: 8px 0 0;">
              Please submit a revised quote addressing the items above by the deadline. Late responses may not be considered in the final evaluation.
            </p>
          </div>

          <div style="text-align: center; margin: 24px 0 16px;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Submit Revised Quote →
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
            This clarification request was sent through Procuvex, a procurement management platform.
            <br/>Questions? Reply directly to this email.
          </p>
        </div>
      </div>
    `

    const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
    if (!sendgridKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: corsHeaders })
    }

    sgMail.default.setApiKey(sendgridKey)
    await sgMail.default.send({
      to: sub.contact_email,
      from: { email: "team@procuvex.com", name: "Procuvex" },
      replyTo: { email: "admin@core314.com", name: sender_name || "Evaluation Team" },
      subject: `Clarification Request: ${sow.sow_name} — ${taskOrder?.site_name || "Project"}`,
      html,
    })

    // Log communication
    await supabase.from("sow_communications").insert({
      sow_subcontractor_id: quote.sow_subcontractor_id,
      comm_type: "clarification",
      direction: "outbound",
      subject: `Clarification Request — ${allGaps.length + allPricingGaps.length} items requiring response by ${deadlineStr}`,
      body: `Prime sent clarification request to ${sub.company_name} for ${sow.sow_name}. Gaps: ${allGaps.length}, Pricing items: ${allPricingGaps.length}. Deadline: ${deadlineStr}.${custom_message ? ` Additional notes: ${custom_message}` : ""}`,
    })

    return new Response(
      JSON.stringify({ success: true, email_sent_to: sub.contact_email }),
      { headers: corsHeaders }
    )
  } catch (err: any) {
    console.error("Gap resolution error:", err)
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: corsHeaders }
    )
  }
}
