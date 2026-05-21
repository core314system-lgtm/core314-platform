import type { DocumentCategory } from './types'

export interface ProjectType {
  id: string
  name: string
  shortName: string
  description: string
  icon: string
  documentCategories: { value: DocumentCategory | string; label: string }[]
  aiContext: string
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
