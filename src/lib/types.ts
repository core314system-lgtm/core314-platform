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
