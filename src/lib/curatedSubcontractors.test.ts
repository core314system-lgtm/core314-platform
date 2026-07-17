// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { searchCuratedCompanies, resolveStateCode } from './curatedSubcontractors'

describe('resolveStateCode', () => {
  it('passes through 2-letter codes', () => {
    expect(resolveStateCode('FL')).toBe('FL')
    expect(resolveStateCode('fl')).toBe('FL')
  })

  it('resolves full state names (incl. multi-word)', () => {
    expect(resolveStateCode('Florida')).toBe('FL')
    expect(resolveStateCode('new york')).toBe('NY')
    expect(resolveStateCode('  Texas  ')).toBe('TX')
  })

  it('returns undefined for unknown/empty input', () => {
    expect(resolveStateCode('')).toBeUndefined()
    expect(resolveStateCode('Atlantis')).toBeUndefined()
  })
})

describe('searchCuratedCompanies — strict local scope', () => {
  it('excludes national-only firms from local results', () => {
    const local = searchCuratedCompanies('Janitorial', 'local', { state: 'FL' })
    expect(local.every(c => c.coverage !== 'national')).toBe(true)
  })

  it('national scope still returns national firms', () => {
    const national = searchCuratedCompanies('Janitorial', 'national', {})
    expect(national.some(c => c.coverage === 'national')).toBe(true)
  })

  it('returns no curated firms for local when state is unresolvable', () => {
    expect(searchCuratedCompanies('Janitorial', 'local', {})).toEqual([])
  })

  it('local firms are only returned for their own state', () => {
    const fl = searchCuratedCompanies('Janitorial', 'local', { state: 'FL' })
    expect(fl.every(c => {
      if (c.coverage === 'local') return c.hq_state.toUpperCase() === 'FL'
      return true
    })).toBe(true)
  })
})
