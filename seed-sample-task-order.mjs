import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.TASKORDER_SUPABASE_URL
const supabaseKey = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// New Sample Task Order ID
const SAMPLE_TO_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// Get the admin user ID
async function getAdminUserId() {
  const { data } = await supabase.from('user_profiles').select('id').eq('email', 'admin@core314.com').single()
  return data?.id || '00000000-0000-0000-0000-000000000000'
}

// 20 new subcontractors (generic — no USPS/Texas-specific references)
const newSubs = [
  { company_name: 'Summit Mechanical Group', contact_name: 'Thomas Richardson', contact_email: 'trichardson@summitmech.com', contact_phone: '(303) 555-1101', service_categories: ['HVAC', 'Mechanical Systems', 'Building Automation'], geographic_coverage: ['CO', 'WY', 'NE'], incumbent_status: 'not_incumbent', performance_notes: 'Large commercial HVAC specialist with federal contract experience.' },
  { company_name: 'Alpine Climate Solutions', contact_name: 'Jennifer Park', contact_email: 'jpark@alpineclimate.com', contact_phone: '(720) 555-2202', service_categories: ['HVAC', 'Energy Management', 'Controls'], geographic_coverage: ['CO', 'UT', 'NM'], incumbent_status: 'suspected', performance_notes: 'Known for energy-efficient solutions. Previously served federal facilities.' },
  { company_name: 'Ironclad Fire Protection', contact_name: 'Marcus Williams', contact_email: 'mwilliams@ironcladfire.com', contact_phone: '(303) 555-3303', service_categories: ['Fire Life Safety', 'Fire Alarm Systems', 'Suppression Systems'], geographic_coverage: ['CO', 'WY', 'KS'], incumbent_status: 'not_incumbent', performance_notes: 'Full-service fire protection company with government clearances.' },
  { company_name: 'RedLine Fire & Safety', contact_name: 'Patricia Nguyen', contact_email: 'pnguyen@redlinefire.com', contact_phone: '(719) 555-4404', service_categories: ['Fire Life Safety', 'Emergency Systems', 'Code Compliance'], geographic_coverage: ['CO', 'NM'], incumbent_status: 'known', performance_notes: 'Current FLS provider at multiple federal sites in the region.' },
  { company_name: 'PrimeSweep Facility Services', contact_name: 'David Okafor', contact_email: 'dokafor@primesweep.com', contact_phone: '(303) 555-5505', service_categories: ['Janitorial', 'Floor Care', 'Custodial Services'], geographic_coverage: ['CO', 'WY', 'NE', 'KS'], incumbent_status: 'not_incumbent', performance_notes: 'Regional janitorial leader with GSA schedule. 500+ staff.' },
  { company_name: 'EverClean Commercial', contact_name: 'Rachel Foster', contact_email: 'rfoster@everclean.com', contact_phone: '(720) 555-6606', service_categories: ['Janitorial', 'Window Cleaning', 'Sanitation'], geographic_coverage: ['CO', 'UT'], incumbent_status: 'not_incumbent', performance_notes: 'Specializes in large commercial and institutional facilities.' },
  { company_name: 'Mountain Crest Landscapes', contact_name: 'Carlos Mendez', contact_email: 'cmendez@mountaincrest.com', contact_phone: '(303) 555-7707', service_categories: ['Exterior Landscaping', 'Snow Removal', 'Grounds Maintenance'], geographic_coverage: ['CO', 'WY'], incumbent_status: 'not_incumbent', performance_notes: 'Expert in high-altitude landscaping and heavy snow removal operations.' },
  { company_name: 'GreenEdge Grounds Management', contact_name: 'Amy Rodriguez', contact_email: 'arodriguez@greenedge.com', contact_phone: '(719) 555-8808', service_categories: ['Exterior Services', 'Irrigation', 'Seasonal Planting'], geographic_coverage: ['CO', 'NM', 'KS'], incumbent_status: 'suspected', performance_notes: 'Serves several government buildings in the region.' },
  { company_name: 'PowerGen Systems Inc', contact_name: 'Steven Clark', contact_email: 'sclark@powergensys.com', contact_phone: '(303) 555-9909', service_categories: ['Emergency Power', 'Generators', 'UPS Systems'], geographic_coverage: ['CO', 'WY', 'NE', 'KS'], incumbent_status: 'not_incumbent', performance_notes: 'Authorized Caterpillar generator dealer with 24/7 service capability.' },
  { company_name: 'Volt Electric & Power', contact_name: 'Nathan Brooks', contact_email: 'nbrooks@voltelectric.com', contact_phone: '(720) 555-1010', service_categories: ['Emergency Power', 'Electrical Systems', 'UPS Maintenance'], geographic_coverage: ['CO', 'UT'], incumbent_status: 'not_incumbent', performance_notes: 'Full-service electrical contractor with backup power specialization.' },
  { company_name: 'ProFlow Plumbing Solutions', contact_name: 'Michelle Taylor', contact_email: 'mtaylor@proflow.com', contact_phone: '(303) 555-1111', service_categories: ['Plumbing', 'Backflow Prevention', 'Water Treatment'], geographic_coverage: ['CO', 'WY'], incumbent_status: 'not_incumbent', performance_notes: 'Commercial plumbing firm with Davis-Bacon compliance experience.' },
  { company_name: 'AquaPipe Commercial Services', contact_name: 'Jason Lee', contact_email: 'jlee@aquapipe.com', contact_phone: '(719) 555-1212', service_categories: ['Plumbing', 'Drain Systems', 'Water Heater Services'], geographic_coverage: ['CO', 'NM', 'KS'], incumbent_status: 'known', performance_notes: 'Current plumbing maintenance provider for several federal facilities.' },
  { company_name: 'DockMaster Loading Systems', contact_name: 'Gregory White', contact_email: 'gwhite@dockmaster.com', contact_phone: '(303) 555-1313', service_categories: ['Dock Equipment', 'Loading Systems', 'Material Handling'], geographic_coverage: ['CO', 'WY', 'NE'], incumbent_status: 'not_incumbent', performance_notes: 'Specialists in loading dock equipment and high-volume distribution centers.' },
  { company_name: 'Precision Dock & Door', contact_name: 'Linda Martinez', contact_email: 'lmartinez@precisiondock.com', contact_phone: '(720) 555-1414', service_categories: ['Dock Equipment', 'Overhead Doors', 'Dock Levelers'], geographic_coverage: ['CO', 'KS'], incumbent_status: 'known', performance_notes: 'Incumbent dock equipment provider at the Denver distribution facility.' },
  { company_name: 'SafeGuard Pest Solutions', contact_name: 'Brandon Harris', contact_email: 'bharris@safeguardpest.com', contact_phone: '(303) 555-1515', service_categories: ['Pest Control', 'Integrated Pest Management', 'Wildlife Control'], geographic_coverage: ['CO', 'WY', 'NE'], incumbent_status: 'not_incumbent', performance_notes: 'IPM-certified with experience in food-grade and government facilities.' },
  { company_name: 'NorthStar Security Systems', contact_name: 'Amanda Chen', contact_email: 'achen@northstarsec.com', contact_phone: '(720) 555-1616', service_categories: ['Security Systems', 'Access Control', 'CCTV'], geographic_coverage: ['CO', 'WY', 'UT'], incumbent_status: 'not_incumbent', performance_notes: 'Integrated security solutions provider with government clearances.' },
  { company_name: 'Elevate Building Services', contact_name: 'Ryan Cooper', contact_email: 'rcooper@elevatebs.com', contact_phone: '(303) 555-1717', service_categories: ['Elevator Maintenance', 'Escalator Service', 'Vertical Transport'], geographic_coverage: ['CO', 'WY', 'NE', 'KS'], incumbent_status: 'not_incumbent', performance_notes: 'Certified elevator maintenance company serving 200+ buildings.' },
  { company_name: 'ClearView Window Solutions', contact_name: 'Stephanie Wright', contact_email: 'swright@clearviewws.com', contact_phone: '(719) 555-1818', service_categories: ['Window Cleaning', 'Pressure Washing', 'Exterior Building Maintenance'], geographic_coverage: ['CO', 'NM'], incumbent_status: 'not_incumbent', performance_notes: 'High-rise and commercial window cleaning specialists.' },
  { company_name: 'TechWaste Environmental', contact_name: 'Derek Johnson', contact_email: 'djohnson@techwaste.com', contact_phone: '(303) 555-1919', service_categories: ['Waste Management', 'Recycling Programs', 'Hazmat Disposal'], geographic_coverage: ['CO', 'WY', 'UT', 'NE'], incumbent_status: 'not_incumbent', performance_notes: 'Environmental services company with EPA certifications and federal contracts.' },
  { company_name: 'RoofShield Commercial', contact_name: 'Karen Patterson', contact_email: 'kpatterson@roofshield.com', contact_phone: '(720) 555-2020', service_categories: ['Roofing', 'Roof Maintenance', 'Waterproofing'], geographic_coverage: ['CO', 'WY', 'KS'], incumbent_status: 'not_incumbent', performance_notes: 'Commercial roofing contractor with preventive maintenance programs.' },
]

