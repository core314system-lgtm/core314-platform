import type { Context } from "@netlify/functions"

/**
 * Netlify Function: Discover Subcontractors via Google Places API
 * 
 * Searches for real businesses by service category and location using
 * Google Places API (New) Text Search endpoint.
 * 
 * POST /api/discover-subs
 * Body: { category, scope, location?, radius?, region? }
 * Updated: 2026-05-18
 */

interface PlaceResult {
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  types?: string[]
  primaryType?: string
  primaryTypeDisplayName?: { text: string }
  location?: { latitude: number; longitude: number }
  businessStatus?: string
}

interface DiscoveredBusiness {
  company_name: string
  address: string
  city: string
  state: string
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  categories: string[]
  source: 'google_places'
}

// Map service categories to effective Google search terms
const CATEGORY_SEARCH_TERMS: Record<string, string> = {
  'HVAC': 'commercial HVAC contractor',
  'Fire Life Safety': 'fire protection company',
  'Janitorial': 'commercial janitorial services',
  'Landscaping': 'commercial landscaping company',
  'Snow Removal': 'commercial snow removal service',
  'Emergency Power': 'commercial generator service',
  'Plumbing': 'commercial plumbing contractor',
  'Electrical': 'commercial electrical contractor',
  'Pest Control': 'commercial pest control company',
  'Dock Equipment': 'loading dock equipment service',
  'Elevator Maintenance': 'elevator service company',
  'Roofing': 'commercial roofing contractor',
  'Painting': 'commercial painting contractor',
  'Flooring': 'commercial flooring contractor',
  'Security Systems': 'commercial security systems',
  'Building Automation': 'building automation systems company',
  'Grounds Maintenance': 'commercial grounds maintenance',
  'Waste Management': 'commercial waste management',
  'General Maintenance': 'commercial facility maintenance',
}

const REGION_CITIES: Record<string, Array<{ city: string; state: string }>> = {
  'West': [
    { city: 'Los Angeles', state: 'CA' }, { city: 'Denver', state: 'CO' },
    { city: 'Phoenix', state: 'AZ' }, { city: 'Las Vegas', state: 'NV' },
    { city: 'San Diego', state: 'CA' }, { city: 'Salt Lake City', state: 'UT' },
  ],
  'Southwest': [
    { city: 'Dallas', state: 'TX' }, { city: 'Houston', state: 'TX' },
    { city: 'San Antonio', state: 'TX' }, { city: 'Austin', state: 'TX' },
    { city: 'Albuquerque', state: 'NM' }, { city: 'Oklahoma City', state: 'OK' },
  ],
  'Southeast': [
    { city: 'Atlanta', state: 'GA' }, { city: 'Miami', state: 'FL' },
    { city: 'Charlotte', state: 'NC' }, { city: 'Nashville', state: 'TN' },
    { city: 'Jacksonville', state: 'FL' }, { city: 'Tampa', state: 'FL' },
  ],
  'Northeast': [
    { city: 'New York', state: 'NY' }, { city: 'Philadelphia', state: 'PA' },
    { city: 'Boston', state: 'MA' }, { city: 'Baltimore', state: 'MD' },
    { city: 'Newark', state: 'NJ' }, { city: 'Hartford', state: 'CT' },
  ],
  'Midwest': [
    { city: 'Chicago', state: 'IL' }, { city: 'Columbus', state: 'OH' },
    { city: 'Detroit', state: 'MI' }, { city: 'Indianapolis', state: 'IN' },
    { city: 'Milwaukee', state: 'WI' }, { city: 'Minneapolis', state: 'MN' },
  ],
  'Pacific Northwest': [
    { city: 'Seattle', state: 'WA' }, { city: 'Portland', state: 'OR' },
    { city: 'Boise', state: 'ID' }, { city: 'Tacoma', state: 'WA' },
    { city: 'Spokane', state: 'WA' }, { city: 'Eugene', state: 'OR' },
  ],
}

