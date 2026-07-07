/**
 * Seeds a pre-loaded demo project so new users can explore features immediately.
 * Creates a realistic GovCon project with sample data in Supabase.
 */
import { supabase } from './supabase'
import { saveAiOutput } from './aiStorage'

const DEMO_PROJECT = {
  title: '[DEMO] Base Operations Support — Fort Liberty',
  solicitation_number: 'W9124D-25-R-0042',
  task_order_number: 'TO-2025-0042',
  site_name: 'Fort Liberty (formerly Fort Bragg)',
  location_city: 'Fayetteville',
  location_state: 'NC',
  status: 'in_progress' as const,
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  contract_vehicle: 'IDIQ',
  contracting_officer: 'Sarah Mitchell',
  co_email: 'sarah.mitchell@army.mil',
  period_of_performance_start: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  period_of_performance_end: new Date(Date.now() + 90 * 86400000 + 5 * 365 * 86400000).toISOString().split('T')[0],
  estimated_value: '47500000',
  naics_code: '561210',
  set_aside: 'Small Business',
  project_type: 'task_order',
  notes: 'This is a demo project pre-loaded with sample data. You can explore all features — AI analysis, capture gates, compliance matrix, pricing, and more. Delete this project anytime from the project page.',
}

const DEMO_ANALYSIS = {
  summary: 'Base Operations Support Services (BOSS) for Fort Liberty encompassing facility management, grounds maintenance, custodial services, pest control, refuse collection, and minor repairs across 2,400+ buildings on a 170,000-acre installation. The contract is structured as a Firm-Fixed-Price (FFP) IDIQ with a 1-year base period and four 1-year option periods. Total estimated value is $47.5M over the full performance period.',
  requirements: [
    { id: 'R1', text: 'Provide facility maintenance services for 2,400+ buildings', category: 'Facility Management', priority: 'critical', risk: 'medium' },
    { id: 'R2', text: 'Grounds maintenance including mowing, landscaping, and snow removal for 170,000 acres', category: 'Grounds Maintenance', priority: 'critical', risk: 'low' },
    { id: 'R3', text: 'Custodial services for administrative buildings, barracks, and common areas', category: 'Custodial', priority: 'high', risk: 'low' },
    { id: 'R4', text: 'Integrated pest management program compliant with DoD IPM guidelines', category: 'Pest Control', priority: 'medium', risk: 'low' },
    { id: 'R5', text: 'Refuse collection and recycling services — 3x weekly pickup at 500+ collection points', category: 'Waste Management', priority: 'high', risk: 'low' },
    { id: 'R6', text: 'Minor repair and maintenance (under $25K per task) with 4-hour emergency response', category: 'Repairs', priority: 'critical', risk: 'high' },
    { id: 'R7', text: 'Quality Control Plan with monthly inspections and corrective action procedures', category: 'Quality Assurance', priority: 'high', risk: 'medium' },
    { id: 'R8', text: 'Transition plan — 90-day phase-in with incumbent knowledge transfer', category: 'Transition', priority: 'critical', risk: 'high' },
    { id: 'R9', text: 'Key personnel: Project Manager (PMP certified), QC Manager, Safety Officer', category: 'Staffing', priority: 'critical', risk: 'medium' },
    { id: 'R10', text: 'OSHA compliance and safety program with monthly training requirements', category: 'Safety', priority: 'high', risk: 'medium' },
    { id: 'R11', text: 'Environmental compliance — hazardous waste handling per 40 CFR 262', category: 'Environmental', priority: 'high', risk: 'high' },
    { id: 'R12', text: 'Small Business Subcontracting Plan per FAR 52.219-9', category: 'Small Business', priority: 'high', risk: 'low' },
  ],
  risks: [
    { risk: 'Incumbent advantage — current contractor has 8 years of institutional knowledge', severity: 'high', mitigation: 'Hire key incumbent staff during transition; conduct site visits to document current operations' },
    { risk: '4-hour emergency response requirement during off-hours', severity: 'medium', mitigation: 'Maintain on-call crew with local housing; pre-position emergency repair materials' },
    { risk: 'Environmental compliance complexity — multiple regulated waste streams', severity: 'high', mitigation: 'Subcontract hazardous waste handling to certified specialist; assign dedicated Environmental Compliance Officer' },
    { risk: 'Workforce availability in Fayetteville labor market', severity: 'medium', mitigation: 'Partner with local workforce development programs; offer competitive wages above area median' },
  ],
  clarification_questions: [
    'Is a Government-Furnished Equipment (GFE) list available for vehicles and heavy equipment?',
    'What is the historical volume of emergency repair requests per month?',
    'Are there any buildings scheduled for demolition or major renovation during the performance period?',
    'What is the current staffing level under the incumbent contract?',
    'Is a site visit available prior to proposal submission?',
  ],
}

