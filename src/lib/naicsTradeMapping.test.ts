import { describe, it, expect } from 'vitest'
import { naicsToCategoryIds, naicsToTradeNames, generateSlug, getTradeCategory } from './naicsTradeMapping'

describe('naicsToCategoryIds', () => {
  it('maps a known NAICS code to at least one category', () => {
    const ids = naicsToCategoryIds(['238220'])
    expect(Array.isArray(ids)).toBe(true)
    expect(ids.length).toBeGreaterThan(0)
  })

  it('deduplicates categories across multiple codes', () => {
    const ids = naicsToCategoryIds(['238220', '238220'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns empty for unmappable codes', () => {
    expect(naicsToCategoryIds(['000000'])).toEqual([])
  })

  it('strips non-digits before matching', () => {
    const clean = naicsToCategoryIds(['238220'])
    const dirty = naicsToCategoryIds(['23-82-20'])
    expect(dirty).toEqual(clean)
  })
})

describe('naicsToTradeNames', () => {
  it('returns human-readable names for known codes', () => {
    const names = naicsToTradeNames(['238220'])
    expect(names.length).toBeGreaterThan(0)
    expect(typeof names[0]).toBe('string')
  })
})

describe('generateSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(generateSlug('Acme Contracting LLC')).toBe('acme-contracting-llc')
  })

  it('strips punctuation', () => {
    expect(generateSlug('A.B.C. & Co., Inc.')).toBe('abc-co-inc')
  })

  it('collapses repeated separators and trims', () => {
    expect(generateSlug('  Big   Gap  ')).toBe('big-gap')
  })

  it('caps at 80 characters', () => {
    expect(generateSlug('x'.repeat(200)).length).toBeLessThanOrEqual(80)
  })
})

describe('getTradeCategory', () => {
  it('finds an existing category', () => {
    expect(getTradeCategory('hvac')?.name).toBe('HVAC')
  })

  it('returns undefined for unknown id', () => {
    expect(getTradeCategory('nonexistent')).toBeUndefined()
  })
})
