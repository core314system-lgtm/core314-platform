import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  try {
    const body = await req.json()
    const { sow_subcontractor_ids, task_order_id, custom_message } = body

    if (!sow_subcontractor_ids?.length || !task_order_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    // Get task order details
    const { data: taskOrder } = await supabase
      .from("task_orders")
      .select("*")
      .eq("id", task_order_id)
      .single()

    if (!taskOrder) {
      return new Response(JSON.stringify({ error: "Task order not found" }), { status: 404 })
    }

    // Look up the sending organization's name
    let orgName = "Procuvex"
    if (taskOrder.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", taskOrder.org_id)
        .single()
      if (org?.name) orgName = org.name
    }

    // Get all sow_subcontractors with their SOW and subcontractor details
    const { data: sowSubs } = await supabase
      .from("sow_subcontractors")
      .select("*, subcontractors(*), sow_items(*)")
      .in("id", sow_subcontractor_ids)

    if (!sowSubs?.length) {
      return new Response(JSON.stringify({ error: "No matching records found" }), { status: 404 })
    }

    const siteUrl = process.env.URL || "https://procuvex.com"
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)

    // Fetch all documents for this task order
    const { data: allDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("task_order_id", task_order_id)
      .order("uploaded_at")

    const results: Array<{ sow_sub_id: string; status: string; error?: string }> = []

    for (const sowSub of sowSubs) {
      const sub = (sowSub as any).subcontractors
      const sow = (sowSub as any).sow_items

      if (!sub?.contact_email) {
        results.push({ sow_sub_id: sowSub.id, status: "skipped", error: "No contact email" })
        continue
      }

      // Generate unique token for portal access
      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 90) // 90 day expiry

      // Store token
      const { error: tokenErr } = await supabase.from("rfq_tokens").insert({
        token,
        sow_subcontractor_id: sowSub.id,
        sow_item_id: sow.id,
        task_order_id: task_order_id,
        subcontractor_id: sub.id,
        expires_at: expiresAt.toISOString(),
      })

      if (tokenErr) {
        results.push({ sow_sub_id: sowSub.id, status: "error", error: tokenErr.message })
        continue
      }

      const portalUrl = `${siteUrl}/portal/${token}`
      const dueDate = taskOrder.due_date
        ? new Date(taskOrder.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "TBD"

      // Get documents for this specific SOW + task-order-level docs
      const sowDocs = (allDocs || []).filter((d: any) => {
        const parts = d.file_path?.split("/") || []
        if (parts.length >= 3 && parts[1] === sow.id) return true // SOW-specific doc
        if (parts.length < 3) return true // Task-order-level doc
        return false
      })

      const docListHtml = sowDocs.length > 0
        ? `<div style="margin: 16px 0;">
            <h4 style="margin: 0 0 8px; font-size: 14px; color: #374151;">📎 Attached Documents & Flow-Downs</h4>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${sowDocs.map((d: any) => {
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/task-order-documents/${d.file_path}`
                const categoryLabel = d.category === "flowdown" ? "Flow-Down" : d.category === "site_info" ? "Site Info" : d.category === "exhibit" ? "Exhibit" : d.category === "amendment" ? "Amendment" : "SOW Document"
                return `<div style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                  <a href="${publicUrl}" style="color: #1e40af; text-decoration: none; font-weight: 500; font-size: 14px;">${d.file_name}</a>
                  <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">[${categoryLabel}]</span>
                </div>`
              }).join("")}
            </div>
            <p style="font-size: 12px; color: #6b7280; margin-top: 6px;">All documents are also available on your portal page.</p>
          </div>`
        : ""

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">Request for Quote</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">On behalf of ${orgName}</p>
          </div>
          
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Dear ${sub.contact_name || sub.company_name},</p>
            
            <p>You are invited to submit a quote for the following scope of work:</p>
            
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #1e40af;">${sow.sow_name}</h3>
              <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;">${sow.description || ""}</p>
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="padding: 4px 0; color: #6b7280;">Task Order:</td><td style="padding: 4px 0; font-weight: bold;">${taskOrder.title}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Site:</td><td style="padding: 4px 0;">${taskOrder.site_name || ""}, ${taskOrder.location_city || ""}, ${taskOrder.location_state || ""}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Category:</td><td style="padding: 4px 0;">${sow.service_category}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Response Due:</td><td style="padding: 4px 0; font-weight: bold; color: #dc2626;">${dueDate}</td></tr>
              </table>
            </div>

            ${custom_message ? `<div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0; font-size: 14px;"><strong>Note from the team:</strong><br/>${custom_message}</div>` : ""}
            
            ${docListHtml}
            
            <p>Please use the secure link below to review the full requirements${sowDocs.length > 0 ? ", download all documents" : ""}, submit your quote, and ask any questions:</p>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                View RFQ & Submit Quote
              </a>
            </div>
            
            <p style="font-size: 13px; color: #6b7280;">
              This link is unique to your organization. Please do not share it.<br/>
              If you have questions, you can submit them through the portal above or reply to this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              Delivered on behalf of ${orgName}<br/>
              Powered by Procuvex
            </p>
          </div>
        </div>
      `

      try {
        const [response] = await sgMail.default.send({
          to: sub.contact_email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@core314.com",
            name: orgName,
          },
          subject: `RFQ: ${sow.sow_name} — ${taskOrder.title}`,
          html: emailHtml,
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true },
          },
          customArgs: {
            sow_subcontractor_id: sowSub.id,
            rfq_token: token,
            task_order_id: task_order_id,
          },
        })

        // Log the email tracking event
        await supabase.from("email_tracking").insert({
          rfq_token_id: token,
          sow_subcontractor_id: sowSub.id,
          sendgrid_message_id: response?.headers?.["x-message-id"] || null,
          event_type: "sent",
          email_to: sub.contact_email,
          email_subject: `RFQ: ${sow.sow_name} — ${taskOrder.title}`,
        })

        // Update the sow_subcontractor status
        await supabase
          .from("sow_subcontractors")
          .update({
            outreach_status: "invited",
            rfq_sent_date: new Date().toISOString(),
            email_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sowSub.id)

        // Log communication
        await supabase.from("sow_communications").insert({
          sow_subcontractor_id: sowSub.id,
          comm_type: "rfq_sent",
          direction: "outbound",
          subject: `RFQ: ${sow.sow_name}`,
          body: `RFQ email sent to ${sub.contact_email}. Portal link: ${portalUrl}`,
        })

        results.push({ sow_sub_id: sowSub.id, status: "sent" })
      } catch (emailErr: any) {
        results.push({ sow_sub_id: sowSub.id, status: "error", error: emailErr.message })
      }
    }

    // Update SOW status if needed
    const sowIds = [...new Set(sowSubs.map((s: any) => s.sow_items?.id).filter(Boolean))]
    for (const sowId of sowIds) {
      const { data: sow } = await supabase.from("sow_items").select("status").eq("id", sowId).single()
      if (sow && (sow.status === "not_started" || sow.status === "subs_identified")) {
        await supabase.from("sow_items").update({ status: "rfqs_sent", updated_at: new Date().toISOString() }).eq("id", sowId)
      }
    }

    const sent = results.filter((r) => r.status === "sent").length
    return new Response(
      JSON.stringify({ success: true, sent, total: results.length, results }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }
}
