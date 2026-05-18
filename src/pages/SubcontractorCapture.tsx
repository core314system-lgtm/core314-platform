import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { markMultipleSources } from '../lib/subcontractorSources'
import { Search, MapPin, Plus, CheckCircle, Building, Phone, Globe, Loader2, AlertCircle, Radar, Globe2 } from 'lucide-react'

const CUSTOM_CATEGORIES_KEY = 'core314_custom_service_categories'

type SearchScope = 'local' | 'regional' | 'national'
type Region = 'West' | 'Southwest' | 'Southeast' | 'Northeast' | 'Midwest' | 'Pacific Northwest'

const REGIONS: Record<Region, { states: string[]; cities: Array<{ city: string; state: string }> }> = {
  'West': {
    states: ['CA', 'NV', 'UT', 'CO', 'AZ'],
    cities: [
      { city: 'Los Angeles', state: 'CA' }, { city: 'Denver', state: 'CO' },
      { city: 'Phoenix', state: 'AZ' }, { city: 'Las Vegas', state: 'NV' },
      { city: 'Salt Lake City', state: 'UT' }, { city: 'San Diego', state: 'CA' },
    ],
  },
  'Southwest': {
    states: ['TX', 'NM', 'OK', 'AZ'],
    cities: [
      { city: 'Dallas', state: 'TX' }, { city: 'Houston', state: 'TX' },
      { city: 'San Antonio', state: 'TX' }, { city: 'Austin', state: 'TX' },
      { city: 'Albuquerque', state: 'NM' }, { city: 'Oklahoma City', state: 'OK' },
    ],
  },
  'Southeast': {
    states: ['FL', 'GA', 'NC', 'SC', 'VA', 'TN'],
    cities: [
      { city: 'Atlanta', state: 'GA' }, { city: 'Miami', state: 'FL' },
      { city: 'Charlotte', state: 'NC' }, { city: 'Nashville', state: 'TN' },
      { city: 'Jacksonville', state: 'FL' }, { city: 'Tampa', state: 'FL' },
    ],
  },
  'Northeast': {
    states: ['NY', 'NJ', 'PA', 'MA', 'CT', 'MD'],
    cities: [
      { city: 'New York', state: 'NY' }, { city: 'Philadelphia', state: 'PA' },
      { city: 'Boston', state: 'MA' }, { city: 'Baltimore', state: 'MD' },
      { city: 'Newark', state: 'NJ' }, { city: 'Hartford', state: 'CT' },
    ],
  },
  'Midwest': {
    states: ['IL', 'OH', 'MI', 'IN', 'WI', 'MN'],
    cities: [
      { city: 'Chicago', state: 'IL' }, { city: 'Columbus', state: 'OH' },
      { city: 'Detroit', state: 'MI' }, { city: 'Indianapolis', state: 'IN' },
      { city: 'Milwaukee', state: 'WI' }, { city: 'Minneapolis', state: 'MN' },
    ],
  },
  'Pacific Northwest': {
    states: ['WA', 'OR', 'ID'],
    cities: [
      { city: 'Seattle', state: 'WA' }, { city: 'Portland', state: 'OR' },
      { city: 'Boise', state: 'ID' }, { city: 'Tacoma', state: 'WA' },
      { city: 'Spokane', state: 'WA' }, { city: 'Eugene', state: 'OR' },
    ],
  },
}

const NATIONAL_CITIES = [
  { city: 'New York', state: 'NY' }, { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' }, { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' }, { city: 'Philadelphia', state: 'PA' },
  { city: 'San Antonio', state: 'TX' }, { city: 'Dallas', state: 'TX' },
  { city: 'Atlanta', state: 'GA' }, { city: 'Denver', state: 'CO' },
  { city: 'Seattle', state: 'WA' }, { city: 'Miami', state: 'FL' },
]

const DEFAULT_SERVICE_CATEGORIES = [
  'HVAC', 'Fire Life Safety', 'Janitorial', 'Landscaping', 'Snow Removal',
  'Emergency Power', 'Plumbing', 'Electrical', 'Pest Control', 'Dock Equipment',
  'Elevator Maintenance', 'Roofing', 'Painting', 'Flooring', 'Security Systems',
  'Building Automation', 'Grounds Maintenance', 'Waste Management', 'General Maintenance',
]

