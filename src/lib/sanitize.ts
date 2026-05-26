const HTML_TAG_RE = /<\/?[^>]+(>|$)/g
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const EVENT_RE = /\bon\w+\s*=/gi

export function sanitizeInput(input: string): string {
  return input
    .replace(SCRIPT_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(EVENT_RE, '')
    .trim()
}

export function sanitizeAndLimit(input: string, maxLength: number): string {
  return sanitizeInput(input).slice(0, maxLength)
}

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id.trim())
}
