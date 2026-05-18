import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.TASKORDER_SUPABASE_URL
const supabaseKey = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const TASK_ORDER_ID = '10cd0ea2-bccd-498b-85a0-05260d04eb9d'

// 10 sample subcontractors (matching actual DB schema)
const subs = [
  // 2 HVAC subs
  { company_name: 'Trane Technologies', contact_name: 'Mark Sullivan', contact_email: 'msullivan@trane.com', contact_phone: '(817) 555-1201', service_categories: ['HVAC', 'Building Automation'], geographic_coverage: ['TX', 'OK', 'LA'], incumbent_status: 'not_incumbent', performance_notes: 'Strong HVAC presence in North Texas market.' },
  { company_name: 'Carrier Commercial Services', contact_name: 'Lisa Chen', contact_email: 'lchen@carrier.com', contact_phone: '(214) 555-3402', service_categories: ['HVAC', 'Refrigeration'], geographic_coverage: ['TX', 'AR', 'NM'], incumbent_status: 'suspected', performance_notes: 'Previously served USPS facilities in DFW area.' },
  // 2 Dock Equipment subs
  { company_name: 'Rite-Hite Service Corp', contact_name: 'James Patterson', contact_email: 'jpatterson@ritehite.com', contact_phone: '(972) 555-7803', service_categories: ['Dock Equipment', 'Loading Dock Doors', 'Material Handling'], geographic_coverage: ['TX', 'OK'], incumbent_status: 'not_incumbent', performance_notes: 'National dock equipment manufacturer with local service team.' },
  { company_name: 'DoorTech Solutions', contact_name: 'Robert Garza', contact_email: 'rgarza@doortech.com', contact_phone: '(817) 555-9104', service_categories: ['Dock Equipment', 'Overhead Doors', 'Auto Sliding Doors'], geographic_coverage: ['TX'], incumbent_status: 'known', performance_notes: 'Current dock equipment maintenance provider at N. Texas P&DX.' },
  // 6 other subs for remaining SOWs
  { company_name: 'SimplexGrinnell (Tyco)', contact_name: 'Angela Martinez', contact_email: 'amartinez@simplexgrinnell.com', contact_phone: '(214) 555-2205', service_categories: ['Fire Life Safety', 'Fire Alarm Systems', 'Sprinkler Systems'], geographic_coverage: ['TX', 'OK', 'LA', 'AR'], incumbent_status: 'known', performance_notes: 'Current FLS provider. Deep knowledge of existing systems.' },
  { company_name: 'ABM Janitorial Services', contact_name: 'David Kim', contact_email: 'dkim@abm.com', contact_phone: '(972) 555-6606', service_categories: ['Janitorial', 'Floor Care', 'Custodial Services'], geographic_coverage: ['Nationwide'], incumbent_status: 'not_incumbent', performance_notes: 'One of the largest commercial janitorial providers in the US.' },
  { company_name: 'BrightView Landscapes', contact_name: 'Sarah Thompson', contact_email: 'sthompson@brightview.com', contact_phone: '(817) 555-4407', service_categories: ['Exterior Landscaping', 'Snow Removal', 'Grounds Maintenance'], geographic_coverage: ['TX', 'OK'], incumbent_status: 'not_incumbent', performance_notes: 'Handles large commercial properties in DFW.' },
  { company_name: 'Cummins Power Systems', contact_name: 'Brian Walsh', contact_email: 'bwalsh@cummins.com', contact_phone: '(214) 555-8808', service_categories: ['Emergency Power', 'Generators', 'UPS Systems'], geographic_coverage: ['Nationwide'], incumbent_status: 'suspected', performance_notes: 'Premier generator and UPS maintenance provider.' },
  { company_name: 'RotoRooter Commercial', contact_name: 'Maria Rodriguez', contact_email: 'mrodriguez@rotorooter.com', contact_phone: '(817) 555-3309', service_categories: ['Plumbing', 'Backflow Prevention', 'Water Treatment'], geographic_coverage: ['TX', 'OK', 'NM'], incumbent_status: 'not_incumbent', performance_notes: 'Commercial plumbing division with government contract experience.' },
  { company_name: 'Terminix Commercial', contact_name: 'Kevin Brooks', contact_email: 'kbrooks@terminix.com', contact_phone: '(972) 555-1110', service_categories: ['Pest Control', 'Integrated Pest Management'], geographic_coverage: ['Nationwide'], incumbent_status: 'not_incumbent', performance_notes: 'Largest commercial pest control provider. GSA schedule holder.' },
]

