import { getProjectType } from './projectTypes'
import { logAiCall } from './aiAuditLog'
import { supabase } from './supabase'

const MODEL = 'gpt-4o-mini'
const MAX_CHARS_PER_DOC = 8000
const MAX_TOTAL_CHARS = 120000

/**
 * Call the ai-proxy function with retry logic and timeout.
 * The server streams from OpenAI internally and returns the assembled JSON response.
 * Leading whitespace (used to keep connection alive) is trimmed before parsing.
 */
export async function fetchAIProxy(body: Record<string, unknown>): Promise<{ choices: Array<{ message: { content: string } }>; model?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const MAX_RETRIES = 2
  const TIMEOUT_MS = 90000 // 90 second timeout

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const text = await res.text()
        let errMsg = `API error: ${res.status}`
        try { errMsg = JSON.parse(text.trim()).error || errMsg } catch { /* use default */ }
        // Don't retry on 4xx errors (client errors)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(errMsg)
        }
        // Retry on 5xx or 429
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
          continue
        }
        throw new Error(errMsg)
      }

      const text = await res.text()
      const trimmed = text.trim()
      if (!trimmed) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
          continue
        }
        throw new Error('AI returned an empty response. Please try again.')
      }
      return JSON.parse(trimmed)
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const isNetwork = err instanceof TypeError && err.message === 'Failed to fetch'

      if (attempt < MAX_RETRIES && (isAbort || isNetwork)) {
        // Wait before retrying (exponential backoff)
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000))
        continue
      }

      if (isAbort) {
        throw new Error('AI analysis timed out. The documents may be too large — try removing some non-essential documents and retry.')
      }
      if (isNetwork) {
        throw new Error('Network connection lost during AI analysis. Please check your internet connection and try again.')
      }
      throw err
    }
  }

  throw new Error('AI analysis failed after multiple attempts. Please try again later.')
}

// Concise directive to enforce factual extraction
const TRUTH_DIRECTIVE = `RULES: Extract ONLY what is explicitly in the documents. Never fabricate, infer, or guess. Use exact language from documents. If info is missing, use null. Include source_document for every extracted fact.
`

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n[... content truncated for analysis ...]\n\n' + text.slice(-half)
}

interface AiCallContext {
  requestType: string
  taskOrderId?: string
  taskOrderTitle?: string
  documentContext?: string
}

async function callOpenAI(systemPrompt: string, userPrompt: string, context?: AiCallContext): Promise<Record<string, unknown>> {
  const start = Date.now()

  try {
    const data = await fetchAIProxy({
      model: MODEL,
      messages: [
        { role: 'system', content: TRUTH_DIRECTIVE + systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    })

    const content = data.choices?.[0]?.message?.content || '{}'
    const result = JSON.parse(content)
    const latency = Date.now() - start
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    // Log to audit trail (non-blocking)
    if (context) {
      const { data: { user } } = await supabase.auth.getUser()
      logAiCall({
        user_id: user?.id || 'anonymous',
        request_type: context.requestType,
        model: data.model || MODEL,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        task_order_id: context.taskOrderId || null,
        task_order_title: context.taskOrderTitle || null,
        document_context: context.documentContext || null,
        response_summary: content.slice(0, 200),
        latency_ms: latency,
        status: 'success',
      })
    }

    return result
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const latency = Date.now() - start

    if (context) {
      const { data: { user } } = await supabase.auth.getUser()
      logAiCall({
        user_id: user?.id || 'anonymous',
        request_type: context.requestType,
        model: MODEL,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        task_order_id: context.taskOrderId || null,
        task_order_title: context.taskOrderTitle || null,
        document_context: context.documentContext || null,
        response_summary: null,
        latency_ms: latency,
        status: 'error',
        error_message: errorMessage,
      })
    }

    throw err
  }
}

function buildDocsText(documentTexts: string[], documentNames: string[]): string {
  const truncated = documentTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC))
  let combined = truncated.map((text, i) => `--- DOCUMENT: ${documentNames[i]} ---\n${text}`).join('\n\n')
  if (combined.length > MAX_TOTAL_CHARS) {
    combined = combined.slice(0, MAX_TOTAL_CHARS) + '\n\n[... remaining content truncated ...]'
  }
  return combined
}

