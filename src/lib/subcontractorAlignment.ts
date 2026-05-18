import { supabase } from './supabase'
import type { Subcontractor } from './types'

// SOW items are fetched dynamically from the database

interface AlignedSubcontractor {
  subcontractor: Subcontractor
  matchedCategories: string[]
  matchScore: number
  reason: string
}

// Keyword mapping: SOW titles to service categories
const SOW_TO_CATEGORY_MAP: Record<string, string[]> = {
  'hvac': ['HVAC', 'Building Automation', 'Energy Management'],
  'heating': ['HVAC'],
  'air conditioning': ['HVAC'],
  'ventilation': ['HVAC'],
  'fire': ['Fire Life Safety'],
  'life safety': ['Fire Life Safety'],
  'sprinkler': ['Fire Life Safety'],
  'fire alarm': ['Fire Life Safety'],
  'suppression': ['Fire Life Safety'],
  'janitorial': ['Janitorial'],
  'custodial': ['Janitorial'],
  'cleaning': ['Janitorial'],
  'sanitation': ['Janitorial'],
  'landscaping': ['Landscaping', 'Grounds Maintenance'],
  'grounds': ['Landscaping', 'Grounds Maintenance'],
  'lawn': ['Landscaping'],
  'irrigation': ['Landscaping'],
  'exterior': ['Landscaping', 'Grounds Maintenance', 'Snow Removal'],
  'snow': ['Snow Removal'],
  'ice removal': ['Snow Removal'],
  'power': ['Emergency Power', 'Electrical'],
  'generator': ['Emergency Power'],
  'emergency power': ['Emergency Power'],
  'ups': ['Emergency Power'],
  'electrical': ['Electrical'],
  'lighting': ['Electrical'],
  'plumbing': ['Plumbing'],
  'drain': ['Plumbing'],
  'water': ['Plumbing'],
  'backflow': ['Plumbing'],
  'pest': ['Pest Control'],
  'exterminator': ['Pest Control'],
  'rodent': ['Pest Control'],
  'dock': ['Dock Equipment'],
  'loading': ['Dock Equipment'],
  'overhead door': ['Dock Equipment'],
  'elevator': ['Elevator Maintenance'],
  'escalator': ['Elevator Maintenance'],
  'vertical transport': ['Elevator Maintenance'],
  'roofing': ['Roofing'],
  'roof': ['Roofing'],
  'security': ['Security Systems'],
  'access control': ['Security Systems'],
  'cctv': ['Security Systems'],
  'surveillance': ['Security Systems'],
  'painting': ['Painting'],
  'flooring': ['Flooring'],
  'carpet': ['Flooring'],
  'waste': ['Waste Management'],
  'trash': ['Waste Management'],
  'recycling': ['Waste Management'],
  'building automation': ['Building Automation'],
  'bms': ['Building Automation'],
  'controls': ['Building Automation'],
}

function extractCategories(sowTitle: string, sowDescription?: string | null): string[] {
  const text = `${sowTitle} ${sowDescription || ''}`.toLowerCase()
  const matched = new Set<string>()

  for (const [keyword, categories] of Object.entries(SOW_TO_CATEGORY_MAP)) {
    if (text.includes(keyword)) {
      categories.forEach(c => matched.add(c))
    }
  }

  return Array.from(matched)
}

export async function alignSubcontractorsToTaskOrder(taskOrderId: string): Promise<Record<string, AlignedSubcontractor[]>> {
  // Get SOW items for this task order
  const { data: sowItems } = await supabase
    .from('sow_items')
    .select('*')
    .eq('task_order_id', taskOrderId)

  if (!sowItems || sowItems.length === 0) return {}

  // Get all subcontractors
  const { data: subs } = await supabase
    .from('subcontractors')
    .select('*')
    .order('company_name')

  if (!subs || subs.length === 0) return {}

  const alignment: Record<string, AlignedSubcontractor[]> = {}

  for (const sow of sowItems) {
    const requiredCategories = extractCategories(sow.title, sow.description || sow.notes)
    if (requiredCategories.length === 0) {
      // Try to match title directly as a category
      const titleMatch = subs.filter(s =>
        s.service_categories?.some((cat: string) =>
          sow.title.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(sow.title.toLowerCase().replace(/\s+services?$/i, ''))
        )
      )
      if (titleMatch.length > 0) {
        alignment[sow.id] = titleMatch.map(sub => ({
          subcontractor: sub,
          matchedCategories: sub.service_categories?.filter((cat: string) =>
            sow.title.toLowerCase().includes(cat.toLowerCase()) ||
            cat.toLowerCase().includes(sow.title.toLowerCase().replace(/\s+services?$/i, ''))
          ) || [],
          matchScore: 70,
          reason: `Matched by SOW title: "${sow.title}"`,
        }))
      }
      continue
    }

    const matchedSubs: AlignedSubcontractor[] = []

    for (const sub of subs) {
      const subCategories = sub.service_categories || []
      const matchedCats = subCategories.filter((cat: string) =>
        requiredCategories.some(rc => rc.toLowerCase() === cat.toLowerCase())
      )

      if (matchedCats.length > 0) {
        // Calculate match score based on category overlap + preferences
        let score = Math.round((matchedCats.length / requiredCategories.length) * 100)
        if (sub.preferred) score += 10
        if (sub.incumbent_status === 'known') score += 15
        if (sub.incumbent_status === 'suspected') score += 5
        score = Math.min(score, 100)

        matchedSubs.push({
          subcontractor: sub,
          matchedCategories: matchedCats,
          matchScore: score,
          reason: `Matched ${matchedCats.length} of ${requiredCategories.length} required categories: ${matchedCats.join(', ')}`,
        })
      }
    }

    // Sort by match score descending
    matchedSubs.sort((a, b) => b.matchScore - a.matchScore)
    alignment[sow.id] = matchedSubs
  }

  return alignment
}

export function getCategoriesForSow(sowTitle: string, sowDescription?: string | null): string[] {
  return extractCategories(sowTitle, sowDescription)
}
