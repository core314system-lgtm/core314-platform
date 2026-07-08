import { describe, it, expect } from 'vitest'
import { getSubcontractorCompleteness, getCompletenessColor, getCompletenessBarColor } from './completeness'
import type { Subcontractor } from './types'

function makeSub(overrides: Partial<Subcontractor> = {}): Subcontractor {
  return { id: 's1', company_name: 'Acme', ...overrides } as Subcontractor
}

describe('getSubcontractorCompleteness', () => {
  it('scores a minimal record as poor', () => {
    const result = getSubcontractorCompleteness(makeSub())
    expect(result.filled).toBe(1)
    expect(result.total).toBe(10)
    expect(result.score).toBe(10)
    expect(result.level).toBe('poor')
    expect(result.missing).toContain('Email Address')
  })

  it('scores a fully populated record as complete', () => {
    const result = getSubcontractorCompleteness(makeSub({
      company_name: 'Acme',
      contact_name: 'Jane',
      contact_email: 'jane@acme.com',
      contact_phone: '9045551234',
      service_categories: ['hvac'],
      geographic_coverage: ['FL'],
      website: 'https://acme.com',
      address: '1 Main St',
      performance_notes: 'great',
      certifications: ['8a'],
    }))
    expect(result.score).toBe(100)
    expect(result.level).toBe('complete')
    expect(result.missing).toEqual([])
  })

  it('classifies mid-range fill as good or fair', () => {
    const result = getSubcontractorCompleteness(makeSub({
      contact_name: 'Jane',
      contact_email: 'jane@acme.com',
      contact_phone: '9045551234',
      service_categories: ['hvac'],
      geographic_coverage: ['FL'],
    }))
    expect(result.score).toBe(60)
    expect(result.level).toBe('fair')
  })
})

describe('completeness color helpers', () => {
  it('returns a color class per level', () => {
    expect(getCompletenessColor('complete')).toContain('green')
    expect(getCompletenessColor('poor')).toContain('red')
    expect(getCompletenessBarColor('good')).toBe('bg-blue-500')
  })
})
