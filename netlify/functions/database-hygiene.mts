import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import dns from "dns"
import { promisify } from "util"

const resolveMx = promisify(dns.resolveMx) as (hostname: string) => Promise<Array<{ exchange: string; priority: number }>>

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
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
  // Handle scheduled invocation (Netlify cron sends POST with no body or specific body)
  const isScheduled = req.headers.get("x-nf-event") === "schedule" ||
                      req.headers.get("user-agent")?.includes("Netlify")

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  // If not a scheduled run, require admin auth
  if (!isScheduled) {
    const callerId = req.headers.get("x-user-id")
    if (!callerId || !(await verifyGlobalAdmin(callerId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers })
    }
  }

  let body: { action?: string } = {}
  try { body = await req.json() } catch { /* scheduled invocations may have empty body */ }
  const action = body.action || "full-cycle"

  const results: Record<string, any> = {}

  try {
    // Run requested action(s)
    if (action === "full-cycle" || action === "domain-check") {
      results.domain_check = await runDomainMxCheck()
    }
    if (action === "full-cycle" || action === "decay-scoring") {
      results.decay_scoring = await runDecayScoring()
    }
    if (action === "full-cycle" || action === "sam-expiry") {
      results.sam_expiry = await runSamExpiryCheck()
    }
    if (action === "full-cycle" || action === "auto-archive") {
      results.auto_archive = await runAutoArchive()
    }
    if (action === "full-cycle" || action === "engagement-decay") {
      results.engagement_decay = await runEngagementDecay()
    }
    if (action === "archive-no-email") {
      results.archive_no_email = await archiveNoEmailRecords()
    }
    if (action === "stats") {
      results.stats = await getDatabaseHealthStats()
    }

    return new Response(JSON.stringify({ success: true, ...results }), { headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}

/**
 * DOMAIN MX CHECK
 * Verify email domains have valid MX records.
 * Dead domains (no MX) → immediate permanent delete.
 */
async function runDomainMxCheck() {
  // Get unique email domains from subs that haven't been checked recently
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: subs } = await supabase
    .from("master_subcontractors")
    .select("id, contact_email")
    .not("contact_email", "is", null)
    .or(`domain_checked_at.is.null,domain_checked_at.lt.${sevenDaysAgo}`)
    .limit(500)

  if (!subs || subs.length === 0) return { checked: 0, purged: 0 }

  // Extract unique domains
  const domainMap = new Map<string, string[]>() // domain → [sub_ids]
  for (const sub of subs) {
    const email = (sub.contact_email || "").toLowerCase()
    const domain = email.split("@")[1]
    if (!domain) continue
    if (!domainMap.has(domain)) domainMap.set(domain, [])
    domainMap.get(domain)!.push(sub.id)
  }

  let purged = 0
  let valid = 0
  const deadDomains: string[] = []

  for (const [domain, subIds] of domainMap) {
    // Skip known-good large providers
    const skipDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "comcast.net", "att.net", "msn.com", "live.com", "mail.com"]
    if (skipDomains.includes(domain)) {
      valid += subIds.length
      // Mark as checked
      await supabase
        .from("master_subcontractors")
        .update({ domain_checked_at: new Date().toISOString() })
        .in("id", subIds)
      continue
    }

    try {
      await resolveMx(domain)
      valid += subIds.length
      await supabase
        .from("master_subcontractors")
        .update({ domain_checked_at: new Date().toISOString() })
        .in("id", subIds)
    } catch {
      // No MX record — domain is dead
      deadDomains.push(domain)
      purged += subIds.length

      // Delete all subs with this dead domain
      for (const id of subIds) {
        const sub = subs.find(s => s.id === id)
        await supabase.from("master_subcontractors").delete().eq("id", id)
        await logHygieneAction(id, sub?.contact_email || "", "dead_domain_delete", `Domain ${domain} has no MX record`)
      }
    }
  }

  return { checked: subs.length, domains_checked: domainMap.size, valid, purged, dead_domains: deadDomains.slice(0, 20) }
}

/**
 * DECAY SCORING
 * Apply time-based decay to data_health_score for records with no recent engagement.
 * -5 points for each 30-day period with no positive signal.
 */
