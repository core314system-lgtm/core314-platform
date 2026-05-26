import { supabase } from './supabase'

const BUCKET = 'task-order-documents'

export interface Debrief {
  id: string
  task_order_id: string
  task_order_title: string
  outcome: 'awarded' | 'not_awarded' | 'no_bid' | 'withdrawn'
  award_date?: string
  final_award_price?: number
  our_proposed_price?: number
  government_estimate?: number
  winning_competitor?: string
  winning_competitor_price?: number
  loss_reasons: string[]
  strengths: string[]
  weaknesses: string[]
  lessons_learned: string
  pricing_notes: string
  sub_performance_notes: string
  what_to_repeat: string
  what_to_change: string
  evaluator_feedback: string
  service_categories: string[]
  region: string
  contract_vehicle?: string
  contract_value_range: string
  created_at: string
  updated_at: string
}

export interface CompetitorProfile {
  name: string
  wins_against_us: number
  losses_against_us: number
  known_services: string[]
  known_regions: string[]
  avg_price_vs_ours: string
  notes: string
}

export interface IntelligenceSummary {
  total_bids: number
  wins: number
  losses: number
  no_bids: number
  win_rate: number
  avg_margin_on_wins: number
  avg_margin_on_losses: number
  top_loss_reasons: Array<{ reason: string; count: number }>
  top_strengths: Array<{ strength: string; count: number }>
  competitors: CompetitorProfile[]
  pricing_insights: string[]
  sub_insights: string[]
  lessons_by_category: Record<string, string[]>
  data_maturity: 'early' | 'developing' | 'mature' | 'advanced'
  data_maturity_description: string
  last_updated: string
}

function debriefPath(taskOrderId: string): string {
  return `${taskOrderId}/debrief.json`
}

function allDebriefsIndexPath(): string {
  return `_global/debriefs_index.json`
}

function intelligencePath(): string {
  return `_global/intelligence_summary.json`
}

export async function saveDebrief(debrief: Debrief): Promise<void> {
  const path = debriefPath(debrief.task_order_id)
  const blob = new Blob([JSON.stringify(debrief, null, 2)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).remove([path])
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw error

  // Update the global index
  await updateDebriefIndex(debrief)
  // Regenerate intelligence
  await regenerateIntelligence()
}

export async function loadDebrief(taskOrderId: string): Promise<Debrief | null> {
  const path = debriefPath(taskOrderId)
  const { data: urlData, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !urlData?.signedUrl) return null
  try {
    const res = await fetch(urlData.signedUrl)
    if (!res.ok) return null
    return await res.json() as Debrief
  } catch {
    return null
  }
}

export async function loadAllDebriefs(): Promise<Debrief[]> {
  const path = allDebriefsIndexPath()
  const { data: urlData, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !urlData?.signedUrl) return []
  try {
    const res = await fetch(urlData.signedUrl)
    if (!res.ok) return []
    return await res.json() as Debrief[]
  } catch {
    return []
  }
}

async function updateDebriefIndex(debrief: Debrief): Promise<void> {
  const existing = await loadAllDebriefs()
  const idx = existing.findIndex(d => d.task_order_id === debrief.task_order_id)
  if (idx >= 0) {
    existing[idx] = debrief
  } else {
    existing.push(debrief)
  }
  const path = allDebriefsIndexPath()
  const blob = new Blob([JSON.stringify(existing, null, 2)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).remove([path])
  await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/json',
    upsert: true,
  })
}

export async function loadIntelligence(): Promise<IntelligenceSummary | null> {
  const path = intelligencePath()
  const { data: urlData, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !urlData?.signedUrl) return null
  try {
    const res = await fetch(urlData.signedUrl)
    if (!res.ok) return null
    return await res.json() as IntelligenceSummary
  } catch {
    return null
  }
}

