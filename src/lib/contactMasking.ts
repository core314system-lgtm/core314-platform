/** Mask an email address: john@company.com → j***@company.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***@***.***'
  const maskedLocal = local.length > 1
    ? local[0] + '***'
    : '***'
  return `${maskedLocal}@${domain}`
}

/** Mask a phone number: (904) 555-1234 → (***) ***-1234 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 4) {
    return '(***) ***-' + digits.slice(-4)
  }
  return '***-****'
}