// SOW items for the Sample Task Order
const sowItems = [
  { sow_name: 'HVAC Services', service_category: 'HVAC', description: 'Complete heating, ventilation, and air conditioning maintenance including preventive maintenance, emergency repairs, filter replacement, coil cleaning, and refrigerant management for all HVAC equipment throughout the facility.', estimated_value: 125000 },
  { sow_name: 'Fire Life Safety (FLS) Services', service_category: 'Fire Life Safety', description: 'Fire alarm testing, sprinkler inspection, fire extinguisher service, emergency lighting testing, suppression system maintenance, and compliance with all applicable fire codes.', estimated_value: 85000 },
  { sow_name: 'Janitorial Services', service_category: 'Janitorial', description: 'Daily cleaning, restroom service, trash removal, floor care, window cleaning (interior), and supply management for approximately 200,000 sq ft of interior space.', estimated_value: 230000 },
  { sow_name: 'Exterior Services', service_category: 'Exterior Maintenance', description: 'Landscaping, mowing, trimming, irrigation maintenance, seasonal planting, snow removal, salt application, and parking lot maintenance for approximately 12 acres.', estimated_value: 145000 },
  { sow_name: 'Emergency Power Services', service_category: 'Emergency Power', description: 'Generator preventive maintenance, load bank testing, automatic transfer switch maintenance, UPS battery testing, and fuel system inspection for all backup power systems.', estimated_value: 72000 },
  { sow_name: 'Dock Equipment Services', service_category: 'Dock Equipment', description: 'Dock leveler maintenance, overhead door repairs, dock seal replacement, vehicle restraint inspection, and safety equipment maintenance for 10 dock positions.', estimated_value: 62000 },
  { sow_name: 'Plumbing Services', service_category: 'Plumbing', description: 'Preventive plumbing maintenance, backflow prevention testing, water treatment monitoring, drain cleaning, and fixture repairs throughout the facility.', estimated_value: 48000 },
  { sow_name: 'Miscellaneous Services', service_category: 'Pest Control', description: 'Integrated pest management, monthly inspections, rodent control, insect treatment, interior/exterior treatments, and quarterly comprehensive inspections.', estimated_value: 26000 },
]