export async function analyzeDocuments(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Analyze the provided project documents. Extract ONLY explicitly stated information.

Return JSON with these keys:
- task_order_metadata: {title, solicitation_number, task_order_number, contract_number, contract_vehicle, site_name, location_city, location_state, contracting_officer, co_email, co_phone, period_of_performance_start, period_of_performance_end, pop_total_duration, pop_base_period, pop_option_periods (array of strings), pop_structure_summary, estimated_value, naics_code, set_aside, response_due_date} — use null if not found
- requirements: array of {requirement, source_document, service_category, frequency} — extract each task/service/inspection as separate entry
- service_categories: array of {category, description, subcontractor_heavy (bool), estimated_scope} — break into specific sub-services (3-10 categories), each coverable by a different subcontractor
- staffing_requirements: array of {role, count, qualifications, certifications_needed, source_document} — only explicitly mentioned roles
- compliance_items: array of {requirement, source_document, risk_level}
- key_dates: array of {date, description, source_document}
- summary: string — concise factual overview including full PoP structure (base + options)`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'document_analysis', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export async function generateComplianceMatrix(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Generate a detailed compliance matrix from the project documents. Every item MUST be directly traceable to a specific document and section.

Return a JSON object with key "items", an array of objects with:
- requirement: the EXACT requirement text from the documents (quote or closely paraphrase the document language)
- source_document: which document it came from (use the exact document filename)
- page_section: MANDATORY page-level citation using the [Page N] markers in the document text. Format: "Page X, Section Y.Z — Title" or "Page X, Paragraph N". Must include a specific page number — never "Various" or "General".
- service_category: which service category this falls under (as described in the documents)
- responsible_party: who is responsible — use ONLY what the documents state. In a subcontracted model, services are performed by subcontractors managed by the Facility Manager. Do NOT assume the prime contractor has direct employees performing the work unless the documents explicitly say so.
- proposal_response_needed: boolean
- pricing_impact: none, low, medium, high — based on what the documents describe, not assumptions
- risk_level: low, medium, high, critical
- status: covered, unclear, missing, needs_review
- notes: flag any missing information or ambiguity found in the documents. Do NOT fill gaps with assumptions.`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'compliance_matrix', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export async function generateRfqPackages(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Generate vendor/subcontractor-specific RFQ packages for each service category identified in the documents.

IMPORTANT: Base EVERY detail on what is EXPLICITLY in the documents. For scope summaries, quote or closely paraphrase the SOW language. For frequencies, use ONLY what the documents state. If a frequency is not specified, say "Frequency not specified in SOW — requires clarification."

Return a JSON object with key "packages", an array of objects with:
- service_category: the service category name (as described in the documents)
- scope_summary: clear summary using the ACTUAL scope described in the specific SOW document — do NOT generalize or add scope items not in the document
- source_references: array of {document, page_section} citing the EXACT document and page/section where this scope is defined. Use [Page N] markers from the text to provide page numbers. Example: [{document: "SOW-HVAC.pdf", page_section: "Page 2, Section 3.1 — Preventive Maintenance"}]
- required_frequency: ONLY what the documents explicitly state. If not specified, say "Not specified in documents"
- site_assumptions: site-specific details ONLY from the documents. If not provided, say "Site details not specified — site visit recommended"
- equipment_details: equipment or area details ONLY as stated in the documents. Include quantities and types ONLY if provided.
- licenses_certifications: required licenses and certifications ONLY if explicitly stated in the SOW
- questions_for_subcontractor: array of questions — these should highlight missing info from the SOW that a subcontractor would need
- due_date_note: when quotes are needed (from documents, or "Not specified" if not stated)
- quote_format: expected quote format and line items
- sales_tax_treatment: required sales tax handling (request not-to-exceed if exact unavailable)
- partnership_language: note about seeking long-term preferred partners for multiple task orders (no guarantee of award)`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'rfq_packages', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export async function generateClarificationQuestions(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Analyze the project documents from the perspective of the vendors/subcontractors who will actually perform the work. Your job is to identify EVERY piece of missing information that a subcontractor would need to provide an accurate quote.

CRITICAL: Analyze EACH Statement of Work (SOW) individually and thoroughly. For each requirement in each SOW, ask yourself: "If I were a subcontractor reading this, do I have enough information to price this work?" If the answer is no, generate a clarification question.

For each SOW, look for these specific gaps:
- QUANTITIES: How many units/items? (e.g., how many fire extinguishers and what types — ABC, K-class, CO2? How many HVAC units and what tonnage? How many restrooms? How many doors?)
- DIMENSIONS/MEASUREMENTS: Square footage of areas to be cleaned/treated/salted? Linear feet of sidewalks? Acreage of grounds? Number of floors?
- FREQUENCIES: If the SOW says "periodic" or "regular" but doesn't specify exact schedule — flag it. If daily/weekly/monthly is stated, note it; if not, ask.
- EQUIPMENT/MATERIALS: Who provides chemicals, supplies, parts? What specific equipment is needed? Are replacement parts included?
- SPECIFICATIONS: What standards apply? What quality levels? What specific types of materials/products?
- SITE CONDITIONS: Current condition of equipment? Age of systems? Known deficiencies? Building layout affecting service delivery?
- ACCESS: Hours of access? Security requirements? Escort requirements? Restricted areas?
- LABOR: Prevailing wage requirements? Certification requirements (EPA, OSHA, state licenses)? Background checks?
- SCOPE BOUNDARIES: What's included vs excluded? Emergency vs routine? What constitutes "as needed"?
- RESPONSE TIMES: Emergency response requirements? After-hours requirements? Notification procedures?
- REPORTING: What reports are required? Format? Frequency? To whom?
- CONFLICTING INFO: Do any SOWs conflict with each other or with the pricing sheet? Do quantities in one document mismatch another?

Generate at LEAST 15-30 clarification questions covering multiple SOW documents. Reference SPECIFIC SOW language when identifying gaps.

Return a JSON object with key "questions", an array of objects with:
- question: the proposed clarification question (written from the perspective of what a subcontractor performing the work would need to know)
- category: missing_quantities, unclear_frequencies, missing_equipment, access_restrictions, shutdown_requirements, missing_dimensions, missing_specifications, missing_site_conditions, labor_requirements, scope_boundaries, response_times, reporting_requirements, pricing_inconsistencies, conflicting_documents, vague_staffing, materials_responsibility, existing_conditions, other
- source_document: which SPECIFIC SOW document triggered this question (use exact filename)
- section_reference: MANDATORY page-level citation. Use the [Page N] markers in the document text. Format: "Page X, Section Y.Z — Title" or "Page X, Paragraph N". Must include a specific page number. Also quote the relevant requirement text that triggered the question.
- priority: low, medium, high, critical (critical = cannot price without this info, high = significant pricing impact, medium = could affect accuracy, low = nice to know)
- impact: specific explanation of what happens if this isn't clarified — be concrete about pricing impact (e.g., "Without knowing the number and type of fire extinguishers, the subcontractor cannot determine if this is a $5,000 or $50,000 annual service")
- subcontractor_trade: which trade/service category this affects (e.g., "Fire Life Safety", "HVAC", "Janitorial", "Snow Removal")

Format questions in a professional style suitable for submission to the contracting officer. Each question MUST reference specific SOW language.`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'clarification_questions', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export async function generatePricingRisks(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Identify all pricing risks, gaps, and issues in the project documents. Every risk you identify MUST be directly tied to something you found (or did NOT find) in a specific document.

Do NOT invent generic risks. Each risk must reference the specific document and section that creates the risk. If a pricing sheet has empty cells, reference those exact cells. If an SOW lacks quantities needed for pricing, cite the specific requirement.

Return a JSON object with key "risks", an array of objects with:
- risk: description of the pricing risk — be specific about what is missing or problematic, referencing exact document language
- category: missing_quotes, unpriced_scope, duplicate_scope, underpriced, labor_assumptions, salary_assumptions, sales_tax, markup_issues, reimbursable_vs_fixed, high_risk_category, leadership_review_needed
- source_document: the EXACT document filename where the risk originates
- section_reference: MANDATORY page-level citation. Use the [Page N] markers in the document text. Format: "Page X, Section Y.Z — Title" or "Page X, Paragraph N". For pricing sheets, use "Sheet: Name, Row/Cell". Must include a specific page number or cell reference — never vague.
- severity: low, medium, high, critical
- recommended_action: what should be done — be specific and actionable
- financial_impact: describe the impact based ONLY on what the documents reveal. Do NOT estimate dollar amounts unless the documents provide enough data to calculate them.`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'pricing_risks', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export async function generateExecutiveSummary(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
  projectTypeId?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)
  const pt = getProjectType(projectTypeId)

  const systemPrompt = `${pt.aiContext}
Generate a comprehensive executive summary suitable for leadership review. EVERY statement must be directly supported by the provided documents.

CRITICAL RULES FOR THIS SUMMARY:
- The overview must describe ONLY what the documents say about the scope, site, and contract structure.
- If a Period of Performance (PoP) is specified, include the FULL structure: base period AND any option periods with dates.
- The staffing_requirements field must state ONLY the staffing explicitly described in the documents. Do NOT add staff positions that are not in the documents.
- For scope_categories, list ONLY the service categories that have corresponding documents provided.
- For major_risks, identify risks based on gaps or issues found IN the documents — not generic industry risks.
- For bid_strategy, base recommendations on the ACTUAL scope and requirements in the documents.

Return a JSON object with:
- overview: project overview paragraph — factual, based ONLY on document content
- site_summary: STRING — plain text paragraph with site name, address, facility type, and key details ONLY as stated in the documents. Do NOT return an object.
- scope_categories: array of {category, description} — ONLY categories with corresponding SOW documents
- staffing_requirements: STRING — state ONLY what the documents say about staffing. If documents describe a Facility Manager overseeing subcontracted services, say exactly that. Do NOT add staff positions that are not in the documents.
- subcontractor_categories: array of service categories that will be subcontracted (based on the SOW structure)
- major_risks: array of {risk, severity, mitigation} — risks must be traced to specific document gaps or issues
- pricing_assumptions: array of key pricing assumptions — ONLY those supported by the documents
- unanswered_questions: array of critical unanswered questions — things the documents should address but don't
- bid_strategy: recommended bid strategy paragraph — based on the actual scope and requirements in the documents
- confidence_rating: high, medium, or low
- confidence_rationale: why this confidence level — cite specific document evidence
- action_items: array of {action, owner, deadline_note, priority}`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt, { requestType: 'executive_summary', taskOrderTitle, documentContext: documentNames.join(', ') })
}

export interface SubMatch {
  subcontractor_id: string
  company_name: string
  matched_categories: string[]
  location_match: boolean
  incumbent_status: string
  preferred: boolean
  match_score: number
  relevance_reason: string
}

export interface RequirementMatch {
  requirement_category: string
  requirement_description: string
  matched_subs: Array<{
    subcontractor_id: string
    company_name: string
    relevance_score: number
    relevance_reason: string
  }>
}

export async function matchSubcontractors(
  analysisResult: Record<string, unknown>,
  subcontractors: Array<{ id: string; company_name: string; service_categories: string[]; geographic_coverage: string[]; incumbent_status: string; preferred: boolean }>,
  taskOrderLocation: string,
): Promise<SubMatch[]> {
  const serviceCategories = (analysisResult.service_categories as Array<{ category: string; description: string }>) || []
  if (serviceCategories.length === 0 || subcontractors.length === 0) return []

  const locationState = taskOrderLocation?.split(',').pop()?.trim().toUpperCase() || ''

  // Build a concise summary of project needs for AI evaluation
  const projectNeeds = serviceCategories.map(c => `${c.category}: ${c.description || ''}`).join('\n')

  // Batch subcontractors into groups for AI evaluation (max ~30 at a time)
  const BATCH_SIZE = 30
  const allMatches: SubMatch[] = []

  for (let i = 0; i < subcontractors.length; i += BATCH_SIZE) {
    const batch = subcontractors.slice(i, i + BATCH_SIZE)
    const subList = batch.map((s, idx) => `${idx + 1}. "${s.company_name}" — services: [${s.service_categories.join(', ')}], coverage: [${s.geographic_coverage.join(', ')}]`).join('\n')

    try {
      const result = await callOpenAI(
        `You are a procurement matching expert. Evaluate how relevant each subcontractor is to the project requirements.

For each subcontractor, determine:
- relevance_score: 0-100 based on how well their services match the project needs. 0 = completely irrelevant (e.g., snow plowing for a janitorial project). 100 = perfect match.
- relevant_categories: which of the project's service categories they could serve
- reason: brief explanation of why they match or don't match

SCORING GUIDE:
- 80-100: Direct match — their services are exactly what the project needs
- 60-79: Strong match — their services substantially overlap with project needs
- 40-59: Partial match — some overlap but not a primary fit
- 20-39: Weak match — tangential relevance at best
- 0-19: No match — their services are unrelated to the project

Be strict. A snow removal company does NOT match a janitorial project. A general "Services" category only counts if the specific services are relevant.

Return JSON: { "matches": [{ "index": number, "relevance_score": number, "relevant_categories": string[], "reason": string }] }
Only include subcontractors with relevance_score > 0.`,
        `PROJECT SERVICE CATEGORIES:\n${projectNeeds}\n\nProject location: ${taskOrderLocation || 'Not specified'}\n\nSUBCONTRACTORS TO EVALUATE:\n${subList}`
      )

      const matches = (result.matches as Array<{ index: number; relevance_score: number; relevant_categories: string[]; reason: string }>) || []

      for (const m of matches) {
        const subIdx = m.index - 1
        if (subIdx < 0 || subIdx >= batch.length) continue
        if (m.relevance_score <= 0) continue

        const sub = batch[subIdx]
        const locationMatch = sub.geographic_coverage.some(g =>
          g.toUpperCase() === locationState ||
          g.toUpperCase() === 'NATIONWIDE' ||
          g.toUpperCase().includes(locationState)
        )

        // Combine AI relevance with bonuses
        let finalScore = m.relevance_score
        if (locationMatch && finalScore > 0) finalScore = Math.min(finalScore + 5, 100)
        if (sub.preferred && finalScore > 0) finalScore = Math.min(finalScore + 5, 100)
        if (sub.incumbent_status === 'known') finalScore = Math.min(finalScore + 5, 100)

        allMatches.push({
          subcontractor_id: sub.id,
          company_name: sub.company_name,
          matched_categories: m.relevant_categories || [],
          location_match: locationMatch,
          incumbent_status: sub.incumbent_status,
          preferred: sub.preferred,
          match_score: finalScore,
          relevance_reason: m.reason,
        })
      }
    } catch {
      // On AI failure, fall back to basic keyword matching for this batch
      for (const sub of batch) {
        const matchedCats = sub.service_categories.filter(sc =>
          serviceCategories.some(c =>
            c.category.toLowerCase() === sc.toLowerCase()
          )
        )
        if (matchedCats.length === 0) continue

        const locationMatch = sub.geographic_coverage.some(g =>
          g.toUpperCase() === locationState ||
          g.toUpperCase() === 'NATIONWIDE' ||
          g.toUpperCase().includes(locationState)
        )

        let score = Math.round((matchedCats.length / serviceCategories.length) * 60)
        if (locationMatch) score += 10
        if (sub.preferred) score += 10
        if (sub.incumbent_status === 'known') score += 10
        score = Math.min(score, 100)

        allMatches.push({
          subcontractor_id: sub.id,
          company_name: sub.company_name,
          matched_categories: matchedCats,
          location_match: locationMatch,
          incumbent_status: sub.incumbent_status,
          preferred: sub.preferred,
          match_score: score,
          relevance_reason: `Matched categories: ${matchedCats.join(', ')}`,
        })
      }
    }
  }

  return allMatches.sort((a, b) => b.match_score - a.match_score)
}

export async function matchSubcontractorsPerRequirement(
  analysisResult: Record<string, unknown>,
  subcontractors: Array<{ id: string; company_name: string; service_categories: string[]; geographic_coverage: string[]; incumbent_status: string; preferred: boolean }>,
  taskOrderLocation: string,
): Promise<RequirementMatch[]> {
  const serviceCategories = (analysisResult.service_categories as Array<{ category: string; description: string }>) || []

  if (serviceCategories.length === 0 || subcontractors.length === 0) return []

  const subList = subcontractors.map((s, idx) => `${idx + 1}. "${s.company_name}" — services: [${s.service_categories.join(', ')}], coverage: [${s.geographic_coverage.join(', ')}]`).join('\n')

  try {
    const result = await callOpenAI(
      `You are a procurement matching expert. For each project requirement category, find the most relevant subcontractors from the list provided.

For each requirement, evaluate every subcontractor and assign a relevance_score (0-100):
- 80-100: Their services directly address this requirement
- 40-79: Partial overlap
- 0-39: Not relevant to this requirement

Return JSON: { "requirement_matches": [{ "category": string, "description": string, "top_subs": [{ "index": number, "score": number, "reason": string }] }] }

Only include subs with score >= 40 in top_subs. Sort top_subs by score descending. Max 5 subs per requirement.`,
      `PROJECT REQUIREMENTS:\n${serviceCategories.map(c => `- ${c.category}: ${c.description || ''}`).join('\n')}\n\nProject location: ${taskOrderLocation || 'Not specified'}\n\nAVAILABLE SUBCONTRACTORS:\n${subList}`
    )

    const reqMatches = (result.requirement_matches as Array<{ category: string; description: string; top_subs: Array<{ index: number; score: number; reason: string }> }>) || []

    return reqMatches.map(rm => ({
      requirement_category: rm.category,
      requirement_description: rm.description || '',
      matched_subs: (rm.top_subs || [])
        .filter(ts => ts.index >= 1 && ts.index <= subcontractors.length && ts.score >= 40)
        .map(ts => ({
          subcontractor_id: subcontractors[ts.index - 1].id,
          company_name: subcontractors[ts.index - 1].company_name,
          relevance_score: ts.score,
          relevance_reason: ts.reason,
        })),
    }))
  } catch {
    return []
  }
}

export interface DiscoveredBusiness {
  company_name: string
  address: string
  city: string
  state: string
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  categories: string[]
  source: 'google_places'
}

export interface RequirementDiscovery {
  requirement_category: string
  requirement_description: string
  discovered_businesses: DiscoveredBusiness[]
  db_matches_count: number
}

export async function discoverSubsForRequirements(
  analysisResult: Record<string, unknown>,
  taskOrderLocation: string,
  dbMatchCounts?: Record<string, number>,
): Promise<RequirementDiscovery[]> {
  const serviceCategories = (analysisResult.service_categories as Array<{ category: string; description: string }>) || []
  if (serviceCategories.length === 0) return []

  const results: RequirementDiscovery[] = []

  for (const cat of serviceCategories) {
    const dbCount = dbMatchCounts?.[cat.category] ?? 0

    try {
      const res = await fetch('/api/discover-subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat.category,
          scope: 'local',
          location: taskOrderLocation || 'United States',
          radius: 50,
        }),
      })

      if (!res.ok) {
        results.push({
          requirement_category: cat.category,
          requirement_description: cat.description || '',
          discovered_businesses: [],
          db_matches_count: dbCount,
        })
        continue
      }

      const data = await res.json()
      results.push({
        requirement_category: cat.category,
        requirement_description: cat.description || '',
        discovered_businesses: data.results || [],
        db_matches_count: dbCount,
      })
    } catch {
      results.push({
        requirement_category: cat.category,
        requirement_description: cat.description || '',
        discovered_businesses: [],
        db_matches_count: dbCount,
      })
    }
  }

  return results
}

export async function compareTaskOrders(
  currentTexts: string[],
  currentTitle: string,
  priorTexts: string[],
  priorTitle: string,
) {
  const systemPrompt = `You are an expert procurement analyst comparing projects.
Compare the current project against the prior project and identify differences. EVERY difference you report must be directly supported by the document text. Do NOT infer or assume changes — only report what is explicitly different between the two sets of documents.

Return a JSON object with:
- similar_requirements: array of {requirement, current_reference, prior_reference}
- changed_requirements: array of {requirement, current_version, prior_version, change_type}
- added_services: array of {service, details, current_reference}
- removed_services: array of {service, details, prior_reference}
- staffing_changes: array of {role, current, prior, change}
- reporting_changes: array of {requirement, current, prior}
- pricing_structure_changes: array of {item, current, prior}
- repeated_language: array of {section, language_summary}
- prior_questions_relevant: array of {question, still_relevant, notes}
- prior_risks_relevant: array of {risk, still_relevant, notes}
- summary: overall comparison summary paragraph — factual, citing specific differences found`

  const currentText = currentTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC)).join('\n\n')
  const priorText = priorTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC)).join('\n\n')
  const userPrompt = `CURRENT PROJECT: ${currentTitle}\n${currentText}\n\nPRIOR PROJECT: ${priorTitle}\n${priorText}`

  return callOpenAI(systemPrompt, userPrompt, { requestType: 'project_comparison', taskOrderTitle: currentTitle })
}
