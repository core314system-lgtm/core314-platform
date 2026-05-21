import { getProjectType } from './projectTypes'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''
const MODEL = 'gpt-4o-mini'
const MAX_CHARS_PER_DOC = 8000
const MAX_TOTAL_CHARS = 120000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 5000

// Global directive prepended to every AI prompt to enforce factual accuracy
const TRUTH_DIRECTIVE = `ABSOLUTE RULES — VIOLATIONS ARE UNACCEPTABLE:
1. Your job is to EXTRACT information that IS in the documents. Read each document thoroughly and extract every fact, requirement, specification, date, quantity, and detail you find. Be thorough — extract MORE, not less.
2. NEVER ADD information that is NOT in the documents. Do not fabricate, assume, infer, or guess. If the documents say "Facility Manager" and no other staffing roles, then the ONLY staffing role is Facility Manager. Do not invent additional staff, positions, or resources.
3. NEVER use speculative language like "may require", "will likely need", "additional staff as needed", "depending on scope", or "exact number will depend on." If the document doesn't say it, don't say it.
4. When documents describe a subcontracted service model (subcontractors perform the work, a Facility Manager manages them), state that EXACTLY. Do not imply the prime contractor has direct employees performing services unless the documents explicitly say so.
5. If information is missing from the documents (e.g., quantities not listed, frequencies not specified), flag it as "Not specified in documents" — do NOT fill the gap with your own guess.
6. Quantities, counts, measurements, and frequencies must come EXACTLY from the documents. Never estimate or round.
7. Each SOW document covers a specific trade — analyze them individually. Extract the specific requirements, tasks, and frequencies from each SOW.
8. DOCUMENT SOURCE CITATIONS — MANDATORY FOR EVERY EXTRACTED FACT:
   - The document text includes [Page N] markers showing where each page starts. USE THESE to determine page numbers.
   - For EVERY fact, requirement, or data point you extract, you MUST provide:
     a) source_document: the exact filename of the document
     b) page_section: a precise citation in the format "Page X, Section Y.Z" or "Page X, Paragraph N" or "Page X" at minimum
   - If a section heading is visible in the text (e.g., "3.2 HVAC Maintenance"), include it: "Page 5, Section 3.2 — HVAC Maintenance"
   - If you can identify a paragraph or list item number, include it: "Page 5, Section 3.2, Item (c)"
   - NEVER leave page_section as empty, generic ("Various"), or vague ("Throughout document"). Every citation must reference at least a specific page number.
   - For Excel/pricing sheet documents, cite the sheet name and cell range: "Sheet: Pricing, Row 15-20" or "Sheet: Labor Rates, Column B"

`

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n[... content truncated for analysis ...]\n\n' + text.slice(-half)
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Contact your administrator.')
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: TRUTH_DIRECTIVE + systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 16384,
      }),
    })

    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw new Error('Rate limit exceeded. Please wait a minute and try again.')
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`AI analysis error: ${err}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    return JSON.parse(content)
  }

  throw new Error('Failed after maximum retries')
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
Analyze the provided project documents and extract ONLY information that is EXPLICITLY stated in the documents.

IMPORTANT: You MUST populate the "requirements" array with individual requirements extracted DIRECTLY from the documents. Each task, inspection, service standard, staffing requirement, reporting obligation, safety protocol, or compliance item should be its own requirement entry. Use the EXACT language from the documents wherever possible.

Extract project metadata ONLY if explicitly stated in the documents:
- task_order_metadata: {title, solicitation_number, task_order_number, contract_number, contract_vehicle, site_name, location_city, location_state, contracting_officer, co_email, co_phone, period_of_performance_start, period_of_performance_end, pop_total_duration, pop_base_period, pop_option_periods, pop_structure_summary, estimated_value, naics_code, set_aside, response_due_date}

PERIOD OF PERFORMANCE (PoP) EXTRACTION — CRITICAL:
- period_of_performance_start: the START date of the BASE period (first day of performance)
- period_of_performance_end: the END date of the ENTIRE contract including ALL option periods (last possible day)
- pop_total_duration: total duration of the FULL contract including all options (e.g., "6 years")
- pop_base_period: description of the base period with dates (e.g., "2-year base period: October 1, 2026 — September 30, 2028")
- pop_option_periods: array of each option period with dates (e.g., ["Option Period 1 (2 years): October 1, 2028 — September 30, 2030", "Option Period 2 (2 years): October 1, 2030 — September 30, 2032"])
- pop_structure_summary: concise summary like "6-year PoP: 2-year base + two 2-year option periods"
- You MUST distinguish between the base period and option periods. Do NOT report only the base period dates as if they are the full PoP. Search ALL documents for option period language, ordering period references, and contract duration details.

Return a JSON object with these keys:
- task_order_metadata: object with the fields above (use null for any field NOT EXPLICITLY found in documents — do NOT guess)
- requirements: array of {requirement, source_document, page_section, service_category, frequency, equipment_needed, staffing_needed, compliance_type, risk_level} — every field must come from the documents or be marked "Not specified". The page_section field MUST reference a specific page number from the [Page N] markers in the document text (e.g., "Page 3, Section 2.1 — Elevator Maintenance"). Never use vague references like "Various" or "General".
- service_categories: array of {category, description, subcontractor_heavy, estimated_scope} — categories must match what the documents describe, not what you think should exist
- staffing_requirements: array of {role, count, qualifications, certifications_needed, source_document} — ONLY roles explicitly mentioned in the documents. If documents say "Facility Manager" and no other positions, that is the ONLY entry. Do NOT add roles that are not in the documents.
- compliance_items: array of {requirement, source_document, section, responsible_party, status, risk_level, notes}
- unclear_items: array of {issue, source_document, section, suggested_clarification} — flag anything ambiguous or missing from the documents
- pricing_alignment_issues: array of {issue, source_document, pricing_sheet_reference, risk_level}
- key_dates: array of {date, description, source_document}
- summary: string — factual overview using ONLY what the documents state. MUST include the full Period of Performance structure (base period AND option periods with dates, e.g., "6-year PoP: 2-year base period (Oct 2026 — Sep 2028) with two 2-year option periods"). Do NOT state only the base period as if it is the full PoP. Do NOT add context, industry knowledge, or assumptions.`

  const userPrompt = `Project: ${taskOrderTitle}\nSite/Location: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
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
  return callOpenAI(systemPrompt, userPrompt)
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
  return callOpenAI(systemPrompt, userPrompt)
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
  return callOpenAI(systemPrompt, userPrompt)
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
  return callOpenAI(systemPrompt, userPrompt)
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
  return callOpenAI(systemPrompt, userPrompt)
}

export async function matchSubcontractors(
  analysisResult: Record<string, unknown>,
  subcontractors: Array<{ id: string; company_name: string; service_categories: string[]; geographic_coverage: string[]; incumbent_status: string; preferred: boolean }>,
  taskOrderLocation: string,
) {
  const serviceCategories = (analysisResult.service_categories as Array<{ category: string }>) || []
  const categories = serviceCategories.map(c => c.category)

  const matches: Array<{
    subcontractor_id: string
    company_name: string
    matched_categories: string[]
    location_match: boolean
    incumbent_status: string
    preferred: boolean
    match_score: number
  }> = []

  const locationState = taskOrderLocation?.split(',').pop()?.trim().toUpperCase() || ''

  for (const sub of subcontractors) {
    const matchedCats = sub.service_categories.filter(sc =>
      categories.some(c => c.toLowerCase().includes(sc.toLowerCase()) || sc.toLowerCase().includes(c.toLowerCase()))
    )
    const locationMatch = sub.geographic_coverage.some(g =>
      g.toUpperCase() === locationState ||
      g.toUpperCase() === 'NATIONWIDE' ||
      g.toUpperCase().includes(locationState)
    )

    if (matchedCats.length > 0) {
      let score = matchedCats.length * 25
      if (locationMatch) score += 20
      if (sub.preferred) score += 15
      if (sub.incumbent_status === 'known') score += 10
      if (sub.incumbent_status === 'suspected') score += 5
      score = Math.min(score, 100)

      matches.push({
        subcontractor_id: sub.id,
        company_name: sub.company_name,
        matched_categories: matchedCats,
        location_match: locationMatch,
        incumbent_status: sub.incumbent_status,
        preferred: sub.preferred,
        match_score: score,
      })
    }
  }

  return matches.sort((a, b) => b.match_score - a.match_score)
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

  return callOpenAI(systemPrompt, userPrompt)
}
