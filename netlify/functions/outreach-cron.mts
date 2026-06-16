import type { Config, Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Outreach cron — runs every 10 min during the 6–8 AM Eastern window (10:00–12:00 UTC).
 * Each invocation sends emails SEQUENTIALLY (one batch at a time) to prevent race conditions.
 * Exits immediately once the daily target is met.
 *
 * Uses a warmup schedule to build domain reputation:
 *   Day 1-4:  500/day   (restarting warmup on outreach.procuvex.com subdomain)
 *   Day 5-8:  1000/day
 *   Day 9-12: 2000/day
 *   Day 13-16: 3000/day
 *   Day 17+:  5000/day
 *
 * WARMUP_START_DATE env var controls when the warmup began (ISO date string).
 * If not set, defaults to 5000/day (no warmup).
 */

const MAX_DAILY_TARGET = 5000
const CONCURRENT_CALLS = 1 // Sequential to prevent race conditions and duplicate sends
const BATCH_PER_CALL = 10 // Small batch so each call completes well within timeout
const MAX_RUNTIME_MS = 8 * 60 * 1000 // 8 min — safe margin under Netlify's 10/15 min limit

const WARMUP_SCHEDULE = [
  { days: 4,  limit: 500 },
  { days: 8,  limit: 1000 },
  { days: 12, limit: 2000 },
  { days: 16, limit: 3000 },
]

function getDailyTarget(): number {
  const startDate = process.env.WARMUP_START_DATE
  if (!startDate) return MAX_DAILY_TARGET

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return MAX_DAILY_TARGET

  const now = new Date()
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))

  for (const tier of WARMUP_SCHEDULE) {
    if (daysSinceStart < tier.days) return tier.limit
  }

  return MAX_DAILY_TARGET
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

async function callSubOutreach(adminId: string, dailyTarget: number): Promise<{ sent: number; remaining: number }> {
  try {
    const resp = await fetch("https://procuvex.com/.netlify/functions/sub-outreach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": adminId,
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({ action: "send-outreach", limit: BATCH_PER_CALL, warmup_daily_limit: dailyTarget }),
      signal: AbortSignal.timeout(60000), // 60s — enough for 10 emails at ~3s each
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
  const dailyTarget = getDailyTarget()
  console.log(`[outreach-cron] Starting outreach run (daily target: ${dailyTarget})`)

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
  if (alreadySent >= dailyTarget) {
    console.log(`[outreach-cron] Daily target already met (${alreadySent}/${dailyTarget})`)
    return new Response(JSON.stringify({ message: "Daily target already met", sent_today: alreadySent, daily_target: dailyTarget }))
  }

  console.log(`[outreach-cron] Sent today: ${alreadySent}. Target: ${dailyTarget}`)

  let totalSent = 0
  let consecutiveZeros = 0

  while (totalSent + alreadySent < dailyTarget) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`[outreach-cron] Time budget reached. Sent ${totalSent} this run. Next invocation will continue.`)
      break
    }

    const promises = Array.from({ length: CONCURRENT_CALLS }, () => callSubOutreach(admin.id, dailyTarget))
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

    console.log(`[outreach-cron] Batch: +${batchSent} (total: ${totalSent + alreadySent}/${dailyTarget})`)

    await new Promise(r => setTimeout(r, 1000))
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`[outreach-cron] Run complete. Sent: ${totalSent}, Duration: ${duration}s`)

  return new Response(JSON.stringify({
    sent: totalSent,
    total_today: alreadySent + totalSent,
    daily_target: dailyTarget,
    duration_seconds: duration,
  }))
}

// Run every 10 min from 10:00–12:00 UTC (6:00–8:00 AM Eastern).
// Each invocation exits early once the daily target is met.
export const config: Config = {
  schedule: "*/10 10-11 * * *",
}
