export type TaskOrderStatus = 'draft' | 'in_progress' | 'under_review' | 'submitted' | 'awarded' | 'not_awarded'

export type UserRole = 'admin' | 'market_sector_lead' | 'program_manager' | 'procurement' | 'contracts' | 'talent_acquisition' | 'read_only'

export interface TaskOrder {
  id: string
  title: string
  solicitation_number: string
  task_order_number: string
  site_name: string
  location_city: string
  location_state: string
  status: TaskOrderStatus
  due_date: string | null
  contract_number?: string | null
  contract_vehicle?: string | null
  contracting_officer?: string | null
  co_email?: string | null
  co_phone?: string | null
  period_of_performance_start?: string | null
  period_of_performance_end?: string | null
  estimated_value?: string | null
  naics_code?: string | null
  set_aside?: string | null
  created_at: string
  updated_at: string
  created_by: string
  notes: string | null
  project_type?: string | null
  org_id?: string | null
}

export interface Document {
  id: string
  task_order_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  category: DocumentCategory
  version: number
  uploaded_by: string
  uploaded_at: string
}

export type DocumentCategory = 'sow' | 'pricing_sheet' | 'exhibit' | 'amendment' | 'qa_response' | 'wage_determination' | 'site_info' | 'subcontractor_quote' | 'internal_notes' | 'other'

export interface Subcontractor {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  service_categories: string[]
  geographic_coverage: string[]
  preferred: boolean
  incumbent_status: 'known' | 'suspected' | 'not_incumbent' | 'unknown'
  performance_notes: string | null
  availability?: 'available' | 'busy' | 'unavailable' | 'seasonal'
  nationwide?: boolean
  regions?: string[]
  certifications?: string[]
  website?: string | null
  address?: string | null
  duns_number?: string | null
  cage_code?: string | null
  small_business?: boolean
  active?: boolean
  created_at: string
  updated_at: string
}

export type ContractType = 'idiq' | 'bpa' | 'gwac' | 'gsa_schedule' | 'prime' | 'subcontract' | 'msa' | 'other'
export type ContractStatus = 'active' | 'pending' | 'expired' | 'closed'

export interface Contract {
  id: string
  title: string
  contract_number: string
  contract_type: ContractType
  status: ContractStatus
  vehicle: string | null
  agency: string | null
  contracting_officer: string | null
  co_email: string | null
  co_phone: string | null
  period_of_performance_start: string | null
  period_of_performance_end: string | null
  ceiling_value: string | null
  funded_value: string | null
  naics_code: string | null
  set_aside: string | null
  description: string | null
  org_id: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  current_org_id?: string | null
  last_sign_in_at?: string | null
  beta_agreement_accepted_at?: string | null
  beta_agreement_version?: string | null
  is_global_admin?: boolean
  beta_start_date?: string | null
  beta_program_status?: string | null
  beta_coupon_code?: string | null
  beta_coupon_expires_at?: string | null
}

// AI Analysis types
export interface TaskOrderMetadata {
  title?: string | null
  solicitation_number?: string | null
  task_order_number?: string | null
  contract_number?: string | null
  contract_vehicle?: string | null
  site_name?: string | null
  location_city?: string | null
  location_state?: string | null
  contracting_officer?: string | null
  co_email?: string | null
  co_phone?: string | null
  period_of_performance_start?: string | null
  period_of_performance_end?: string | null
  pop_total_duration?: string | null
  pop_base_period?: string | null
  pop_option_periods?: string[] | null
  pop_structure_summary?: string | null
  estimated_value?: string | null
  naics_code?: string | null
  set_aside?: string | null
  response_due_date?: string | null
}

export interface AnalysisResult {
  task_order_metadata?: TaskOrderMetadata
  requirements: Requirement[]
  service_categories: ServiceCategory[]
  staffing_requirements: StaffingRequirement[]
  compliance_items: ComplianceItem[]
  unclear_items: UnclearItem[]
  pricing_alignment_issues: PricingAlignmentIssue[]
  key_dates: KeyDate[]
  summary: string
}

export interface Requirement {
  requirement: string
  source_document: string
  page_section: string
  service_category: string
  frequency: string
  equipment_needed: string
  staffing_needed: string
  compliance_type: string
  risk_level: string
}

export interface ServiceCategory {
  category: string
  description: string
  subcontractor_heavy: boolean
  estimated_scope: string
}

export interface StaffingRequirement {
  role: string
  count: number | string
  qualifications: string
  certifications_needed: string
  source_document: string
}

export interface ComplianceItem {
  requirement: string
  source_document: string
  page_section: string
  service_category: string
  responsible_party: string
  proposal_response_needed: boolean
  pricing_impact: string
  risk_level: string
  status: string
  notes: string
}

export interface UnclearItem {
  issue: string
  source_document: string
  section: string
  suggested_clarification: string
}

export interface PricingAlignmentIssue {
  issue: string
  source_document: string
  pricing_sheet_reference: string
  risk_level: string
}

export interface KeyDate {
  date: string
  description: string
  source_document: string
}

export interface RfqPackage {
  service_category: string
  scope_summary: string
  source_references?: Array<{ document: string; page_section: string }>
  required_frequency: string
  site_assumptions: string
  equipment_details: string
  licenses_certifications: string
  questions_for_subcontractor: string[]
  due_date_note: string
  quote_format: string
  sales_tax_treatment: string
  partnership_language: string
}

export interface ClarificationQuestion {
  question: string
  category: string
  source_document: string
  section_reference: string
  priority: string
  impact: string
  subcontractor_trade?: string
}