// Convert radius in miles to meters for Google Places API
function milesToMeters(miles: number): number {
  // Google Places API max radius is 50,000 meters (~31 miles)
  return Math.min(Math.round(miles * 1609.34), 50000)
}

// Parse state from address string
function parseStateFromAddress(address: string): string {
  const stateMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/)
  if (stateMatch) return stateMatch[1]
  const parts = address.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    const stateZip = parts[parts.length - 2]?.trim() || ''
    const stateCode = stateZip.split(/\s+/)[0]
    if (stateCode && stateCode.length === 2 && stateCode === stateCode.toUpperCase()) {
      return stateCode
    }
  }
  return ''
}

// Parse city from address string
function parseCityFromAddress(address: string): string {
  const parts = address.split(',').map(s => s.trim())
  if (parts.length >= 3) return parts[parts.length - 3] || parts[0]
  if (parts.length >= 2) return parts[0]
  return ''
}

async function searchGooglePlaces(
  query: string,
  apiKey: string,
  options?: { locationBias?: { lat: number; lng: number; radius: number }; maxResults?: number }
): Promise<DiscoveredBusiness[]> {
  const fieldMask = [
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.types',
    'places.primaryTypeDisplayName',
    'places.businessStatus',
  ].join(',')

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: options?.maxResults || 15,
    languageCode: 'en',
  }

  if (options?.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.lat,
          longitude: options.locationBias.lng,
        },
        radius: options.locationBias.radius,
      },
    }
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Google Places API error:', response.status, errText)
    throw new Error(`Google Places API error: ${response.status} - ${errText}`)
  }

  const data = await response.json()
  const places: PlaceResult[] = data.places || []

  return places
    .filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map(p => {
      const address = p.formattedAddress || ''
      return {
        company_name: p.displayName?.text || 'Unknown',
        address,
        city: parseCityFromAddress(address),
        state: parseStateFromAddress(address),
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
        website: p.websiteUri ? p.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
        rating: p.rating || null,
        review_count: p.userRatingCount || null,
        categories: [
          ...(p.primaryTypeDisplayName?.text ? [p.primaryTypeDisplayName.text] : []),
        ],
        source: 'google_places' as const,
      }
    })
}

// Geocode a location string to lat/lng using Google Geocoding API
async function geocodeLocation(location: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
  )
  if (!response.ok) return null
  const data = await response.json()
  if (data.results && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  }
  return null
}

// Known city coordinates as fallback
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'new york,ny': { lat: 40.7128, lng: -74.0060 },
  'los angeles,ca': { lat: 34.0522, lng: -118.2437 },
  'chicago,il': { lat: 41.8781, lng: -87.6298 },
  'houston,tx': { lat: 29.7604, lng: -95.3698 },
  'phoenix,az': { lat: 33.4484, lng: -112.0740 },
  'philadelphia,pa': { lat: 39.9526, lng: -75.1652 },
  'san antonio,tx': { lat: 29.4241, lng: -98.4936 },
  'dallas,tx': { lat: 32.7767, lng: -96.7970 },
  'atlanta,ga': { lat: 33.7490, lng: -84.3880 },
  'denver,co': { lat: 39.7392, lng: -104.9903 },
  'seattle,wa': { lat: 47.6062, lng: -122.3321 },
  'miami,fl': { lat: 25.7617, lng: -80.1918 },
  'boston,ma': { lat: 42.3601, lng: -71.0589 },
  'nashville,tn': { lat: 36.1627, lng: -86.7816 },
  'detroit,mi': { lat: 42.3314, lng: -83.0458 },
  'columbus,oh': { lat: 39.9612, lng: -82.9988 },
  'indianapolis,in': { lat: 39.7684, lng: -86.1581 },
  'charlotte,nc': { lat: 35.2271, lng: -80.8431 },
  'san diego,ca': { lat: 32.7157, lng: -117.1611 },
  'portland,or': { lat: 45.5051, lng: -122.6750 },
  'las vegas,nv': { lat: 36.1699, lng: -115.1398 },
  'salt lake city,ut': { lat: 40.7608, lng: -111.8910 },
  'baltimore,md': { lat: 39.2904, lng: -76.6122 },
  'milwaukee,wi': { lat: 43.0389, lng: -87.9065 },
  'minneapolis,mn': { lat: 44.9778, lng: -93.2650 },
  'tampa,fl': { lat: 27.9506, lng: -82.4572 },
  'jacksonville,fl': { lat: 30.3322, lng: -81.6557 },
  'albuquerque,nm': { lat: 35.0844, lng: -106.6504 },
  'oklahoma city,ok': { lat: 35.4676, lng: -97.5164 },
  'boise,id': { lat: 43.6150, lng: -116.2023 },
  'austin,tx': { lat: 30.2672, lng: -97.7431 },
  'newark,nj': { lat: 40.7357, lng: -74.1724 },
  'hartford,ct': { lat: 41.7658, lng: -72.6734 },
  'tacoma,wa': { lat: 47.2529, lng: -122.4443 },
  'spokane,wa': { lat: 47.6588, lng: -117.4260 },
  'eugene,or': { lat: 44.0521, lng: -123.0868 },
}

