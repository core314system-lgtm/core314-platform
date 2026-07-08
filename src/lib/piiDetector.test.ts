import { describe, it, expect } from 'vitest'
import { scanForPii, hasPii } from './piiDetector'

describe('scanForPii', () => {
  it('detects an SSN and redacts the first five digits', () => {
    const matches = scanForPii('SSN is 123-45-6789 on file')
    const ssn = matches.find(m => m.type === 'ssn')
    expect(ssn).toBeDefined()
    expect(ssn!.count).toBe(1)
    // Redaction masks by character index in the match ('-' at index 3 shifts the window)
    expect(ssn!.examples[0]).toBe('***-*5-6789')
  })

  it('detects credit card numbers', () => {
    const matches = scanForPii('card 4111 1111 1111 1111')
    expect(matches.some(m => m.type === 'credit_card')).toBe(true)
  })

  it('does not flag a small number of phone numbers', () => {
    const matches = scanForPii('call (904) 555-1234')
    expect(matches.some(m => m.type === 'phone')).toBe(false)
  })

  it('flags phone numbers only in bulk (5+)', () => {
    const phones = Array.from({ length: 5 }, (_, i) => `(904) 555-000${i}`).join(' ')
    const matches = scanForPii(phones)
    expect(matches.some(m => m.type === 'phone')).toBe(true)
  })

  it('does not flag a handful of emails', () => {
    const matches = scanForPii('reach me at a@b.com or c@d.com')
    expect(matches.some(m => m.type === 'email_bulk')).toBe(false)
  })

  it('returns empty for clean text', () => {
    expect(scanForPii('just a normal sentence')).toEqual([])
  })
})

describe('hasPii', () => {
  it('is true when PII present', () => {
    expect(hasPii('SSN 123-45-6789')).toBe(true)
  })

  it('is false for clean text', () => {
    expect(hasPii('nothing sensitive here')).toBe(false)
  })
})
