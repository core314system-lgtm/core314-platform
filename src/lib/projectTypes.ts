import type { DocumentCategory } from './types'

export interface WorkflowStage {
  id: string
  label: string
  color: string        // tailwind color class like 'gray', 'blue', 'yellow', 'purple', 'green', 'red'
  description: string
  requiresApproval?: boolean
  allowedRoles?: string[]
}

export interface ProjectType {
  id: string
  name: string
  shortName: string
  description: string
  icon: string
  documentCategories: { value: DocumentCategory | string; label: string }[]
  aiContext: string
  workflowStages: WorkflowStage[]
  placeholders: {
    title: string
    siteName: string
    solicitation: string
    referenceNumber: string
  }
}

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: 'government_task_order',
    name: 'Government Task Order / RFQ',
    shortName: 'Task Order',
    description: 'Federal or state government task orders, IDIQs, BPAs, and facility maintenance RFQs',
    icon: 'building-2',
    documentCategories: [
      { value: 'sow', label: 'Statement of Work' },
      { value: 'pricing_sheet', label: 'Pricing Sheet' },
      { value: 'exhibit', label: 'Exhibit / Attachment' },
      { value: 'amendment', label: 'Amendment' },
      { value: 'qa_response', label: 'Q&A Response' },
      { value: 'wage_determination', label: 'Wage Determination' },
      { value: 'site_info', label: 'Site Information' },
      { value: 'subcontractor_quote', label: 'Subcontractor Quote' },
      { value: 'internal_notes', label: 'Internal Notes' },
      { value: 'other', label: 'Other' },
    ],
    aiContext: `You are an expert government contract analyst specializing in federal procurement, facility maintenance, IFSM, and task order RFQ analysis. Apply knowledge of the FAR, service contract labor standards, and government compliance requirements.`,
    workflowStages: [
      { id: 'draft', label: 'New / Intake', color: 'gray', description: 'Initial project setup — uploading documents and entering basic information' },
      { id: 'in_progress', label: 'Evaluating', color: 'blue', description: 'AI analysis running — reviewing requirements, compliance, and pricing' },
      { id: 'under_review', label: 'Bid Review', color: 'yellow', description: 'Internal review of analysis outputs and subcontractor quotes', requiresApproval: true },
      { id: 'submitted', label: 'Bid Submitted', color: 'purple', description: 'Bid has been submitted to the contracting officer' },
      { id: 'awarded', label: 'Awarded', color: 'green', description: 'Contract awarded — project won' },
      { id: 'not_awarded', label: 'Not Awarded', color: 'red', description: 'Bid was not selected' },
    ],
    placeholders: {
      title: 'e.g., Atlanta P&DC IFSM Task Order',
      siteName: 'e.g., Atlanta Processing & Distribution Center',
      solicitation: 'From the RFQ cover page',
      referenceNumber: 'Task order number if assigned',
    },
  },
  {
    id: 'government_rfp',
    name: 'Government RFP / Proposal',
    shortName: 'RFP',
    description: 'Competitive government proposals, RFPs, and solicitations across agencies',
    icon: 'landmark',
    documentCategories: [
      { value: 'sow', label: 'Statement of Work / PWS' },
      { value: 'pricing_sheet', label: 'Pricing Template / CLIN Structure' },
      { value: 'exhibit', label: 'Exhibit / Attachment' },
      { value: 'amendment', label: 'Amendment / Modification' },
      { value: 'qa_response', label: 'Q&A / Industry Day Notes' },
      { value: 'wage_determination', label: 'Wage Determination' },
      { value: 'site_info', label: 'Past Performance References' },
      { value: 'subcontractor_quote', label: 'Teaming Partner Quotes' },
      { value: 'internal_notes', label: 'Internal Notes / Strategy' },
      { value: 'other', label: 'Other' },
    ],
    aiContext: `You are an expert government proposal analyst specializing in competitive federal procurements. Apply knowledge of the FAR, source selection criteria, past performance evaluation, and proposal compliance. Focus on win themes, discriminators, and technical approach.`,
    workflowStages: [
      { id: 'draft', label: 'Requirements Review', color: 'gray', description: 'Reviewing solicitation documents and identifying requirements' },
      { id: 'in_progress', label: 'Proposal Development', color: 'blue', description: 'Developing technical and cost proposals' },
      { id: 'under_review', label: 'Red Team Review', color: 'yellow', description: 'Internal review and scoring of draft proposal', requiresApproval: true },
      { id: 'submitted', label: 'Submitted', color: 'purple', description: 'Proposal submitted to the government' },
      { id: 'awarded', label: 'Awarded', color: 'green', description: 'Contract awarded' },
      { id: 'not_awarded', label: 'Not Awarded', color: 'red', description: 'Proposal was not selected' },
    ],
    placeholders: {
      title: 'e.g., USDA IT Modernization RFP',
      siteName: 'e.g., USDA Headquarters',
      solicitation: 'Solicitation number',
      referenceNumber: 'RFP reference number',
    },
  },
  {
    id: 'construction',
    name: 'Construction Bid',
    shortName: 'Bid',
    description: 'Commercial or government construction, renovation, and infrastructure projects',
    icon: 'hard-hat',
    documentCategories: [
      { value: 'sow', label: 'Scope of Work / Plans' },
      { value: 'pricing_sheet', label: 'Bill of Quantities / Estimate' },
      { value: 'exhibit', label: 'Drawings / Specifications' },
      { value: 'amendment', label: 'Addendum' },
      { value: 'qa_response', label: 'RFI Responses' },
      { value: 'wage_determination', label: 'Prevailing Wage / Davis-Bacon' },
      { value: 'site_info', label: 'Site Survey / Geotechnical' },
      { value: 'subcontractor_quote', label: 'Subcontractor Bid' },
      { value: 'internal_notes', label: 'Internal Notes / Takeoff' },
      { value: 'other', label: 'Other' },
    ],
    aiContext: `You are an expert construction estimator and bid analyst. Analyze project documents including drawings, specifications, bills of quantities, and scope documents. Identify trades, divisions (CSI format), material requirements, and construction-specific risks. Focus on quantity takeoffs, schedule implications, and subcontractor coordination.`,
    workflowStages: [
      { id: 'draft', label: 'Bid Review', color: 'gray', description: 'Reviewing bid documents, drawings, and specifications' },
      { id: 'in_progress', label: 'Estimating', color: 'blue', description: 'Performing takeoffs, getting subcontractor bids, building estimate' },
      { id: 'under_review', label: 'Bid Finalization', color: 'yellow', description: 'Finalizing pricing, overhead, and markup', requiresApproval: true },
      { id: 'submitted', label: 'Bid Submitted', color: 'purple', description: 'Bid submitted to the owner/GC' },
      { id: 'awarded', label: 'Awarded', color: 'green', description: 'Project awarded — mobilization begins' },
      { id: 'not_awarded', label: 'Not Awarded', color: 'red', description: 'Bid was not selected' },
    ],
    placeholders: {
      title: 'e.g., Downtown Office Tower Renovation',
      siteName: 'e.g., 100 Main Street, Atlanta, GA',
      solicitation: 'Invitation for Bid number',
      referenceNumber: 'Project number',
    },
  },
  {
    id: 'it_services',
    name: 'IT Services / Technology',
    shortName: 'IT Project',
    description: 'IT consulting, managed services, software implementation, and technology procurements',
    icon: 'server',
    documentCategories: [
      { value: 'sow', label: 'Statement of Work / Requirements' },
      { value: 'pricing_sheet', label: 'Pricing Model / Rate Card' },
      { value: 'exhibit', label: 'Technical Requirements / Architecture' },
      { value: 'amendment', label: 'Amendment / Change Request' },
      { value: 'qa_response', label: 'Q&A Responses' },
      { value: 'wage_determination', label: 'Labor Category Descriptions' },
      { value: 'site_info', label: 'Environment / Infrastructure Docs' },
      { value: 'subcontractor_quote', label: 'Teaming Partner Quotes' },
      { value: 'internal_notes', label: 'Internal Notes / Technical Approach' },
      { value: 'other', label: 'Other' },
    ],
    aiContext: `You are an expert IT services analyst specializing in technology procurements, managed services, and software implementation projects. Analyze requirements for technical complexity, staffing models (labor categories, FTEs), SLA requirements, security/compliance (FedRAMP, SOC 2, HIPAA), and integration risks.`,
    workflowStages: [
      { id: 'draft', label: 'Requirements Gathering', color: 'gray', description: 'Collecting and reviewing technical requirements' },
      { id: 'in_progress', label: 'Solution Design', color: 'blue', description: 'Designing technical approach and staffing plan' },
      { id: 'under_review', label: 'Technical Review', color: 'yellow', description: 'Internal review of solution design and pricing', requiresApproval: true },
      { id: 'submitted', label: 'Proposal Submitted', color: 'purple', description: 'Proposal submitted to the client' },
      { id: 'awarded', label: 'Awarded', color: 'green', description: 'Contract awarded — kickoff scheduled' },
      { id: 'not_awarded', label: 'Not Awarded', color: 'red', description: 'Proposal was not selected' },
    ],
    placeholders: {
      title: 'e.g., Cloud Migration & Managed Services',
      siteName: 'e.g., Client HQ — Washington, DC',
      solicitation: 'RFP or solicitation number',
      referenceNumber: 'Contract or project number',
    },
  },
  {
    id: 'commercial',
    name: 'Commercial Procurement',
    shortName: 'Procurement',
    description: 'Commercial RFPs, vendor selection, and general business procurement',
    icon: 'briefcase',
    documentCategories: [
      { value: 'sow', label: 'Scope of Work / Requirements' },
      { value: 'pricing_sheet', label: 'Pricing Template' },
      { value: 'exhibit', label: 'Specifications / Attachments' },
      { value: 'amendment', label: 'Amendment / Revision' },
      { value: 'qa_response', label: 'Q&A / Vendor Conference Notes' },
      { value: 'site_info', label: 'Site / Facility Information' },
      { value: 'subcontractor_quote', label: 'Vendor Quote' },
      { value: 'internal_notes', label: 'Internal Notes' },
      { value: 'other', label: 'Other' },
    ],
    aiContext: `You are an expert procurement analyst for commercial business. Analyze vendor proposals, service agreements, and procurement documents. Focus on total cost of ownership, service level agreements, risk allocation, insurance requirements, and vendor qualifications.`,
    workflowStages: [
      { id: 'draft', label: 'Intake', color: 'gray', description: 'Initial vendor/project intake and document collection' },
      { id: 'in_progress', label: 'Evaluation', color: 'blue', description: 'Evaluating vendor proposals and conducting analysis' },
      { id: 'under_review', label: 'Approval', color: 'yellow', description: 'Management review and budget approval', requiresApproval: true },
      { id: 'submitted', label: 'Contracted', color: 'purple', description: 'Contract executed with selected vendor' },
      { id: 'awarded', label: 'Complete', color: 'green', description: 'Procurement complete and vendor onboarded' },
      { id: 'not_awarded', label: 'Cancelled', color: 'red', description: 'Procurement cancelled or vendor not selected' },
    ],
    placeholders: {
      title: 'e.g., Janitorial Services — Corporate Campus',
      siteName: 'e.g., Main Office — Dallas, TX',
      solicitation: 'RFP or bid number',
      referenceNumber: 'Reference number',
    },
  },
]

export function getProjectType(id: string | null | undefined): ProjectType {
  return PROJECT_TYPES.find(pt => pt.id === id) || PROJECT_TYPES[0]
}

export function getProjectTypeLabel(id: string | null | undefined): string {
  return getProjectType(id).shortName
}

export function getWorkflowStages(projectTypeId: string | null | undefined): WorkflowStage[] {
  return getProjectType(projectTypeId).workflowStages
}

export function getWorkflowStage(projectTypeId: string | null | undefined, stageId: string): WorkflowStage {
  const stages = getWorkflowStages(projectTypeId)
  return stages.find(s => s.id === stageId) || stages[0]
}

export function getStageColor(color: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    gray:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300' },
    blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-400' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400' },
    green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-400' },
    red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-400' },
  }
  return colors[color] || colors.gray
}
