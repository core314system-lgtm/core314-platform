// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { KNOWN_TRADES } from './tradeTaxonomy'
import { TRADE_CATEGORIES } from '../../../src/lib/naicsTradeMapping'

// Guards against taxonomy drift between the AI SOW-matching trade list and the
// canonical trade categories used for master subcontractor `trade_categories`.
// If these diverge, AI matching maps SOW items to names that don't exist in the
// data (e.g. "Janitorial" vs "Janitorial & Custodial") and returns 0 results.
describe('trade taxonomy sync', () => {
  it('KNOWN_TRADES matches the canonical TRADE_CATEGORIES names exactly', () => {
    const canonical = [...TRADE_CATEGORIES.map(t => t.name)].sort()
    const known = [...KNOWN_TRADES].sort()
    expect(known).toEqual(canonical)
  })

  it('has no duplicate trade names', () => {
    expect(new Set(KNOWN_TRADES).size).toBe(KNOWN_TRADES.length)
  })
})
