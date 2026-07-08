import { describe, it, expect } from 'vitest'
import {
  resolvePlan,
  computeTierFlags,
  canAccessFeature,
  getTierLimit,
  trialDaysLeft,
} from './tierLogic'

describe('resolvePlan', () => {
  it.each([
    ['growth_monthly', 'growth'],
    ['growth_annual', 'growth'],
    ['enterprise_monthly', 'enterprise'],
    ['agentic_monthly', 'agentic'],
    ['', 'none'],
    [null, 'none'],
    [undefined, 'none'],
    ['random', 'none'],
  ])('maps %s to %s', (raw, expected) => {
    expect(resolvePlan(raw as string | null | undefined)).toBe(expected)
  })

  it('prioritizes agentic over enterprise/growth substrings', () => {
    expect(resolvePlan('enterprise_agentic')).toBe('agentic')
  })
})

describe('computeTierFlags', () => {
  it('grants everything to a global admin regardless of status', () => {
    const flags = computeTierFlags({ plan: 'none', status: 'cancelled', isGlobalAdmin: true })
    expect(flags).toEqual({
      hasActiveSubscription: true,
      isAgentic: true,
      isEnterprise: true,
      isGrowth: false,
    })
  })

  it('treats active enterprise as enterprise but not agentic', () => {
    const flags = computeTierFlags({ plan: 'enterprise', status: 'active', isGlobalAdmin: false })
    expect(flags.isEnterprise).toBe(true)
    expect(flags.isAgentic).toBe(false)
    expect(flags.hasActiveSubscription).toBe(true)
  })

  it('treats cancelled growth as inactive', () => {
    const flags = computeTierFlags({ plan: 'growth', status: 'cancelled', isGlobalAdmin: false })
    expect(flags.hasActiveSubscription).toBe(false)
    expect(flags.isGrowth).toBe(false)
  })

  it('treats trialing growth as active growth', () => {
    const flags = computeTierFlags({ plan: 'growth', status: 'trialing', isGlobalAdmin: false })
    expect(flags.isGrowth).toBe(true)
    expect(flags.hasActiveSubscription).toBe(true)
  })
})

describe('canAccessFeature', () => {
  const growthFlags = computeTierFlags({ plan: 'growth', status: 'active', isGlobalAdmin: false })
  const enterpriseFlags = computeTierFlags({ plan: 'enterprise', status: 'active', isGlobalAdmin: false })
  const inactiveFlags = computeTierFlags({ plan: 'growth', status: 'cancelled', isGlobalAdmin: false })

  it('lets growth use a non-enterprise feature', () => {
    expect(canAccessFeature('basic_projects', { isGlobalAdmin: false, flags: growthFlags })).toBe(true)
  })

  it('blocks growth from an enterprise-only feature', () => {
    expect(canAccessFeature('agent_hub', { isGlobalAdmin: false, flags: growthFlags })).toBe(false)
    expect(canAccessFeature('proposal_draft_generation', { isGlobalAdmin: false, flags: growthFlags })).toBe(false)
  })

  it('lets enterprise use an enterprise-only feature', () => {
    expect(canAccessFeature('agent_hub', { isGlobalAdmin: false, flags: enterpriseFlags })).toBe(true)
  })

  it('blocks everything for an inactive subscription', () => {
    expect(canAccessFeature('basic_projects', { isGlobalAdmin: false, flags: inactiveFlags })).toBe(false)
  })

  it('lets a global admin bypass all gating', () => {
    const adminFlags = computeTierFlags({ plan: 'none', status: 'cancelled', isGlobalAdmin: true })
    expect(canAccessFeature('agent_hub', { isGlobalAdmin: true, flags: adminFlags })).toBe(true)
  })
})

describe('getTierLimit', () => {
  const growthFlags = computeTierFlags({ plan: 'growth', status: 'active', isGlobalAdmin: false })
  const enterpriseFlags = computeTierFlags({ plan: 'enterprise', status: 'active', isGlobalAdmin: false })
  const noneFlags = computeTierFlags({ plan: 'none', status: 'no_subscription', isGlobalAdmin: false })

  it('caps growth projects at 25', () => {
    expect(getTierLimit('max_projects', { isGlobalAdmin: false, flags: growthFlags })).toBe(25)
  })

  it('gives enterprise unlimited projects', () => {
    expect(getTierLimit('max_projects', { isGlobalAdmin: false, flags: enterpriseFlags })).toBe(Infinity)
  })

  it('caps enterprise connections at 100', () => {
    expect(getTierLimit('max_connections_per_month', { isGlobalAdmin: false, flags: enterpriseFlags })).toBe(100)
  })

  it('gives zero to no-subscription users', () => {
    expect(getTierLimit('max_projects', { isGlobalAdmin: false, flags: noneFlags })).toBe(0)
  })
})

describe('trialDaysLeft', () => {
  const now = new Date('2026-06-15T00:00:00Z').getTime()

  it('returns null with no trial date', () => {
    expect(trialDaysLeft(null, now)).toBeNull()
  })

  it('counts remaining days rounding up', () => {
    const ends = new Date('2026-06-20T12:00:00Z').toISOString()
    expect(trialDaysLeft(ends, now)).toBe(6)
  })

  it('never returns negative for an expired trial', () => {
    const ends = new Date('2026-06-01T00:00:00Z').toISOString()
    expect(trialDaysLeft(ends, now)).toBe(0)
  })
})