async function runDecayScoring() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Records with no engagement in 30+ days: -5
  const { data: stale30 } = await supabase
    .from("master_subcontractors")
    .select("id, data_health_score")
    .or(`last_engagement_at.is.null,last_engagement_at.lt.${thirtyDaysAgo}`)
    .or(`email_verified_at.is.null,email_verified_at.lt.${thirtyDaysAgo}`)
    .gt("data_health_score", 0)
    .limit(2000)

  let decayed = 0
  if (stale30) {
    for (const sub of stale30) {
      const newScore = Math.max(0, (sub.data_health_score || 50) - 5)
      await supabase
        .from("master_subcontractors")
        .update({ data_health_score: newScore })
        .eq("id", sub.id)
      decayed++
    }
  }

  // Records with outreach sent but NEVER opened (3+ emails): -10 penalty
  const { data: neverOpened } = await supabase
    .from("master_subcontractors")
    .select("id, data_health_score, outreach_email_count")
    .is("last_engagement_at", null)
    .gte("outreach_email_count", 3)
    .gt("data_health_score", 10)
    .limit(1000)

  let noEngagementPenalized = 0
  if (neverOpened) {
    for (const sub of neverOpened) {
      const newScore = Math.max(0, (sub.data_health_score || 50) - 10)
      await supabase
        .from("master_subcontractors")
        .update({ data_health_score: newScore })
        .eq("id", sub.id)
      noEngagementPenalized++
    }
  }

  return { decayed, no_engagement_penalized: noEngagementPenalized }
}

/**
 * SAM.GOV EXPIRATION CHECK
 * Records with expired SAM registration get a health score penalty.
 * Expired 6+ months with no engagement → archive.
 */
async function runSamExpiryCheck() {
  const now = new Date().toISOString()
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

  // Find records with SAM expiration dates in the past
  const { data: expired } = await supabase
    .from("master_subcontractors")
    .select("id, data_health_score, sam_expiration_date, last_engagement_at")
    .not("sam_expiration_date", "is", null)
    .lt("sam_expiration_date", now)
    .eq("archived", false)
    .limit(1000)

  let penalized = 0
  let archived = 0

  if (expired) {
    for (const sub of expired) {
      const expiredLongAgo = sub.sam_expiration_date < sixMonthsAgo
      const noEngagement = !sub.last_engagement_at

      if (expiredLongAgo && noEngagement) {
        // Expired 6+ months + no engagement → archive
        await supabase
          .from("master_subcontractors")
          .update({ archived: true, archived_at: now, archive_reason: "sam_expired_no_engagement" })
          .eq("id", sub.id)
        archived++
      } else {
        // Recently expired → penalize score
        const newScore = Math.max(0, (sub.data_health_score || 50) - 10)
        await supabase
          .from("master_subcontractors")
          .update({ data_health_score: newScore })
          .eq("id", sub.id)
        penalized++
      }
    }
  }

  return { expired_found: expired?.length || 0, penalized, archived }
}

/**
 * AUTO-ARCHIVE
 * Records with data_health_score at or below 0 → soft-archived.
 * Archived records are excluded from search and outreach.
 */
async function runAutoArchive() {
  const { data: zeroed } = await supabase
    .from("master_subcontractors")
    .select("id, contact_email, data_health_score")
    .lte("data_health_score", 0)
    .eq("archived", false)
    .limit(1000)

  let archived = 0
  if (zeroed) {
    for (const sub of zeroed) {
      await supabase
        .from("master_subcontractors")
        .update({ archived: true, archived_at: new Date().toISOString(), archive_reason: "health_score_zero" })
        .eq("id", sub.id)
      await logHygieneAction(sub.id, sub.contact_email || "", "auto_archive", `Health score: ${sub.data_health_score}`)
      archived++
    }
  }

  return { archived }
}

/**
 * ENGAGEMENT DECAY CLOCK
 * 3+ outreach attempts over 60+ days with zero engagement → archive.
 */
async function runEngagementDecay() {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: dead } = await supabase
    .from("master_subcontractors")
    .select("id, contact_email")
    .gte("outreach_email_count", 3)
    .lt("outreach_sent_at", sixtyDaysAgo)
    .is("last_engagement_at", null)
    .eq("archived", false)
    .is("claimed_at", null)
    .limit(1000)

  let archived = 0
  if (dead) {
    for (const sub of dead) {
      await supabase
        .from("master_subcontractors")
        .update({ archived: true, archived_at: new Date().toISOString(), archive_reason: "no_engagement_3_attempts" })
        .eq("id", sub.id)
      await logHygieneAction(sub.id, sub.contact_email || "", "engagement_decay_archive", "3+ outreach attempts, 60+ days, zero engagement")
      archived++
    }
  }

  return { archived }
}

/**
 * DATABASE HEALTH STATS
 * Returns comprehensive health metrics for the admin dashboard.
 */
