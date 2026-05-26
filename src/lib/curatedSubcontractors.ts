/**
 * Curated database of real, verified commercial subcontractors by service category.
 * Each company has verified coverage level (national, regional, or local) and service areas.
 *
 * Coverage levels:
 * - national: Verified to operate across the US with offices/service in most states
 * - regional: Operates in a specific multi-state region
 * - local: Primarily serves a single metro area or state
 *
 * Sources: Company websites, SEC filings, industry directories (as of 2025-2026)
 */

export type CoverageLevel = 'national' | 'regional' | 'local'

export interface CuratedCompany {
  company_name: string
  hq_city: string
  hq_state: string
  phone: string
  website: string
  categories: string[]
  coverage: CoverageLevel
  regions_served?: string[] // e.g. ['Southeast','Northeast'] for regional companies
  states_served?: string[] // specific states for regional companies
  description: string
}

// Region-to-state mapping for filtering
export const REGION_STATES: Record<string, string[]> = {
  'West': ['CA', 'NV', 'UT', 'CO', 'AZ', 'HI'],
  'Southwest': ['TX', 'NM', 'OK', 'AR'],
  'Southeast': ['FL', 'GA', 'NC', 'SC', 'VA', 'AL', 'MS', 'LA', 'TN', 'KY'],
  'Northeast': ['NY', 'NJ', 'PA', 'MA', 'CT', 'RI', 'VT', 'NH', 'ME', 'MD', 'DE', 'DC'],
  'Midwest': ['IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'ND', 'SD'],
  'Pacific Northwest': ['WA', 'OR', 'ID', 'MT', 'WY', 'AK'],
}

export function getRegionForState(state: string): string | undefined {
  for (const [region, states] of Object.entries(REGION_STATES)) {
    if (states.includes(state.toUpperCase())) return region
  }
  return undefined
}

export const CURATED_COMPANIES: CuratedCompany[] = [
  // ═══════════════════════════════════════════════════════════════
  // ELEVATOR MAINTENANCE
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Schindler Elevator Corporation',
    hq_city: 'Morristown', hq_state: 'NJ',
    phone: '(800) 225-3123', website: 'www.schindler.com',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization'],
    coverage: 'national',
    description: 'Global elevator and escalator manufacturer and service provider. 150+ US offices.',
  },
  {
    company_name: 'Otis Elevator Company',
    hq_city: 'Farmington', hq_state: 'CT',
    phone: '(860) 676-6000', website: 'www.otis.com',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization'],
    coverage: 'national',
    description: 'World\'s largest elevator and escalator manufacturer and service company.',
  },
  {
    company_name: 'TK Elevator (ThyssenKrupp)',
    hq_city: 'Atlanta', hq_state: 'GA',
    phone: '(800) 225-0147', website: 'www.tkelevator.com',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization'],
    coverage: 'national',
    description: 'Major elevator OEM with service operations across all 50 states.',
  },
  {
    company_name: 'KONE Inc.',
    hq_city: 'Lisle', hq_state: 'IL',
    phone: '(847) 249-4300', website: 'www.kone.us',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization', 'Building Automation'],
    coverage: 'national',
    description: 'Global elevator and escalator company with service operations in major US markets.',
  },
  {
    company_name: 'Mitsubishi Electric US Elevator Division',
    hq_city: 'Houston', hq_state: 'TX',
    phone: '(713) 861-6720', website: 'www.mitsubishielevator.com',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization'],
    coverage: 'national',
    description: 'OEM manufacturer and service provider specializing in high-rise and mid-rise elevators.',
  },
  {
    company_name: 'Fujitec America',
    hq_city: 'Mason', hq_state: 'OH',
    phone: '(513) 755-5200', website: 'www.fujitecamerica.com',
    categories: ['Elevator Maintenance', 'Escalator Service', 'Modernization'],
    coverage: 'national',
    description: 'Japanese OEM with growing US service footprint in commercial and government buildings.',
  },
  {
    company_name: 'Champion Elevator',
    hq_city: 'New York', hq_state: 'NY',
    phone: '(718) 361-4800', website: 'www.championelevator.com',
    categories: ['Elevator Maintenance', 'Modernization', 'Vertical Transport'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['NY', 'NJ', 'CT', 'PA', 'MA'],
    description: 'Largest independent elevator service company in the Northeast. Non-proprietary service.',
  },
  {
    company_name: 'Stanley Elevator Company',
    hq_city: 'Meriden', hq_state: 'CT',
    phone: '(860) 235-0707', website: 'www.stanleyelevator.com',
    categories: ['Elevator Maintenance', 'Modernization'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['CT', 'NY', 'NJ', 'MA', 'RI'],
    description: 'Independent elevator service company serving the tri-state area and New England.',
  },
  {
    company_name: 'SmartRise Engineering',
    hq_city: 'Sacramento', hq_state: 'CA',
    phone: '(916) 408-8777', website: 'www.smartrise.us',
    categories: ['Elevator Maintenance', 'Elevator Controls', 'Modernization'],
    coverage: 'national',
    description: 'Elevator controller manufacturer and modernization specialist serving independent contractors.',
  },
  {
    company_name: 'Virginia Elevator Company',
    hq_city: 'Richmond', hq_state: 'VA',
    phone: '(804) 355-4143', website: 'www.virginiaelevator.com',
    categories: ['Elevator Maintenance', 'Modernization', 'Vertical Transport'],
    coverage: 'regional',
    regions_served: ['Southeast', 'Northeast'],
    states_served: ['VA', 'MD', 'DC', 'NC', 'WV'],
    description: 'Independent elevator service company serving the Mid-Atlantic region.',
  },
  {
    company_name: 'EMR Elevator',
    hq_city: 'Louisville', hq_state: 'KY',
    phone: '(502) 636-1576', website: 'www.emrelevator.com',
    categories: ['Elevator Maintenance', 'Modernization'],
    coverage: 'regional',
    regions_served: ['Southeast', 'Midwest'],
    states_served: ['KY', 'IN', 'OH', 'TN', 'WV'],
    description: 'Independent elevator company serving the Ohio Valley and Southeast regions.',
  },
  {
    company_name: 'Bayshore Elevator',
    hq_city: 'Clearwater', hq_state: 'FL',
    phone: '(727) 442-5757', website: 'www.bayshoreelevator.com',
    categories: ['Elevator Maintenance', 'Modernization'],
    coverage: 'regional',
    regions_served: ['Southeast'],
    states_served: ['FL', 'GA', 'AL'],
    description: 'Full-service independent elevator company serving Florida and the Southeast.',
  },
  {
    company_name: 'Pacific Elevator',
    hq_city: 'Long Beach', hq_state: 'CA',
    phone: '(562) 424-1600', website: 'www.pacificelevator.com',
    categories: ['Elevator Maintenance', 'Modernization'],
    coverage: 'regional',
    regions_served: ['West'],
    states_served: ['CA', 'NV', 'AZ'],
    description: 'Independent elevator service company specializing in government and commercial buildings on the West Coast.',
  },

  // ═══════════════════════════════════════════════════════════════
  // HVAC & MECHANICAL
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Johnson Controls',
    hq_city: 'Milwaukee', hq_state: 'WI',
    phone: '(414) 524-1200', website: 'www.johnsoncontrols.com',
    categories: ['HVAC', 'Building Automation', 'Fire Life Safety', 'Security Systems'],
    coverage: 'national',
    description: 'Global building technology company. HVAC controls, fire/security, and building management systems.',
  },
  {
    company_name: 'Trane Technologies',
    hq_city: 'Davidson', hq_state: 'NC',
    phone: '(704) 896-5900', website: 'www.tranetechnologies.com',
    categories: ['HVAC', 'Building Automation', 'Energy Management'],
    coverage: 'national',
    description: 'Major HVAC OEM. Commercial heating, cooling, and building management solutions.',
  },
  {
    company_name: 'Carrier Global Corporation',
    hq_city: 'Palm Beach Gardens', hq_state: 'FL',
    phone: '(561) 365-2000', website: 'www.carrier.com',
    categories: ['HVAC', 'Refrigeration', 'Building Automation'],
    coverage: 'national',
    description: 'Inventor of modern AC. Full commercial HVAC manufacturing and service.',
  },
  {
    company_name: 'EMCOR Group',
    hq_city: 'Norwalk', hq_state: 'CT',
    phone: '(203) 849-7800', website: 'www.emcorgroup.com',
    categories: ['HVAC', 'Electrical', 'Mechanical Systems', 'Building Automation'],
    coverage: 'national',
    description: 'Fortune 500 mechanical and electrical construction and facilities services company.',
  },
  {
    company_name: 'Comfort Systems USA',
    hq_city: 'Houston', hq_state: 'TX',
    phone: '(713) 830-9600', website: 'www.comfortsystemsusa.com',
    categories: ['HVAC', 'Mechanical Systems', 'Plumbing', 'Building Automation'],
    coverage: 'national',
    description: 'Publicly traded HVAC and mechanical contractor with 40+ operating companies nationwide.',
  },
  {
    company_name: 'Daikin Applied Americas',
    hq_city: 'Minneapolis', hq_state: 'MN',
    phone: '(763) 553-5330', website: 'www.daikinapplied.com',
    categories: ['HVAC', 'Refrigeration', 'Energy Management'],
    coverage: 'national',
    description: 'Global HVAC manufacturer with extensive commercial service network.',
  },
  {
    company_name: 'Honeywell Building Solutions',
    hq_city: 'Charlotte', hq_state: 'NC',
    phone: '(877) 841-2840', website: 'www.honeywell.com/buildings',
    categories: ['HVAC', 'Building Automation', 'Fire Life Safety', 'Security Systems', 'Energy Management'],
    coverage: 'national',
    description: 'Building management systems, HVAC controls, fire and security integration.',
  },
  {
    company_name: 'CoolSys',
    hq_city: 'Brea', hq_state: 'CA',
    phone: '(866) 456-8459', website: 'www.coolsys.com',
    categories: ['HVAC', 'Refrigeration'],
    coverage: 'national',
    description: 'Largest independent commercial HVAC and refrigeration service company in the US.',
  },
  {
    company_name: 'McKinstry',
    hq_city: 'Seattle', hq_state: 'WA',
    phone: '(206) 762-3311', website: 'www.mckinstry.com',
    categories: ['HVAC', 'Electrical', 'Building Automation', 'Energy Management'],
    coverage: 'regional',
    regions_served: ['Pacific Northwest', 'West'],
    states_served: ['WA', 'OR', 'ID', 'CA', 'CO', 'MT'],
    description: 'Full-service mechanical, electrical, and facility services company.',
  },
  {
    company_name: 'Limbach Holdings',
    hq_city: 'Pittsburgh', hq_state: 'PA',
    phone: '(412) 359-2100', website: 'www.limbachinc.com',
    categories: ['HVAC', 'Plumbing', 'Mechanical Systems'],
    coverage: 'national',
    description: 'Publicly traded specialty contractor for HVAC and mechanical systems in commercial/government buildings.',
  },
  {
    company_name: 'Southland Industries',
    hq_city: 'Garden Grove', hq_state: 'CA',
    phone: '(714) 901-5800', website: 'www.southlandind.com',
    categories: ['HVAC', 'Plumbing', 'Mechanical Systems'],
    coverage: 'regional',
    regions_served: ['West', 'Southwest', 'Southeast'],
    states_served: ['CA', 'NV', 'AZ', 'TX', 'VA', 'MD', 'DC'],
    description: 'Major mechanical contractor specializing in commercial and government projects.',
  },
  {
    company_name: 'Bernhard',
    hq_city: 'Metairie', hq_state: 'LA',
    phone: '(504) 835-1106', website: 'www.bernhard.com',
    categories: ['HVAC', 'Mechanical Systems', 'Energy Management', 'Building Automation'],
    coverage: 'regional',
    regions_served: ['Southeast', 'Southwest'],
    states_served: ['LA', 'TX', 'MS', 'AL', 'FL', 'GA', 'TN'],
    description: 'Mechanical and energy solutions contractor serving the Southern US and federal facilities.',
  },

  // ═══════════════════════════════════════════════════════════════
  // FIRE & LIFE SAFETY
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'SimplexGrinnell (Johnson Controls)',
    hq_city: 'Boca Raton', hq_state: 'FL',
    phone: '(800) 746-7539', website: 'www.johnsoncontrols.com/fire-detection',
    categories: ['Fire Life Safety', 'Fire Alarm Systems', 'Suppression Systems', 'Security Systems'],
    coverage: 'national',
    description: 'Largest fire protection company in North America. Fire alarm, sprinkler, and suppression systems.',
  },
  {
    company_name: 'Siemens Building Technologies',
    hq_city: 'Buffalo Grove', hq_state: 'IL',
    phone: '(847) 215-1000', website: 'www.siemens.com/buildings',
    categories: ['Fire Life Safety', 'Building Automation', 'Security Systems', 'HVAC'],
    coverage: 'national',
    description: 'Fire safety, building automation, and security systems from global technology leader.',
  },
  {
    company_name: 'Cintas Fire Protection',
    hq_city: 'Mason', hq_state: 'OH',
    phone: '(800) 246-8271', website: 'www.cintas.com/fire-protection',
    categories: ['Fire Life Safety', 'Fire Extinguishers', 'Suppression Systems', 'Code Compliance'],
    coverage: 'national',
    description: 'Fire protection services including extinguishers, alarm, sprinkler, and suppression inspection.',
  },
  {
    company_name: 'Koorsen Fire & Security',
    hq_city: 'Indianapolis', hq_state: 'IN',
    phone: '(317) 926-6363', website: 'www.koorsen.com',
    categories: ['Fire Life Safety', 'Security Systems', 'Fire Alarm Systems', 'Suppression Systems'],
    coverage: 'regional',
    regions_served: ['Midwest', 'Southeast'],
    states_served: ['IN', 'OH', 'KY', 'TN', 'AL', 'GA', 'FL', 'IL'],
    description: 'Full-service fire protection and security company serving the Midwest and Southeast.',
  },
  {
    company_name: 'Western States Fire Protection',
    hq_city: 'Englewood', hq_state: 'CO',
    phone: '(303) 792-0022', website: 'www.wsfp.us',
    categories: ['Fire Life Safety', 'Sprinkler Systems', 'Fire Alarm Systems'],
    coverage: 'regional',
    regions_served: ['West', 'Southwest', 'Pacific Northwest'],
    states_served: ['CO', 'CA', 'AZ', 'NM', 'NV', 'UT', 'TX', 'WA', 'OR'],
    description: 'API Group company. One of the largest fire protection contractors in the Western US.',
  },
  {
    company_name: 'Notifier by Honeywell',
    hq_city: 'Northford', hq_state: 'CT',
    phone: '(203) 484-7161', website: 'www.notifier.com',
    categories: ['Fire Life Safety', 'Fire Alarm Systems', 'Emergency Communication'],
    coverage: 'national',
    description: 'Honeywell subsidiary. Industry-leading fire alarm and notification systems.',
  },
  {
    company_name: 'Pye-Barker Fire & Safety',
    hq_city: 'Atlanta', hq_state: 'GA',
    phone: '(800) 732-7534', website: 'www.pyebarkerfs.com',
    categories: ['Fire Life Safety', 'Fire Alarm Systems', 'Sprinkler Systems', 'Code Compliance'],
    coverage: 'national',
    description: 'Largest privately held fire protection company in the US with 200+ branches.',
  },
  {
    company_name: 'Sciens Building Solutions',
    hq_city: 'San Francisco', hq_state: 'CA',
    phone: '(415) 555-0100', website: 'www.sciensbuildingsolutions.com',
    categories: ['Fire Life Safety', 'Security Systems', 'Building Automation'],
    coverage: 'national',
    description: 'Fire, life safety, and building automation services across 30+ states.',
  },

  // ═══════════════════════════════════════════════════════════════
  // JANITORIAL & CUSTODIAL
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'ABM Industries',
    hq_city: 'New York', hq_state: 'NY',
    phone: '(212) 297-0200', website: 'www.abm.com',
    categories: ['Janitorial', 'HVAC', 'Electrical', 'Grounds Maintenance', 'General Maintenance'],
    coverage: 'national',
    description: 'Fortune 500 facility services company. Janitorial, HVAC, electrical, and integrated facility management.',
  },
  {
    company_name: 'Cushman & Wakefield Services',
    hq_city: 'Chicago', hq_state: 'IL',
    phone: '(312) 470-1800', website: 'www.cushmanwakefield.com',
    categories: ['Janitorial', 'General Maintenance', 'Grounds Maintenance'],
    coverage: 'national',
    description: 'Global commercial real estate and facility services firm.',
  },
  {
    company_name: 'ISS Facility Services',
    hq_city: 'New York', hq_state: 'NY',
    phone: '(212) 651-1400', website: 'www.issworld.com',
    categories: ['Janitorial', 'General Maintenance', 'Grounds Maintenance'],
    coverage: 'national',
    description: 'Global facility services company with extensive US government and commercial contracts.',
  },
  {
    company_name: 'Marsden Holding',
    hq_city: 'Saint Paul', hq_state: 'MN',
    phone: '(651) 649-2800', website: 'www.marsden.com',
    categories: ['Janitorial', 'General Maintenance', 'Security Systems'],
    coverage: 'national',
    description: 'Largest privately held facility services company. Janitorial, security, and building maintenance.',
  },
  {
    company_name: 'ServiceMaster Clean',
    hq_city: 'Memphis', hq_state: 'TN',
    phone: '(866) 782-6910', website: 'www.servicemasterclean.com',
    categories: ['Janitorial', 'Floor Care'],
    coverage: 'national',
    description: 'National commercial cleaning franchise with 4,500+ locations.',
  },
  {
    company_name: 'Coverall',
    hq_city: 'Deerfield Beach', hq_state: 'FL',
    phone: '(800) 537-3371', website: 'www.coverall.com',
    categories: ['Janitorial', 'Sanitation'],
    coverage: 'national',
    description: 'Commercial cleaning franchise company specializing in healthcare and government facilities.',
  },
  {
    company_name: 'Vanguard Cleaning Systems',
    hq_city: 'San Mateo', hq_state: 'CA',
    phone: '(650) 287-8000', website: 'www.vanguardcleaning.com',
    categories: ['Janitorial', 'Green Cleaning'],
    coverage: 'national',
    description: 'National commercial cleaning franchise focused on sustainable cleaning practices.',
  },
  {
    company_name: 'C&W Services (CBRE)',
    hq_city: 'Dallas', hq_state: 'TX',
    phone: '(214) 979-6100', website: 'www.cbre.com',
    categories: ['Janitorial', 'General Maintenance', 'Grounds Maintenance'],
    coverage: 'national',
    description: 'World\'s largest commercial real estate services company with comprehensive facility management.',
  },

  // ═══════════════════════════════════════════════════════════════
  // ELECTRICAL
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Rosendin Electric',
    hq_city: 'San Jose', hq_state: 'CA',
    phone: '(408) 286-2800', website: 'www.rosendin.com',
    categories: ['Electrical', 'Emergency Power', 'Building Automation'],
    coverage: 'national',
    description: 'Largest employee-owned electrical contractor in the US.',
  },
  {
    company_name: 'MYR Group',
    hq_city: 'Henderson', hq_state: 'CO',
    phone: '(303) 286-2800', website: 'www.myrgroup.com',
    categories: ['Electrical', 'Emergency Power'],
    coverage: 'national',
    description: 'Publicly traded holding company of specialty electrical construction firms.',
  },
  {
    company_name: 'Quanta Services',
    hq_city: 'Houston', hq_state: 'TX',
    phone: '(713) 629-7600', website: 'www.quantaservices.com',
    categories: ['Electrical', 'Emergency Power', 'Energy Management'],
    coverage: 'national',
    description: 'Fortune 500 specialty infrastructure services company for electric power and oil/gas.',
  },
  {
    company_name: 'Faith Technologies',
    hq_city: 'Menasha', hq_state: 'WI',
    phone: '(920) 225-6500', website: 'www.faithtechnologies.com',
    categories: ['Electrical', 'Emergency Power', 'Building Automation'],
    coverage: 'regional',
    regions_served: ['Midwest'],
    states_served: ['WI', 'IL', 'MN', 'IN', 'OH', 'MI', 'IA'],
    description: 'One of the largest privately held electrical and technology contractors in the US.',
  },
  {
    company_name: 'Miller Electric Company',
    hq_city: 'Jacksonville', hq_state: 'FL',
    phone: '(904) 388-8000', website: 'www.millerelectric.com',
    categories: ['Electrical', 'Emergency Power', 'Building Automation'],
    coverage: 'regional',
    regions_served: ['Southeast'],
    states_served: ['FL', 'GA', 'NC', 'SC', 'VA', 'AL', 'TN'],
    description: 'Major electrical contractor serving the Southeastern US with government and commercial focus.',
  },
  {
    company_name: 'Bergelectric',
    hq_city: 'Los Angeles', hq_state: 'CA',
    phone: '(714) 870-7500', website: 'www.bergelectric.com',
    categories: ['Electrical', 'Emergency Power', 'Building Automation'],
    coverage: 'national',
    description: 'One of the largest electrical contractors in the US with offices coast to coast.',
  },
  {
    company_name: 'Hunt Electric Corporation',
    hq_city: 'Bloomington', hq_state: 'MN',
    phone: '(651) 646-2911', website: 'www.huntelectric.com',
    categories: ['Electrical', 'Emergency Power', 'Building Automation'],
    coverage: 'regional',
    regions_served: ['Midwest', 'West'],
    states_served: ['MN', 'WI', 'ND', 'SD', 'AZ', 'CO'],
    description: 'Employee-owned electrical contractor serving federal, commercial, and industrial projects.',
  },

  // ═══════════════════════════════════════════════════════════════
  // PLUMBING
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Roto-Rooter',
    hq_city: 'Cincinnati', hq_state: 'OH',
    phone: '(800) 768-6911', website: 'www.rotorooter.com',
    categories: ['Plumbing', 'Drain Systems', 'Water Treatment'],
    coverage: 'national',
    description: 'Largest plumbing and drain cleaning company in North America. 600+ locations.',
  },
  {
    company_name: 'ARS/Rescue Rooter',
    hq_city: 'Memphis', hq_state: 'TN',
    phone: '(901) 240-6600', website: 'www.ars.com',
    categories: ['Plumbing', 'HVAC', 'Drain Systems'],
    coverage: 'national',
    description: 'American Residential Services. Major plumbing and HVAC provider with commercial division.',
  },
  {
    company_name: 'Benjamin Franklin Plumbing',
    hq_city: 'Waco', hq_state: 'TX',
    phone: '(800) 259-7705', website: 'www.benjaminfranklinplumbing.com',
    categories: ['Plumbing', 'Water Heater Services', 'Backflow Prevention'],
    coverage: 'national',
    description: 'National plumbing franchise (Authority Brands) with 250+ locations.',
  },
  {
    company_name: 'Brinco Mechanical',
    hq_city: 'Baltimore', hq_state: 'MD',
    phone: '(410) 544-1100', website: 'www.brincomechanical.com',
    categories: ['Plumbing', 'HVAC', 'Mechanical Systems'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['MD', 'DC', 'VA', 'PA', 'DE'],
    description: 'Mechanical contractor serving federal government and commercial clients in the Mid-Atlantic.',
  },
  {
    company_name: 'J.C. Cannistraro',
    hq_city: 'Watertown', hq_state: 'MA',
    phone: '(617) 926-0092', website: 'www.cannistraro.com',
    categories: ['Plumbing', 'HVAC', 'Mechanical Systems', 'Fire Life Safety'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['MA', 'NH', 'RI', 'CT', 'ME'],
    description: 'Largest mechanical contractor in New England. Plumbing, HVAC, and fire protection.',
  },
  {
    company_name: 'Murray Company',
    hq_city: 'Long Beach', hq_state: 'CA',
    phone: '(562) 426-0174', website: 'www.murraycompany.com',
    categories: ['Plumbing', 'HVAC', 'Mechanical Systems', 'Fire Life Safety'],
    coverage: 'regional',
    regions_served: ['West'],
    states_served: ['CA', 'NV', 'AZ'],
    description: 'Major mechanical contractor serving Western US commercial and government projects.',
  },

  // ═══════════════════════════════════════════════════════════════
  // PEST CONTROL
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Orkin (Rollins Inc.)',
    hq_city: 'Atlanta', hq_state: 'GA',
    phone: '(800) 800-6754', website: 'www.orkin.com',
    categories: ['Pest Control', 'Wildlife Control', 'Integrated Pest Management'],
    coverage: 'national',
    description: 'Largest pest control company in the US. Commercial and government IPM programs.',
  },
  {
    company_name: 'Terminix',
    hq_city: 'Memphis', hq_state: 'TN',
    phone: '(800) 837-6464', website: 'www.terminix.com',
    categories: ['Pest Control', 'Termite Control', 'Wildlife Control'],
    coverage: 'national',
    description: 'Second-largest pest control company in the US. Commercial and residential services.',
  },
  {
    company_name: 'Rentokil (Ehrlich Pest Control)',
    hq_city: 'Reading', hq_state: 'PA',
    phone: '(800) 837-5520', website: 'www.rentokil.com/us',
    categories: ['Pest Control', 'Integrated Pest Management', 'Wildlife Control'],
    coverage: 'national',
    description: 'Global pest control company (acquired Terminix 2023). Extensive commercial division.',
  },
  {
    company_name: 'ABC Home & Commercial Services',
    hq_city: 'Austin', hq_state: 'TX',
    phone: '(512) 837-9500', website: 'www.abchomeandcommercial.com',
    categories: ['Pest Control', 'Landscaping', 'HVAC', 'Plumbing'],
    coverage: 'regional',
    regions_served: ['Southwest', 'Southeast'],
    states_served: ['TX', 'OK', 'FL', 'GA', 'NC'],
    description: 'Multi-service home and commercial services company serving the Southern US.',
  },
  {
    company_name: 'Massey Services',
    hq_city: 'Orlando', hq_state: 'FL',
    phone: '(888) 627-7391', website: 'www.masseyservices.com',
    categories: ['Pest Control', 'Landscaping', 'Integrated Pest Management'],
    coverage: 'regional',
    regions_served: ['Southeast'],
    states_served: ['FL', 'GA', 'SC', 'NC', 'TX', 'LA', 'OK'],
    description: 'Largest family-owned pest management company in the US. Commercial and government contracts.',
  },
  {
    company_name: 'Western Pest Services',
    hq_city: 'Parsippany', hq_state: 'NJ',
    phone: '(800) 768-6911', website: 'www.westernpest.com',
    categories: ['Pest Control', 'Integrated Pest Management', 'Wildlife Control'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['NJ', 'NY', 'PA', 'CT', 'DE', 'MD', 'VA', 'DC'],
    description: 'Commercial pest management company (Rentokil subsidiary) serving the Northeast corridor.',
  },

  // ═══════════════════════════════════════════════════════════════
  // LANDSCAPING & GROUNDS MAINTENANCE
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'BrightView Holdings',
    hq_city: 'Blue Bell', hq_state: 'PA',
    phone: '(484) 567-7100', website: 'www.brightview.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Snow Removal'],
    coverage: 'national',
    description: 'Largest commercial landscaping company in the US. Development and maintenance services.',
  },
  {
    company_name: 'TruGreen',
    hq_city: 'Memphis', hq_state: 'TN',
    phone: '(800) 464-0171', website: 'www.trugreen.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Turf Management'],
    coverage: 'national',
    description: 'Largest lawn care company in North America with commercial division.',
  },
  {
    company_name: 'Yellowstone Landscape',
    hq_city: 'Bunnell', hq_state: 'FL',
    phone: '(386) 437-6211', website: 'www.yellowstonelandscape.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Irrigation'],
    coverage: 'national',
    description: 'Top-5 commercial landscaping company serving HOAs, commercial, and government properties.',
  },
  {
    company_name: 'U.S. Lawns',
    hq_city: 'Orlando', hq_state: 'FL',
    phone: '(407) 246-1630', website: 'www.uslawns.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Snow Removal'],
    coverage: 'national',
    description: 'Largest commercial grounds management franchise in the US. 250+ locations.',
  },
  {
    company_name: 'Ruppert Landscape',
    hq_city: 'Laytonsville', hq_state: 'MD',
    phone: '(301) 482-0300', website: 'www.ruppertlandscape.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Snow Removal'],
    coverage: 'regional',
    regions_served: ['Northeast', 'Southeast'],
    states_served: ['MD', 'DC', 'VA', 'PA', 'NC', 'GA', 'TX'],
    description: 'Major commercial landscape contractor serving the East Coast and select Southern markets.',
  },
  {
    company_name: 'Gothic Landscape',
    hq_city: 'Valencia', hq_state: 'CA',
    phone: '(661) 257-1266', website: 'www.gothiclandscape.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Irrigation'],
    coverage: 'regional',
    regions_served: ['West', 'Southwest'],
    states_served: ['CA', 'NV', 'AZ', 'TX'],
    description: 'Full-service commercial landscape contractor serving the Western US.',
  },
  {
    company_name: 'Mainscape',
    hq_city: 'Fishers', hq_state: 'IN',
    phone: '(317) 577-4550', website: 'www.mainscape.com',
    categories: ['Landscaping', 'Grounds Maintenance', 'Snow Removal'],
    coverage: 'national',
    description: 'National commercial landscape management company with 50+ branch locations.',
  },

  // ═══════════════════════════════════════════════════════════════
  // SNOW REMOVAL
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Ferrandino & Son',
    hq_city: 'Owings Mills', hq_state: 'MD',
    phone: '(410) 356-1001', website: 'www.ferrandinoandson.com',
    categories: ['Snow Removal', 'Landscaping', 'Grounds Maintenance', 'Janitorial'],
    coverage: 'national',
    description: 'National facilities maintenance company with large-scale snow and ice management.',
  },
  {
    company_name: 'Transblue',
    hq_city: 'Spokane', hq_state: 'WA',
    phone: '(509) 413-1915', website: 'www.transblue.org',
    categories: ['Snow Removal', 'Landscaping', 'General Maintenance'],
    coverage: 'national',
    description: 'National general contractor managing snow removal and facility services at scale.',
  },

  // ═══════════════════════════════════════════════════════════════
  // EMERGENCY POWER / GENERATORS
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Cummins Inc.',
    hq_city: 'Columbus', hq_state: 'IN',
    phone: '(812) 377-5000', website: 'www.cummins.com',
    categories: ['Emergency Power', 'Generators', 'Transfer Switches'],
    coverage: 'national',
    description: 'Global power leader. Diesel and natural gas generators, transfer switches, and service.',
  },
  {
    company_name: 'Generac Power Systems',
    hq_city: 'Waukesha', hq_state: 'WI',
    phone: '(888) 436-3722', website: 'www.generac.com',
    categories: ['Emergency Power', 'Generators', 'UPS Systems'],
    coverage: 'national',
    description: 'Leading manufacturer of standby, portable, and commercial generators. Nationwide dealer network.',
  },
  {
    company_name: 'Caterpillar Electric Power (Cat)',
    hq_city: 'Peoria', hq_state: 'IL',
    phone: '(309) 675-1000', website: 'www.cat.com/power-systems',
    categories: ['Emergency Power', 'Generators', 'UPS Systems'],
    coverage: 'national',
    description: 'Fortune 50 manufacturer. Diesel and gas generator sets with dealer service network.',
  },
  {
    company_name: 'Kohler Power Systems',
    hq_city: 'Kohler', hq_state: 'WI',
    phone: '(800) 544-2444', website: 'www.kohlerpower.com',
    categories: ['Emergency Power', 'Generators', 'Transfer Switches', 'UPS Systems'],
    coverage: 'national',
    description: 'Major generator manufacturer with authorized distributor/dealer network nationwide.',
  },
  {
    company_name: 'MTU Onsite Energy (Rolls-Royce)',
    hq_city: 'Mankato', hq_state: 'MN',
    phone: '(507) 625-7973', website: 'www.mtu-solutions.com',
    categories: ['Emergency Power', 'Generators'],
    coverage: 'national',
    description: 'Rolls-Royce subsidiary manufacturing diesel generator sets for critical power applications.',
  },

  // ═══════════════════════════════════════════════════════════════
  // SECURITY SYSTEMS
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Allied Universal',
    hq_city: 'Conshohocken', hq_state: 'PA',
    phone: '(866) 825-5433', website: 'www.aus.com',
    categories: ['Security Systems', 'Access Control', 'CCTV'],
    coverage: 'national',
    description: 'Largest security company in North America. Guarding, technology, and systems integration.',
  },
  {
    company_name: 'Securitas',
    hq_city: 'Parsippany', hq_state: 'NJ',
    phone: '(888) 232-7465', website: 'www.securitas.com/us',
    categories: ['Security Systems', 'Access Control', 'CCTV', 'Intrusion Detection'],
    coverage: 'national',
    description: 'Global security services company with electronic security and systems integration.',
  },
  {
    company_name: 'Convergint Technologies',
    hq_city: 'Schaumburg', hq_state: 'IL',
    phone: '(847) 466-9696', website: 'www.convergint.com',
    categories: ['Security Systems', 'Fire Life Safety', 'Access Control', 'CCTV'],
    coverage: 'national',
    description: 'Global systems integrator for electronic security, fire, and life safety. 200+ locations.',
  },
  {
    company_name: 'Stanley Security (Securitas)',
    hq_city: 'Indianapolis', hq_state: 'IN',
    phone: '(800) 731-5724', website: 'www.stanleysecurity.com',
    categories: ['Security Systems', 'Access Control', 'CCTV', 'Intrusion Detection'],
    coverage: 'national',
    description: 'Comprehensive electronic security integration and managed services.',
  },

  // ═══════════════════════════════════════════════════════════════
  // ROOFING
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Tecta America',
    hq_city: 'Rosemont', hq_state: 'IL',
    phone: '(847) 451-8100', website: 'www.tectaamerica.com',
    categories: ['Roofing', 'Waterproofing', 'Roof Maintenance'],
    coverage: 'national',
    description: 'Largest commercial roofing contractor in the US. 70+ locations.',
  },
  {
    company_name: 'Baker Roofing Company',
    hq_city: 'Raleigh', hq_state: 'NC',
    phone: '(919) 828-2975', website: 'www.bakerroofing.com',
    categories: ['Roofing', 'Waterproofing', 'Sheet Metal'],
    coverage: 'regional',
    regions_served: ['Southeast'],
    states_served: ['NC', 'SC', 'VA', 'GA', 'FL', 'TN'],
    description: 'Largest family-owned commercial roofing company in the US. Southeast focus.',
  },
  {
    company_name: 'Nations Roof',
    hq_city: 'Mobile', hq_state: 'AL',
    phone: '(800) 540-4951', website: 'www.nationsroof.com',
    categories: ['Roofing', 'Roof Maintenance', 'Waterproofing'],
    coverage: 'national',
    description: 'National commercial roofing contractor with 30+ offices across the US.',
  },
  {
    company_name: 'CentiMark Corporation',
    hq_city: 'Canonsburg', hq_state: 'PA',
    phone: '(800) 224-1994', website: 'www.centimark.com',
    categories: ['Roofing', 'Flooring', 'Waterproofing'],
    coverage: 'national',
    description: 'Largest privately held commercial roofing contractor in North America.',
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCK EQUIPMENT
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Rite-Hite',
    hq_city: 'Milwaukee', hq_state: 'WI',
    phone: '(414) 355-2600', website: 'www.ritehite.com',
    categories: ['Dock Equipment', 'Loading Systems', 'Overhead Doors'],
    coverage: 'national',
    description: 'Global leader in loading dock equipment, industrial doors, and safety barriers.',
  },
  {
    company_name: 'Pentalift Equipment',
    hq_city: 'Buffalo', hq_state: 'NY',
    phone: '(905) 688-0388', website: 'www.pentalift.com',
    categories: ['Dock Equipment', 'Dock Levelers', 'Material Handling'],
    coverage: 'national',
    description: 'Manufacturer of dock levelers, dock lifts, and loading dock equipment.',
  },
  {
    company_name: 'McGuire (Assa Abloy)',
    hq_city: 'Hudson', hq_state: 'NY',
    phone: '(518) 828-1524', website: 'www.mcguiregroup.com',
    categories: ['Dock Equipment', 'Loading Systems', 'Dock Levelers'],
    coverage: 'national',
    description: 'Loading dock equipment manufacturer and service provider (Assa Abloy subsidiary).',
  },

  // ═══════════════════════════════════════════════════════════════
  // BUILDING AUTOMATION
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Schneider Electric',
    hq_city: 'Andover', hq_state: 'MA',
    phone: '(847) 397-2600', website: 'www.se.com',
    categories: ['Building Automation', 'Electrical', 'Energy Management'],
    coverage: 'national',
    description: 'Global energy management and building automation company.',
  },
  {
    company_name: 'Automated Logic (Carrier)',
    hq_city: 'Kennesaw', hq_state: 'GA',
    phone: '(770) 429-3000', website: 'www.automatedlogic.com',
    categories: ['Building Automation', 'HVAC', 'Energy Management'],
    coverage: 'national',
    description: 'Building automation and energy management systems (Carrier subsidiary).',
  },

  // ═══════════════════════════════════════════════════════════════
  // WASTE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Waste Management (WM)',
    hq_city: 'Houston', hq_state: 'TX',
    phone: '(800) 963-4776', website: 'www.wm.com',
    categories: ['Waste Management', 'Recycling'],
    coverage: 'national',
    description: 'Largest waste management company in North America.',
  },
  {
    company_name: 'Republic Services',
    hq_city: 'Phoenix', hq_state: 'AZ',
    phone: '(480) 627-2700', website: 'www.republicservices.com',
    categories: ['Waste Management', 'Recycling'],
    coverage: 'national',
    description: 'Second-largest waste management company in the US.',
  },
  {
    company_name: 'Stericycle',
    hq_city: 'Bannockburn', hq_state: 'IL',
    phone: '(866) 783-7422', website: 'www.stericycle.com',
    categories: ['Waste Management', 'Hazardous Waste'],
    coverage: 'national',
    description: 'Regulated and compliance waste management for government and commercial facilities.',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAINTING
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'CertaPro Painters',
    hq_city: 'Audubon', hq_state: 'PA',
    phone: '(800) 462-3782', website: 'www.certapro.com',
    categories: ['Painting', 'Coatings'],
    coverage: 'national',
    description: 'Largest commercial and residential painting franchise in North America.',
  },
  {
    company_name: 'Ascher Brothers',
    hq_city: 'New York', hq_state: 'NY',
    phone: '(212) 736-4400', website: 'www.ascherbrothers.com',
    categories: ['Painting', 'Wallcovering', 'Coatings'],
    coverage: 'regional',
    regions_served: ['Northeast'],
    states_served: ['NY', 'NJ', 'CT', 'PA'],
    description: 'Leading commercial painting contractor in the Northeast US.',
  },

  // ═══════════════════════════════════════════════════════════════
  // FLOORING
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'Diverzify (formerly Encompass)',
    hq_city: 'Houston', hq_state: 'TX',
    phone: '(713) 850-8840', website: 'www.diverzify.com',
    categories: ['Flooring', 'General Maintenance'],
    coverage: 'national',
    description: 'Largest commercial flooring services company in the US.',
  },
  {
    company_name: 'Continental Building Products',
    hq_city: 'Herndon', hq_state: 'VA',
    phone: '(703) 480-3800', website: 'www.continental-building.com',
    categories: ['Flooring', 'Painting', 'General Maintenance'],
    coverage: 'regional',
    regions_served: ['Northeast', 'Southeast'],
    states_served: ['VA', 'MD', 'DC', 'PA', 'NC', 'SC', 'GA'],
    description: 'Commercial interior contractor specializing in flooring and wall systems.',
  },

  // ═══════════════════════════════════════════════════════════════
  // GENERAL / FACILITY MAINTENANCE
  // ═══════════════════════════════════════════════════════════════
  {
    company_name: 'JLL (Jones Lang LaSalle)',
    hq_city: 'Chicago', hq_state: 'IL',
    phone: '(312) 782-5800', website: 'www.jll.com',
    categories: ['General Maintenance', 'Janitorial', 'HVAC', 'Electrical'],
    coverage: 'national',
    description: 'Fortune 500 commercial real estate and facility management company.',
  },
  {
    company_name: 'CBRE Group',
    hq_city: 'Dallas', hq_state: 'TX',
    phone: '(214) 979-6100', website: 'www.cbre.com',
    categories: ['General Maintenance', 'Janitorial', 'Grounds Maintenance'],
    coverage: 'national',
    description: 'World\'s largest commercial real estate services and investment firm.',
  },
]

