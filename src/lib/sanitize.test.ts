import { describe, it, expect } from 'vitest'
import { sanitizeInput, sanitizeAndLimit, isValidEmail, isValidUUID } from './sanitize'

describe('sanitizeInput', () => {
  it('strips <script> blocks entirely', () => {
    expect(sanitizeInput('hello<script>alert(1)</script>world')).toBe('helloworld')
  })

  it('strips a tag carrying an inline event handler, leaving only text', () => {
    expect(sanitizeInput('<div onclick="steal()">x</div>')).toBe('x')
  })

  it('strips a bare event-handler attribute when no surrounding tag', () => {
    expect(sanitizeInput('onerror=alert(1)')).toBe('alert(1)')
  })

  it('removes html tags', () => {
    expect(sanitizeInput('<b>bold</b>')).toBe('bold')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeInput('   padded   ')).toBe('padded')
  })

  it('leaves plain text untouched', () => {
    expect(sanitizeInput('Acme Contracting LLC')).toBe('Acme Contracting LLC')
  })

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('')
  })
})

describe('sanitizeAndLimit', () => {
  it('truncates to max length after sanitizing', () => {
    expect(sanitizeAndLimit('abcdefghij', 5)).toBe('abcde')
  })

  it('sanitizes before measuring length', () => {
    const out = sanitizeAndLimit('<script>xxxxx</script>abc', 3)
    expect(out).toBe('abc')
  })
})

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'first.last@sub.domain.co',
    'name+tag@company.io',
  ])('accepts valid email %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    'no-at-sign',
    '@nolocal.com',
    'notld@domain',
    'spaces in@email.com',
    '',
  ])('rejects invalid email %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('trims before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true)
  })
})

describe('isValidUUID', () => {
  it('accepts a canonical v4 uuid', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('rejects a malformed uuid', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })
})
