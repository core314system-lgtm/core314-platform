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

  return project.id
}