function loadCustomCategories(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

function saveCustomCategory(cat: string) {
  const existing = loadCustomCategories()
  const normalized = cat.trim()
  if (!normalized) return
  const allKnown = [...DEFAULT_SERVICE_CATEGORIES, ...existing].map(c => c.toLowerCase())
  if (allKnown.includes(normalized.toLowerCase())) return
  existing.push(normalized)
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(existing))
}

interface DiscoveredSub {
  id: string
  company_name: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  categories: string[]
  location_city: string
  location_state: string
  selected: boolean
  imported: boolean
}

// Simulated commercial subcontractor discovery engine
// In production, this would call Google Places API, Yelp, or other commercial directories
async function discoverSubcontractors(
  category: string,
  location: string,
  _radius: number,
  scope: SearchScope = 'local',
  region?: Region
): Promise<DiscoveredSub[]> {
  // For regional/national, generate results from multiple cities
  if (scope === 'national' || scope === 'regional') {
    const cities = scope === 'national'
      ? NATIONAL_CITIES
      : (region ? REGIONS[region].cities : NATIONAL_CITIES)
    
    const allResults: DiscoveredSub[] = []
    for (const cityInfo of cities) {
      const results = await discoverSingleLocation(category, cityInfo.city, cityInfo.state)
      // Take 2-3 results per city for wider coverage
      const take = 2 + (cityInfo.city.length % 2)
      allResults.push(...results.slice(0, take))
    }
    return allResults
  }

  // Local search: use the location string
  const locationParts = location.split(',').map(s => s.trim())
  const city = locationParts[0] || 'Denver'
  const state = locationParts[1] || 'CO'
  return discoverSingleLocation(category, city, state)
}

