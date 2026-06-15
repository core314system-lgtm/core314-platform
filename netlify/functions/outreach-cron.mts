import type { Config, Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Outreach cron — runs every 10 min during the 6–8 AM Eastern window (10:00–12:00 UTC).
 * Each invocation sends as many emails as it can within a safe 8-minute budget.
 * Exits immediately once the daily 5,000 target is met.
 *
 * This avoids the previous single-run design that exceeded Netlify's function timeout.
 */

const DAILY_TARGET = 5000
const CONCURRENT_CALLS = 5
const BATCH_PER_CALL = 50
const MAX_RUNTIME_MS = 8 * 60 * 1000 // 8 min — safe margin under Netlify's 10/15 min limit

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

async function callSubOutreach(adminId: string): Promise<{ sent: number; remaining: number }> {
  try {
    const resp = await fetch("https://procuvex.com/.netlify/functions/sub-outreach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": adminId,
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({ action: "send-outreach", limit: BATCH_PER_CALL }),
      signal: AbortSignal.timeout(25000),
    })
    if (!resp.ok) {
      const text = await resp.text()
      console.log(`[outreach-cron] sub-outreach error: ${resp.status} ${text}`)
      return { sent: 0, remaining: 0 }
    }
    const data = await resp.json() as any
    return { sent: data.sent || 0, remaining: data.remaining_today || 0 }
  } catch (err: any) {
    console.log(`[outreach-cron] fetch error: ${err.message}`)
    return { sent: 0, remaining: 0 }
  }
}

export default async (_req: Request, _context: Context) => {
  const startTime = Date.now()
  console.log(`[outreach-cron] Starting outreach run`)

  const { data: admin } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("is_global_admin", true)
    .limit(1)
    .single()

  if (!admin) {
    console.log(`[outreach-cron] No global admin found`)
    return new Response(JSON.stringify({ error: "No admin user" }))
  }

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: sentToday } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .gte("outreach_sent_at", todayStart.toISOString())

  const alreadySent = sentToday || 0
  if (alreadySent >= DAILY_TARGET) {
    console.log(`[outreach-cron] Daily target already met (${alreadySent}/${DAILY_TARGET})`)
    return new Response(JSON.stringify({ message: "Daily target already met", sent_today: alreadySent }))
  }

  console.log(`[outreach-cron] Sent today: ${alreadySent}. Target: ${DAILY_TARGET}`)

  let totalSent = 0
  let consecutiveZeros = 0

  while (totalSent + alreadySent < DAILY_TARGET) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`[outreach-cron] Time budget reached. Sent ${totalSent} this run. Next invocation will continue.`)
      break
    }

    const promises = Array.from({ length: CONCURRENT_CALLS }, () => callSubOutreach(admin.id))
    const results = await Promise.all(promises)

    const batchSent = results.reduce((sum, r) => sum + r.sent, 0)
    totalSent += batchSent

    if (batchSent === 0) {
      consecutiveZeros++
      if (consecutiveZeros >= 3) {
        console.log(`[outreach-cron] 3 consecutive zero-sends. No more eligible recipients.`)
        break
      }
    } else {
      consecutiveZeros = 0
    }

    console.log(`[outreach-cron] Batch: +${batchSent} (total: ${totalSent + alreadySent}/${DAILY_TARGET})`)

    await new Promise(r => setTimeout(r, 1000))
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`[outreach-cron] Run complete. Sent: ${totalSent}, Duration: ${duration}s`)

  return new Response(JSON.stringify({
    sent: totalSent,
    total_today: alreadySent + totalSent,
    daily_target: DAILY_TARGET,
    duration_seconds: duration,
  }))
}

// Run every 10 min from 10:00–12:00 UTC (6:00–8:00 AM Eastern).
// Each invocation exits early once the daily target is met.
export const config: Config = {
  schedule: "*/10 10-11 * * *",
}
