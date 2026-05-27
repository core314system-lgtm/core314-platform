import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const { question_id, answer_text, share_with_all, user_id } = await req.json()

    if (!question_id || !answer_text?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders })
    }

    const status = share_with_all ? "shared" : "answered"

    const { data, error } = await supabase
      .from("subcontractor_questions")
      .update({
        answer_text: answer_text.trim(),
        answered_by: user_id || null,
        answered_at: new Date().toISOString(),
        status,
        shared_with_all: share_with_all || false,
      })
      .eq("id", question_id)
      .select("*, sow_subcontractors(*, subcontractors(*), sow_items(*))")
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }

    // Log communication
    const sub = (data as any)?.sow_subcontractors?.subcontractors
    const sow = (data as any)?.sow_subcontractors?.sow_items
    await supabase.from("sow_communications").insert({
      sow_subcontractor_id: data.sow_subcontractor_id,
      comm_type: "response",
      direction: "outbound",
      subject: `Answer to question${share_with_all ? " (shared with all)" : ""}`,
      body: answer_text.trim(),
      created_by: user_id || null,
    })

    // If sub was in questions_pending, update to reviewing
    const sowSub = (data as any)?.sow_subcontractors
    if (sowSub && sowSub.outreach_status === "questions_pending") {
      await supabase
        .from("sow_subcontractors")
        .update({ outreach_status: "reviewing", updated_at: new Date().toISOString() })
        .eq("id", data.sow_subcontractor_id)
    }

    // Send email notification to the subcontractor about the answer
    let emailSent = false
    const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
    if (sub?.contact_email && sendgridKey) {
      try {
        sgMail.default.setApiKey(sendgridKey)

        const sowName = sow?.sow_name || sow?.service_category || "your RFQ"
        const questionText = (data as any).question_text || ""

        // Get task order name and org name for context
        let taskOrderTitle = "the project"
        let orgName = "Procuvex"
        if (sow?.task_order_id) {
          const { data: to } = await supabase
            .from("task_orders")
            .select("title, org_id")
            .eq("id", sow.task_order_id)
            .single()
          if (to) {
            taskOrderTitle = to.title
            if (to.org_id) {
              const { data: org } = await supabase
                .from("organizations")
                .select("name")
                .eq("id", to.org_id)
                .single()
              if (org?.name) orgName = org.name
            }
          }
        }

        // Find portal URL for this sub
        let portalLink = ""
        const { data: tokenData } = await supabase
          .from("rfq_tokens")
          .select("token")
          .eq("sow_subcontractor_id", data.sow_subcontractor_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        if (tokenData?.token) {
          const siteUrl = process.env.URL || "https://procuvex.com"
          portalLink = `${siteUrl}/portal/${tokenData.token}`
        }

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">Your Question Has Been Answered</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">On behalf of ${orgName}</p>
            </div>
            
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p>Dear ${sub.contact_name || sub.company_name},</p>
              
              <p>Your question regarding <strong>${sowName}</strong> for <strong>${taskOrderTitle}</strong> has been answered.</p>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0;">
                <h4 style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Your Question</h4>
                <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">${questionText}</p>
                
                <h4 style="margin: 0 0 8px; color: #1e40af; font-size: 12px; text-transform: uppercase;">Answer</h4>
                <p style="margin: 0; font-size: 14px; color: #374151;">${answer_text.trim()}</p>
              </div>

              ${share_with_all ? '<p style="font-size: 13px; color: #6b7280; font-style: italic;">This answer has been shared with all invited subcontractors.</p>' : ""}
              
              ${portalLink ? `
              <div style="text-align: center; margin: 24px 0;">
                <a href="${portalLink}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  View on Portal
                </a>
              </div>
              ` : ""}
              
              <p style="font-size: 13px; color: #6b7280;">
                If you have additional questions, you can submit them through the portal or reply to this email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                Delivered on behalf of ${orgName}<br/>
                Powered by Procuvex
              </p>
            </div>
          </div>
        `

        await sgMail.default.send({
          to: sub.contact_email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "team@procuvex.com",
            name: orgName,
          },
          replyTo: { email: "admin@core314.com", name: "Procuvex Support" },
          subject: `Answer to your question — ${sowName}`,
          html: emailHtml,
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true },
          },
          customArgs: {
            sow_subcontractor_id: data.sow_subcontractor_id,
            question_id: question_id,
          },
        })

        emailSent = true
      } catch (emailErr: any) {
        // Log email failure but don't fail the overall request
        console.error("Failed to send answer notification email:", emailErr?.message || emailErr)
      }
    }

    return new Response(JSON.stringify({ success: true, question: data, email_sent: emailSent }), { headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