export async function regenerateIntelligence(): Promise<IntelligenceSummary> {
  const debriefs = await loadAllDebriefs()

  const wins = debriefs.filter(d => d.outcome === 'awarded')
  const losses = debriefs.filter(d => d.outcome === 'not_awarded')
  const noBids = debriefs.filter(d => d.outcome === 'no_bid')

  // Win rate
  const decidedBids = wins.length + losses.length
  const winRate = decidedBids > 0 ? (wins.length / decidedBids) * 100 : 0

  // Average margins
  const winMargins = wins
    .filter(d => d.final_award_price && d.our_proposed_price)
    .map(d => ((d.our_proposed_price! - d.final_award_price!) / d.final_award_price!) * 100)
  const avgMarginWins = winMargins.length > 0 ? winMargins.reduce((a, b) => a + b, 0) / winMargins.length : 0

  const lossMargins = losses
    .filter(d => d.winning_competitor_price && d.our_proposed_price)
    .map(d => ((d.our_proposed_price! - d.winning_competitor_price!) / d.winning_competitor_price!) * 100)
  const avgMarginLosses = lossMargins.length > 0 ? lossMargins.reduce((a, b) => a + b, 0) / lossMargins.length : 0

  // Loss reasons aggregation
  const reasonCounts: Record<string, number> = {}
  for (const d of losses) {
    for (const r of d.loss_reasons) {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1
    }
  }
  const topLossReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Strengths aggregation
  const strengthCounts: Record<string, number> = {}
  for (const d of debriefs) {
    for (const s of d.strengths) {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1
    }
  }
  const topStrengths = Object.entries(strengthCounts)
    .map(([strength, count]) => ({ strength, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Competitor profiles
  const competitorMap: Record<string, CompetitorProfile> = {}
  for (const d of debriefs) {
    if (!d.winning_competitor) continue
    const name = d.winning_competitor
    if (!competitorMap[name]) {
      competitorMap[name] = {
        name,
        wins_against_us: 0,
        losses_against_us: 0,
        known_services: [],
        known_regions: [],
        avg_price_vs_ours: 'Unknown',
        notes: '',
      }
    }
    if (d.outcome === 'not_awarded') {
      competitorMap[name].wins_against_us++
    } else if (d.outcome === 'awarded') {
      competitorMap[name].losses_against_us++
    }
    for (const cat of d.service_categories) {
      if (!competitorMap[name].known_services.includes(cat)) {
        competitorMap[name].known_services.push(cat)
      }
    }
    if (d.region && !competitorMap[name].known_regions.includes(d.region)) {
      competitorMap[name].known_regions.push(d.region)
    }
  }

  // Pricing insights
  const pricingInsights: string[] = []
  if (avgMarginWins !== 0) {
    pricingInsights.push(`Average margin on wins: ${avgMarginWins.toFixed(1)}% ${avgMarginWins > 0 ? 'above' : 'below'} award price`)
  }
  if (avgMarginLosses !== 0) {
    pricingInsights.push(`Average pricing gap on losses: ${Math.abs(avgMarginLosses).toFixed(1)}% ${avgMarginLosses > 0 ? 'above' : 'below'} winning price`)
  }

  // Sub insights
  const subInsights: string[] = []
  const subNotes = debriefs.filter(d => d.sub_performance_notes).map(d => d.sub_performance_notes)
  if (subNotes.length > 0) {
    subInsights.push(`${subNotes.length} subcontractor performance notes recorded`)
  }

  // Lessons by category
  const lessonsByCategory: Record<string, string[]> = {}
  for (const d of debriefs) {
    for (const cat of d.service_categories) {
      if (!lessonsByCategory[cat]) lessonsByCategory[cat] = []
      if (d.lessons_learned) lessonsByCategory[cat].push(d.lessons_learned)
    }
  }

  // Data maturity
  let maturity: IntelligenceSummary['data_maturity'] = 'early'
  let maturityDesc = 'Limited data available. Add more debriefs to improve insights.'
  if (debriefs.length >= 3) { maturity = 'developing'; maturityDesc = 'Building baseline patterns. Insights becoming more reliable.' }
  if (debriefs.length >= 10) { maturity = 'mature'; maturityDesc = 'Strong historical data. Recommendations are statistically meaningful.' }
  if (debriefs.length >= 25) { maturity = 'advanced'; maturityDesc = 'Comprehensive dataset. AI recommendations are highly reliable.' }

  const summary: IntelligenceSummary = {
    total_bids: debriefs.length,
    wins: wins.length,
    losses: losses.length,
    no_bids: noBids.length,
    win_rate: Math.round(winRate * 10) / 10,
    avg_margin_on_wins: Math.round(avgMarginWins * 10) / 10,
    avg_margin_on_losses: Math.round(avgMarginLosses * 10) / 10,
    top_loss_reasons: topLossReasons,
    top_strengths: topStrengths,
    competitors: Object.values(competitorMap),
    pricing_insights: pricingInsights,
    sub_insights: subInsights,
    lessons_by_category: lessonsByCategory,
    data_maturity: maturity,
    data_maturity_description: maturityDesc,
    last_updated: new Date().toISOString(),
  }

  // Save
  const path = intelligencePath()
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).remove([path])
  await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/json',
    upsert: true,
  })

  return summary
}

export async function deleteDebrief(taskOrderId: string): Promise<void> {
  const path = debriefPath(taskOrderId)
  await supabase.storage.from(BUCKET).remove([path])

  // Update index
  const existing = await loadAllDebriefs()
  const filtered = existing.filter(d => d.task_order_id !== taskOrderId)
  const indexPath = allDebriefsIndexPath()
  const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).remove([indexPath])
  await supabase.storage.from(BUCKET).upload(indexPath, blob, {
    contentType: 'application/json',
    upsert: true,
  })

  await regenerateIntelligence()
}
