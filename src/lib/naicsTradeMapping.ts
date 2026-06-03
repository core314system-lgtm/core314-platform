/**
 * NAICS Code → Trade Category Mapping
 * Maps NAICS codes (2-6 digit prefixes) to Procuvex trade categories.
 * Used by SAM.gov entity import to auto-categorize subcontractors.
 */

export interface TradeCategory {
  id: string
  name: string
  description: string
  icon: string  // lucide icon name
}

// Master list of 45 trade categories
export const TRADE_CATEGORIES: TradeCategory[] = [
  { id: 'hvac', name: 'HVAC', description: 'Heating, ventilation, air conditioning', icon: 'Thermometer' },
  { id: 'electrical', name: 'Electrical', description: 'Electrical systems, wiring, lighting', icon: 'Zap' },
  { id: 'plumbing', name: 'Plumbing', description: 'Plumbing, water systems, fixtures', icon: 'Droplets' },
  { id: 'fire_safety', name: 'Fire & Life Safety', description: 'Fire alarms, suppression, sprinklers', icon: 'Flame' },
  { id: 'elevator', name: 'Elevator & Escalator', description: 'Elevator maintenance, modernization', icon: 'ArrowUpDown' },
  { id: 'janitorial', name: 'Janitorial & Custodial', description: 'Cleaning, custodial services', icon: 'Sparkles' },
  { id: 'landscaping', name: 'Landscaping & Grounds', description: 'Landscaping, lawn, irrigation', icon: 'TreePine' },
  { id: 'snow_removal', name: 'Snow & Ice Removal', description: 'Snow plowing, de-icing, winter services', icon: 'Snowflake' },
  { id: 'pest_control', name: 'Pest Control', description: 'Extermination, pest management', icon: 'Bug' },
  { id: 'roofing', name: 'Roofing', description: 'Roofing installation, repair, maintenance', icon: 'Home' },
  { id: 'painting', name: 'Painting & Coatings', description: 'Interior/exterior painting, coatings', icon: 'Paintbrush' },
  { id: 'flooring', name: 'Flooring', description: 'Carpet, tile, hardwood, flooring', icon: 'Layers' },
  { id: 'security', name: 'Security Systems', description: 'CCTV, access control, surveillance', icon: 'Shield' },
  { id: 'general_construction', name: 'General Construction', description: 'General contracting, build-outs', icon: 'HardHat' },
  { id: 'demolition', name: 'Demolition', description: 'Demolition, site clearing', icon: 'Hammer' },
  { id: 'concrete', name: 'Concrete & Masonry', description: 'Concrete, masonry, foundations', icon: 'Blocks' },
  { id: 'structural_steel', name: 'Structural Steel', description: 'Steel erection, fabrication', icon: 'Building2' },
  { id: 'environmental', name: 'Environmental Services', description: 'Remediation, hazmat, asbestos', icon: 'Leaf' },
  { id: 'waste_management', name: 'Waste Management', description: 'Waste disposal, recycling', icon: 'Trash2' },
  { id: 'it_telecom', name: 'IT & Telecommunications', description: 'Networking, cabling, telecom', icon: 'Wifi' },
  { id: 'building_automation', name: 'Building Automation', description: 'BAS, controls, smart building', icon: 'Cpu' },
  { id: 'generator', name: 'Emergency Power', description: 'Generators, UPS, emergency power', icon: 'Battery' },
  { id: 'dock_equipment', name: 'Dock & Loading Equipment', description: 'Dock levelers, overhead doors', icon: 'Truck' },
  { id: 'glass_glazing', name: 'Glass & Glazing', description: 'Windows, glass, curtain walls', icon: 'Square' },
  { id: 'insulation', name: 'Insulation', description: 'Thermal, acoustic insulation', icon: 'Layers' },
  { id: 'drywall', name: 'Drywall & Framing', description: 'Drywall, metal framing, ceilings', icon: 'LayoutGrid' },
  { id: 'mechanical', name: 'Mechanical Services', description: 'Mechanical systems, piping', icon: 'Wrench' },
  { id: 'welding', name: 'Welding & Metal Work', description: 'Welding, fabrication, metal work', icon: 'Flame' },
  { id: 'paving', name: 'Paving & Asphalt', description: 'Parking lots, roads, striping', icon: 'Route' },
  { id: 'fencing', name: 'Fencing', description: 'Fencing installation, security barriers', icon: 'Fence' },
  { id: 'signage', name: 'Signage', description: 'Signs, wayfinding, ADA signage', icon: 'SignpostBig' },
  { id: 'food_services', name: 'Food Services', description: 'Cafeteria, catering, vending', icon: 'UtensilsCrossed' },
  { id: 'moving_logistics', name: 'Moving & Logistics', description: 'Moving, relocation, logistics', icon: 'PackageOpen' },
  { id: 'furniture', name: 'Furniture & Installation', description: 'Office furniture, installation', icon: 'Armchair' },
  { id: 'engineering', name: 'Engineering Services', description: 'Civil, structural, MEP engineering', icon: 'Compass' },
  { id: 'architectural', name: 'Architectural Services', description: 'Architecture, design, planning', icon: 'PenTool' },
  { id: 'surveying', name: 'Surveying & Geotechnical', description: 'Land survey, soil testing', icon: 'Map' },
  { id: 'abatement', name: 'Abatement', description: 'Lead, asbestos, mold abatement', icon: 'ShieldAlert' },
  { id: 'waterproofing', name: 'Waterproofing', description: 'Waterproofing, sealants, caulking', icon: 'Droplet' },
  { id: 'fire_protection', name: 'Fire Protection', description: 'Fire protection engineering, design', icon: 'Siren' },
  { id: 'testing_inspection', name: 'Testing & Inspection', description: 'Quality testing, inspection services', icon: 'ClipboardCheck' },
  { id: 'staffing', name: 'Staffing & Labor', description: 'Temporary staffing, labor support', icon: 'Users' },
  { id: 'consulting', name: 'Consulting', description: 'Management, technical consulting', icon: 'Lightbulb' },
  { id: 'training', name: 'Training', description: 'Safety training, technical training', icon: 'GraduationCap' },
  { id: 'other', name: 'Other Services', description: 'Other specialty services', icon: 'MoreHorizontal' },
]

