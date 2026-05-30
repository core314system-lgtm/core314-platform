import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

type ServiceStatus = "operational" | "degraded" | "outage"

interface ServiceCheck {
  status: ServiceStatus
  latency_ms: number
  message?: string
}

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
    const latency = Date.now() - start
    if (error) return { status: "degraded", latency_ms: latency, message: error.message }
    if (latency > 5000) return { status: "degraded", latency_ms: latency, message: "Slow response" }
    return { status: "operational", latency_ms: latency }
  } catch (err) {
    return { status: "outage", latency_ms: Date.now() - start, message: err instanceof Error ? err.message : "Connection failed" }
  }
}

async function checkAuth(): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.auth.getUser("00000000-0000-0000-0000-000000000000")
    const latency = Date.now() - start
    // Auth returns an error for a fake user ID, but the service is reachable if we get any response
    if (error && error.message.includes("fetch")) {
      return { status: "outage", latency_ms: latency, message: "Auth service unreachable" }
    }
    return { status: "operational", latency_ms: latency }
  } catch (err) {
    return { status: "outage", latency_ms: Date.now() - start, message: err instanceof Error ? err.message : "Auth check failed" }
  }
}

async function checkSamGov(): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    const res = await fetch("https://sam.gov/api/prod/sgs/v1/search/?index=opp&mode=search&size=1&q=test", {
      signal: AbortSignal.timeout(10000),
    })
    const latency = Date.now() - start
    if (!res.ok) return { status: "degraded", latency_ms: latency, message: `HTTP ${res.status}` }
    if (latency > 8000) return { status: "degraded", latency_ms: latency, message: "Slow response" }
    return { status: "operational", latency_ms: latency }
  } catch (err) {
    return { status: "outage", latency_ms: Date.now() - start, message: err instanceof Error ? err.message : "SAM.gov unreachable" }
  }
}

async function checkOpenAI(): Promise<ServiceCheck> {
  const start = Date.now()
  const apiKey = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
  if (!apiKey) return { status: "degraded", latency_ms: 0, message: "API key not configured" }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    const latency = Date.now() - start
    if (res.status === 401) return { status: "degraded", latency_ms: latency, message: "Invalid API key" }
    if (!res.ok) return { status: "degraded", latency_ms: latency, message: `HTTP ${res.status}` }
    return { status: "operational", latency_ms: latency }
  } catch (err) {
    return { status: "outage", latency_ms: Date.now() - start, message: err instanceof Error ? err.message : "OpenAI unreachable" }
  }
}

async function checkStripe(): Promise<ServiceCheck> {
  const start = Date.now()
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.TASKORDER_STRIPE_SECRET_KEY
  if (!stripeKey) return { status: "degraded", latency_ms: 0, message: "Stripe key not configured" }
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${stripeKey}` },
      signal: AbortSignal.timeout(10000),
    })
    const latency = Date.now() - start
    if (res.status === 401) return { status: "degraded", latency_ms: latency, message: "Invalid API key" }
    if (!res.ok) return { status: "degraded", latency_ms: latency, message: `HTTP ${res.status}` }
    return { status: "operational", latency_ms: latency }
  } catch (err) {
    return { status: "outage", latency_ms: Date.now() - start, message: err instanceof Error ? err.message : "Stripe unreachable" }
  }
}

function overallStatus(services: Record<string, ServiceCheck>): ServiceStatus {
  const statuses = Object.values(services).map((s) => s.status)
  if (statuses.includes("outage")) return "outage"
  if (statuses.includes("degraded")) return "degraded"
  return "operational"
}

export default async (req: Request, _context: Context) => {
  const startTime = Date.now()

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  // Run all checks in parallel
  const [database, auth, samGov, openai, stripe] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkSamGov(),
    checkOpenAI(),
    checkStripe(),
  ])

  const services = { database, auth, sam_gov: samGov, openai, stripe }
  const status = overallStatus(services)
  const totalLatency = Date.now() - startTime

  // Determine if caller wants detailed info (admin) or summary (public)
  const url = new URL(req.url)
  const detailed = url.searchParams.get("detailed") === "true"

  const publicResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    response_time_ms: totalLatency,
    services: Object.fromEntries(
      Object.entries(services).map(([key, val]) => [
        key,
        { status: val.status, latency_ms: val.latency_ms },
      ])
    ),
  }

  const response = detailed
    ? { ...publicResponse, services }
    : publicResponse

  return new Response(JSON.stringify(response), {
    status: status === "operational" ? 200 : status === "degraded" ? 200 : 503,
    headers: corsHeaders,
  })
}
