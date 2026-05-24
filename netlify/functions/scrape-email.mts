import type { Context } from "@netlify/functions"

/**
 * Netlify Function: Scrape email addresses from a business website
 * 
 * POST /api/scrape-email
 * Body: { website: string }
 * Returns: { emails: string[], source: string }
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Common non-useful email patterns to filter out
const IGNORED_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /donotreply@/i,
  /example\.com$/i,
  /sentry\.io$/i,
  /webpack\.js$/i,
  /wixpress\.com$/i,
  /squarespace\.com$/i,
  /wordpress\.com$/i,
  /cloudflare\.com$/i,
  /googleapis\.com$/i,
  /schema\.org$/i,
  /w3\.org$/i,
  /placeholder/i,
  /test@/i,
  /user@/i,
  /email@/i,
  /your.*@/i,
  /name@/i,
]

function isValidBusinessEmail(email: string): boolean {
  if (email.length > 80) return false
  if (email.includes('..')) return false
  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(email)) return false
  }
  return true
}

// Score emails to prioritize contact/info emails
function scoreEmail(email: string): number {
  const lower = email.toLowerCase()
  if (lower.startsWith('info@')) return 100
  if (lower.startsWith('contact@')) return 95
  if (lower.startsWith('sales@')) return 90
  if (lower.startsWith('office@')) return 85
  if (lower.startsWith('service@')) return 80
  if (lower.startsWith('admin@')) return 75
  if (lower.startsWith('hello@')) return 70
  if (lower.startsWith('support@')) return 60
  if (lower.startsWith('billing@')) return 40
  if (lower.startsWith('careers@') || lower.startsWith('jobs@') || lower.startsWith('hr@')) return 20
  // Personal-looking emails (name@company) get moderate score
  if (/^[a-z]+(\.[a-z]+)?@/.test(lower)) return 65
  return 50
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null
    
    const text = await response.text()
    return text.slice(0, 500000) // Limit to 500KB
  } catch {
    return null
  }
}

function extractEmails(html: string): string[] {
  // Also decode mailto: links and common HTML entity encoding
  const decoded = html
    .replace(/&#64;/g, '@')
    .replace(/&#x40;/g, '@')
    .replace(/\[at\]/gi, '@')
    .replace(/\(at\)/gi, '@')
    .replace(/\[dot\]/gi, '.')
    .replace(/\(dot\)/gi, '.')

  const matches = decoded.match(EMAIL_REGEX) || []
  const unique = [...new Set(matches.map(e => e.toLowerCase()))]
  return unique.filter(isValidBusinessEmail)
}

export default async function handler(req: Request, _context: Context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    const { website } = body

    if (!website) {
      return new Response(JSON.stringify({ emails: [], error: 'No website provided' }), { status: 200, headers })
    }

    // Normalize the URL
    let baseUrl = website.trim()
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`
    }
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '')

    const allEmails: string[] = []
    const pagesChecked: string[] = []

    // Check main page first
    const mainContent = await fetchPageContent(baseUrl)
    if (mainContent) {
      allEmails.push(...extractEmails(mainContent))
      pagesChecked.push(baseUrl)
    }

    // Check common contact page paths
    const contactPaths = ['/contact', '/contact-us', '/about', '/about-us']
    for (const path of contactPaths) {
      if (allEmails.length >= 3) break // Already found enough
      const url = `${baseUrl}${path}`
      const content = await fetchPageContent(url)
      if (content) {
        allEmails.push(...extractEmails(content))
        pagesChecked.push(url)
      }
    }

    // Deduplicate and score
    const unique = [...new Set(allEmails)]
    const scored = unique.map(email => ({ email, score: scoreEmail(email) }))
    scored.sort((a, b) => b.score - a.score)

    // Return top 3 emails
    const topEmails = scored.slice(0, 3).map(s => s.email)

    return new Response(JSON.stringify({
      emails: topEmails,
      best_email: topEmails[0] || null,
      pages_checked: pagesChecked.length,
      source: 'website_scrape',
    }), { status: 200, headers })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ emails: [], error: message }), { status: 200, headers })
  }
}