async function getDatabaseHealthStats() {
  const { count: total } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })

  const { count: archived } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .eq("archived", true)

  const { count: active } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .eq("archived", false)

  const { count: withEmail } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .not("contact_email", "is", null)
    .eq("archived", false)

  const { count: claimed } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .not("claimed_at", "is", null)

  const { count: highHealth } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .gte("data_health_score", 70)
    .eq("archived", false)

  const { count: medHealth } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .gte("data_health_score", 30)
    .lt("data_health_score", 70)
    .eq("archived", false)

  const { count: lowHealth } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .lt("data_health_score", 30)
    .eq("archived", false)

  const { count: engaged } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .not("last_engagement_at", "is", null)
    .eq("archived", false)

  const { count: samExpired } = await supabase
    .from("master_subcontractors")
    .select("*", { count: "exact", head: true })
    .not("sam_expiration_date", "is", null)
    .lt("sam_expiration_date", new Date().toISOString())
    .eq("archived", false)

  // Recent hygiene actions (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentActions } = await supabase
    .from("database_hygiene_log")
    .select("action")
    .gte("performed_at", sevenDaysAgo)

  const actionCounts: Record<string, number> = {}
  if (recentActions) {
    for (const a of recentActions) {
      actionCounts[a.action] = (actionCounts[a.action] || 0) + 1
    }
  }

  // Suppression list size
  const { count: suppressed } = await supabase
    .from("email_suppression_list")
    .select("*", { count: "exact", head: true })

  return {
    total: total || 0,
    active: active || 0,
    archived: archived || 0,
    with_email: withEmail || 0,
    claimed: claimed || 0,
    engaged: engaged || 0,
    sam_expired: samExpired || 0,
    suppressed: suppressed || 0,
    health_distribution: {
      high: highHealth || 0,
      medium: medHealth || 0,
      low: lowHealth || 0,
    },
    recent_actions_7d: actionCounts,
    data_quality_score: active
      ? Math.round(((highHealth || 0) / (active || 1)) * 100)
      : 0,
  }
}

/**
 * ARCHIVE NO-EMAIL RECORDS
 * Archive all records that have no email address — they're unreachable.
 * Uses direct SQL via RPC to bypass Supabase JS client query builder issues
 * that cause .is("column", null) to silently return 0 rows in Netlify's runtime.
 */
async function archiveNoEmailRecords() {
  // Use RPC to run archival directly in the database — most reliable approach
  const { data, error } = await supabase.rpc("archive_no_email_records", { batch_limit: 20000 })

  if (error) {
    // Fallback: try direct update if RPC doesn't exist yet
    if (error.code === "PGRST202" || error.message?.includes("Could not find")) {
      return await archiveNoEmailFallback()
    }
    return { archived: 0, error: error.message }
  }

  // Log the action
  if (data && data > 0) {
    await supabase.from("database_hygiene_log").insert({
      master_sub_id: null,
      email: "",
      action: "archive_no_email_bulk",
      reason: `Bulk archived ${data} records with no email address`,
      performed_at: new Date().toISOString(),
    }).catch(() => {})
  }

  // Count remaining
  const { count: remaining } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .filter("contact_email", "is", "null")
    .eq("archived", false)

  return { archived: data || 0, remaining: remaining || 0 }
}

/**
 * Fallback archive method if the RPC function hasn't been created yet.
 * Uses .filter() instead of .is() to work around Netlify runtime issues.
 */
async function archiveNoEmailFallback() {
  let archived = 0
  const batchSize = 1000
  const maxBatches = 20
  let batches = 0

  while (batches < maxBatches) {
    // Use .filter() with string "null" — more reliable than .is(col, null) in Netlify
    const { data: subs, error: queryError } = await supabase
      .from("master_subcontractors")
      .select("id")
      .filter("contact_email", "is", "null")
      .eq("archived", false)
      .limit(batchSize)

    if (queryError) return { archived, error: `SELECT failed: ${queryError.message}` }
    if (!subs || subs.length === 0) break

    const ids = subs.map(s => s.id)
    const { data: updated, error: updateError } = await supabase
      .from("master_subcontractors")
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: "no_email_address",
      })
      .in("id", ids)
      .select("id")

    if (updateError) return { archived, error: `UPDATE failed: ${updateError.message}` }
    // Count actually updated rows, not just IDs we tried
    archived += updated ? updated.length : 0
    batches++

    // If update returned fewer rows than expected, something is blocking
    if (updated && updated.length === 0 && subs.length > 0) {
      return { archived, error: `UPDATE returned 0 rows despite ${subs.length} matching records — likely RLS blocking writes. Service role key may not be configured.` }
    }
  }

  if (archived > 0) {
    await supabase.from("database_hygiene_log").insert({
      master_sub_id: null,
      email: "",
      action: "archive_no_email_bulk",
      reason: `Bulk archived ${archived} records with no email address (fallback method)`,
      performed_at: new Date().toISOString(),
    }).catch(() => {})
  }

  const { count: remaining } = await supabase
    .from("master_subcontractors")
    .select("id", { count: "exact", head: true })
    .filter("contact_email", "is", "null")
    .eq("archived", false)

  return { archived, remaining: remaining || 0 }
}

async function logHygieneAction(subId: string, email: string, action: string, reason: string) {
  await supabase.from("database_hygiene_log").insert({
    master_sub_id: subId,
    email,
    action,
    reason,
    performed_at: new Date().toISOString(),
  }).catch(() => {})
}
