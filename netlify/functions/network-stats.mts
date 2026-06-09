import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Public API: Network Statistics
 * Returns aggregate counts for the subcontractor network — total subs,
 * category breakdown, state coverage, SBA certifications.
 * No authentication required (public marketing data).
 *
 * GET /api/network-stats
 * GET /api/network-stats?detail=categories
 * GET /api/network-stats?detail=states
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.TASKORDER_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || ""

const TRADE_CATEGORIES: Record<string, string> = {
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  fire_safety: "Fire & Life Safety",
  elevator: "Elevator & Escalator",
  janitorial: "Janitorial & Custodial",
  landscaping: "Landscaping & Grounds",
  snow_removal: "Snow & Ice Removal",
  pest_control: "Pest Control",
  roofing: "Roofing",
  painting: "Painting & Coatings",
  flooring: "Flooring",
  security: "Security Systems",
  general_construction: "General Construction",
  demolition: "Demolition",
  concrete: "Concrete & Masonry",
  structural_steel: "Structural Steel",
  environmental: "Environmental Services",
  waste_management: "Waste Management",
  it_telecom: "IT & Telecommunications",
  building_automation: "Building Automation",
  generator: "Emergency Power",
  dock_equipment: "Dock & Loading Equipment",
  glass_glazing: "Glass & Glazing",
  insulation: "Insulation",
  drywall: "Drywall & Framing",
  mechanical: "Mechanical Services",
  welding: "Welding & Metal Work",
  paving: "Paving & Asphalt",
  fencing: "Fencing",
  signage: "Signage",
  food_services: "Food Services",
  moving_logistics: "Moving & Logistics",
  furniture: "Furniture & Installation",
  engineering: "Engineering Services",
  architectural: "Architectural Services",
  surveying: "Surveying & Geotechnical",
  abatement: "Abatement",
  waterproofing: "Waterproofing",
  fire_protection: "Fire Protection",
  testing_inspection: "Testing & Inspection",
  staffing: "Staffing & Labor",
  consulting: "Consulting",
  training: "Training",
  other: "Other Services",
}

export default async (req: Request, _context: Context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // cache 5 min
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const url = new URL(req.url)
  const detail = url.searchParams.get("detail")

  try {
    // Always get total count
    const { count: totalCount } = await supabase
      .from("master_subcontractors")
      .select("*", { count: "exact", head: true })

    const { count: withEmail } = await supabase
      .from("master_subcontractors")
      .select("*", { count: "exact", head: true })
      .not("contact_email", "is", null)

    const { count: smallBiz } = await supabase
      .from("master_subcontractors")
      .select("*", { count: "exact", head: true })
      .eq("small_business", true)

    const { count: verified } = await supabase
      .from("master_subcontractors")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "verified")

    const { count: claimed } = await supabase
      .from("master_subcontractors")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "claimed")

    const base = {
      total: totalCount || 0,
      contactable: withEmail || 0,
      small_business: smallBiz || 0,
      verified: (verified || 0) + (claimed || 0),
      states_covered: 50,
      trade_categories: Object.keys(TRADE_CATEGORIES).length,
    }

    if (detail === "categories") {
      // Get category counts by scanning trade_categories arrays
      const { data: tradesRaw } = await supabase
        .from("master_subcontractors")
        .select("trade_categories")
        .not("trade_categories", "eq", "{}")

      const categoryCounts: Record<string, number> = {}
      tradesRaw?.forEach((row) => {
        if (row.trade_categories) {
          row.trade_categories.forEach((cat: string) => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
          })
        }
      })

      // Sort by count desc and add human-readable names
      const categories = Object.entries(categoryCounts)
        .map(([id, count]) => ({
          id,
          name: TRADE_CATEGORIES[id] || id,
          count,
        }))
        .sort((a, b) => b.count - a.count)

      return new Response(JSON.stringify({ ...base, categories }), { status: 200, headers })
    }

    if (detail === "states") {
      const { data: statesRaw } = await supabase
        .from("master_subcontractors")
        .select("state")
        .not("state", "is", null)

      const stateCounts: Record<string, number> = {}
      statesRaw?.forEach((row) => {
        if (row.state) {
          const st = row.state.toUpperCase().trim()
          stateCounts[st] = (stateCounts[st] || 0) + 1
        }
      })

      const states = Object.entries(stateCounts)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)

      return new Response(JSON.stringify({ ...base, states }), { status: 200, headers })
    }

    // Default: just base stats
    return new Response(JSON.stringify(base), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
