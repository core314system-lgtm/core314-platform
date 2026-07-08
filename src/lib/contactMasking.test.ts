import { describe, it, expect } from 'vitest'
import { maskEmail, maskPhone } from './contactMasking'

describe('maskEmail', () => {
  it('masks the local part but keeps the domain', () => {
    expect(maskEmail('john@company.com')).toBe('j***@company.com')
  })

  it('masks a single-character local part fully', () => {
    expect(maskEmail('a@company.com')).toBe('***@company.com')
  })

  it('returns a fully masked placeholder when there is no domain', () => {
    expect(maskEmail('invalid-email')).toBe('***@***.***')
  })
})

describe('maskPhone', () => {
  it('keeps only the last four digits', () => {
    expect(maskPhone('(904) 555-1234')).toBe('(***) ***-1234')
  })

  it('handles unformatted digits', () => {
    expect(maskPhone('9045551234')).toBe('(***) ***-1234')
  })

  it('returns generic mask for too-few digits', () => {
    expect(maskPhone('12')).toBe('***-****')
  })
})
