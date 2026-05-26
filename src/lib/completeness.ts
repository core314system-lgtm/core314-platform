/**
 * Data Completeness Scoring
 * 
 * Calculates completeness percentages for subcontractors, projects, and SOW items.
 * Returns a score 0-100 with a list of missing fields.
 */

import type { Subcontractor, TaskOrder } from './types'

export interface CompletenessResult {
  score: number
  total: number
  filled: number
  missing: string[]
  level: 'complete' | 'good' | 'fair' | 'poor'
}

// Subcontractor completeness
export function getSubcontractorCompleteness(sub: Subcontractor): CompletenessResult {
  const fields: { name: string; filled: boolean }[] = [
    { name: 'Company Name', filled: !!sub.company_name },
    { name: 'Contact Name', filled: !!sub.contact_name },
    { name: 'Email Address', filled: !!sub.contact_email },
    { name: 'Phone Number', filled: !!sub.contact_phone },
    { name: 'Service Categories', filled: (sub.service_categories?.length || 0) > 0 },
    { name: 'Geographic Coverage', filled: (sub.geographic_coverage?.length || 0) > 0 },
    { name: 'Website', filled: !!sub.website },
    { name: 'Address', filled: !!sub.address },
    { name: 'Performance Notes', filled: !!sub.performance_notes },
    { name: 'Certifications', filled: (sub.certifications?.length || 0) > 0 },
  ]

  const filled = fields.filter(f => f.filled).length
  const total = fields.length
  const score = Math.round((filled / total) * 100)
  const missing = fields.filter(f => !f.filled).map(f => f.name)

  return {
    score,
    total,
    filled,
    missing,
    level: score >= 90 ? 'complete' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
  }
}

// Project completeness
export function getProjectCompleteness(project: TaskOrder, extras?: {
  documentCount?: number
  analysisComplete?: boolean
  sowItemCount?: number
  subcontractorCount?: number
  quoteCount?: number
}): CompletenessResult {
  const fields: { name: string; filled: boolean }[] = [
    { name: 'Title', filled: !!project.title },
    { name: 'Solicitation Number', filled: !!project.solicitation_number },
    { name: 'Site Name', filled: !!project.site_name },
    { name: 'Location', filled: !!project.location_city && !!project.location_state },
    { name: 'Due Date', filled: !!project.due_date },
    { name: 'Contracting Officer', filled: !!project.contracting_officer },
    { name: 'CO Contact Info', filled: !!project.co_email || !!project.co_phone },
    { name: 'Period of Performance', filled: !!project.period_of_performance_start },
    { name: 'Estimated Value', filled: !!project.estimated_value },
    { name: 'NAICS Code', filled: !!project.naics_code },
    { name: 'Documents Uploaded', filled: (extras?.documentCount || 0) > 0 },
    { name: 'AI Analysis Complete', filled: extras?.analysisComplete || false },
    { name: 'SOW Items Defined', filled: (extras?.sowItemCount || 0) > 0 },
    { name: 'Subcontractors Assigned', filled: (extras?.subcontractorCount || 0) > 0 },
    { name: 'Quotes Received', filled: (extras?.quoteCount || 0) > 0 },
  ]

  const filled = fields.filter(f => f.filled).length
  const total = fields.length
  const score = Math.round((filled / total) * 100)
  const missing = fields.filter(f => !f.filled).map(f => f.name)

  return {
    score,
    total,
    filled,
    missing,
    level: score >= 90 ? 'complete' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
  }
}

// Color coding for completeness levels
export function getCompletenessColor(level: CompletenessResult['level']): string {
  switch (level) {
    case 'complete': return 'text-green-700 bg-green-50 border-green-200'
    case 'good': return 'text-blue-700 bg-blue-50 border-blue-200'
    case 'fair': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    case 'poor': return 'text-red-700 bg-red-50 border-red-200'
  }
}

export function getCompletenessBarColor(level: CompletenessResult['level']): string {
  switch (level) {
    case 'complete': return 'bg-green-500'
    case 'good': return 'bg-blue-500'
    case 'fair': return 'bg-yellow-500'
    case 'poor': return 'bg-red-500'
  }
}