const DEMO_COMPLIANCE_MATRIX = {
  items: [
    { id: 'C1', requirement: 'SOW 3.1 — Facility Maintenance', section_ref: 'L.5.1', status: 'covered', risk_level: 'low', notes: 'Address in Volume I Technical Approach section 3' },
    { id: 'C2', requirement: 'SOW 3.2 — Grounds Maintenance', section_ref: 'L.5.1', status: 'covered', risk_level: 'low', notes: 'Include seasonal staffing plan' },
    { id: 'C3', requirement: 'SOW 3.6 — Emergency Response (4-hour)', section_ref: 'L.5.2', status: 'needs_review', risk_level: 'high', notes: 'Need to define on-call rotation and response procedures' },
    { id: 'C4', requirement: 'FAR 52.219-9 — SB Subcontracting Plan', section_ref: 'L.5.4', status: 'covered', risk_level: 'low', notes: 'Use SB Plan Generator' },
    { id: 'C5', requirement: 'SOW 4.1 — Quality Control Plan', section_ref: 'L.5.3', status: 'unclear', risk_level: 'medium', notes: 'RFP references inspection frequency but conflicts with QASP' },
    { id: 'C6', requirement: 'SOW 5.1 — Transition Plan (90-day)', section_ref: 'L.5.5', status: 'covered', risk_level: 'high', notes: 'Critical — address incumbent knowledge transfer' },
    { id: 'C7', requirement: 'SOW 6.1 — Key Personnel Qualifications', section_ref: 'L.5.6', status: 'covered', risk_level: 'medium', notes: 'PM requires PMP; QC Manager requires CQM' },
    { id: 'C8', requirement: 'DFARS 252.204-7012 — Cybersecurity', section_ref: 'L.5.7', status: 'missing', risk_level: 'high', notes: 'Need to address CMMC Level 1 compliance for CUI handling' },
  ],
}

