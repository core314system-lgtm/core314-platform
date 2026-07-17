/**
 * Shared trade-classification matcher for subcontractor imports.
 *
 * Maps free-text capability/description strings to canonical trade categories.
 *
 * IMPORTANT: matching is WORD-BOUNDARY based, not raw substring. The previous
 * substring approach produced mass false positives that polluted the master
 * subcontractor database — e.g. "design" matched inside "de-sign" logic and
 * tagged software/interior-design firms as "Signage" and "Architectural
 * Services"; "management" tagged everything "Consulting"; "guard" (in
 * "safeguard") tagged "Security Systems"; "lead" tagged "Abatement". Broad,
 * ambiguous single-word keywords have been removed in favour of specific
 * phrases so a firm is only tagged with a trade its text actually describes.
 */

// Canonical keyword/phrase -> trade category name(s).
// Single-word keys also match a trailing plural (e.g. "roof" -> "roofs").
// Multi-word keys are matched as an exact phrase on word boundaries.
export const TRADE_KEYWORD_MAP: Record<string, string[]> = {
  hvac: ['HVAC'], hvacr: ['HVAC'], heating: ['HVAC'], ventilation: ['HVAC'],
  'air conditioning': ['HVAC'], 'air conditioner': ['HVAC'], refrigeration: ['HVAC'],
  chiller: ['HVAC'], 'cooling tower': ['HVAC'], furnace: ['HVAC'], ductwork: ['HVAC'],
  electrical: ['Electrical'], solar: ['Electrical'], photovoltaic: ['Electrical'], switchgear: ['Electrical'],
  plumbing: ['Plumbing'], plumber: ['Plumbing'],
  'fire alarm': ['Fire & Life Safety'], 'fire sprinkler': ['Fire & Life Safety'],
  'fire suppression': ['Fire & Life Safety'], 'life safety': ['Fire & Life Safety'], sprinkler: ['Fire & Life Safety'],
  elevator: ['Elevator & Escalator'], escalator: ['Elevator & Escalator'],
  janitorial: ['Janitorial & Custodial'], custodial: ['Janitorial & Custodial'], 'building cleaning': ['Janitorial & Custodial'],
  landscaping: ['Landscaping & Grounds'], landscape: ['Landscaping & Grounds'], lawn: ['Landscaping & Grounds'],
  'grounds maintenance': ['Landscaping & Grounds'], irrigation: ['Landscaping & Grounds'],
  'snow removal': ['Snow & Ice Removal'], 'ice removal': ['Snow & Ice Removal'],
  'pest control': ['Pest Control'], extermination: ['Pest Control'],
  roofing: ['Roofing'], roof: ['Roofing'],
  painting: ['Painting & Coatings'], painter: ['Painting & Coatings'], coatings: ['Painting & Coatings'],
  flooring: ['Flooring'], carpet: ['Flooring'], tile: ['Flooring'], terrazzo: ['Flooring'],
  'security system': ['Security Systems'], cctv: ['Security Systems'], 'access control': ['Security Systems'], surveillance: ['Security Systems'],
  'general contractor': ['General Construction'], 'general construction': ['General Construction'],
  'construction management': ['General Construction'], 'build-out': ['General Construction'], 'build out': ['General Construction'],
  demolition: ['Demolition'],
  concrete: ['Concrete & Masonry'], masonry: ['Concrete & Masonry'],
  'structural steel': ['Structural Steel'], 'steel erection': ['Structural Steel'], 'steel fabrication': ['Structural Steel'],
  environmental: ['Environmental Services'], remediation: ['Environmental Services'], hazmat: ['Environmental Services'],
  asbestos: ['Abatement'], abatement: ['Abatement'], 'lead paint': ['Abatement'], 'lead-based': ['Abatement'], 'mold remediation': ['Abatement'],
  'waste management': ['Waste Management'], 'trash removal': ['Waste Management'], recycling: ['Waste Management'], dumpster: ['Waste Management'],
  'information technology': ['IT & Telecommunications'], 'it services': ['IT & Telecommunications'], 'it support': ['IT & Telecommunications'],
  telecom: ['IT & Telecommunications'], telecommunications: ['IT & Telecommunications'], networking: ['IT & Telecommunications'],
  'network cabling': ['IT & Telecommunications'], 'structured cabling': ['IT & Telecommunications'], 'fiber optic': ['IT & Telecommunications'],
  'help desk': ['IT & Telecommunications'], cybersecurity: ['IT & Telecommunications'],
  'building automation': ['Building Automation'], 'building controls': ['Building Automation'], 'hvac controls': ['Building Automation'],
  generator: ['Emergency Power'], 'emergency power': ['Emergency Power'], 'uninterruptible power': ['Emergency Power'],
  glass: ['Glass & Glazing'], glazing: ['Glass & Glazing'], 'curtain wall': ['Glass & Glazing'], storefront: ['Glass & Glazing'],
  insulation: ['Insulation'],
  drywall: ['Drywall & Framing'], 'metal framing': ['Drywall & Framing'], 'acoustical ceiling': ['Drywall & Framing'],
  'mechanical contractor': ['Mechanical Services'], 'mechanical services': ['Mechanical Services'],
  'mechanical systems': ['Mechanical Services'], 'process piping': ['Mechanical Services'],
  welding: ['Welding & Metal Work'], 'metal fabrication': ['Welding & Metal Work'], 'metal work': ['Welding & Metal Work'],
  paving: ['Paving & Asphalt'], asphalt: ['Paving & Asphalt'], sealcoating: ['Paving & Asphalt'],
  'parking lot': ['Paving & Asphalt'], 'pavement striping': ['Paving & Asphalt'],
  fencing: ['Fencing'], fence: ['Fencing'],
  signage: ['Signage'], wayfinding: ['Signage'],
  'food service': ['Food Services'], catering: ['Food Services'], cafeteria: ['Food Services'], vending: ['Food Services'],
  'moving service': ['Moving & Logistics'], relocation: ['Moving & Logistics'], logistics: ['Moving & Logistics'], freight: ['Moving & Logistics'],
  furniture: ['Furniture & Installation'],
  engineering: ['Engineering Services'], 'civil engineering': ['Engineering Services'], 'mep engineering': ['Engineering Services'],
  architect: ['Architectural Services'], architecture: ['Architectural Services'], architectural: ['Architectural Services'],
  surveying: ['Surveying & Geotechnical'], 'land survey': ['Surveying & Geotechnical'], geotechnical: ['Surveying & Geotechnical'],
  waterproofing: ['Waterproofing'], sealant: ['Waterproofing'], caulking: ['Waterproofing'],
  'testing and inspection': ['Testing & Inspection'], 'materials testing': ['Testing & Inspection'], nondestructive: ['Testing & Inspection'],
  staffing: ['Staffing & Labor'], 'temporary labor': ['Staffing & Labor'], 'temp staffing': ['Staffing & Labor'],
  training: ['Training'],
  consulting: ['Consulting'], 'advisory services': ['Consulting'],
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface CompiledKeyword {
  re: RegExp
  trades: string[]
}

const COMPILED: CompiledKeyword[] = Object.entries(TRADE_KEYWORD_MAP).map(([keyword, trades]) => {
  const escaped = escapeRegExp(keyword)
  // Multi-word phrases match exactly; single words allow an optional trailing "s".
  const pattern = /\s/.test(keyword) ? `\\b${escaped}\\b` : `\\b${escaped}s?\\b`
  return { re: new RegExp(pattern, 'i'), trades }
})

/**
 * Classify free text into canonical trade categories using word-boundary
 * matching. Returns a de-duplicated array (empty when nothing matches — callers
 * should store null rather than inventing an "Other" bucket).
 */
export function descriptionToTrades(text: string | null | undefined): string[] {
  if (!text) return []
  const trades = new Set<string>()
  for (const { re, trades: tradeList } of COMPILED) {
    if (re.test(text)) tradeList.forEach(t => trades.add(t))
  }
  return [...trades]
}