async function seed() {
  const adminId = await getAdminUserId()
  console.log('Admin user ID:', adminId)

  // 1. Create the Sample Task Order
  console.log('\n1. Creating Sample Task Order...')
  const { data: taskOrder, error: toErr } = await supabase
    .from('task_orders')
    .upsert({
      id: SAMPLE_TO_ID,
      title: 'Sample Task Order',
      solicitation_number: 'SOL-2026-FM-0042',
      task_order_number: 'TO-FM-2026-0042',
      site_name: 'Metro Distribution Center',
      location_city: 'Denver',
      location_state: 'CO',
      status: 'in_progress',
      due_date: '2026-07-15T17:00:00Z',
      created_by: adminId,
      notes: 'Facility management services for a 200,000 sq ft distribution center. 6-year period of performance with 2-year base and two 2-year options. Multi-trade services required. GSA Schedule contract vehicle. Small Business Set-Aside. NAICS 561210.',
    })
    .select()
    .single()

  if (toErr) { console.error('Task Order insert error:', toErr); return }
  console.log('Created task order:', taskOrder.title)

  // 2. Insert 20 new subcontractors
  console.log('\n2. Inserting 20 new subcontractors...')
  const { data: insertedSubs, error: subErr } = await supabase
    .from('subcontractors')
    .insert(newSubs)
    .select()

  if (subErr) { console.error('Sub insert error:', subErr); return }
  console.log(`Inserted ${insertedSubs.length} subcontractors`)

  // Map subs by name
  const subMap = {}
  for (const s of insertedSubs) subMap[s.company_name] = s

  // 3. Insert SOW items
  console.log('\n3. Creating SOW items...')
  const sowRecords = sowItems.map(s => ({
    task_order_id: SAMPLE_TO_ID,
    sow_name: s.sow_name,
    service_category: s.service_category,
    description: s.description,
    status: 'quotes_received',
    notes: `Estimated value: $${s.estimated_value.toLocaleString()}`,
  }))

  const { data: insertedSows, error: sowErr } = await supabase
    .from('sow_items')
    .insert(sowRecords)
    .select()

  if (sowErr) { console.error('SOW insert error:', sowErr); return }
  console.log(`Inserted ${insertedSows.length} SOW items`)

  // Map SOWs by name
  const sowMap = {}
  for (const s of insertedSows) sowMap[s.sow_name] = s

  // 4. Assign subcontractors to SOWs and create quotes
  console.log('\n4. Assigning subcontractors and inserting quotes...')

  const assignments = [
    // HVAC - 3 subs
    { sub: 'Summit Mechanical Group', sow: 'HVAC Services', status: 'quote_submitted' },
    { sub: 'Alpine Climate Solutions', sow: 'HVAC Services', status: 'quote_submitted' },
    // FLS - 2 subs
    { sub: 'Ironclad Fire Protection', sow: 'Fire Life Safety (FLS) Services', status: 'quote_submitted' },
    { sub: 'RedLine Fire & Safety', sow: 'Fire Life Safety (FLS) Services', status: 'quote_submitted' },
    // Janitorial - 2 subs
    { sub: 'PrimeSweep Facility Services', sow: 'Janitorial Services', status: 'quote_submitted' },
    { sub: 'EverClean Commercial', sow: 'Janitorial Services', status: 'quote_submitted' },
    // Exterior - 2 subs
    { sub: 'Mountain Crest Landscapes', sow: 'Exterior Services', status: 'quote_submitted' },
    { sub: 'GreenEdge Grounds Management', sow: 'Exterior Services', status: 'quote_submitted' },
    // Emergency Power - 2 subs
    { sub: 'PowerGen Systems Inc', sow: 'Emergency Power Services', status: 'quote_submitted' },
    { sub: 'Volt Electric & Power', sow: 'Emergency Power Services', status: 'quote_submitted' },
    // Dock Equipment - 2 subs
    { sub: 'DockMaster Loading Systems', sow: 'Dock Equipment Services', status: 'quote_submitted' },
    { sub: 'Precision Dock & Door', sow: 'Dock Equipment Services', status: 'quote_submitted' },
    // Plumbing - 2 subs
    { sub: 'ProFlow Plumbing Solutions', sow: 'Plumbing Services', status: 'quote_submitted' },
    { sub: 'AquaPipe Commercial Services', sow: 'Plumbing Services', status: 'quote_submitted' },
    // Miscellaneous (Pest) - 1 sub
    { sub: 'SafeGuard Pest Solutions', sow: 'Miscellaneous Services', status: 'quote_submitted' },
  ]

  const sowSubRecords = []
  for (const a of assignments) {
    const sub = subMap[a.sub]
    const sow = sowMap[a.sow]
    if (!sub || !sow) { console.error(`Missing: sub=${a.sub} sow=${a.sow}`); continue }
    sowSubRecords.push({
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      match_score: Math.floor(Math.random() * 20) + 78,
      outreach_status: a.status,
      rfq_sent_date: '2026-05-20T00:00:00Z',
      rfq_due_date: '2026-06-10T00:00:00Z',
      response_date: '2026-06-07T00:00:00Z',
    })
  }

  const { data: insertedSowSubs, error: ssErr } = await supabase
    .from('sow_subcontractors')
    .insert(sowSubRecords)
    .select()

  if (ssErr) { console.error('SowSub insert error:', ssErr); return }
  console.log(`Inserted ${insertedSowSubs.length} SOW-subcontractor assignments`)

  // Map sow_sub records
  const sowSubMap = {}
  for (const ss of insertedSowSubs) {
    const key = `${ss.sow_item_id}:${ss.subcontractor_id}`
    sowSubMap[key] = ss
  }

  // Quotes
  const quotes = [
    // HVAC
    { sub: 'Summit Mechanical Group', sow: 'HVAC Services', total: 121000, monthly: 10083, annual: 121000, labor: 84000, materials: 28000, equipment: 9000, overhead: 5.5, inclusions: 'Preventive maintenance, emergency repairs, filter replacement, coil cleaning, belt replacement, refrigerant management, BAS monitoring', exclusions: 'Major equipment replacement over $10,000, ductwork modifications, new installations', assumptions: 'Based on 4 quarterly PM visits + emergency response within 4 hours. Includes 2 rooftop units and 6 split systems.', timeline: 'Annual contract with quarterly PMs', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'Alpine Climate Solutions', sow: 'HVAC Services', total: 134500, monthly: 11208, annual: 134500, labor: 91000, materials: 31500, equipment: 12000, overhead: 7.0, inclusions: 'Full-service HVAC maintenance, 24/7 emergency response, energy optimization reports, parts inventory on-site, BAS programming', exclusions: 'Capital equipment replacement, ductwork redesign, structural modifications', assumptions: 'Includes dedicated technician 3 days/week, energy audit quarterly', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '60 days' },
    // FLS
    { sub: 'Ironclad Fire Protection', sow: 'Fire Life Safety (FLS) Services', total: 82000, monthly: 6833, annual: 82000, labor: 54000, materials: 20000, equipment: 8000, overhead: 5.0, inclusions: 'Fire alarm testing, sprinkler inspection, extinguisher service, emergency lighting, suppression systems, code compliance reporting', exclusions: 'Fire alarm panel replacement, sprinkler riser replacement, structural fire proofing', assumptions: 'Based on 180,000 sq ft protected area with wet and dry systems', timeline: 'Annual contract with semi-annual inspections', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'RedLine Fire & Safety', sow: 'Fire Life Safety (FLS) Services', total: 91500, monthly: 7625, annual: 91500, labor: 62000, materials: 21500, equipment: 8000, overhead: 6.5, inclusions: 'All FLS testing and inspections, 24/7 monitoring, code compliance consulting, emergency repairs, reporting to AHJ', exclusions: 'Complete panel upgrades, riser replacement, fire pump overhaul', assumptions: 'Based on current system knowledge as incumbent provider', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Janitorial
    { sub: 'PrimeSweep Facility Services', sow: 'Janitorial Services', total: 228000, monthly: 19000, annual: 228000, labor: 186000, materials: 30000, equipment: 12000, overhead: 6.0, inclusions: 'Daily cleaning, restroom service, trash removal, floor care, window cleaning (interior), supply management, day porter service', exclusions: 'Carpet replacement, hazmat cleanup, construction cleanup, exterior pressure washing', assumptions: '200,000 sq ft, 5 days/week base service + 2 day porters', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '60 days' },
    { sub: 'EverClean Commercial', sow: 'Janitorial Services', total: 242000, monthly: 20167, annual: 242000, labor: 195000, materials: 33000, equipment: 14000, overhead: 7.5, inclusions: 'Daily cleaning, restroom deep clean, trash/recycling, floor stripping and waxing, interior window cleaning, consumable supplies, quality inspections', exclusions: 'Carpet replacement, exterior cleaning, mechanical room cleaning, paint touch-up', assumptions: '200,000 sq ft, 6 days/week service, dedicated site supervisor', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Exterior
    { sub: 'Mountain Crest Landscapes', sow: 'Exterior Services', total: 148000, monthly: 12333, annual: 148000, labor: 102000, materials: 30000, equipment: 16000, overhead: 5.0, inclusions: 'Mowing, trimming, irrigation maintenance, seasonal planting, snow removal, salt/sand application, parking lot sweeping', exclusions: 'Tree removal over 8-inch caliper, new irrigation installation, hardscape construction', assumptions: '12 acres maintained grounds, snow removal on-call with 2-hour response', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'GreenEdge Grounds Management', sow: 'Exterior Services', total: 158000, monthly: 13167, annual: 158000, labor: 110000, materials: 32000, equipment: 16000, overhead: 6.0, inclusions: 'Full grounds maintenance, seasonal color, irrigation management, snow/ice management, tree and shrub care, turf programs', exclusions: 'Major tree removal, new plantings over $500 per unit, structural repairs, drainage projects', assumptions: '12 acres, includes dedicated crew 3 days/week during growing season', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Emergency Power
    { sub: 'PowerGen Systems Inc', sow: 'Emergency Power Services', total: 74000, monthly: 6167, annual: 74000, labor: 46000, materials: 21000, equipment: 7000, overhead: 4.5, inclusions: 'Generator PM, load bank testing, ATS maintenance, UPS battery testing, fuel system inspection, remote monitoring', exclusions: 'Generator replacement, major overhaul, fuel supply, new installations', assumptions: '3 generators (500kW, 250kW, 150kW) and 2 UPS systems, quarterly service', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'Volt Electric & Power', sow: 'Emergency Power Services', total: 79500, monthly: 6625, annual: 79500, labor: 50000, materials: 22500, equipment: 7000, overhead: 5.0, inclusions: 'Full generator service, ATS testing, UPS maintenance, fuel polishing, infrared scanning, comprehensive reporting', exclusions: 'Equipment replacement over $5,000, fuel purchase, electrical panel upgrades', assumptions: 'Same equipment inventory, monthly inspections plus quarterly PM', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '60 days' },
    // Dock Equipment
    { sub: 'DockMaster Loading Systems', sow: 'Dock Equipment Services', total: 64000, monthly: 5333, annual: 64000, labor: 40000, materials: 18000, equipment: 6000, overhead: 4.0, inclusions: 'Dock leveler maintenance, overhead door service, bumper replacement, safety equipment, vehicle restraint inspection', exclusions: 'Complete leveler or door replacement, electrical panel upgrades, structural modifications', assumptions: '10 dock positions, quarterly PM inspections', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'Precision Dock & Door', sow: 'Dock Equipment Services', total: 58500, monthly: 4875, annual: 58500, labor: 36000, materials: 16500, equipment: 6000, overhead: 3.5, inclusions: 'Dock levelers, overhead doors, dock seals, vehicle restraints, weatherstripping, annual safety certification', exclusions: 'Electrical upgrades, structural repairs, new equipment installation over $3,000', assumptions: 'Based on current equipment inventory and maintenance history as incumbent', timeline: 'Annual contract', payment_terms: 'Net 45', validity: '90 days' },
    // Plumbing
    { sub: 'ProFlow Plumbing Solutions', sow: 'Plumbing Services', total: 49500, monthly: 4125, annual: 49500, labor: 33000, materials: 11500, equipment: 5000, overhead: 3.5, inclusions: 'Preventive maintenance, backflow testing, water treatment monitoring, drain cleaning, fixture repairs, water heater maintenance', exclusions: 'Main line replacement, sewer line repair, new fixture installation, fire suppression plumbing', assumptions: 'Monthly service visits plus emergency response within 2 hours', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    { sub: 'AquaPipe Commercial Services', sow: 'Plumbing Services', total: 53000, monthly: 4417, annual: 53000, labor: 35500, materials: 12500, equipment: 5000, overhead: 4.0, inclusions: 'Full plumbing maintenance, backflow prevention, water quality testing, drain jetting, fixture repair/replacement, valve maintenance', exclusions: 'Major pipe replacement, sewer rehab, boiler work, fire suppression systems', assumptions: 'Bi-weekly scheduled visits plus emergency on-call', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
    // Miscellaneous (Pest)
    { sub: 'SafeGuard Pest Solutions', sow: 'Miscellaneous Services', total: 27000, monthly: 2250, annual: 27000, labor: 17500, materials: 7500, equipment: 2000, overhead: 3.0, inclusions: 'Integrated pest management, monthly inspections, rodent control, insect treatment, bird deterrents, reporting and documentation', exclusions: 'Wildlife removal, fumigation, structural repairs, remediation', assumptions: 'Monthly interior/exterior treatments, quarterly comprehensive inspections, emergency response', timeline: 'Annual contract', payment_terms: 'Net 30', validity: '90 days' },
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
      submitted_at: '2026-06-07T00:00:00Z',
    })
  }

  const { data: insertedQuotes, error: qErr } = await supabase
    .from('sow_quotes')
    .insert(quoteRecords)
    .select()

  if (qErr) { console.error('Quote insert error:', qErr); return }
  console.log(`Inserted ${insertedQuotes.length} quotes`)

  // 5. Communication logs
  console.log('\n5. Inserting communication logs...')
  const commRecords = []
  for (const ss of insertedSowSubs) {
    const sub = insertedSubs.find(s => s.id === ss.subcontractor_id)
    commRecords.push({
      sow_subcontractor_id: ss.id,
      comm_type: 'rfq_sent',
      direction: 'outbound',
      subject: `RFQ sent to ${sub?.company_name}`,
      body: `Request for Quote sent for Metro Distribution Center facility management task order.`,
      created_at: '2026-05-20T10:00:00Z',
    })
    commRecords.push({
      sow_subcontractor_id: ss.id,
      comm_type: 'quote_received',
      direction: 'inbound',
      subject: `Quote received from ${sub?.company_name}`,
      body: `Subcontractor submitted their quote for review.`,
      created_at: '2026-06-07T14:00:00Z',
    })
  }

  const { error: commErr } = await supabase
    .from('sow_communications')
    .insert(commRecords)

  if (commErr) { console.error('Comm insert error:', commErr); return }
  console.log(`Inserted ${commRecords.length} communication logs`)

  // 6. Seed AI analysis output into Supabase Storage
  console.log('\n6. Seeding AI analysis output...')
  const analysisResult = {
    task_order_metadata: {
      title: 'Sample Task Order',
      solicitation_number: 'SOL-2026-FM-0042',
      task_order_number: 'TO-FM-2026-0042',
      contract_number: 'GS-06P-14-BSD-0042',
      contracting_officer: 'Sarah Mitchell',
      co_email: 'sarah.mitchell@gsa.gov',
      co_phone: '(303) 555-0100',
      issuing_office: 'General Services Administration - Region 8',
      location: 'Denver, CO',
      period_of_performance_start: '2026-10-01',
      period_of_performance_end: '2032-09-30',
      pop_duration: '6 years',
      pop_structure: '6-year PoP: 2-year base + two 2-year option periods',
      base_period: '2-year base period: October 1, 2026 — September 30, 2028',
      option_periods: [
        'Option Period 1 (2 years): October 1, 2028 — September 30, 2030',
        'Option Period 2 (2 years): October 1, 2030 — September 30, 2032',
      ],
      estimated_value: '$750,000 - $950,000 annually',
      naics_code: '561210 - Facilities Support Services',
      set_aside: 'Small Business Set-Aside',
      response_deadline: '2026-07-15T17:00:00Z',
    },
    requirements: [
      { id: 'REQ-001', category: 'Technical', description: 'Provide preventive and corrective HVAC maintenance for all rooftop units, split systems, and building automation systems.', priority: 'High', source_reference: 'SOW Section 3.1', compliance_status: 'compliant' },
      { id: 'REQ-002', category: 'Technical', description: 'Maintain fire alarm systems, sprinkler systems, fire extinguishers, and emergency lighting in compliance with NFPA codes.', priority: 'High', source_reference: 'SOW Section 3.2', compliance_status: 'compliant' },
      { id: 'REQ-003', category: 'Technical', description: 'Provide daily janitorial services including restroom maintenance, trash removal, and floor care for all common areas.', priority: 'Medium', source_reference: 'SOW Section 3.3', compliance_status: 'compliant' },
      { id: 'REQ-004', category: 'Technical', description: 'Maintain all exterior grounds including landscaping, snow removal, and parking lot maintenance year-round.', priority: 'Medium', source_reference: 'SOW Section 3.4', compliance_status: 'compliant' },
      { id: 'REQ-005', category: 'Technical', description: 'Perform quarterly maintenance on emergency generators, UPS systems, and automatic transfer switches.', priority: 'High', source_reference: 'SOW Section 3.5', compliance_status: 'compliant' },
      { id: 'REQ-006', category: 'Technical', description: 'Maintain all dock equipment including levelers, overhead doors, dock seals, and vehicle restraints.', priority: 'Medium', source_reference: 'SOW Section 3.6', compliance_status: 'compliant' },
      { id: 'REQ-007', category: 'Technical', description: 'Provide plumbing maintenance including backflow prevention testing and water treatment monitoring.', priority: 'Medium', source_reference: 'SOW Section 3.7', compliance_status: 'compliant' },
      { id: 'REQ-008', category: 'Administrative', description: 'All technicians must have appropriate trade certifications and pass background checks.', priority: 'High', source_reference: 'SOW Section 4.1', compliance_status: 'compliant' },
      { id: 'REQ-009', category: 'Administrative', description: 'Contractor shall provide monthly performance reports and maintain a computerized maintenance management system (CMMS).', priority: 'Medium', source_reference: 'SOW Section 4.3', compliance_status: 'compliant' },
      { id: 'REQ-010', category: 'Compliance', description: 'Davis-Bacon wage rates apply to all work performed on-site.', priority: 'High', source_reference: 'Contract Clause H.4', compliance_status: 'compliant' },
      { id: 'REQ-011', category: 'Compliance', description: 'Contractor must maintain liability insurance of $2M per occurrence and workers comp coverage.', priority: 'High', source_reference: 'Contract Clause H.8', compliance_status: 'compliant' },
      { id: 'REQ-012', category: 'Transition', description: 'A 30-day transition period is provided for the incoming contractor to assume full responsibility.', priority: 'Medium', source_reference: 'SOW Section 5.1', compliance_status: 'compliant' },
    ],
    service_categories: [
      { name: 'HVAC Services', description: 'Heating, ventilation, and air conditioning maintenance', sow_reference: 'Section 3.1' },
      { name: 'Fire Life Safety (FLS) Services', description: 'Fire alarm, sprinkler, and suppression system maintenance', sow_reference: 'Section 3.2' },
      { name: 'Janitorial Services', description: 'Daily cleaning and custodial services', sow_reference: 'Section 3.3' },
      { name: 'Exterior Services', description: 'Landscaping, snow removal, and grounds maintenance', sow_reference: 'Section 3.4' },
      { name: 'Emergency Power Services', description: 'Generator, UPS, and transfer switch maintenance', sow_reference: 'Section 3.5' },
      { name: 'Dock Equipment Services', description: 'Loading dock equipment maintenance and repair', sow_reference: 'Section 3.6' },
      { name: 'Plumbing Services', description: 'Plumbing maintenance and backflow prevention', sow_reference: 'Section 3.7' },
      { name: 'Miscellaneous Services', description: 'Pest control and integrated pest management', sow_reference: 'Section 3.8' },
    ],
    staffing_requirements: [
      { role: 'Project Manager', quantity: 1, qualifications: 'Minimum 5 years facility management experience, PMP or CFM certification preferred', full_time: true },
      { role: 'HVAC Technician', quantity: 2, qualifications: 'EPA 608 Universal certification, 3+ years commercial HVAC experience', full_time: true },
      { role: 'Electrician', quantity: 1, qualifications: 'State journeyman electrician license, experience with emergency power systems', full_time: false },
      { role: 'Janitorial Supervisor', quantity: 1, qualifications: 'ISSA CMI or CIMS certification preferred, 2+ years supervisory experience', full_time: true },
      { role: 'Grounds Crew Lead', quantity: 1, qualifications: 'Commercial landscaping experience, snow removal equipment operation', full_time: true },
    ],
    key_dates: [
      { date: '2026-06-15', description: 'Questions due to Contracting Officer' },
      { date: '2026-06-30', description: 'Government responses to questions published' },
      { date: '2026-07-15', description: 'Proposal submission deadline' },
      { date: '2026-08-30', description: 'Anticipated award date' },
      { date: '2026-10-01', description: 'Contract start / transition period begins' },
      { date: '2026-10-31', description: 'Full performance begins' },
    ],
  }

  // Store AI analysis as JSON in Supabase Storage
  const analysisBlob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: 'application/json' })
  const analysisPath = `${SAMPLE_TO_ID}/ai_analysis.json`
  await supabase.storage.from('task-order-documents').remove([analysisPath])
  const { error: uploadErr } = await supabase.storage.from('task-order-documents').upload(analysisPath, analysisBlob, {
    contentType: 'application/json',
    upsert: true,
  })
  if (uploadErr) { console.error('Analysis upload error:', uploadErr) }
  else { console.log('AI analysis output uploaded') }

  // 7. Seed debrief for the Sample Task Order (Awarded this time for variety)
  console.log('\n7. Seeding debrief for Sample Task Order...')
  const debrief = {
    id: crypto.randomUUID(),
    task_order_id: SAMPLE_TO_ID,
    task_order_title: 'Sample Task Order',
    outcome: 'awarded',
    award_date: '2026-08-28',
    final_award_price: 835000,
    our_proposed_price: 835000,
    government_estimate: 880000,
    winning_competitor: null,
    winning_competitor_price: null,
    loss_reasons: [],
    strengths: ['Competitive pricing', 'Strong technical approach', 'Strong subcontractor team', 'Local presence', 'Transition plan quality'],
    weaknesses: [],
    lessons_learned: 'Pricing below the government estimate while maintaining quality subcontractor team was the winning combination. Strong local presence and detailed transition plan differentiated us from competitors who bid higher. Key takeaway: when you have solid local subs with incumbent knowledge, you can price competitively without sacrificing quality.',
    pricing_notes: 'Our price of $835K was 5.1% below the government estimate of $880K. Two other bidders priced above $900K. Competitive pricing was achievable because of existing relationships with local subcontractors who gave us preferred rates.',
    sub_performance_notes: 'All subcontractors responded quickly to RFQs. Precision Dock & Door provided the most competitive dock equipment quote due to their incumbent knowledge. PrimeSweep offered excellent janitorial pricing for the square footage. Summit Mechanical was responsive and provided detailed scope breakdowns.',
    what_to_repeat: 'Early subcontractor engagement (3+ weeks before proposal deadline), competitive markup strategy (6-8% overall), detailed transition plan showing day-by-day assumption of services, leveraging incumbent subcontractors where available.',
    what_to_change: 'Start site visit earlier in the process. Some subs needed more time to provide accurate quotes for the emergency power scope. Also consider getting 3 quotes minimum per SOW for better leverage in negotiations.',
    evaluator_feedback: 'Proposal was rated Excellent for Technical and Good for Management. Pricing was lowest among technically acceptable offerors. Transition plan was specifically called out as a strength. Evaluators noted the strong team of local subcontractors with relevant experience.',
    service_categories: ['HVAC', 'Fire Life Safety', 'Janitorial', 'Exterior', 'Emergency Power', 'Dock Equipment', 'Plumbing', 'Pest Control'],
    region: 'CO',
    contract_value_range: '$500K - $1M',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save debrief to storage
  const debriefBlob = new Blob([JSON.stringify(debrief, null, 2)], { type: 'application/json' })
  const debriefPath = `${SAMPLE_TO_ID}/debrief.json`
  await supabase.storage.from('task-order-documents').remove([debriefPath])
  const { error: debriefErr } = await supabase.storage.from('task-order-documents').upload(debriefPath, debriefBlob, {
    contentType: 'application/json',
    upsert: true,
  })
  if (debriefErr) { console.error('Debrief upload error:', debriefErr) }
  else { console.log('Debrief saved for Sample Task Order') }

  // Update global debriefs index (include both the existing N. Texas debrief if present and this new one)
  const indexPath = '_global/debriefs_index.json'
  let existingDebriefs = []
  try {
    const { data: urlData } = await supabase.storage.from('task-order-documents').createSignedUrl(indexPath, 60)
    if (urlData?.signedUrl) {
      const res = await fetch(urlData.signedUrl)
      if (res.ok) existingDebriefs = await res.json()
    }
  } catch (e) { /* no existing index */ }

  // Remove any existing entry for this task order and add new one
  existingDebriefs = existingDebriefs.filter(d => d.task_order_id !== SAMPLE_TO_ID)
  existingDebriefs.push(debrief)

  const indexBlob = new Blob([JSON.stringify(existingDebriefs, null, 2)], { type: 'application/json' })
  await supabase.storage.from('task-order-documents').remove([indexPath])
  await supabase.storage.from('task-order-documents').upload(indexPath, indexBlob, { contentType: 'application/json', upsert: true })
  console.log(`Updated global debriefs index (${existingDebriefs.length} debriefs total)`)

  // Regenerate intelligence summary
  console.log('\n8. Regenerating intelligence summary...')
  const allDebriefs = existingDebriefs
  const wins = allDebriefs.filter(d => d.outcome === 'awarded')
  const losses = allDebriefs.filter(d => d.outcome === 'not_awarded')
  const noBids = allDebriefs.filter(d => d.outcome === 'no_bid')
  const decidedBids = wins.length + losses.length
  const winRate = decidedBids > 0 ? Math.round((wins.length / decidedBids) * 100) : 0

  // Loss reasons
  const reasonCounts = {}
  for (const d of losses) {
    for (const r of d.loss_reasons || []) {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1
    }
  }
  const topLossReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Strengths
  const strengthCounts = {}
  for (const d of allDebriefs) {
    for (const s of d.strengths || []) {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1
    }
  }
  const topStrengths = Object.entries(strengthCounts)
    .map(([strength, count]) => ({ strength, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Competitors
  const competitorMap = {}
  for (const d of losses) {
    if (d.winning_competitor) {
      if (!competitorMap[d.winning_competitor]) {
        competitorMap[d.winning_competitor] = { name: d.winning_competitor, wins_against_us: 0, losses_against_us: 0, known_services: new Set(), known_regions: new Set(), avg_price_vs_ours: '', notes: '' }
      }
      competitorMap[d.winning_competitor].wins_against_us++
      for (const cat of d.service_categories || []) competitorMap[d.winning_competitor].known_services.add(cat)
      if (d.region) competitorMap[d.winning_competitor].known_regions.add(d.region)
    }
  }
  const competitors = Object.values(competitorMap).map(c => ({
    ...c,
    known_services: [...c.known_services],
    known_regions: [...c.known_regions],
  }))

  // Pricing insights
  const pricingInsights = []
  if (losses.length > 0) {
    const gaps = losses.filter(d => d.our_proposed_price && d.winning_competitor_price)
      .map(d => ((d.our_proposed_price - d.winning_competitor_price) / d.winning_competitor_price) * 100)
    if (gaps.length > 0) {
      const avgGap = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)
      pricingInsights.push(`Average pricing gap on losses: ${avgGap}% above winning price`)
    }
  }
  if (wins.length > 0) {
    const winGaps = wins.filter(d => d.our_proposed_price && d.government_estimate)
      .map(d => ((d.government_estimate - d.our_proposed_price) / d.government_estimate) * 100)
    if (winGaps.length > 0) {
      const avgBelow = (winGaps.reduce((a, b) => a + b, 0) / winGaps.length).toFixed(1)
      pricingInsights.push(`Average savings below gov estimate on wins: ${avgBelow}%`)
    }
  }

  const dataCount = allDebriefs.length
  let maturity = 'early'
  let maturityDesc = 'Limited data available. Add more debriefs to improve insights.'
  if (dataCount >= 25) { maturity = 'advanced'; maturityDesc = 'Comprehensive dataset. Recommendations are highly reliable.' }
  else if (dataCount >= 10) { maturity = 'mature'; maturityDesc = 'Strong historical data. Recommendations are statistically meaningful.' }
  else if (dataCount >= 3) { maturity = 'developing'; maturityDesc = 'Building baseline patterns. More data will improve accuracy.' }

  const intelligence = {
    total_bids: allDebriefs.length,
    wins: wins.length,
    losses: losses.length,
    no_bids: noBids.length,
    win_rate: winRate,
    avg_margin_on_wins: 0,
    avg_margin_on_losses: 0,
    top_loss_reasons: topLossReasons,
    top_strengths: topStrengths,
    competitors,
    pricing_insights: pricingInsights,
    sub_insights: [],
    lessons_by_category: {},
    data_maturity: maturity,
    data_maturity_description: maturityDesc,
    last_updated: new Date().toISOString(),
  }

  const intBlob = new Blob([JSON.stringify(intelligence, null, 2)], { type: 'application/json' })
  const intPath = '_global/intelligence_summary.json'
  await supabase.storage.from('task-order-documents').remove([intPath])
  await supabase.storage.from('task-order-documents').upload(intPath, intBlob, { contentType: 'application/json', upsert: true })
  console.log('Intelligence summary regenerated')

  // Update task order status to awarded since this one was won
  await supabase.from('task_orders').update({ status: 'awarded' }).eq('id', SAMPLE_TO_ID)

  console.log('\n========================================')
  console.log('DONE! Sample Task Order seeded successfully.')
  console.log('========================================')
  console.log('Summary:')
  console.log('  - 1 new task order: "Sample Task Order" (Metro Distribution Center, Denver, CO)')
  console.log('  - 20 new subcontractors added')
  console.log('  - 8 SOW items with descriptions')
  console.log('  - 15 subcontractor assignments')
  console.log('  - 15 quotes with full cost breakdowns')
  console.log('  - 30 communication logs')
  console.log('  - AI analysis output (metadata, requirements, categories, staffing, key dates)')
  console.log('  - Debrief: Awarded at $835K (5.1% below gov estimate)')
  console.log('  - Intelligence summary updated (2 debriefs total: 1 win + 1 loss = 50% win rate)')
  console.log('')
  console.log('Live at: https://core314-taskorder.netlify.app')
}

seed().catch(console.error)
