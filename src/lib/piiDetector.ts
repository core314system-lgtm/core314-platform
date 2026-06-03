export interface PiiMatch {
  type: string
  label: string
  count: number
  examples: string[]
}

const PII_PATTERNS: { type: string; label: string; pattern: RegExp }[] = [
  { type: 'ssn', label: 'Social Security Number', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  { type: 'credit_card', label: 'Credit Card Number', pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g },
  { type: 'phone', label: 'Phone Number', pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'email_bulk', label: 'Email Address', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'dob', label: 'Date of Birth', pattern: /\b(?:DOB|Date\s+of\s+Birth|birth\s*date)\s*[:=]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi },
  { type: 'ssn_label', label: 'SSN Reference', pattern: /\b(?:SSN|Social\s+Security(?:\s+Number)?)\s*[:=]?\s*[\dX*]{3,}/gi },
  { type: 'passport', label: 'Passport Number', pattern: /\b(?:passport\s*(?:no|number|#)?)\s*[:=]?\s*[A-Z0-9]{6,9}\b/gi },
  { type: 'dl', label: 'Driver License', pattern: /\b(?:driver'?s?\s*(?:license|lic|DL)\s*(?:no|number|#)?)\s*[:=]?\s*[A-Z0-9]{5,15}\b/gi },
  { type: 'ein', label: 'Employer ID (EIN)', pattern: /\bEIN\s*[:=]?\s*\d{2}[-]?\d{7}\b/gi },
]

/**
 * Scan text for potential PII patterns.
 * Returns found matches grouped by type with counts and redacted examples.
 */
export function scanForPii(text: string): PiiMatch[] {
  const results: PiiMatch[] = []

  for (const { type, label, pattern } of PII_PATTERNS) {
    const matches = text.match(pattern) || []
    // Filter phone numbers — only flag if there are 5+ (bulk) to avoid flagging normal business contacts
    if (type === 'phone' && matches.length < 5) continue
    // Filter emails — only flag if there are 10+ (bulk) to avoid normal business emails
    if (type === 'email_bulk' && matches.length < 10) continue

    if (matches.length > 0) {
      const examples = matches.slice(0, 3).map(m => redactMatch(m, type))
      results.push({ type, label, count: matches.length, examples })
    }
  }

  return results
}

function redactMatch(match: string, type: string): string {
  if (type === 'ssn' || type === 'ssn_label') {
    return match.replace(/\d/g, (_, i: number) => i < 5 ? '*' : match[i])
  }
  if (type === 'credit_card') {
    return match.replace(/\d(?=.{4})/g, '*')
  }
  if (type === 'email_bulk') {
    const [local, domain] = match.split('@')
    return `${local[0]}***@${domain}`
  }
  return match.slice(0, 3) + '***'
}

/**
 * Returns true if any PII was detected in the text.
 */
export function hasPii(text: string): boolean {
  return scanForPii(text).length > 0
}