export async function seedDemoProject(userId: string, orgId: string): Promise<string | null> {
  // Check if demo project already exists
  const { data: existing } = await supabase
    .from('task_orders')
    .select('id')
    .eq('org_id', orgId)
    .ilike('title', '%[DEMO]%')
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // Create the demo project
  const { data: project, error } = await supabase
    .from('task_orders')
    .insert({
      ...DEMO_PROJECT,
      created_by: userId,
      org_id: orgId,
    })
    .select('id')
    .single()

  if (error || !project) {
    console.error('Failed to create demo project:', error)
    return null
  }

  // Save AI analysis outputs
  await saveAiOutput(project.id, 'analysis', DEMO_ANALYSIS)
  await saveAiOutput(project.id, 'compliance_matrix', DEMO_COMPLIANCE_MATRIX)

  // Seed capture gate data
  try {
    const gates = [
      { task_order_id: project.id, org_id: orgId, gate_number: 0, gate_name: 'Opportunity Qualification', status: 'complete', decision: 'go', decision_rationale: 'Strong alignment with our BOSS portfolio. Incumbent contract ending.', checklist: JSON.stringify([
        { label: 'Opportunity aligns with strategic plan', checked: true, notes: 'Core service line — facility management' },
        { label: 'Budget is identified and funded', checked: true, notes: '$47.5M ceiling confirmed in FedBizOpps' },
        { label: 'Customer relationship exists', checked: true, notes: 'Active relationship with DPW Fort Liberty' },
        { label: 'Competitive landscape is understood', checked: true, notes: '3 known competitors — see Market Intel' },
        { label: 'We have relevant past performance', checked: true, notes: '2 similar BOSS contracts (Ft. Hood, Ft. Stewart)' },
      ]) },
      { task_order_id: project.id, org_id: orgId, gate_number: 1, gate_name: 'Capture Strategy', status: 'in_progress', decision: null, checklist: JSON.stringify([
        { label: 'Win strategy defined', checked: true, notes: 'Price competitiveness + transition risk mitigation' },
        { label: 'Teaming partners identified', checked: true, notes: 'JV with local SB for grounds maintenance' },
        { label: 'Competitive price range estimated', checked: false, notes: '' },
        { label: 'Staffing approach defined', checked: false, notes: '' },
        { label: 'Customer engagement plan in place', checked: true, notes: 'Site visit scheduled for next month' },
      ]) },
      { task_order_id: project.id, org_id: orgId, gate_number: 2, gate_name: 'Proposal Planning', status: 'not_started', decision: null, checklist: JSON.stringify([
        { label: 'Proposal manager assigned', checked: false, notes: '' },
        { label: 'Proposal schedule created', checked: false, notes: '' },
        { label: 'Color team reviews scheduled', checked: false, notes: '' },
        { label: 'Volume leads assigned', checked: false, notes: '' },
      ]) },
    ]

    await supabase.from('capture_gates').insert(gates)
  } catch { /* gates table might not exist */ }

  // Seed past performance citations
  try {
    const pastPerf = [
      {
        org_id: orgId,
        contract_title: 'Base Operations Support — Fort Hood',
        contract_number: 'W91247-20-C-0018',
        agency: 'US Army Installation Management Command',
        period_of_performance: '2020-2025',
        contract_value: '$38,200,000',
        description: 'Comprehensive facility management, grounds maintenance, custodial services, pest control, refuse collection, and minor repairs for 1,800+ buildings on Fort Hood. Managed 320+ employees with zero safety incidents over 5 years.',
        relevance_tags: ['BOSS', 'Facility Management', 'Grounds Maintenance', 'Army'],
        cpars_quality: 5,
        cpars_schedule: 4,
        cpars_cost: 5,
        cpars_management: 5,
        cpars_small_business: 4,
      },
      {
        org_id: orgId,
        contract_title: 'Installation Support Services — Fort Stewart',
        contract_number: 'W911SE-18-C-0092',
        agency: 'US Army Garrison Fort Stewart',
        period_of_performance: '2018-2023',
        contract_value: '$29,500,000',
        description: 'Integrated base operations including facility maintenance, grounds care, pest management, and environmental services. Successfully transitioned from incumbent within 60-day phase-in period.',
        relevance_tags: ['Installation Support', 'Transition', 'Environmental', 'Army'],
        cpars_quality: 4,
        cpars_schedule: 5,
        cpars_cost: 4,
        cpars_management: 4,
        cpars_small_business: 5,
      },
    ]
    await supabase.from('past_performance').insert(pastPerf)
  } catch { /* table might not exist */ }

  // Seed contract vehicles
  try {
    const vehicles = [
      {
        org_id: orgId,
        vehicle_name: 'GSA OASIS SB Pool 1',
        vehicle_type: 'gwac',
        contract_number: '47QRAA20D0001',
        ordering_period_start: '2020-07-01',
        ordering_period_end: '2030-06-30',
        ceiling_value: 60000000000,
        naics_codes: ['561210', '561720', '562111'],
        sin_numbers: [],
        scope_description: 'Management, Scientific, and Technical Consulting Services — Small Business pool for facility management and support services.',
        contracting_agency: 'GSA',
        status: 'active',
      },
      {
        org_id: orgId,
        vehicle_name: 'Army BOSS III IDIQ',
        vehicle_type: 'agency_idiq',
        contract_number: 'W911KB-22-D-0045',
        ordering_period_start: '2022-10-01',
        ordering_period_end: '2027-09-30',
        ceiling_value: 500000000,
        naics_codes: ['561210'],
        sin_numbers: [],
        scope_description: 'Base Operations Support Services III — Multiple installations across CONUS.',
        contracting_agency: 'US Army',
        status: 'active',
      },
    ]
    await supabase.from('contract_vehicles').insert(vehicles)
  } catch { /* table might not exist */ }

  // Seed competitive intelligence
  await saveAiOutput(project.id, 'competitive_intel', {
    analysis_date: new Date().toISOString(),
    competitors: [
      { name: 'Vectrus (now V2X)', strengths: 'Incumbent on Fort Liberty BOSS. 8 years of institutional knowledge. Strong Army relationships.', weaknesses: 'Recent merger integration challenges. Higher overhead rates post-V2X consolidation.', estimated_win_probability: '35%' },
      { name: 'KBR', strengths: 'Massive BOSS portfolio across DoD. Deep bench of key personnel. Price competitive at scale.', weaknesses: 'May not prioritize $47.5M contract given larger pursuits. Less agile than smaller competitors.', estimated_win_probability: '25%' },
      { name: 'Akima (NANA Regional)', strengths: 'Alaska Native Corporation — 8(a) eligible. Strong SB subcontracting record.', weaknesses: 'Less experience in southeast US region. Smaller BOSS portfolio.', estimated_win_probability: '15%' },
    ],
    our_position: 'Strong contender with 2 directly relevant BOSS contracts (Fort Hood, Fort Stewart). Key differentiator: proven 60-day transition capability and zero safety incidents over 5 years. Need to address price competitiveness against V2X incumbent advantage.',
  })

  // Seed win themes
  await saveAiOutput(project.id, 'win_themes', {
    themes: [
      { theme: 'Proven BOSS Excellence', evidence: 'Two completed Army BOSS contracts with Exceptional CPARS ratings — Fort Hood ($38.2M) and Fort Stewart ($29.5M). Zero safety incidents across 5 years of performance.', discriminator: 'No other competitor can demonstrate consecutive Exceptional ratings on comparable Army installations.' },
      { theme: 'Rapid Transition Specialists', evidence: 'Completed Fort Stewart transition in 60 days (vs. 90-day requirement), retaining 85% of incumbent workforce. Proprietary transition methodology with knowledge capture framework.', discriminator: 'Documented transition playbook eliminates the #1 risk factor in BOSS contract changeovers.' },
      { theme: 'Local Workforce Investment', evidence: 'Partnership with Fayetteville Technical Community College for workforce pipeline. Wages 12% above area median to ensure retention.', discriminator: 'Reduces workforce turnover risk that plagues competitors relying on minimum-wage labor models.' },
    ],
    generated_at: new Date().toISOString(),
  })

  return project.id
}
