import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.TASKORDER_SUPABASE_URL
const supabaseKey = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const NEW_TO_ID = 'b2c3d4e5-f6a7-8901-bcde-f23456789012'

async function getAdminUserId() {
  const { data } = await supabase.from('user_profiles').select('id').eq('email', 'admin@core314.com').single()
  return data?.id || '00000000-0000-0000-0000-000000000000'
}

async function seed() {
  const adminId = await getAdminUserId()
  console.log('Admin user ID:', adminId)

  // 1. Create the new task order — just uploaded, early stage
  console.log('\n1. Creating Midwest Regional Facility Task Order...')
  const { data: taskOrder, error: toErr } = await supabase
    .from('task_orders')
    .upsert({
      id: NEW_TO_ID,
      title: 'Midwest Regional Facility Services',
      solicitation_number: 'SOL-2026-FM-0089',
      task_order_number: 'TO-FM-2026-0089',
      site_name: 'Central Operations & Logistics Center',
      location_city: 'Columbus',
      location_state: 'OH',
      status: 'in_progress',
      due_date: '2026-09-01T17:00:00Z',
      created_by: adminId,
      notes: 'Full facility management services for a 175,000 sq ft operations and logistics center. 5-year period of performance with 1-year base and four 1-year options. Multi-trade services required including HVAC, electrical, janitorial, landscaping, and fire life safety. GSA Schedule contract vehicle. Full & Open competition. NAICS 561210. Response deadline September 1, 2026.',
    })
    .select()
    .single()

  if (toErr) { console.error('Task Order insert error:', toErr); return }
  console.log('Created task order:', taskOrder.title)

  // 2. Create SOW items (similar scope to Sample Task Order)
  console.log('\n2. Creating SOW items...')
  const sowItems = [
    { sow_name: 'HVAC & Mechanical Services', service_category: 'HVAC', description: 'Complete HVAC maintenance, repair, and operations for all mechanical systems including RTUs, split systems, VAV boxes, and building automation controls. Includes preventive maintenance, emergency response, and seasonal changeovers.', estimated_value: 110000, sowStatus: 'quotes_received', statusNote: 'RFQs sent. 1 of 3 quotes received.' },
    { sow_name: 'Fire Life Safety Systems', service_category: 'Fire Life Safety', description: 'Inspection, testing, and maintenance of all fire alarm systems, sprinkler systems, fire extinguishers, emergency lighting, and exit signage per NFPA codes. Includes annual inspections and 24/7 monitoring.', estimated_value: 75000, sowStatus: 'quotes_received', statusNote: 'RFQs sent. 1 of 2 quotes received.' },
    { sow_name: 'Janitorial & Custodial Services', service_category: 'Janitorial', description: 'Day and night porter services, restroom maintenance, floor care (stripping, waxing, carpet cleaning), trash removal, and recycling. 175,000 sq ft facility including offices, warehouse, and common areas.', estimated_value: 210000, sowStatus: 'rfqs_sent', statusNote: 'RFQs sent to 2 subcontractors. Awaiting responses.' },
    { sow_name: 'Grounds & Landscaping', service_category: 'Landscaping', description: 'Lawn care, tree and shrub maintenance, seasonal planting, irrigation system management, parking lot sweeping, and snow/ice removal during winter months.', estimated_value: 135000, sowStatus: 'quotes_received', statusNote: 'RFQs sent. 1 of 2 quotes received.' },
    { sow_name: 'Electrical Systems Maintenance', service_category: 'Electrical', description: 'Maintenance and repair of all electrical systems including lighting, panels, transformers, emergency generators, and UPS systems. Includes infrared scanning and preventive maintenance.', estimated_value: 85000, sowStatus: 'rfqs_sent', statusNote: 'RFQ sent to 1 subcontractor. Awaiting response.' },
    { sow_name: 'Plumbing Services', service_category: 'Plumbing', description: 'Maintenance and repair of all plumbing systems including domestic water, sanitary, storm drainage, backflow prevention, and water heaters. Includes emergency response.', estimated_value: 48000, sowStatus: 'rfqs_sent', statusNote: 'RFQ sent to 1 subcontractor. Awaiting response.' },
    { sow_name: 'Elevator & Vertical Transport', service_category: 'Elevator Maintenance', description: 'Full-service maintenance of 3 passenger elevators and 2 freight elevators. Includes preventive maintenance, inspections, emergency callback service, and modernization consulting.', estimated_value: 62000, sowStatus: 'not_started', statusNote: 'No subcontractors identified yet. Need to source elevator maintenance providers.' },
    { sow_name: 'Security Systems & Access Control', service_category: 'Security Systems', description: 'Maintenance and monitoring of CCTV systems, access control (card readers, biometric), intrusion detection, and perimeter security. Includes software updates and hardware repairs.', estimated_value: 55000, sowStatus: 'not_started', statusNote: 'No subcontractors identified yet. Need to source security system providers.' },
  ]

  const sowRecords = sowItems.map(s => ({
    task_order_id: NEW_TO_ID,
    sow_name: s.sow_name,
    service_category: s.service_category,
    description: s.description,
    status: s.sowStatus || 'rfqs_sent',
    notes: `Estimated value: $${s.estimated_value.toLocaleString()}. ${s.statusNote || 'RFQs sent to qualified subcontractors. Awaiting responses.'}`,
  }))

  const { data: insertedSows, error: sowErr } = await supabase
    .from('sow_items')
    .insert(sowRecords)
    .select()

  if (sowErr) { console.error('SOW insert error:', sowErr); return }
  console.log(`Inserted ${insertedSows.length} SOW items`)

  const sowMap = {}
  for (const s of insertedSows) sowMap[s.sow_name] = s

  // 3. Get existing subcontractors to assign some
  const { data: allSubs } = await supabase.from('subcontractors').select('*')
  const subByName = {}
  for (const s of allSubs) subByName[s.company_name] = s

  // 4. Assign subcontractors to SOWs — RFQs sent but most haven't responded yet
  console.log('\n3. Assigning subcontractors to SOWs (RFQs sent, few quotes back)...')

  const assignments = [
    // HVAC — 3 subs contacted, only 1 has responded with a quote
    { sub: 'Summit Mechanical Group', sow: 'HVAC & Mechanical Services', status: 'invited', hasQuote: false },
    { sub: 'Alpine Climate Solutions', sow: 'HVAC & Mechanical Services', status: 'quote_submitted', hasQuote: true },
    { sub: 'Trane Technologies', sow: 'HVAC & Mechanical Services', status: 'invited', hasQuote: false },
    // FLS — 2 subs contacted, 1 responded
    { sub: 'Ironclad Fire Protection', sow: 'Fire Life Safety Systems', status: 'invited', hasQuote: false },
    { sub: 'RedLine Fire & Safety', sow: 'Fire Life Safety Systems', status: 'quote_submitted', hasQuote: true },
    // Janitorial — 2 subs contacted, 0 responded
    { sub: 'PrimeSweep Facility Services', sow: 'Janitorial & Custodial Services', status: 'invited', hasQuote: false },
    { sub: 'ABM Janitorial Services', sow: 'Janitorial & Custodial Services', status: 'invited', hasQuote: false },
    // Landscaping — 2 subs contacted, 1 responded
    { sub: 'Mountain Crest Landscapes', sow: 'Grounds & Landscaping', status: 'invited', hasQuote: false },
    { sub: 'BrightView Landscapes', sow: 'Grounds & Landscaping', status: 'quote_submitted', hasQuote: true },
    // Electrical — 1 sub contacted, 0 responded
    { sub: 'Volt Electric & Power', sow: 'Electrical Systems Maintenance', status: 'invited', hasQuote: false },
    // Plumbing — 1 sub contacted, 0 responded
    { sub: 'ProFlow Plumbing Solutions', sow: 'Plumbing Services', status: 'invited', hasQuote: false },
    // Elevator — not yet assigned (no subs contacted)
    // Security — not yet assigned (no subs contacted)
  ]

  const sowSubRecords = []
  for (const a of assignments) {
    const sub = subByName[a.sub]
    const sow = sowMap[a.sow]
    if (!sub || !sow) { console.warn(`Skipping: sub=${a.sub} (found=${!!sub}) sow=${a.sow} (found=${!!sow})`); continue }
    sowSubRecords.push({
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      outreach_status: a.status,
      rfq_sent_date: '2026-05-10T00:00:00Z',
      rfq_due_date: '2026-08-15T00:00:00Z',
      response_date: a.hasQuote ? '2026-05-13T00:00:00Z' : null,
    })
  }

  if (sowSubRecords.length > 0) {
    const { error: ssErr } = await supabase.from('sow_subcontractors').insert(sowSubRecords)
    if (ssErr) console.error('SOW-Sub assignment error:', ssErr)
    else console.log(`Assigned ${sowSubRecords.length} subcontractors to SOWs`)
  }

  // 5. Insert the 3 quotes that have come back so far
  console.log('\n4. Inserting 3 early quotes...')

  const quotes = [
    {
      sub: 'Alpine Climate Solutions',
      sow: 'HVAC & Mechanical Services',
      total_amount: 115000,
      monthly_amount: 9583,
      labor_cost: 72000,
      materials_cost: 28000,
      equipment_cost: 8000,
      overhead_markup: 7,
      scope_inclusions: ['Preventive maintenance for all RTUs', '24/7 emergency response', 'Seasonal changeovers', 'BAS monitoring and adjustments', 'Filter replacements quarterly'],
      scope_exclusions: ['Major equipment replacements over $5,000', 'Ductwork modifications', 'New construction'],
      assumptions: ['Access to all mechanical rooms during normal business hours', 'Owner provides replacement filters', 'Emergency response within 2 hours'],
    },
    {
      sub: 'RedLine Fire & Safety',
      sow: 'Fire Life Safety Systems',
      total_amount: 78500,
      monthly_amount: 6542,
      labor_cost: 52000,
      materials_cost: 18000,
      equipment_cost: 5500,
      overhead_markup: 4,
      scope_inclusions: ['Annual fire alarm testing per NFPA 72', 'Quarterly sprinkler inspections', 'Fire extinguisher service', 'Emergency lighting testing', '24/7 monitoring'],
      scope_exclusions: ['Fire alarm panel replacement', 'Sprinkler system redesign', 'Hood suppression systems'],
      assumptions: ['Existing systems are in serviceable condition', 'Access for inspections during business hours', 'Fire watch coverage billed separately if needed'],
    },
    {
      sub: 'BrightView Landscapes',
      sow: 'Grounds & Landscaping',
      total_amount: 142000,
      monthly_amount: 11833,
      labor_cost: 95000,
      materials_cost: 32000,
      equipment_cost: 10000,
      overhead_markup: 5,
      scope_inclusions: ['Weekly mowing April–October', 'Snow removal November–March', 'Seasonal color planting (2x/year)', 'Irrigation system management', 'Parking lot sweeping'],
      scope_exclusions: ['Tree removal over 6" caliper', 'Irrigation system replacement', 'Parking lot repaving'],
      assumptions: ['Salt and de-icing materials provided by owner', 'Snow removal triggered at 2" accumulation', 'Mowing schedule may adjust based on weather'],
    },
  ]

  // First get the sow_subcontractor IDs we just created
  const { data: sowSubData } = await supabase.from('sow_subcontractors')
    .select('id, sow_item_id, subcontractor_id')
    .in('sow_item_id', Object.values(sowMap).map(s => s.id))
  const sowSubMap = {}
  for (const ss of (sowSubData || [])) sowSubMap[`${ss.sow_item_id}:${ss.subcontractor_id}`] = ss

  for (const q of quotes) {
    const sub = subByName[q.sub]
    const sow = sowMap[q.sow]
    if (!sub || !sow) { console.warn(`Skipping quote: sub=${q.sub} sow=${q.sow}`); continue }
    const sowSub = sowSubMap[`${sow.id}:${sub.id}`]
    if (!sowSub) { console.warn(`No sow_subcontractor for ${q.sub} → ${q.sow}`); continue }

    const { error: qErr } = await supabase.from('sow_quotes').insert({
      sow_subcontractor_id: sowSub.id,
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      total_amount: q.total_amount,
      monthly_amount: q.monthly_amount,
      annual_amount: q.total_amount,
      labor_cost: q.labor_cost,
      materials_cost: q.materials_cost,
      equipment_cost: q.equipment_cost,
      overhead_markup: q.overhead_markup,
      status: 'received',
      submitted_at: '2026-05-13T14:30:00Z',
      scope_inclusions: q.scope_inclusions.join(', '),
      scope_exclusions: q.scope_exclusions.join(', '),
      assumptions: q.assumptions.join(', '),
    })
    if (qErr) console.error(`Quote error for ${q.sub}:`, qErr)
    else console.log(`  Quote: ${q.sub} → ${q.sow}: $${q.total_amount.toLocaleString()}`)
  }

  // 6. Add communication logs (RFQ sent dates)
  console.log('\n5. Adding communication logs...')
  for (const a of assignments) {
    const sub = subByName[a.sub]
    const sow = sowMap[a.sow]
    if (!sub || !sow) continue

    // RFQ sent to all assigned subs
    await supabase.from('sow_communications').insert({
      sow_item_id: sow.id,
      subcontractor_id: sub.id,
      type: 'rfq_sent',
      subject: `RFQ: ${sow.sow_name} - Central Operations & Logistics Center`,
      message: `Request for Quote sent for ${sow.sow_name} services at the Central Operations & Logistics Center, Columbus, OH. Please submit your quote by August 15, 2026.`,
      sent_at: '2026-05-10T09:00:00Z',
    })

    // If they submitted a quote, add that log too
    if (a.hasQuote) {
      await supabase.from('sow_communications').insert({
        sow_item_id: sow.id,
        subcontractor_id: sub.id,
        type: 'quote_received',
        subject: `Quote Received: ${sow.sow_name}`,
        message: `Quote received from ${a.sub} for ${sow.sow_name} services.`,
        sent_at: '2026-05-13T14:30:00Z',
      })
    }
  }
  console.log('Communication logs added')

  // 7. Update task order status to reflect early stage
  await supabase.from('task_orders').update({
    status: 'in_progress',
  }).eq('id', NEW_TO_ID)

  console.log('\n=== SEED COMPLETE ===')
  console.log('Task Order: Midwest Regional Facility Services')
  console.log('Location: Central Operations & Logistics Center, Columbus, OH')
  console.log('SOWs: 8 items')
  console.log('Subcontractors contacted: 11 across 6 SOWs')
  console.log('Quotes received: 3 of 11 (HVAC, FLS, Landscaping)')
  console.log('SOWs with no subs yet: 2 (Elevator & Vertical Transport, Security Systems)')
  console.log('SOWs awaiting quotes: 3 (Janitorial, Electrical, Plumbing)')
}

seed().catch(console.error)
