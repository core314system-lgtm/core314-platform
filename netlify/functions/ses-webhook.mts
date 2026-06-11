import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const action = url.searchParams.get("t")
  const emailB64 = url.searchParams.get("e")
  const redirectUrl = url.searchParams.get("u")

  if (!action || !emailB64) {
    return new Response("OK", { status: 200 })
  }

  const email = safeBase64Decode(emailB64)
  if (!email) {
    return new Response("OK", { status: 200 })
  }

  // Process event in the background — don't block the response
  const eventPromise = handleEvent(action, email, redirectUrl)

  if (action === "click" && redirectUrl) {
    const decoded = safeBase64Decode(redirectUrl)
    // Ensure we record the event before redirecting
    await eventPromise
    if (decoded) {
      return new Response(null, {
        status: 302,
        headers: { Location: decoded },
      })
    }
    return new Response("OK", { status: 200 })
  }

  if (action === "open") {
    // Fire-and-forget the event recording, return pixel immediately
    eventPromise.catch(() => {})
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    })
  }

  await eventPromise
  return new Response("OK", { status: 200 })
}

async function handleEvent(action: string, email: string, _redirectUrl: string | null) {
  try {
    const normalizedEmail = email.toLowerCase().trim()

    const { data: sub } = await supabase
      .from("master_subcontractors")
      .select("id, data_health_score, last_engagement_at, engagement_open_count, engagement_click_count")
      .eq("contact_email", normalizedEmail)
      .single()

    if (!sub) return

    const now = new Date().toISOString()

    if (action === "open") {
      const newScore = Math.min(100, (sub.data_health_score || 50) + 10)
      await supabase
        .from("master_subcontractors")
        .update({
          data_health_score: newScore,
          last_engagement_at: now,
          engagement_open_count: (sub.engagement_open_count || 0) + 1,
        })
        .eq("id", sub.id)
    }

    if (action === "click") {
      const newScore = Math.min(100, (sub.data_health_score || 50) + 20)
      await supabase
        .from("master_subcontractors")
        .update({
          data_health_score: newScore,
          last_engagement_at: now,
          engagement_click_count: (sub.engagement_click_count || 0) + 1,
        })
        .eq("id", sub.id)
    }
  } catch (err) {
    console.error("SES webhook event error:", err)
  }
}

function safeBase64Decode(str: string): string | null {
  try {
    return Buffer.from(str, "base64").toString("utf-8")
  } catch {
    return null
  }
}
