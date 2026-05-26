const HTML_TAG_RE = /<\/?[^>]+(>|$)/g
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const EVENT_RE = /\bon\w+\s*=/gi

export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return ""
  return input
    .replace(SCRIPT_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(EVENT_RE, "")
    .trim()
}

export function sanitizeEmail(input: unknown): string {
  if (typeof input !== "string") return ""
  const trimmed = input.trim().toLowerCase()
  const emailRe = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  if (!emailRe.test(trimmed)) return ""
  return trimmed
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(input: unknown): boolean {
  if (typeof input !== "string") return false
  return UUID_RE.test(input.trim())
}

export function sanitizeAndLimit(input: unknown, maxLength: number): string {
  const cleaned = sanitizeText(input)
  return cleaned.slice(0, maxLength)
}

export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    const val = body[field]
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
      return `Missing required field: ${field}`
    }
  }
  return null
}
