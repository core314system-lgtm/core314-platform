// Canonical trade taxonomy for AI SOW → trade mapping.
// These names MUST exactly match the `name` field of TRADE_CATEGORIES in
// src/lib/naicsTradeMapping.ts — that list is the canonical source used for the
// master subcontractor `trade_categories` values and the manual search filter.
// If they drift, AI matching maps SOW items to trade names that don't exist in
// the data and returns 0 results. tradeTaxonomy.test.ts enforces this equality.
export const KNOWN_TRADES: string[] = [
  "HVAC", "Electrical", "Plumbing", "Fire & Life Safety", "Elevator & Escalator",
  "Janitorial & Custodial", "Landscaping & Grounds", "Snow & Ice Removal", "Pest Control", "Roofing",
  "Painting & Coatings", "Flooring", "Security Systems", "General Construction", "Demolition",
  "Concrete & Masonry", "Structural Steel", "Environmental Services", "Waste Management",
  "IT & Telecommunications", "Building Automation", "Emergency Power", "Dock & Loading Equipment",
  "Glass & Glazing", "Insulation", "Drywall & Framing", "Mechanical Services",
  "Welding & Metal Work", "Paving & Asphalt", "Fencing", "Signage", "Food Services",
  "Moving & Logistics", "Furniture & Installation", "Engineering Services",
  "Architectural Services", "Surveying & Geotechnical", "Abatement", "Waterproofing",
  "Fire Protection", "Testing & Inspection", "Staffing & Labor", "Consulting", "Training",
  "Other Services",
]