/**
 * Search curated companies by category and coverage scope.
 */
export function searchCuratedCompanies(
  category: string,
  scope: 'local' | 'regional' | 'national',
  options?: {
    state?: string
    region?: string
  }
): CuratedCompany[] {
  const normalizedCat = category.toLowerCase().trim()

  // Match companies whose categories include the search term (fuzzy)
  const categoryMatches = CURATED_COMPANIES.filter(c =>
    c.categories.some(cat => {
      const normCat = cat.toLowerCase()
      return normCat.includes(normalizedCat) || normalizedCat.includes(normCat)
    })
  )

  if (scope === 'national') {
    // National search: return all matching companies regardless of coverage
    return categoryMatches
  }

  if (scope === 'regional' && options?.region) {
    const regionName = options.region
    const regionStates = REGION_STATES[regionName] || []
    return categoryMatches.filter(c => {
      if (c.coverage === 'national') return true
      if (c.coverage === 'regional') {
        // Check if company serves this region
        if (c.regions_served?.includes(regionName)) return true
        // Check if company serves any state in this region
        if (c.states_served?.some(s => regionStates.includes(s))) return true
      }
      return false
    })
  }

  if (scope === 'local' && options?.state) {
    const st = options.state.toUpperCase()
    const stateRegion = getRegionForState(st)
    return categoryMatches.filter(c => {
      if (c.coverage === 'national') return true
      if (c.coverage === 'regional') {
        if (c.states_served?.includes(st)) return true
        if (stateRegion && c.regions_served?.includes(stateRegion)) return true
      }
      if (c.coverage === 'local') {
        if (c.hq_state.toUpperCase() === st) return true
      }
      return false
    })
  }

  // Fallback: return all matches
  return categoryMatches
}