// NAICS prefix → trade category IDs
// Key: NAICS code prefix (2-6 digits), Value: array of trade category IDs
const NAICS_MAP: Record<string, string[]> = {
  // Construction (23xxxx)
  '236': ['general_construction'],
  '236115': ['general_construction'],
  '236116': ['general_construction'],
  '236117': ['general_construction'],
  '236118': ['general_construction'],
  '236210': ['general_construction'],
  '236220': ['general_construction'],
  '237': ['general_construction', 'paving'],
  '237110': ['paving'],
  '237120': ['paving'],
  '237130': ['general_construction'],
  '237210': ['general_construction'],
  '237310': ['general_construction'],
  '237990': ['general_construction'],

  // Specialty Trades (238xxx)
  '238110': ['concrete'],
  '238120': ['structural_steel'],
  '238130': ['general_construction'],  // framing
  '238140': ['concrete'],  // masonry
  '238150': ['glass_glazing'],
  '238160': ['roofing'],
  '238170': ['insulation'],
  '238190': ['general_construction'],  // other foundation
  '238210': ['electrical'],
  '238220': ['plumbing', 'hvac'],
  '238290': ['mechanical'],  // other building equipment
  '238310': ['drywall'],
  '238320': ['painting'],
  '238330': ['flooring'],
  '238340': ['drywall'],  // tile and terrazzo
  '238350': ['general_construction'],  // finish carpentry
  '238390': ['general_construction'],  // other finishing
  '238910': ['general_construction'],  // site preparation
  '238990': ['general_construction'],  // all other specialty

  // Waste Management (562xxx)
  '562': ['waste_management', 'environmental'],
  '562111': ['waste_management'],
  '562112': ['waste_management'],
  '562119': ['waste_management'],
  '562211': ['waste_management'],
  '562212': ['waste_management'],
  '562213': ['environmental'],
  '562219': ['environmental'],
  '562910': ['environmental'],  // remediation
  '562920': ['waste_management'],
  '562991': ['pest_control'],
  '562998': ['waste_management'],

  // Building Services (561xxx)
  '561210': ['janitorial'],  // facilities support
  '561710': ['pest_control'],
  '561720': ['janitorial'],  // janitorial services
  '561730': ['landscaping'],
  '561740': ['landscaping'],  // carpet cleaning
  '561790': ['janitorial'],  // other services to buildings
  '561611': ['consulting'],
  '561612': ['consulting'],
  '561320': ['staffing'],
  '561330': ['staffing'],

  // Professional Services
  '541310': ['architectural'],
  '541320': ['architectural'],
  '541330': ['engineering'],
  '541340': ['engineering'],
  '541350': ['engineering'],
  '541360': ['surveying'],
  '541370': ['surveying'],
  '541380': ['testing_inspection'],
  '541611': ['consulting'],
  '541612': ['consulting'],
  '541613': ['consulting'],
  '541614': ['consulting'],
  '541620': ['environmental'],
  '541690': ['consulting'],
  '541715': ['it_telecom'],
  '541990': ['consulting'],

  // Manufacturing / Specialty
  '332312': ['structural_steel'],
  '332313': ['structural_steel'],
  '332323': ['welding'],
  '332439': ['mechanical'],
  '333415': ['hvac'],
  '333921': ['elevator'],
  '334290': ['it_telecom'],
  '334511': ['testing_inspection'],
  '335311': ['generator'],
  '335312': ['generator'],
  '335313': ['generator'],
  '335911': ['electrical'],
  '339950': ['signage'],

  // IT / Telecom
  '517': ['it_telecom'],
  '517110': ['it_telecom'],
  '517210': ['it_telecom'],
  '517911': ['it_telecom'],
  '518210': ['it_telecom'],
  '541511': ['it_telecom'],
  '541512': ['it_telecom'],
  '541513': ['it_telecom'],
  '541519': ['it_telecom'],

  // Security
  '561621': ['security'],

  // Food Services
  '722310': ['food_services'],
  '722320': ['food_services'],
  '722330': ['food_services'],

  // Training
  '611430': ['training'],
  '611519': ['training'],
  '611699': ['training'],

  // Fire Protection
  '922160': ['fire_protection'],
}

/**
 * Maps NAICS codes to trade category IDs.
 * Tries exact match first, then progressively shorter prefixes.
 */
export function naicsToCategoryIds(naicsCodes: string[]): string[] {
  const categories = new Set<string>()
  for (const code of naicsCodes) {
    const clean = code.replace(/\D/g, '')
    // Try exact, then 5, 4, 3, 2 digit prefixes
    for (let len = clean.length; len >= 2; len--) {
      const prefix = clean.substring(0, len)
      if (NAICS_MAP[prefix]) {
        NAICS_MAP[prefix].forEach(c => categories.add(c))
        break
      }
    }
  }
  return Array.from(categories)
}

/**
 * Maps NAICS codes to human-readable trade category names.
 */
export function naicsToTradeNames(naicsCodes: string[]): string[] {
  const ids = naicsToCategoryIds(naicsCodes)
  return ids.map(id => {
    const cat = TRADE_CATEGORIES.find(c => c.id === id)
    return cat?.name || id
  })
}

/**
 * Generates a URL-safe slug from a company name.
 */
export function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

/**
 * Get trade category by ID.
 */
export function getTradeCategory(id: string): TradeCategory | undefined {
  return TRADE_CATEGORIES.find(c => c.id === id)
}
