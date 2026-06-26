import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const { task_order_id, distributions } = await req.json()

    if (!task_order_id || !distributions || !Array.isArray(distributions)) {
      return new Response(JSON.stringify({ error: "task_order_id and distributions array required" }), { status: 400, headers: corsHeaders })
    }

    // Get task order
    const { data: taskOrder } = await supabase
      .from("task_orders")
      .select("*")
      .eq("id", task_order_id)
      .single()

    if (!taskOrder) {
      return new Response(JSON.stringify({ error: "Task order not found" }), { status: 404, headers: corsHeaders })
    }

    let orgName = "Procuvex"
    if (taskOrder.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", taskOrder.org_id)
        .single()
      if (org?.name) orgName = org.name
    }

    const siteUrl = process.env.URL || "https://procuvex.com"
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)

    let sent = 0

    for (const dist of distributions) {
      if (!dist.contact_email) continue

      // Find sub's portal token
      const { data: tokenData } = await supabase
        .from("rfq_tokens")
        .select("token")
        .eq("subcontractor_id", dist.subcontractor_id)
        .eq("task_order_id", task_order_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      const portalUrl = tokenData ? `${siteUrl}/portal/${tokenData.token}` : null

      const qaHtml = dist.qa_pairs.map((qa: any, i: number) => `
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 8px 0; background: #f9fafb;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #1f2937; font-size: 14px;">
            ${qa.govt_qa.question_number ? `${qa.govt_qa.question_number}: ` : ''}${qa.govt_qa.question_text}
          </p>
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 8px 12px; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #065f46;">${qa.govt_qa.answer_text}</p>
          </div>
          ${qa.admin_note ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;"><em>Note from team: ${qa.admin_note}</em></p>` : ''}
        </div>
      `).join("")

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">📋 Government Q&A Response</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${taskOrder.title}</p>
          </div>
          
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Dear ${dist.company_name},</p>
            
            <p>The government has issued responses to questions submitted for this project. Below are the answers relevant to <strong>your</strong> questions:</p>
            
            ${qaHtml}
            
            <div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
              <strong>Action:</strong> Please review these responses carefully. If any answers affect your pricing or scope, you may submit a revised quote through your portal. If you have follow-up questions, you can submit them through the portal as well.
            </div>

            ${portalUrl ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                View on Your Portal
              </a>
            </div>
            <p style="font-size: 13px; color: #6b7280; text-align: center;">
              Your portal link remains active for all updates, questions, and quote revisions.
            </p>
            ` : ""}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              Delivered on behalf of ${orgName}<br/>
              Powered by Procuvex
            </p>
          </div>
        </div>
      `

      try {
        await sgMail.default.send({
          to: dist.contact_email,
          from: {
            email: "noreply@procuvex.com",
            name: orgName,
          },
          subject: `Q&A Response: ${taskOrder.title} — ${dist.qa_pairs.length} answer${dist.qa_pairs.length !== 1 ? 's' : ''} to your questions`,
          html: emailHtml,
          text: htmlToPlainText(emailHtml),
          trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
        })
        sent++
      } catch (emailErr: any) {
        console.error(`Failed to send Q&A response to ${dist.contact_email}:`, emailErr.message)
      }
    }

    return new Response(JSON.stringify({ success: true, sent, total: distributions.length }), { headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