async function discoverSingleLocation(category: string, city: string, state: string): Promise<DiscoveredSub[]> {

  const companyTemplates: Record<string, Array<{ prefix: string; suffix: string; specialties: string[] }>> = {
    'HVAC': [
      { prefix: 'Summit', suffix: 'Heating & Air', specialties: ['HVAC', 'Building Automation'] },
      { prefix: 'Precision', suffix: 'Climate Control', specialties: ['HVAC', 'Energy Management'] },
      { prefix: 'Reliable', suffix: 'Mechanical Services', specialties: ['HVAC', 'Mechanical Systems'] },
      { prefix: 'AirFlow', suffix: 'Solutions', specialties: ['HVAC', 'Ventilation'] },
      { prefix: 'ThermalTech', suffix: 'Commercial HVAC', specialties: ['HVAC', 'Refrigeration'] },
      { prefix: 'ProAir', suffix: 'Systems Inc', specialties: ['HVAC', 'Controls'] },
      { prefix: 'AllSeason', suffix: 'Comfort Systems', specialties: ['HVAC', 'Building Automation'] },
      { prefix: 'Metro', suffix: 'Mechanical Corp', specialties: ['HVAC', 'Plumbing'] },
      { prefix: 'Arctic', suffix: 'Air Conditioning', specialties: ['HVAC', 'Cooling Systems'] },
      { prefix: 'BlueLine', suffix: 'HVAC Solutions', specialties: ['HVAC', 'Energy Management'] },
      { prefix: 'ComfortZone', suffix: 'Mechanical', specialties: ['HVAC', 'Indoor Air Quality'] },
      { prefix: 'ClimateCraft', suffix: 'Services LLC', specialties: ['HVAC', 'Controls'] },
      { prefix: 'EcoBreeze', suffix: 'HVAC Group', specialties: ['HVAC', 'Green Solutions'] },
      { prefix: 'FrostFree', suffix: 'Commercial Systems', specialties: ['HVAC', 'Refrigeration'] },
      { prefix: 'HeatWave', suffix: 'Mechanical Services', specialties: ['HVAC', 'Heating Systems'] },
      { prefix: 'IronAir', suffix: 'Climate Solutions', specialties: ['HVAC', 'Building Automation'] },
      { prefix: 'JetStream', suffix: 'Air Systems', specialties: ['HVAC', 'Ventilation'] },
      { prefix: 'KeyStone', suffix: 'Heating & Cooling', specialties: ['HVAC', 'Geothermal'] },
      { prefix: 'LightBreeze', suffix: 'HVAC Corp', specialties: ['HVAC', 'Energy Efficiency'] },
      { prefix: 'MountainAir', suffix: 'Comfort Systems', specialties: ['HVAC', 'Heat Pumps'] },
    ],
    'Fire Life Safety': [
      { prefix: 'Shield', suffix: 'Fire Protection', specialties: ['Fire Life Safety', 'Fire Alarm Systems'] },
      { prefix: 'Guardian', suffix: 'Safety Systems', specialties: ['Fire Life Safety', 'Suppression Systems'] },
      { prefix: 'FireWatch', suffix: 'Services LLC', specialties: ['Fire Life Safety', 'Code Compliance'] },
      { prefix: 'National', suffix: 'Fire & Safety', specialties: ['Fire Life Safety', 'Emergency Systems'] },
      { prefix: 'ProGuard', suffix: 'Fire Solutions', specialties: ['Fire Life Safety', 'Sprinkler Systems'] },
      { prefix: 'BlazeSafe', suffix: 'Commercial', specialties: ['Fire Life Safety', 'Alarm Testing'] },
      { prefix: 'AlertFire', suffix: 'Systems Inc', specialties: ['Fire Life Safety', 'Fire Alarm Systems'] },
      { prefix: 'CodeRed', suffix: 'Protection Services', specialties: ['Fire Life Safety', 'Code Compliance'] },
      { prefix: 'FlameGuard', suffix: 'Safety Corp', specialties: ['Fire Life Safety', 'Suppression Systems'] },
      { prefix: 'HeatShield', suffix: 'Fire Services', specialties: ['Fire Life Safety', 'Fire Doors'] },
      { prefix: 'InfernoPro', suffix: 'Solutions', specialties: ['Fire Life Safety', 'Emergency Systems'] },
      { prefix: 'SafeFlame', suffix: 'Commercial Fire', specialties: ['Fire Life Safety', 'Sprinkler Systems'] },
    ],
    'Janitorial': [
      { prefix: 'CleanPro', suffix: 'Facility Services', specialties: ['Janitorial', 'Floor Care'] },
      { prefix: 'SparkleMax', suffix: 'Commercial Cleaning', specialties: ['Janitorial', 'Custodial Services'] },
      { prefix: 'Premier', suffix: 'Building Services', specialties: ['Janitorial', 'Window Cleaning'] },
      { prefix: 'CrystalClear', suffix: 'Maintenance', specialties: ['Janitorial', 'Sanitation'] },
      { prefix: 'NextGen', suffix: 'Cleaning Solutions', specialties: ['Janitorial', 'Floor Care'] },
      { prefix: 'EcoClean', suffix: 'Services Inc', specialties: ['Janitorial', 'Green Cleaning'] },
      { prefix: 'BrightShine', suffix: 'Janitorial Corp', specialties: ['Janitorial', 'Floor Care'] },
      { prefix: 'DustFree', suffix: 'Commercial Services', specialties: ['Janitorial', 'Deep Cleaning'] },
      { prefix: 'FreshStart', suffix: 'Facility Group', specialties: ['Janitorial', 'Sanitation'] },
      { prefix: 'GleamWorks', suffix: 'Cleaning Co', specialties: ['Janitorial', 'Window Cleaning'] },
      { prefix: 'PureSpace', suffix: 'Maintenance LLC', specialties: ['Janitorial', 'Green Cleaning'] },
      { prefix: 'SpotlessEdge', suffix: 'Services', specialties: ['Janitorial', 'Carpet Cleaning'] },
    ],
    'Landscaping': [
      { prefix: 'GreenScape', suffix: 'Management', specialties: ['Landscaping', 'Grounds Maintenance'] },
      { prefix: 'TerraForm', suffix: 'Landscape Services', specialties: ['Landscaping', 'Irrigation'] },
      { prefix: 'NaturePro', suffix: 'Grounds Care', specialties: ['Landscaping', 'Snow Removal'] },
      { prefix: 'MowTech', suffix: 'Commercial', specialties: ['Landscaping', 'Grounds Maintenance'] },
      { prefix: 'EvergreenEdge', suffix: 'Outdoor Services', specialties: ['Landscaping', 'Seasonal Planting'] },
      { prefix: 'BladeRunner', suffix: 'Lawn Care', specialties: ['Landscaping', 'Turf Management'] },
      { prefix: 'CanopyGreen', suffix: 'Services LLC', specialties: ['Landscaping', 'Tree Care'] },
      { prefix: 'DesertBlooom', suffix: 'Landscape Group', specialties: ['Landscaping', 'Xeriscaping'] },
      { prefix: 'EdgeMaster', suffix: 'Grounds Services', specialties: ['Landscaping', 'Hardscaping'] },
      { prefix: 'FloraFirst', suffix: 'Commercial Landscape', specialties: ['Landscaping', 'Irrigation'] },
      { prefix: 'GardenPro', suffix: 'Outdoor Solutions', specialties: ['Landscaping', 'Seasonal Planting'] },
    ],
    'Emergency Power': [
      { prefix: 'PowerGuard', suffix: 'Systems', specialties: ['Emergency Power', 'Generators'] },
      { prefix: 'GenTech', suffix: 'Power Solutions', specialties: ['Emergency Power', 'UPS Systems'] },
      { prefix: 'ReliaPower', suffix: 'Services LLC', specialties: ['Emergency Power', 'Electrical Systems'] },
      { prefix: 'VoltStar', suffix: 'Energy Systems', specialties: ['Emergency Power', 'Transfer Switches'] },
      { prefix: 'BackupPro', suffix: 'Generator Services', specialties: ['Emergency Power', 'Load Testing'] },
      { prefix: 'GridSafe', suffix: 'Power Corp', specialties: ['Emergency Power', 'Battery Systems'] },
      { prefix: 'LightForce', suffix: 'Emergency Systems', specialties: ['Emergency Power', 'UPS Systems'] },
      { prefix: 'PowerVault', suffix: 'Solutions Inc', specialties: ['Emergency Power', 'Generators'] },
      { prefix: 'StormReady', suffix: 'Power Services', specialties: ['Emergency Power', 'Transfer Switches'] },
      { prefix: 'SurgeGuard', suffix: 'Electric LLC', specialties: ['Emergency Power', 'Load Testing'] },
    ],
    'Plumbing': [
      { prefix: 'AquaTech', suffix: 'Plumbing Solutions', specialties: ['Plumbing', 'Backflow Prevention'] },
      { prefix: 'FlowMaster', suffix: 'Commercial Plumbing', specialties: ['Plumbing', 'Water Treatment'] },
      { prefix: 'PipePro', suffix: 'Services Inc', specialties: ['Plumbing', 'Drain Systems'] },
      { prefix: 'ClearDrain', suffix: 'Plumbing Corp', specialties: ['Plumbing', 'Water Heater Services'] },
      { prefix: 'HydroMax', suffix: 'Plumbing & Mechanical', specialties: ['Plumbing', 'Backflow Prevention'] },
      { prefix: 'BlueWater', suffix: 'Commercial Services', specialties: ['Plumbing', 'Water Treatment'] },
      { prefix: 'DrainMaster', suffix: 'Solutions LLC', specialties: ['Plumbing', 'Sewer Systems'] },
      { prefix: 'IronPipe', suffix: 'Plumbing Group', specialties: ['Plumbing', 'Commercial Repairs'] },
      { prefix: 'JetFlow', suffix: 'Mechanical Services', specialties: ['Plumbing', 'Drain Systems'] },
      { prefix: 'TrueFlow', suffix: 'Plumbing Co', specialties: ['Plumbing', 'Water Heater Services'] },
    ],
    'Pest Control': [
      { prefix: 'BugShield', suffix: 'Pest Management', specialties: ['Pest Control', 'Integrated Pest Management'] },
      { prefix: 'CritterGuard', suffix: 'Commercial Services', specialties: ['Pest Control', 'Wildlife Control'] },
      { prefix: 'SafeZone', suffix: 'Pest Solutions', specialties: ['Pest Control', 'Rodent Control'] },
      { prefix: 'EcoPest', suffix: 'Control Inc', specialties: ['Pest Control', 'Integrated Pest Management'] },
      { prefix: 'GreenBarrier', suffix: 'Pest Services', specialties: ['Pest Control', 'Organic Solutions'] },
      { prefix: 'PestFree', suffix: 'Commercial LLC', specialties: ['Pest Control', 'Termite Control'] },
      { prefix: 'ShieldBug', suffix: 'Solutions Corp', specialties: ['Pest Control', 'Rodent Control'] },
      { prefix: 'VerminGuard', suffix: 'Services', specialties: ['Pest Control', 'Wildlife Control'] },
    ],
    'Dock Equipment': [
      { prefix: 'LoadMaster', suffix: 'Dock Services', specialties: ['Dock Equipment', 'Loading Systems'] },
      { prefix: 'DockPro', suffix: 'Solutions LLC', specialties: ['Dock Equipment', 'Overhead Doors'] },
      { prefix: 'IndustrialDoor', suffix: 'Services', specialties: ['Dock Equipment', 'Material Handling'] },
      { prefix: 'BayTech', suffix: 'Loading Systems', specialties: ['Dock Equipment', 'Dock Levelers'] },
      { prefix: 'CargoGate', suffix: 'Equipment Inc', specialties: ['Dock Equipment', 'Dock Seals'] },
      { prefix: 'FreightDoor', suffix: 'Solutions', specialties: ['Dock Equipment', 'Overhead Doors'] },
      { prefix: 'LiftGate', suffix: 'Services Corp', specialties: ['Dock Equipment', 'Material Handling'] },
      { prefix: 'RampTech', suffix: 'Dock Equipment', specialties: ['Dock Equipment', 'Dock Levelers'] },
    ],
    'Electrical': [
      { prefix: 'CurrentFlow', suffix: 'Electric', specialties: ['Electrical', 'Emergency Power'] },
      { prefix: 'BrightSpark', suffix: 'Electrical Services', specialties: ['Electrical', 'Lighting'] },
      { prefix: 'PowerLine', suffix: 'Contractors', specialties: ['Electrical', 'Building Automation'] },
      { prefix: 'VoltEdge', suffix: 'Electric Inc', specialties: ['Electrical', 'Panel Upgrades'] },
      { prefix: 'AmpTech', suffix: 'Electrical Solutions', specialties: ['Electrical', 'Wiring Systems'] },
      { prefix: 'CircuitPro', suffix: 'Services LLC', specialties: ['Electrical', 'Emergency Power'] },
      { prefix: 'FlashPoint', suffix: 'Electric Corp', specialties: ['Electrical', 'Lighting'] },
      { prefix: 'OhmGuard', suffix: 'Commercial Electric', specialties: ['Electrical', 'Panel Upgrades'] },
    ],
    'Elevator Maintenance': [
      { prefix: 'LiftTech', suffix: 'Elevator Services', specialties: ['Elevator Maintenance', 'Vertical Transport'] },
      { prefix: 'Ascend', suffix: 'Elevator Company', specialties: ['Elevator Maintenance', 'Escalator Service'] },
      { prefix: 'VerticalPro', suffix: 'Maintenance LLC', specialties: ['Elevator Maintenance', 'Modernization'] },
      { prefix: 'UpRise', suffix: 'Elevator Solutions', specialties: ['Elevator Maintenance', 'Vertical Transport'] },
      { prefix: 'SkyLift', suffix: 'Services Corp', specialties: ['Elevator Maintenance', 'Escalator Service'] },
      { prefix: 'FloorLink', suffix: 'Elevator Group', specialties: ['Elevator Maintenance', 'Modernization'] },
    ],
    'Roofing': [
      { prefix: 'TopShield', suffix: 'Roofing', specialties: ['Roofing', 'Waterproofing'] },
      { prefix: 'PeakGuard', suffix: 'Commercial Roofing', specialties: ['Roofing', 'Roof Maintenance'] },
      { prefix: 'StormSafe', suffix: 'Roof Systems', specialties: ['Roofing', 'Leak Repair'] },
      { prefix: 'CapRock', suffix: 'Roofing Solutions', specialties: ['Roofing', 'Flat Roofs'] },
      { prefix: 'SkyCoat', suffix: 'Roofing Corp', specialties: ['Roofing', 'Waterproofing'] },
      { prefix: 'TileMax', suffix: 'Commercial Roof', specialties: ['Roofing', 'Roof Maintenance'] },
    ],
    'Security Systems': [
      { prefix: 'SecureTech', suffix: 'Solutions', specialties: ['Security Systems', 'Access Control'] },
      { prefix: 'VaultGuard', suffix: 'Security Services', specialties: ['Security Systems', 'CCTV'] },
      { prefix: 'WatchDog', suffix: 'Systems Inc', specialties: ['Security Systems', 'Intrusion Detection'] },
      { prefix: 'AlarmPro', suffix: 'Security LLC', specialties: ['Security Systems', 'Access Control'] },
      { prefix: 'EagleEye', suffix: 'Surveillance Corp', specialties: ['Security Systems', 'CCTV'] },
      { prefix: 'FortressNet', suffix: 'Security Solutions', specialties: ['Security Systems', 'Intrusion Detection'] },
    ],
    'Snow Removal': [
      { prefix: 'SnowPro', suffix: 'Services', specialties: ['Snow Removal', 'Ice Management'] },
      { prefix: 'IceClear', suffix: 'Solutions LLC', specialties: ['Snow Removal', 'Parking Lot Maintenance'] },
      { prefix: 'WinterGuard', suffix: 'Snow & Ice', specialties: ['Snow Removal', 'Salt Application'] },
      { prefix: 'BlizzardBust', suffix: 'Services Corp', specialties: ['Snow Removal', 'Ice Management'] },
      { prefix: 'FreezeShield', suffix: 'Snow Removal', specialties: ['Snow Removal', 'De-Icing'] },
      { prefix: 'PolarPlow', suffix: 'Commercial LLC', specialties: ['Snow Removal', 'Parking Lot Maintenance'] },
    ],
  }

  // Default templates for categories not explicitly defined
  const defaultTemplates = [
    { prefix: 'ProServ', suffix: 'Solutions', specialties: [category, 'General Maintenance'] },
    { prefix: 'National', suffix: 'Services Corp', specialties: [category, 'Facility Management'] },
    { prefix: 'Metro', suffix: `${category} Services`, specialties: [category] },
    { prefix: 'Alliance', suffix: 'Commercial', specialties: [category, 'Building Services'] },
    { prefix: 'Premier', suffix: 'Facility Care', specialties: [category] },
  ]

  const templates = companyTemplates[category] || defaultTemplates

  // Use city name as a deterministic seed so different locations produce different results
  const cityHash = city.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const stateHash = state.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const locationSeed = cityHash + stateHash

  // Location-based prefixes to make company names unique per city
  const locationPrefixes = [city, city.split(' ')[0], state, `${city} Metro`, `${state} State`, city.slice(0, 3).toUpperCase()]

  // Generate 8-12 realistic results from the pool, using location seed for selection
  const count = Math.min(templates.length, 8 + (locationSeed % 5))
  const seededSort = [...templates].map((t, i) => ({ t, sort: ((i + 1) * locationSeed * 7 + i * 13) % 1000 }))
  seededSort.sort((a, b) => a.sort - b.sort)
  const selected = seededSort.slice(0, count).map(s => s.t)

  const streetNames = ['Industrial Blvd', 'Commerce Dr', 'Business Park Way', 'Corporate Ave', 'Trade Center Rd', 'Enterprise St', 'Market St', 'Main St']
  const areaCodes: Record<string, string[]> = {
    'FL': ['904', '305', '407', '813', '954'],
    'TX': ['214', '972', '817', '469', '512'],
    'CO': ['303', '720', '719', '970'],
    'CA': ['213', '310', '415', '619', '916'],
    'NY': ['212', '718', '516', '914'],
    'GA': ['404', '678', '770'],
    'IL': ['312', '773', '630'],
    'AZ': ['602', '480', '520'],
    'OH': ['614', '216', '513'],
    'VA': ['703', '804', '757'],
  }
  const stateAreaCodes = areaCodes[state.toUpperCase()] || ['555', '800', '888']
  const areaCode = stateAreaCodes[(locationSeed) % stateAreaCodes.length]

  return selected.map((t, i) => {
    const useLocationName = ((i + locationSeed) % 3) === 0
    const locPrefix = locationPrefixes[(i + locationSeed) % locationPrefixes.length]
    const companyName = useLocationName
      ? `${locPrefix} ${t.suffix}`
      : `${t.prefix} ${t.suffix} of ${city}`

    return {
      id: `disc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      company_name: companyName,
      address: `${1000 + ((locationSeed * (i + 1) * 37) % 8000)} ${streetNames[i % streetNames.length]}, ${city}, ${state}`,
      phone: `(${areaCode}) ${100 + ((locationSeed * (i + 1) * 17) % 900)}-${1000 + ((locationSeed * (i + 1) * 23) % 9000)}`,
      website: `www.${t.prefix.toLowerCase()}${city.toLowerCase().replace(/[^a-z]/g, '').slice(0, 4)}.com`,
      rating: Math.round((3.5 + ((locationSeed * (i + 1) * 11) % 15) / 10) * 10) / 10,
      review_count: 10 + ((locationSeed * (i + 1) * 31) % 150),
      categories: t.specialties,
      location_city: city,
      location_state: state,
      selected: false,
      imported: false,
    }
  })
}

export default function SubcontractorCapture() {
  const [category, setCategory] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState(50)
  const [searchScope, setSearchScope] = useState<SearchScope>('local')
  const [selectedRegion, setSelectedRegion] = useState<Region>('West')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<DiscoveredSub[]>([])
  const [importing, setImporting] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState('')
  const [searchPerformed, setSearchPerformed] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const allCategories = [...DEFAULT_SERVICE_CATEGORIES, ...customCategories]
  const effectiveCategory = customInput.trim() || category

  // Filter suggestions based on custom input
  const suggestions = customInput.trim()
    ? allCategories.filter(c => c.toLowerCase().includes(customInput.trim().toLowerCase()))
    : []

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch() {
    if (!effectiveCategory) {
      setError('Please select or enter a service category.')
      return
    }
    if (searchScope === 'local' && !location) {
      setError('Please enter a location for local search.')
      return
    }

    // Save custom category if it's new
    if (customInput.trim()) {
      saveCustomCategory(customInput.trim())
      setCustomCategories(loadCustomCategories())
    }

    setError('')
    setSearching(true)
    setResults([])
    setSearchPerformed(true)

    try {
      // Simulate API latency
      await new Promise(resolve => setTimeout(resolve, searchScope === 'local' ? 1500 : 2500))
      const discovered = await discoverSubcontractors(
        effectiveCategory,
        location,
        radius,
        searchScope,
        searchScope === 'regional' ? selectedRegion : undefined
      )

      // Check against existing database to avoid showing duplicates
      const { data: existing } = await supabase.from('subcontractors').select('company_name')
      const existingNames = new Set((existing || []).map(s => s.company_name.toLowerCase()))
      const filtered = discovered.filter(d => !existingNames.has(d.company_name.toLowerCase()))

      setResults(filtered)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  function toggleSelect(id: string) {
    setResults(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r))
  }

  function selectAll() {
    const allSelected = results.filter(r => !r.imported).every(r => r.selected)
    setResults(prev => prev.map(r => r.imported ? r : { ...r, selected: !allSelected }))
  }

  async function handleImport() {
    const selected = results.filter(r => r.selected && !r.imported)
    if (selected.length === 0) return

    setImporting(true)
    setImportCount(0)

    const records = selected.map(s => ({
      company_name: s.company_name,
      contact_name: null,
      contact_email: null,
      contact_phone: s.phone,
      service_categories: s.categories,
      geographic_coverage: [s.location_state],
      preferred: false,
      incumbent_status: 'unknown' as const,
      performance_notes: `Discovered via Core314 Subcontractor Capture. Address: ${s.address}${s.website ? '. Website: ' + s.website : ''}${s.rating ? '. Rating: ' + s.rating + '/5 (' + s.review_count + ' reviews)' : ''}`,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('subcontractors')
      .insert(records)
      .select()

    if (insertErr) {
      setError('Import failed: ' + insertErr.message)
      setImporting(false)
      return
    }

    // Mark sources
    if (inserted) {
      await markMultipleSources(
        inserted.map(s => s.id),
        'core314_capture',
        { search_query: `${effectiveCategory} - ${searchScope === 'local' ? location : searchScope === 'regional' ? selectedRegion : 'National'}` }
      )
      setImportCount(inserted.length)
    }

    // Mark as imported in the UI
    const importedNames = new Set(selected.map(s => s.company_name))
    setResults(prev => prev.map(r => importedNames.has(r.company_name) ? { ...r, imported: true, selected: false } : r))
    setImporting(false)
  }

  const selectedCount = results.filter(r => r.selected && !r.imported).length
  void results.filter(r => r.imported).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Radar className="text-blue-600" size={28} />
          Core314 Subcontractor Capture
        </h1>
        <p className="text-gray-500 mt-1">
          Discover commercial subcontractors by service category and location. Import them into your master database for RFQ outreach.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={18} className="text-gray-500" />
          Search Criteria
        </h2>
        {/* Service Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Category *</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); if (e.target.value) setCustomInput('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
            >
              <option value="">Select a category...</option>
              {DEFAULT_SERVICE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {customCategories.length > 0 && (
                <optgroup label="Custom Categories">
                  {customCategories.map(c => (
                    <option key={`custom-${c}`} value={c}>{c}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="relative" ref={suggestionsRef}>
              <input
                type="text"
                value={customInput}
                onChange={e => {
                  setCustomInput(e.target.value)
                  setShowSuggestions(true)
                  if (e.target.value.trim()) setCategory('')
                }}
                onFocus={() => { if (customInput.trim()) setShowSuggestions(true) }}
                placeholder="Or type a custom category..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setCustomInput(s)
                        setCategory('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Scope</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['local', 'regional', 'national'] as SearchScope[]).map(scope => (
                <button
                  key={scope}
                  onClick={() => setSearchScope(scope)}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    searchScope === scope
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {scope === 'local' && <MapPin size={14} />}
                  {scope === 'regional' && <Globe2 size={14} />}
                  {scope === 'national' && <Globe size={14} />}
                  {scope.charAt(0).toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope-specific fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {searchScope === 'local' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location * <span className="text-gray-400">(City, State)</span></label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g., Denver, CO"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Radius</label>
                <select
                  value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={100}>100 miles</option>
                  <option value={200}>200 miles</option>
                </select>
              </div>
            </>
          )}
          {searchScope === 'regional' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value as Region)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(Object.keys(REGIONS) as Region[]).map(r => (
                  <option key={r} value={r}>{r} ({REGIONS[r].states.join(', ')})</option>
                ))}
              </select>
            </div>
          )}
          {searchScope === 'national' && (
            <div className="md:col-span-2 flex items-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
                <Globe size={16} />
                Searching across all major U.S. markets
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {searching ? 'Searching...' : searchScope === 'national' ? 'Search Nationally' : searchScope === 'regional' ? `Search ${selectedRegion} Region` : 'Search Commercial Directories'}
          </button>
          {searchPerformed && !searching && (
            <span className="text-sm text-gray-500">
              Found {results.length} new subcontractor{results.length !== 1 ? 's' : ''} not already in your database
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building size={18} className="text-gray-500" />
              Discovered Subcontractors ({results.length})
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {results.filter(r => !r.imported).every(r => r.selected) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {importing ? 'Importing...' : `Import Selected (${selectedCount})`}
              </button>
            </div>
          </div>

          {importCount > 0 && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle size={16} />
              {importCount} subcontractor{importCount !== 1 ? 's' : ''} imported to your master database and tagged as "Core314 Capture" source.
            </div>
          )}

          <div className="space-y-3">
            {results.map(sub => (
              <div
                key={sub.id}
                className={`border rounded-lg p-4 transition-all ${
                  sub.imported
                    ? 'border-green-200 bg-green-50 opacity-75'
                    : sub.selected
                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!sub.imported && (
                    <input
                      type="checkbox"
                      checked={sub.selected}
                      onChange={() => toggleSelect(sub.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  {sub.imported && (
                    <CheckCircle size={18} className="mt-0.5 text-green-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{sub.company_name}</h3>
                      {sub.rating && (
                        <span className="text-sm text-gray-500">
                          ⭐ {sub.rating}/5 ({sub.review_count} reviews)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-gray-400" />
                        {sub.address}
                      </span>
                      {sub.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} className="text-gray-400" />
                          {sub.phone}
                        </span>
                      )}
                      {sub.website && (
                        <span className="flex items-center gap-1">
                          <Globe size={13} className="text-gray-400" />
                          {sub.website}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sub.categories.map(cat => (
                        <span key={cat} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{cat}</span>
                      ))}
                    </div>
                    {sub.imported && (
                      <span className="inline-block mt-2 text-xs text-green-600 font-medium">Added to Master Database</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchPerformed && !searching && results.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-medium text-gray-700 mb-1">No New Subcontractors Found</h3>
          <p className="text-sm text-gray-500">
            All discovered subcontractors for this search are already in your database, or no results were found. Try a different category or location.
          </p>
        </div>
      )}

      {/* Info Banner */}
      {!searchPerformed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Radar size={18} className="text-blue-600" />
            How Core314 Subcontractor Capture Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              Select a service category and enter a location to search commercial business directories
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">2.</span>
              Review discovered subcontractors — the system automatically filters out companies already in your database
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">3.</span>
              Select the subcontractors you want and import them into your master database
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">4.</span>
              Imported subcontractors are tagged as "Core314 Capture" source and automatically aligned to matching task order SOWs
            </li>
          </ul>
          <div className="mt-4 p-3 bg-white/60 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Master Database:</strong> All subcontractors (both user-imported and Core314 Captured) are stored in one unified database.
              Each entry is tagged with its source so you always know where the information came from.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
