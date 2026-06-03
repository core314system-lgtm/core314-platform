import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit, rateLimitResponse } from "./_shared/rate-limiter.ts"

const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

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
    const { modification_id, task_order_id } = await req.json()
    if (!modification_id || !task_order_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    // Get modification details
    const { data: mod } = await supabase
      .from("project_modifications")
      .select("*")
      .eq("id", modification_id)
      .single()

    if (!mod) {
      return new Response(JSON.stringify({ error: "Modification not found" }), { status: 404 })
    }

    // Get task order
    const { data: taskOrder } = await supabase
      .from("task_orders")
      .select("*")
      .eq("id", task_order_id)
      .single()

    if (!taskOrder) {
      return new Response(JSON.stringify({ error: "Task order not found" }), { status: 404 })
    }

    // Rate limit
    if (taskOrder.org_id) {
      const rl = await checkRateLimit(taskOrder.org_id, "email")
      if (!rl.allowed) return rateLimitResponse(rl, "modification notifications")
    }

    // Get org name
    let orgName = "Procuvex"
    if (taskOrder.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", taskOrder.org_id)
        .single()
      if (org?.name) orgName = org.name
    }

    // Get SOW items to determine affected scope
    const affectedSowIds = mod.affected_sow_ids?.length > 0
      ? mod.affected_sow_ids
      : null

    // Get sow_subcontractors with active outreach
    let query = supabase
      .from("sow_subcontractors")
      .select("*, subcontractors(*), sow_items(*)")
      .in("outreach_status", ["invited", "reviewing", "questions_pending", "quote_submitted"])

    if (affectedSowIds) {
      query = query.in("sow_item_id", affectedSowIds)
    } else {
      // Get all SOW IDs for this task order
      const { data: allSows } = await supabase
        .from("sow_items")
        .select("id")
        .eq("task_order_id", task_order_id)
      if (allSows) {
        query = query.in("sow_item_id", allSows.map(s => s.id))
      }
    }

    const { data: sowSubs } = await query

    if (!sowSubs || sowSubs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, total: 0, message: "No active subcontractors to notify" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      })
    }

    // Deduplicate by subcontractor (one email per sub, not per SOW)
    const subMap = new Map<string, { sub: any; sowSubs: any[]; sow_names: string[] }>()
    for (const ss of sowSubs) {
      const sub = (ss as any).subcontractors
      const sow = (ss as any).sow_items
      if (!sub?.contact_email) continue

      const existing = subMap.get(sub.id)
      if (existing) {
        existing.sowSubs.push(ss)
        if (sow) existing.sow_names.push(sow.sow_name)
      } else {
        subMap.set(sub.id, {
          sub,
          sowSubs: [ss],
          sow_names: sow ? [sow.sow_name] : [],
        })
      }
    }

    const siteUrl = process.env.URL || "https://procuvex.com"
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY!)

    let sent = 0
    const total = subMap.size

    for (const [, entry] of subMap) {
      const { sub, sowSubs: subSowSubs, sow_names } = entry

      // Find the sub's portal token
      const { data: tokenData } = await supabase
        .from("rfq_tokens")
        .select("token")
        .eq("subcontractor_id", sub.id)
        .eq("task_order_id", task_order_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      const portalUrl = tokenData
        ? `${siteUrl}/portal/${tokenData.token}`
        : null

      const effectiveDateStr = mod.effective_date
        ? new Date(mod.effective_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "Immediately"

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #d97706; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">⚠️ Amendment Notice</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${taskOrder.title}</p>
          </div>
          
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Dear ${sub.contact_name || sub.company_name},</p>
            
            <p>A modification has been issued for the project you are quoting on. Please review the details below:</p>
            
            <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #92400e;">${mod.modification_number}: ${mod.title}</h3>
              ${mod.description ? `<p style="margin: 0 0 8px; font-size: 14px; color: #78350f;">${mod.description}</p>` : ""}
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="padding: 4px 0; color: #92400e;">Effective:</td><td style="padding: 4px 0; font-weight: bold;">${effectiveDateStr}</td></tr>
                <tr><td style="padding: 4px 0; color: #92400e;">Affected Scope:</td><td style="padding: 4px 0;">${sow_names.join(", ") || "All scopes"}</td></tr>
              </table>
            </div>
            
            <div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
              <strong>Action Required:</strong> Please review the updated documents on your portal and revise your quote if this modification affects your pricing or scope. If you have already submitted a quote, you may submit a revised quote through the portal.
            </div>

            ${portalUrl ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}" style="display: inline-block; background: #d97706; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Review Amendment & Update Quote
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
          to: sub.contact_email,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@core314.com",
            name: orgName,
          },
          subject: `⚠️ Amendment Notice: ${mod.modification_number} — ${taskOrder.title}`,
          html: emailHtml,
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true },
          },
        })

        // Log communications for each SOW assignment
        for (const ss of subSowSubs) {
          await supabase.from("sow_communications").insert({
            sow_subcontractor_id: ss.id,
            comm_type: "follow_up",
            direction: "outbound",
            subject: `Amendment Notice: ${mod.modification_number}`,
            body: `Notified about modification "${mod.title}". ${portalUrl ? `Portal: ${portalUrl}` : ""}`,
          })
        }

        sent++
      } catch (emailErr: any) {
        console.error(`Failed to send to ${sub.contact_email}:`, emailErr.message)
      }
    }

    // Update modification notification status
    await supabase
      .from("project_modifications")
      .update({
        notification_status: sent === total ? "sent" : sent > 0 ? "partial" : "pending",
        affected_subcontractor_ids: Array.from(subMap.keys()),
      })
      .eq("id", modification_id)

    return new Response(
      JSON.stringify({ success: true, sent, total }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }
}