async function getCoordinates(location: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  // Try known coordinates first
  const normalized = location.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key.split(',')[0]) && normalized.includes(key.split(',')[1])) {
      return coords
    }
  }
  // Fallback to geocoding API
  return geocodeLocation(location, apiKey)
}

export default async function handler(req: Request, _context: Context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Google Places API key not configured',
      results: [],
    }), { status: 200, headers })
  }

  try {
    const body = await req.json()
    const { category, scope, location, radius = 50, region } = body

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category is required' }), { status: 400, headers })
    }

    const searchTerm = CATEGORY_SEARCH_TERMS[category] || `commercial ${category}`
    let allResults: DiscoveredBusiness[] = []

    if (scope === 'local') {
      if (!location) {
        return new Response(JSON.stringify({ error: 'Location is required for local search' }), { status: 400, headers })
      }

      const coords = await getCoordinates(location, apiKey)
      const radiusMeters = milesToMeters(radius)
      const query = `${searchTerm} in ${location}`

      allResults = await searchGooglePlaces(query, apiKey, {
        locationBias: coords ? { lat: coords.lat, lng: coords.lng, radius: radiusMeters } : undefined,
        maxResults: 20,
      })

    } else if (scope === 'regional') {
      const cities = REGION_CITIES[region || 'Midwest'] || REGION_CITIES['Midwest']
      // Search top 3 cities in the region to stay within reasonable API usage
      const topCities = cities.slice(0, 3)

      for (const cityInfo of topCities) {
        const cityLocation = `${cityInfo.city}, ${cityInfo.state}`
        const coords = await getCoordinates(cityLocation, apiKey)
        const query = `${searchTerm} in ${cityInfo.city}, ${cityInfo.state}`

        try {
          const cityResults = await searchGooglePlaces(query, apiKey, {
            locationBias: coords ? { lat: coords.lat, lng: coords.lng, radius: milesToMeters(100) } : undefined,
            maxResults: 8,
          })
          allResults.push(...cityResults)
        } catch (e) {
          console.error(`Error searching ${cityInfo.city}:`, e)
        }
      }

      // Deduplicate by company name
      const seen = new Set<string>()
      allResults = allResults.filter(r => {
        const key = r.company_name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return new Response(JSON.stringify({
      results: allResults,
      count: allResults.length,
      scope,
      source: 'google_places',
    }), { status: 200, headers })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('discover-subs error:', message)
    return new Response(JSON.stringify({ error: message, results: [] }), { status: 500, headers })
  }
}
