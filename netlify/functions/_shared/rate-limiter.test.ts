import { describe, it, expect } from 'vitest'
import { resolvePlanKey, limitFor, PLAN_LIMITS } from './rate-limiter'

describe('resolvePlanKey', () => {
  it('gives global admins enterprise limits regardless of plan/status', () => {
    expect(resolvePlanKey({ hasGlobalAdmin: true, subscriptionStatus: 'cancelled', subscriptionPlan: null }))
      .toBe('enterprise_monthly')
  })

  it('maps trialing status to the trialing bucket', () => {
    expect(resolvePlanKey({ hasGlobalAdmin: false, subscriptionStatus: 'trialing', subscriptionPlan: 'growth_monthly' }))
      .toBe('trialing')
  })

  it('uses the subscription plan when active', () => {
    expect(resolvePlanKey({ hasGlobalAdmin: false, subscriptionStatus: 'active', subscriptionPlan: 'growth_monthly' }))
      .toBe('growth_monthly')
  })

  it('falls back to no_subscription when plan is missing', () => {
    expect(resolvePlanKey({ hasGlobalAdmin: false, subscriptionStatus: 'active', subscriptionPlan: null }))
      .toBe('no_subscription')
  })
})

describe('limitFor', () => {
  it('returns configured AI limit for growth', () => {
    expect(limitFor('growth_monthly', 'ai_call')).toBe(30)
  })

  it('returns the near-unlimited AI limit for enterprise', () => {
    expect(limitFor('enterprise_monthly', 'ai_call')).toBe(999)
  })

  it('returns the strict no_subscription limits', () => {
    expect(limitFor('no_subscription', 'ai_call')).toBe(5)
    expect(limitFor('no_subscription', 'email')).toBe(10)
    expect(limitFor('no_subscription', 'api_call')).toBe(20)
  })

  it('falls back to no_subscription for an unknown plan key', () => {
    expect(limitFor('mystery_plan', 'ai_call')).toBe(PLAN_LIMITS.no_subscription.ai_calls_per_hour)
  })

  it('maps each action type to the right field', () => {
    expect(limitFor('enterprise_monthly', 'email')).toBe(200)
    expect(limitFor('enterprise_monthly', 'api_call')).toBe(120)
  })
})
