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

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
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
  site_summary: string
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

// Storage keys for AI outputs in Supabase Storage
export function aiOutputPath(taskOrderId: string, outputType: string): string {
  return `${taskOrderId}/ai_outputs/${outputType}.json`
}
