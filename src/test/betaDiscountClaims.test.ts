// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Regression guard for the Founding Partner discount claim (PR #831).
 *
 * The delivered mechanism in netlify/functions/beta-feedback.mts is a ONE-TIME
 * coupon: percent_off 50, duration "once", 1 redemption, 5-day expiry. The
 * marketing/terms once advertised a "25% lifetime discount" for "the duration
 * of your continuous subscription" plus a "permanent" designation, which the
 * code never delivered. These tests lock every buyer-facing surface to the
 * real bounded benefit so the perpetual/lifetime claim can't silently return.
 */

const repoRoot = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8')

const CLAIM_SURFACES = [
  'src/components/BetaAgreementModal.tsx',
  'src/components/BetaClaimBanner.tsx',
  'src/pages/BetaFeedback.tsx',
  'src/pages/BetaApply.tsx',
  'src/landing/pages/BetaLandingPage.tsx',
  'netlify/functions/manage-beta-invites.mts',
  'netlify/functions/beta-reminders.mts',
  'netlify/functions/beta-feedback.mts',
]

// Positive-claim phrases that would reintroduce the perpetual/inaccurate
// commitment. (Negated disclaimers like "not a recurring or lifetime discount"
// are intentionally allowed, so we match the marketing-claim shapes only.)
const FORBIDDEN = [
  /\d+%\s*lifetime/i,
  /lifetime discount code/i,
  /for the (life|duration) of your (continuous )?subscription/i,
  /duration of your continuous subscription/i,
  /permanent(ly)?\s+founding partner/i,
  /founding partner[\s"'-]*designation[^.]{0,40}permanent/i,
]

describe('Founding Partner discount claim consistency', () => {
  it.each(CLAIM_SURFACES)('%s contains no perpetual/lifetime discount language', (file) => {
    const src = read(file)
    for (const pattern of FORBIDDEN) {
      expect(src, `"${pattern}" found in ${file}`).not.toMatch(pattern)
    }
  })

  it('the delivered coupon is a one-time 50%-off-first-month mechanism', () => {
    const src = read('netlify/functions/beta-feedback.mts')
    expect(src).toMatch(/percent_off:\s*50/)
    expect(src).toMatch(/duration:\s*["']once["']/)
    expect(src).toMatch(/max_redemptions:\s*1/)
    // must NOT be a recurring/forever coupon
    expect(src).not.toMatch(/duration:\s*["']forever["']/)
    expect(src).not.toMatch(/duration:\s*["']repeating["']/)
  })

  it('the beta agreement describes a one-time first-month credit and is change-of-control safe', () => {
    const src = read('src/components/BetaAgreementModal.tsx')
    expect(src).toMatch(/one-time/i)
    expect(src).toMatch(/first (invoice|month)/i)
    expect(src).toMatch(/50% off the first month/i)
    // explicit assignment / change-of-control survival
    expect(src).toMatch(/assign(ed|ment)?|change of control|merger|acquisition/i)
  })
})
