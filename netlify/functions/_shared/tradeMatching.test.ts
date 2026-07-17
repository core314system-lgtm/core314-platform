// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { descriptionToTrades } from './tradeMatching'

describe('descriptionToTrades — positive matches', () => {
  it('classifies HVAC descriptions', () => {
    expect(descriptionToTrades('HVAC installation and repair')).toContain('HVAC')
    expect(descriptionToTrades('heating and air conditioning services')).toContain('HVAC')
    expect(descriptionToTrades('Commercial HVAC/Refrigeration installation')).toContain('HVAC')
    expect(descriptionToTrades('chiller and cooling tower maintenance')).toContain('HVAC')
  })

  it('classifies other trades correctly', () => {
    expect(descriptionToTrades('commercial roofing contractor')).toContain('Roofing')
    expect(descriptionToTrades('fire alarm installation')).toContain('Fire & Life Safety')
    expect(descriptionToTrades('access control systems')).toContain('Security Systems')
    expect(descriptionToTrades('licensed electrical contractor')).toContain('Electrical')
    expect(descriptionToTrades('wayfinding and signage fabrication')).toContain('Signage')
  })

  it('is case-insensitive and de-duplicates', () => {
    const trades = descriptionToTrades('ROOFING, roofing, and more Roofing')
    expect(trades).toEqual(['Roofing'])
  })

  it('matches simple plurals on word boundaries', () => {
    expect(descriptionToTrades('we install fences')).toContain('Fencing')
    expect(descriptionToTrades('roofs repaired')).toContain('Roofing')
  })
})

describe('descriptionToTrades — substring false positives are NOT matched', () => {
  it('does not tag Signage/Architectural from "design"', () => {
    const trades = descriptionToTrades('custom software design and web development')
    expect(trades).not.toContain('Signage')
    expect(trades).not.toContain('Architectural Services')
  })

  it('does not tag Roofing from "proofreading"', () => {
    expect(descriptionToTrades('proofreading and document preparation')).not.toContain('Roofing')
  })

  it('does not tag Consulting from generic "management"', () => {
    expect(descriptionToTrades('project management office')).not.toContain('Consulting')
  })

  it('does not tag Abatement from generic "lead"', () => {
    expect(descriptionToTrades('lead generation and sales')).not.toContain('Abatement')
  })

  it('does not tag Security Systems from "safeguard"', () => {
    expect(descriptionToTrades('we safeguard your assets')).not.toContain('Security Systems')
  })

  it('does not tag IT from the pronoun "it"', () => {
    expect(descriptionToTrades('it is a great company to work with')).not.toContain('IT & Telecommunications')
  })

  it('requires the "lead paint" phrase for Abatement', () => {
    expect(descriptionToTrades('lead paint abatement')).toContain('Abatement')
  })
})

describe('descriptionToTrades — edge cases', () => {
  it('returns empty array for empty/nullish input', () => {
    expect(descriptionToTrades('')).toEqual([])
    expect(descriptionToTrades(null)).toEqual([])
    expect(descriptionToTrades(undefined)).toEqual([])
  })

  it('returns empty array when nothing maps (no raw text dumped)', () => {
    expect(descriptionToTrades('generic products distributor xyz')).toEqual([])
  })
})