export interface PricingRisk {
  risk: string
  category: string
  source_document: string
  section_reference: string
  severity: string
  recommended_action: string
  financial_impact: string
}

export interface ExecutiveSummary {
  overview: string
  site_summary: string | { site_name?: string; address?: string; service_period?: string; key_details?: Record<string, string> }
  scope_categories: Array<{ category: string; description: string }>
  staffing_requirements: string
  subcontractor_categories: string[]
  major_risks: Array<{ risk: string; severity: string; mitigation: string }>
  pricing_assumptions: string[]
  unanswered_questions: string[]
  bid_strategy: string
  confidence_rating: string
  confidence_rationale: string
  action_items: Array<{ action: string; owner: string; deadline_note: string; priority: string }>
}

export interface TaskOrderComparison {
  similar_requirements: Array<{ requirement: string; current_reference: string; prior_reference: string }>
  changed_requirements: Array<{ requirement: string; current_version: string; prior_version: string; change_type: string }>
  added_services: Array<{ service: string; details: string; current_reference: string }>
  removed_services: Array<{ service: string; details: string; prior_reference: string }>
  staffing_changes: Array<{ role: string; current: string; prior: string; change: string }>
  reporting_changes: Array<{ requirement: string; current: string; prior: string }>
  pricing_structure_changes: Array<{ item: string; current: string; prior: string }>
  repeated_language: Array<{ section: string; language_summary: string }>
  prior_questions_relevant: Array<{ question: string; still_relevant: boolean; notes: string }>
  prior_risks_relevant: Array<{ risk: string; still_relevant: boolean; notes: string }>
  summary: string
}

// ========== Project-Specific Subcontractor Matrix Types ==========

export type ProjectSubStatus = 'matched' | 'shortlisted' | 'invited' | 'quoted' | 'awarded' | 'rejected' | 'removed'
export type ProjectSubSource = 'ai_match' | 'auto_discover' | 'manual' | 'sow_tracker'

export interface ProjectSubcontractor {
  id: string
  task_order_id: string
  subcontractor_id: string
  match_score: number
  relevance_reason: string | null
  matched_requirements: string[]
  status: ProjectSubStatus
  source: ProjectSubSource
  added_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  subcontractor?: Subcontractor
}

// ========== Subcontractor Bid Management Types ==========

export type SowStatus = 'not_started' | 'subs_identified' | 'rfqs_sent' | 'quotes_received' | 'evaluating' | 'awarded'

export type OutreachStatus = 'identified' | 'invited' | 'reviewing' | 'questions_pending' | 'quote_submitted' | 'declined' | 'no_response' | 'awarded' | 'not_selected'

export type CommType = 'rfq_sent' | 'question' | 'response' | 'follow_up' | 'quote_received' | 'clarification' | 'award_notice' | 'decline_notice' | 'note'

export type QuoteStatus = 'received' | 'under_review' | 'clarification_needed' | 'accepted' | 'rejected' | 'expired'

export interface SowItem {
  id: string
  task_order_id: string
  sow_name: string
  service_category: string
  description: string | null
  source_document: string | null
  status: SowStatus
  awarded_subcontractor_id: string | null
  awarded_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SowSubcontractor {
  id: string
  sow_item_id: string
  subcontractor_id: string
  match_score: number
  outreach_status: OutreachStatus
  rfq_sent_date: string | null
  rfq_due_date: string | null
  response_date: string | null
  created_at: string
  updated_at: string
  // Joined fields
  subcontractor?: Subcontractor
}

export interface SowCommunication {
  id: string
  sow_subcontractor_id: string
  comm_type: CommType
  direction: 'outbound' | 'inbound' | 'internal'
  subject: string | null
  body: string | null
  created_by: string | null
  created_at: string
}

export interface SowQuote {
  id: string
  sow_subcontractor_id: string
  sow_item_id: string
  subcontractor_id: string
  total_amount: number | null
  monthly_amount: number | null
  annual_amount: number | null
  labor_cost: number | null
  materials_cost: number | null
  equipment_cost: number | null
  overhead_markup: number | null
  scope_inclusions: string | null
  scope_exclusions: string | null
  assumptions: string | null
  timeline: string | null
  payment_terms: string | null
  validity_period: string | null
  attachment_path: string | null
  status: QuoteStatus
  reviewer_notes: string | null
  submitted_at: string
  reviewed_at: string | null
  created_at: string
  ai_compliance_score: number | null
  ai_compliance_analysis: Record<string, unknown> | null
  ai_analyzed_at: string | null
  // Joined
  subcontractor?: Subcontractor
}

// Modification / Amendment tracking
export interface Modification {
  id: string
  task_order_id: string
  modification_number: string
  title: string
  description: string | null
  affected_sow_ids: string[]
  effective_date: string | null
  notification_status: 'pending' | 'partial' | 'sent' | 'acknowledged'
  created_by: string
  created_at: string
}

// Government Q&A pair
export interface GovtQAPair {
  question_number: string | null
  question_text: string
  answer_text: string
  section_reference: string | null
}

// Incumbent intelligence from portal self-report
export interface IncumbentIntel {
  id: string
  subcontractor_id: string
  task_order_id: string
  sow_item_id: string | null
  is_incumbent: boolean
  incumbent_locations: string | null
  contract_info: string | null
  years_experience: string | null
  source: 'portal_self_report' | 'admin' | 'ai_detected'
  created_at: string
}

// Storage keys for AI outputs in Supabase Storage
export function aiOutputPath(taskOrderId: string, outputType: string): string {
  return `${taskOrderId}/ai_outputs/${outputType}.json`
}
