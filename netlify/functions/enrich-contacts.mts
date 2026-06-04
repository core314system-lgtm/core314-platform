import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

/**
 * Enrich master_subcontractors with verified contact info via Apollo.io:
 * 1. Search people by company domain → get person IDs
 * 2. Enrich person by ID → get verified email + phone
 * Falls back to website scraping if Apollo has no data.
 *
 * POST body: { batchSize?: number }
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Extract emails from HTML text (fallback scraping)
function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(emailRegex) || []
  const excluded = ['noreply', 'no-reply', 'donotreply', 'unsubscribe', 'mailer-daemon', 'postmaster', 'example.com', 'sentry.io', 'wixpress.com', 'wordpress', '.png', '.jpg', '.gif', '.webp']
  const unique = [...new Set(matches.map(e => e.toLowerCase()))]
  return unique.filter(email => !excluded.some(ex => email.includes(ex)))
}

function scoreEmail(email: string): number {
  const local = email.split('@')[0].toLowerCase()
  if (local === 'info' || local === 'contact' || local === 'hello') return 100
  if (local === 'sales' || local === 'inquiries' || local === 'inquiry') return 90
  if (local === 'admin' || local === 'office' || local === 'general') return 80
  if (local === 'support' || local === 'help') return 70
  return 50
}

async function fetchUrl(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProcuvexBot/1.0; +https://procuvex.com)' },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null
    const text = await res.text()
    return text.slice(0, 200_000)
  } catch {
    return null
  }
}

function findContactPageUrl(html: string, baseUrl: string): string | null {
  const hrefRegex = /href=["']([^"']*(?:contact|about|reach|get-in-touch|connect)[^"']*)["']/gi
  const matches: string[] = []
  let match
  while ((match = hrefRegex.exec(html)) !== null) {
    matches.push(match[1])
  }
  if (matches.length === 0) return null
  const contactMatch = matches.find(m => m.toLowerCase().includes('contact'))
  const chosen = contactMatch || matches[0]
  try {
    return new URL(chosen, baseUrl).href
  } catch {
    return null
  }
}

// Apollo: Search for people at a domain, return best person's ID
async function apolloSearchPeople(domain: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({
        q_organization_domains: domain,
        per_page: 5,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const people = data.people || []
    // Prefer someone with email, prioritize by seniority titles
    const withEmail = people.filter((p: any) => p.has_email)
    if (withEmail.length === 0) return null
    // Prefer owner/president/ceo/director/manager
    const seniorTitles = ['owner', 'president', 'ceo', 'founder', 'director', 'manager', 'vp', 'principal']
    const senior = withEmail.find((p: any) => {
      const title = (p.title || '').toLowerCase()
      return seniorTitles.some(t => title.includes(t))
    })
    return (senior || withEmail[0]).id
  } catch {
    return null
  }
}

// Apollo: Enrich a person by ID to get their email
async function apolloEnrichPerson(personId: string): Promise<{ email?: string; phone?: string; name?: string; title?: string } | null> {
  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const person = data.person
    if (!person) return null
    const phones = person.phone_numbers || []
    return {
      email: person.email || undefined,
      phone: phones.length > 0 ? (phones[0].sanitized_number || phones[0].raw_number) : undefined,
      name: [person.first_name, person.last_name].filter(Boolean).join(' ') || undefined,
      title: person.title || undefined,
    }
  } catch {
    return null
  }
}

// Apollo: Organization enrichment for phone/description
async function apolloOrgEnrich(domain: string): Promise<{ phone?: string; description?: string } | null> {
  try {
    const res = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
      headers: { "X-Api-Key": APOLLO_API_KEY },
    })
    if (!res.ok) return null
    const data = await res.json()
    const org = data.organization
    if (!org) return null
    return {
      phone: org.phone || undefined,
      description: org.short_description || undefined,
    }
  } catch {
    return null
  }
}

// Scrape website for email (fallback)
async function scrapeForEmail(website: string): Promise<string | null> {
  const homeHtml = await fetchUrl(website)
  if (!homeHtml) return null
  let emails = extractEmails(homeHtml)
  if (emails.length === 0) {
    const contactUrl = findContactPageUrl(homeHtml, website)
    if (contactUrl) {
      const contactHtml = await fetchUrl(contactUrl)
      if (contactHtml) {
        emails = extractEmails(contactHtml)
      }
    }
  }
  if (emails.length === 0) return null
  emails.sort((a, b) => scoreEmail(b) - scoreEmail(a))
  return emails[0]
}

export default async function handler(req: Request, _context: Context) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const token = authHeader.replace("Bearer ", "")
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const body = await req.json()
    const batchSize = Math.min(body.batchSize || 10, 20)

    // Priority NAICS codes — Tier 1 (highest demand) enriched first
    const TIER1_NAICS = ['238210', '238220', '236220', '238160', '238110', '238320', '238910']
    const TIER2_NAICS = ['541512', '541519', '561720', '561730', '561612', '541330', '238290', '238310', '238340', '238350']

    // Try Tier 1 first, then Tier 2, then everything else
    let records: any[] | null = null
    let fetchError: any = null

    // Tier 1: high-demand construction trades
    const { data: tier1Records, error: tier1Err } = await supabase
      .from("master_subcontractors")
      .select("id, company_name, website, naics_codes")
      .not("website", "is", null)
      .is("contact_email", null)
      .is("profile_updated_at", null)
      .overlaps("naics_codes", TIER1_NAICS)
      .limit(batchSize)

    if (tier1Err) {
      fetchError = tier1Err
    } else if (tier1Records && tier1Records.length > 0) {
      records = tier1Records
    } else {
      // Tier 2: IT, janitorial, security, engineering
      const { data: tier2Records, error: tier2Err } = await supabase
        .from("master_subcontractors")
        .select("id, company_name, website, naics_codes")
        .not("website", "is", null)
        .is("contact_email", null)
        .is("profile_updated_at", null)
        .overlaps("naics_codes", TIER2_NAICS)
        .limit(batchSize)

      if (tier2Err) {
        fetchError = tier2Err
      } else if (tier2Records && tier2Records.length > 0) {
        records = tier2Records
      } else {
        // All remaining records
        const { data: remainingRecords, error: remainErr } = await supabase
          .from("master_subcontractors")
          .select("id, company_name, website, naics_codes")
          .not("website", "is", null)
          .is("contact_email", null)
          .is("profile_updated_at", null)
          .limit(batchSize)

        if (remainErr) fetchError = remainErr
        else records = remainingRecords
      }
    }

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ enriched: 0, noContact: 0, errors: 0, total: 0, done: true }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    let enriched = 0
    let noContact = 0
    let errors = 0

    for (const record of records) {
      try {
        const website = record.website!
        let domain: string
        try {
          domain = new URL(website).hostname.replace(/^www\./, '')
        } catch {
          domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
        }

        const updateData: Record<string, any> = {
          profile_updated_at: new Date().toISOString(),
        }

        let foundEmail = false

        // Step 1: Try Apollo people search → enrich for verified email
        if (APOLLO_API_KEY) {
          const personId = await apolloSearchPeople(domain)
          if (personId) {
            const personData = await apolloEnrichPerson(personId)
            if (personData?.email) {
              updateData.contact_email = personData.email
              foundEmail = true
            }
            if (personData?.phone) {
              updateData.contact_phone = personData.phone
            }
            if (personData?.name) {
              updateData.contact_name = personData.name
            }
          }

          // Also get org-level phone if we didn't get one from the person
          if (!updateData.contact_phone) {
            const orgData = await apolloOrgEnrich(domain)
            if (orgData?.phone) {
              updateData.contact_phone = orgData.phone
            }
            if (orgData?.description && !updateData.description) {
              updateData.description = orgData.description
            }
          }
        }

        // Step 2: If no email from Apollo, try website scraping
        if (!foundEmail) {
          const scrapedEmail = await scrapeForEmail(website)
          if (scrapedEmail) {
            updateData.contact_email = scrapedEmail
            foundEmail = true
          }
        }

        if (foundEmail || updateData.contact_phone) {
          enriched++
        } else {
          noContact++
        }

        await supabase
          .from("master_subcontractors")
          .update(updateData)
          .eq("id", record.id)

      } catch (err) {
        await supabase
          .from("master_subcontractors")
          .update({ profile_updated_at: new Date().toISOString() })
          .eq("id", record.id)
        errors++
      }
    }

    // Check remaining by tier
    const { count: remainT1 } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("website", "is", null)
      .is("contact_email", null)
      .is("profile_updated_at", null)
      .overlaps("naics_codes", TIER1_NAICS)

    const { count: remainT2 } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("website", "is", null)
      .is("contact_email", null)
      .is("profile_updated_at", null)
      .overlaps("naics_codes", TIER2_NAICS)

    const { count: remainAll } = await supabase
      .from("master_subcontractors")
      .select("id", { count: "exact", head: true })
      .not("website", "is", null)
      .is("contact_email", null)
      .is("profile_updated_at", null)

    const currentTier = (remainT1 || 0) > 0 ? 'tier1' : (remainT2 || 0) > 0 ? 'tier2' : 'other'

    return new Response(JSON.stringify({
      enriched,
      noContact,
      errors,
      total: records.length,
      remaining: remainAll || 0,
      remainingTier1: remainT1 || 0,
      remainingTier2: remainT2 || 0,
      currentTier,
      done: (remainAll || 0) === 0,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}
