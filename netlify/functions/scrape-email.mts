import type { Context } from "@netlify/functions"

/**
 * Netlify Function: Scrape email addresses from a business website
 * 
 * POST /api/scrape-email
 * Body: { website: string }
 * Returns: { emails: string[], best_email: string|null, pages_checked: number, source: string }
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
  /gravatar\.com$/i,
  /googleusercontent\.com$/i,
  /gstatic\.com$/i,
  /facebook\.com$/i,
  /twitter\.com$/i,
  /linkedin\.com$/i,
]

// Filter out file-like strings that match email regex (e.g., img_banner@2x.jpg)
const FILE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|svg|webp|ico|bmp|tiff?|js|css|woff2?|ttf|eot|map|pdf|zip|doc|docx|xls|xlsx)$/i

function isValidBusinessEmail(email: string): boolean {
  if (email.length > 80) return false
  if (email.includes('..')) return false
  if (FILE_EXTENSION_PATTERN.test(email)) return false
  // Must have a valid TLD (at least 2 chars after last dot)
  const domain = email.split('@')[1]
  if (!domain || domain.split('.').pop()!.length < 2) return false
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
  if (lower.startsWith('service@')) return 82
  if (lower.startsWith('services@')) return 81
  if (lower.startsWith('admin@')) return 75
  if (lower.startsWith('hello@')) return 70
  if (lower.startsWith('inquir')) return 68 // inquiry@, inquiries@
  if (lower.startsWith('support@')) return 60
  if (lower.startsWith('customerservice@')) return 58
  if (lower.startsWith('billing@')) return 40
  if (lower.startsWith('marketing@')) return 35
  if (lower.startsWith('careers@') || lower.startsWith('jobs@') || lower.startsWith('hr@')) return 20
  if (lower.startsWith('webmaster@') || lower.startsWith('postmaster@')) return 10
  // Personal-looking emails (name@company) get moderate score
  if (/^[a-z]+(\.[a-z]+)?@/.test(lower)) return 65
  return 50
}

// Extract the root domain (protocol + host) from a URL, stripping paths/query/hash
function getRootUrl(fullUrl: string): string {
  try {
    const parsed = new URL(fullUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    const match = fullUrl.match(/^(https?:\/\/[^\/\?#]+)/)
    return match ? match[1] : fullUrl
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
]

async function fetchPageContent(url: string, retryCount = 0): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const ua = USER_AGENTS[retryCount % USER_AGENTS.length]
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    
    if (!response.ok) {
      // Retry once with a different User-Agent on 403/429
      if ((response.status === 403 || response.status === 429) && retryCount === 0) {
        return fetchPageContent(url, 1)
      }
      return null
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null
    
    const text = await response.text()
    return text.slice(0, 500000)
  } catch {
    return null
  }
}

function extractEmails(html: string): string[] {
  // Decode common HTML entity encoding for @ and .
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

// Specifically extract emails from mailto: links (higher confidence)
function extractMailtoEmails(html: string): string[] {
  const mailtoRegex = /href\s*=\s*["']mailto:([^"'\?#\s]+)/gi
  const emails: string[] = []
  let match
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = decodeURIComponent(match[1]).toLowerCase().trim()
    if (isValidBusinessEmail(email)) {
      emails.push(email)
    }
  }
  return emails
}

// Extract emails from JSON-LD structured data (schema.org)
function extractStructuredDataEmails(html: string): string[] {
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const emails: string[] = []
  let match
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const extractFromObj = (obj: Record<string, unknown>) => {
        if (!obj || typeof obj !== 'object') return
        if (typeof obj.email === 'string' && isValidBusinessEmail(obj.email.toLowerCase())) {
          emails.push(obj.email.toLowerCase())
        }
        if (obj.contactPoint) {
          const points = Array.isArray(obj.contactPoint) ? obj.contactPoint : [obj.contactPoint]
          for (const point of points) {
            if (point && typeof point === 'object' && typeof (point as Record<string, unknown>).email === 'string') {
              const e = ((point as Record<string, unknown>).email as string).toLowerCase()
              if (isValidBusinessEmail(e)) emails.push(e)
            }
          }
        }
        // Check @graph array (common in schema.org)
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            if (item && typeof item === 'object') extractFromObj(item as Record<string, unknown>)
          }
        }
      }
      if (Array.isArray(data)) {
        data.forEach((item: Record<string, unknown>) => extractFromObj(item))
      } else {
        extractFromObj(data)
      }
    } catch { /* invalid JSON-LD, skip */ }
  }
  return emails
}

// Extract emails from meta tags (og:email, etc.)
function extractMetaEmails(html: string): string[] {
  const metaRegex = /content\s*=\s*["']([^"']*@[^"']+)["']/gi
  const emails: string[] = []
  let match
  while ((match = metaRegex.exec(html)) !== null) {
    const candidate = match[1].toLowerCase().trim()
    if (EMAIL_REGEX.test(candidate) && isValidBusinessEmail(candidate)) {
      emails.push(candidate)
    }
  }
  return emails
}

function extractAllEmails(html: string): string[] {
  const allEmails: string[] = [
    ...extractMailtoEmails(html),       // highest confidence
    ...extractStructuredDataEmails(html), // high confidence
    ...extractMetaEmails(html),           // medium confidence
    ...extractEmails(html),               // general regex
  ]
  return [...new Set(allEmails)]
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
      return new Response(JSON.stringify({ emails: [], best_email: null, pages_checked: 0, source: 'website_scrape' }), { status: 200, headers })
    }

    // Normalize the URL — add protocol if missing
    let fullUrl = website.trim()
    if (!fullUrl.startsWith('http')) {
      fullUrl = `https://${fullUrl}`
    }
    fullUrl = fullUrl.replace(/\/$/, '')

    // Extract root domain for building contact page URLs
    // Google Places URLs often include paths/UTM params (e.g., www.site.com/locations/tampa?utm_source=gbp)
    // We need the bare domain for appending /contact, /about, etc.
    const rootUrl = getRootUrl(fullUrl)

    const allEmails: string[] = []
    const pagesChecked: string[] = []

    // 1. Check the original URL first (may include a location-specific page)
    const mainContent = await fetchPageContent(fullUrl)
    if (mainContent) {
      allEmails.push(...extractAllEmails(mainContent))
      pagesChecked.push(fullUrl)
    }

    // 2. If original URL had a path, also check the bare root homepage
    if (fullUrl !== rootUrl) {
      const rootContent = await fetchPageContent(rootUrl)
      if (rootContent) {
        allEmails.push(...extractAllEmails(rootContent))
        pagesChecked.push(rootUrl)
      }
    }

    // 3. Check common contact/about page paths on the ROOT domain
    const contactPaths = [
      '/contact', '/contact-us', '/about', '/about-us',
      '/get-a-quote', '/request-quote', '/get-in-touch',
    ]
    for (const path of contactPaths) {
      if (new Set(allEmails).size >= 3) break
      const url = `${rootUrl}${path}`
      if (pagesChecked.includes(url)) continue
      const content = await fetchPageContent(url)
      if (content) {
        allEmails.push(...extractAllEmails(content))
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
    return new Response(JSON.stringify({ emails: [], best_email: null, pages_checked: 0, error: message, source: 'website_scrape' }), { status: 200, headers })
  }
}