async function seed() {
  console.log('Inserting 10 sample subcontractors...')
  
  const { data: insertedSubs, error: subErr } = await supabase
    .from('subcontractors')
    .insert(subs)
    .select()
  
  if (subErr) { console.error('Sub insert error:', subErr); return }
  console.log(`Inserted ${insertedSubs.length} subcontractors`)

  // Map subs by name for easy reference
  const subMap = {}
  for (const s of insertedSubs) subMap[s.company_name] = s

  // Get SOW items for N. Texas P&DX
  const { data: sowItems, error: sowErr } = await supabase
    .from('sow_items')
    .select('*')
    .eq('task_order_id', TASK_ORDER_ID)

  if (sowErr) { console.error('SOW fetch error:', sowErr); return }
  console.log(`Found ${sowItems.length} SOW items`)

  // Map SOWs by name
  const sowMap = {}
  for (const s of sowItems) sowMap[s.sow_name] = s

  // Define assignments: sub → SOW with outreach status
  const assignments = [
    // HVAC - 2 subs (Trane + Carrier, plus existing JCI)
    { sub: 'Trane Technologies', sow: 'HVAC Services', status: 'quote_submitted' },
    { sub: 'Carrier Commercial Services', sow: 'HVAC Services', status: 'quote_submitted' },
    // Dock Equipment - 2 subs
    { sub: 'Rite-Hite Service Corp', sow: 'Dock Equipment Services', status: 'quote_submitted' },
    { sub: 'DoorTech Solutions', sow: 'Dock Equipment Services', status: 'quote_submitted' },
    // FLS
    { sub: 'SimplexGrinnell (Tyco)', sow: 'Fire Life Safety (FLS) Services', status: 'quote_submitted' },
    // Janitorial
    { sub: 'ABM Janitorial Services', sow: 'Janitorial Services', status: 'quote_submitted' },
    // Exterior (landscaping + snow)
    { sub: 'BrightView Landscapes', sow: 'Exterior Services', status: 'quote_submitted' },
    // Emergency Power
    { sub: 'Cummins Power Systems', sow: 'Emergency Power Services', status: 'quote_submitted' },
    // Plumbing
    { sub: 'RotoRooter Commercial', sow: 'Plumbing Services', status: 'quote_submitted' },
    // Miscellaneous (pest control under misc)
    { sub: 'Terminix Commercial', sow: 'Miscellaneous Services', status: 'quote_submitted' },
  ]

  // Insert sow_subcontractors
  const sowSubRecords = []
  for (const a of assignments) {
    const sub = subMap[a.sub]
    const sow = sowMap[a.sow]
    if (!sub || !sow) { console.error(`Missing: sub=${a.sub} sow=${a.sow}`); continue }
    sowSubRecords.push({
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      match_score: Math.floor(Math.random() * 20) + 75, // 75-95
      outreach_status: a.status,
      rfq_sent_date: '2026-04-15T00:00:00Z',
      rfq_due_date: '2026-05-05T00:00:00Z',
      response_date: '2026-05-02T00:00:00Z',
    })
  }

  const { data: insertedSowSubs, error: ssErr } = await supabase
    .from('sow_subcontractors')
    .insert(sowSubRecords)
    .select()

  if (ssErr) { console.error('SowSub insert error:', ssErr); return }
  console.log(`Inserted ${insertedSowSubs.length} SOW-subcontractor assignments`)

  // Map sow_sub records for quote insertion
  const sowSubMap = {}
  for (const ss of insertedSowSubs) {
    const key = `${ss.sow_item_id}:${ss.subcontractor_id}`
    sowSubMap[key] = ss
  }

  // Define quotes
  const quotes = [
    // HVAC - Trane
    { sub: 'Trane Technologies', sow: 'HVAC Services', total: 118500, monthly: 9875, annual: 118500, labor: 82000, materials: 28500, equipment: 8000, overhead: 5.0, inclusions: 'Preventive maintenance, emergency repairs, filter replacement, coil cleaning, belt replacement, refrigerant management', exclusions: 'Major equipment replacement, ductwork modifications', assumptions: 'Based on 4 quarterly PM visits + emergency response within 4 hours', timeline: 'Annual contract with quarterly PMs', payment_terms: 'Net 30', validity: '90 days' },
    // HVAC - Carrier
    { sub: 'Carrier Commercial Services', sow: 'HVAC Services', total: 132000, monthly: 11000, annual: 132000, labor: 89000, materials: 32000, equipment: 11000, overhead: 8.0, inclusions: 'Full-service HVAC maintenance, 24/7 emergency response, parts inventory on-site, BAS monitoring', exclusions: 'Capital equipment replacement over $5,000', assumptions: 'Includes dedicated on-site technician 2 days/week', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '60 days' },
    // Dock Equipment - Rite-Hite
    { sub: 'Rite-Hite Service Corp', sow: 'Dock Equipment Services', total: 67500, monthly: 5625, annual: 67500, labor: 42000, materials: 19500, equipment: 6000, overhead: 4.5, inclusions: 'Dock leveler maintenance, door repairs, bumper replacement, safety equipment inspection', exclusions: 'Complete dock leveler or door replacement', assumptions: '12 dock positions, quarterly PM inspections', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Dock Equipment - DoorTech
    { sub: 'DoorTech Solutions', sow: 'Dock Equipment Services', total: 58900, monthly: 4908, annual: 58900, labor: 36500, materials: 16400, equipment: 6000, overhead: 3.0, inclusions: 'Dock levelers, overhead doors, auto sliding doors, dock seals, vehicle restraints', exclusions: 'Electrical panel upgrades, structural modifications', assumptions: 'Based on current equipment inventory from incumbent knowledge', timeline: 'Annual contract', payment_terms: 'Net 45', validity: '90 days' },
    // FLS - SimplexGrinnell
    { sub: 'SimplexGrinnell (Tyco)', sow: 'Fire Life Safety (FLS) Services', total: 89000, monthly: 7417, annual: 89000, labor: 58000, materials: 22000, equipment: 9000, overhead: 6.0, inclusions: 'Fire alarm testing, sprinkler inspection, extinguisher service, emergency lighting, suppression systems', exclusions: 'Fire alarm panel replacement, sprinkler riser replacement', assumptions: 'Based on existing SimplexGrinnell systems installed at facility', timeline: 'Annual contract with semi-annual inspections', payment_terms: 'Net 30', validity: '90 days' },
    // Janitorial - ABM
    { sub: 'ABM Janitorial Services', sow: 'Janitorial Services', total: 245000, monthly: 20417, annual: 245000, labor: 198000, materials: 35000, equipment: 12000, overhead: 7.5, inclusions: 'Daily cleaning, restroom service, trash removal, floor care, window cleaning, supply management', exclusions: 'Carpet replacement, deep cleaning of mechanical rooms, hazmat cleanup', assumptions: 'Based on approximately 250,000 sq ft of interior space, 5 days/week service', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '60 days' },
    // Exterior - BrightView
    { sub: 'BrightView Landscapes', sow: 'Exterior Services', total: 156000, monthly: 13000, annual: 156000, labor: 108000, materials: 32000, equipment: 16000, overhead: 5.5, inclusions: 'Mowing, trimming, irrigation maintenance, seasonal planting, snow removal, salt application, parking lot sweeping', exclusions: 'Tree removal over 6 inch caliper, irrigation system replacement, new hardscape installation', assumptions: 'Approximately 15 acres of maintained grounds, snow removal on-call basis', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Emergency Power - Cummins
    { sub: 'Cummins Power Systems', sow: 'Emergency Power Services', total: 78500, monthly: 6542, annual: 78500, labor: 48000, materials: 22500, equipment: 8000, overhead: 4.0, inclusions: 'Generator PM, load bank testing, ATS maintenance, UPS battery testing, fuel system inspection', exclusions: 'Generator replacement, major overhaul, fuel supply', assumptions: 'Based on 3 generators and 2 UPS systems, quarterly maintenance', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Plumbing - RotoRooter
    { sub: 'RotoRooter Commercial', sow: 'Plumbing Services', total: 52000, monthly: 4333, annual: 52000, labor: 35000, materials: 12000, equipment: 5000, overhead: 3.5, inclusions: 'Preventive plumbing maintenance, backflow testing, water treatment monitoring, drain cleaning, fixture repairs', exclusions: 'Main line replacement, water heater replacement, fire suppression plumbing', assumptions: 'Monthly service visits plus emergency response', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Miscellaneous (Pest Control) - Terminix
    { sub: 'Terminix Commercial', sow: 'Miscellaneous Services', total: 28500, monthly: 2375, annual: 28500, labor: 18000, materials: 8500, equipment: 2000, overhead: 3.0, inclusions: 'Integrated pest management, monthly inspections, rodent control, insect treatment, reporting', exclusions: 'Wildlife removal, fumigation, structural repairs due to pest damage', assumptions: 'Monthly interior/exterior treatments, quarterly comprehensive inspections', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
  ]

  const quoteRecords = []
  for (const q of quotes) {
    const sub = subMap[q.sub]
    const sow = sowMap[q.sow]
    if (!sub || !sow) { console.error(`Missing for quote: sub=${q.sub} sow=${q.sow}`); continue }
    const key = `${sow.id}:${sub.id}`
    const sowSub = sowSubMap[key]
    if (!sowSub) { console.error(`Missing sowSub for ${key}`); continue }

    quoteRecords.push({
      sow_subcontractor_id: sowSub.id,
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      total_amount: q.total,
      monthly_amount: q.monthly,
      annual_amount: q.annual,
      labor_cost: q.labor,
      materials_cost: q.materials,
      equipment_cost: q.equipment,
      overhead_markup: q.overhead,
      scope_inclusions: q.inclusions,
      scope_exclusions: q.exclusions,
      assumptions: q.assumptions,
      timeline: q.timeline,
      payment_terms: q.payment_terms,
      validity_period: q.validity,
      status: 'received',
      submitted_at: '2026-05-02T00:00:00Z',
    })
  }

  const { data: insertedQuotes, error: qErr } = await supabase
    .from('sow_quotes')
    .insert(quoteRecords)
    .select()

  if (qErr) { console.error('Quote insert error:', qErr); return }
  console.log(`Inserted ${insertedQuotes.length} quotes`)

  // Update SOW statuses to 'quotes_received'
  const sowsWithQuotes = [...new Set(quotes.map(q => sowMap[q.sow]?.id).filter(Boolean))]
  for (const sowId of sowsWithQuotes) {
    await supabase
      .from('sow_items')
      .update({ status: 'quotes_received' })
      .eq('id', sowId)
  }
  console.log(`Updated ${sowsWithQuotes.length} SOWs to quotes_received status`)

  // Add communication logs for each assignment
  const commRecords = []
  for (const ss of insertedSowSubs) {
    const sub = insertedSubs.find(s => s.id === ss.subcontractor_id)
    commRecords.push({
      sow_subcontractor_id: ss.id,
      comm_type: 'rfq_sent',
      direction: 'outbound',
      subject: `RFQ sent to ${sub?.company_name}`,
      body: `Request for Quote sent for N. Texas P&DX task order.`,
      created_at: '2026-04-15T10:00:00Z',
    })
    commRecords.push({
      sow_subcontractor_id: ss.id,
      comm_type: 'quote_received',
      direction: 'inbound',
      subject: `Quote received from ${sub?.company_name}`,
      body: `Subcontractor submitted their quote for review.`,
      created_at: '2026-05-02T14:00:00Z',
    })
  }

  const { error: commErr } = await supabase
    .from('sow_communications')
    .insert(commRecords)

  if (commErr) { console.error('Comm insert error:', commErr); return }
  console.log(`Inserted ${commRecords.length} communication logs`)

  console.log('\nDone! Sample data seeded successfully.')
  console.log('Summary:')
  console.log('  - 10 new subcontractors')
  console.log('  - 10 SOW assignments')
  console.log('  - 10 quotes (2 HVAC, 2 Dock Equipment, 6 others)')
  console.log('  - 20 communication logs')
}

seed().catch(console.error)
