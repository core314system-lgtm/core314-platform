import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const body = await req.json()
  const { sub_id } = body

  if (!sub_id) {
    return new Response(JSON.stringify({ error: "sub_id required" }), { status: 400, headers })
  }

  // Look up the sub details
  const { data: sub, error } = await supabase
    .from("master_subcontractors")
    .select("company_name, city, state, contact_email, trade_categories, claimed_at")
    .eq("id", sub_id)
    .single()

  if (error || !sub) {
    return new Response(JSON.stringify({ error: "Sub not found" }), { status: 404, headers })
  }

  // Send notification email to admin
  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
  if (!sendgridKey) {
    return new Response(JSON.stringify({ error: "SendGrid not configured" }), { status: 500, headers })
  }

  sgMail.default.setApiKey(sendgridKey)

  const trades = sub.trade_categories?.slice(0, 3).join(", ") || "N/A"
  const location = [sub.city, sub.state].filter(Boolean).join(", ") || "N/A"

  try {
    await sgMail.default.send({
      to: "admin@core314.com",
      from: { email: "team@procuvex.com", name: "Procuvex Notifications" },
      subject: `🎉 ${sub.company_name} just claimed their profile!`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px;">
            <h2 style="color: #166534; margin: 0 0 16px; font-size: 18px;">New Profile Claim</h2>
            <table style="width: 100%; font-size: 14px; color: #374151;">
              <tr><td style="padding: 6px 0; font-weight: 600; width: 100px;">Company:</td><td>${sub.company_name}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600;">Location:</td><td>${location}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600;">Trades:</td><td>${trades}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td>${sub.contact_email || "N/A"}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600;">Claimed:</td><td>${new Date(sub.claimed_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</td></tr>
            </table>
            <div style="margin-top: 16px; text-align: center;">
              <a href="https://procuvex.com/master-subs" style="background: #059669; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
                View in Dashboard
              </a>
            </div>
          </div>
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
            Procuvex Outreach Notification &mdash; ${new Date().toLocaleDateString()}
          </p>
        </div>
      `,
    })

    // Also create in-app notification (for all org owners — uses a general approach)
    // Get all orgs to notify (admin sees all claims)
    const { data: orgs } = await supabase.from("organizations").select("id").limit(10)
    if (orgs) {
      for (const org of orgs) {
        await supabase.from("notifications").insert({
          org_id: org.id,
          type: "profile_claimed",
          title: `${sub.company_name} claimed their profile`,
          message: `${location} · Trades: ${trades}`,
          link: "/master-subs",
          read: false,
          metadata: {},
        }).catch(() => {})
      }
    }

    return new Response(JSON.stringify({ sent: true }), { headers })
  } catch (err: any) {
    console.error("Notification email error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
